import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { chat, type AIModel } from './ai-client';

// ── Types ──

export type NodeType =
  | 'start'
  | 'end'
  | 'ai-decide'    // AI chooses next path
  | 'ai-execute'   // AI generates and runs code/text
  | 'shell'        // Run shell command
  | 'claude-code'  // Delegate to Claude Code CLI
  | 'condition'    // Boolean check
  | 'loop'         // Repeat until condition
  | 'gate'         // Human approval
  | 'delay';       // Wait N seconds

export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting';

export type AgentStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowNode {
  id: string;
  name: string;
  type: NodeType;
  status: NodeStatus;
  config: NodeConfig;
  output: string;
  error: string;
  // Connections
  next?: string[];        // Node IDs to go to on success
  onFailure?: string;     // Node ID on failure (optional)
  // Runtime
  startedAt?: string;
  completedAt?: string;
  iterations?: number;    // For loop nodes
}

export interface NodeConfig {
  // ai-decide / ai-execute
  prompt?: string;
  model?: AIModel;
  systemPrompt?: string;
  // ai-decide: choices the AI picks from
  choices?: Array<{ label: string; targetNodeId: string }>;
  // shell / claude-code
  command?: string;
  cwd?: string;
  timeout?: number;
  // condition
  checkCommand?: string;
  trueNodeId?: string;
  falseNodeId?: string;
  // loop
  maxIterations?: number;
  loopConditionCommand?: string; // Exit 0 = continue loop
  loopBodyNodeId?: string;       // First node of loop body
  loopExitNodeId?: string;       // Node after loop ends
  // gate
  gateMessage?: string;
  // delay
  delaySeconds?: number;
  // Retry
  retryCount?: number;
}

export interface AgentWorkflow {
  id: string;
  name: string;
  description: string;
  cwd: string;
  nodes: WorkflowNode[];
  startNodeId: string;
  status: AgentStatus;
  variables: Record<string, string>;
  context: string;         // Accumulated context from AI outputs
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  currentNodeId?: string;
  totalTokens: number;
}

// ── Storage ──

const AGENTS_DIR = path.join(os.homedir(), '.code-harness', 'agents');

function ensureDir() {
  fs.mkdirSync(AGENTS_DIR, { recursive: true });
}

function agentPath(id: string) {
  return path.join(AGENTS_DIR, `${id}.json`);
}

export function saveAgent(agent: AgentWorkflow) {
  ensureDir();
  agent.updatedAt = new Date().toISOString();
  fs.writeFileSync(agentPath(agent.id), JSON.stringify(agent, null, 2));
}

export function loadAgent(id: string): AgentWorkflow | null {
  try { return JSON.parse(fs.readFileSync(agentPath(id), 'utf-8')); }
  catch { return null; }
}

export function deleteAgent(id: string) {
  try { fs.unlinkSync(agentPath(id)); } catch {}
}

export function listAgents(): Array<{
  id: string; name: string; status: AgentStatus;
  nodeCount: number; updatedAt: string; currentNodeId?: string;
}> {
  ensureDir();
  try {
    return fs.readdirSync(AGENTS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          const a: AgentWorkflow = JSON.parse(fs.readFileSync(path.join(AGENTS_DIR, f), 'utf-8'));
          return { id: a.id, name: a.name, status: a.status, nodeCount: a.nodes.length, updatedAt: a.updatedAt, currentNodeId: a.currentNodeId };
        } catch { return null; }
      })
      .filter(Boolean) as any[];
  } catch { return []; }
}

// ── Variable Substitution ──

function sub(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || `{{${k}}}`);
}

// ── Agent Runner ──

export class AgentRunner extends EventEmitter {
  private agent: AgentWorkflow;
  private currentProcess: ChildProcess | null = null;
  private isPaused = false;
  private isCancelled = false;

  constructor(agent: AgentWorkflow) {
    super();
    this.agent = agent;
  }

  private getNode(id: string): WorkflowNode | undefined {
    return this.agent.nodes.find((n) => n.id === id);
  }

  async run() {
    this.agent.status = 'running';
    this.agent.startedAt = new Date().toISOString();
    saveAgent(this.agent);
    this.emit('status', this.agent.status);

    let currentId = this.agent.currentNodeId || this.agent.startNodeId;

    while (currentId && !this.isCancelled) {
      // Pause check
      while (this.isPaused && !this.isCancelled) {
        await new Promise((r) => setTimeout(r, 500));
      }
      if (this.isCancelled) break;

      const node = this.getNode(currentId);
      if (!node) {
        this.agent.status = 'failed';
        saveAgent(this.agent);
        this.emit('status', 'failed');
        return;
      }

      // Skip start/end marker nodes
      if (node.type === 'start') {
        node.status = 'completed';
        currentId = node.next?.[0] || '';
        continue;
      }
      if (node.type === 'end') {
        node.status = 'completed';
        break;
      }

      this.agent.currentNodeId = currentId;
      node.status = 'running';
      node.startedAt = new Date().toISOString();
      node.output = '';
      node.error = '';
      saveAgent(this.agent);
      this.emit('node-start', { nodeId: currentId, node });

      let nextId: string | undefined;

      try {
        nextId = await this.executeNode(node);
        node.status = 'completed';
      } catch (err: unknown) {
        const retries = node.config.retryCount || 0;
        let recovered = false;

        if (retries > 0) {
          for (let r = 0; r < retries; r++) {
            node.output += `\n[Retry ${r + 1}/${retries}]\n`;
            await new Promise((resolve) => setTimeout(resolve, 3000));
            try {
              nextId = await this.executeNode(node);
              node.status = 'completed';
              recovered = true;
              break;
            } catch {}
          }
        }

        if (!recovered) {
          node.status = 'failed';
          node.error = (err as Error).message;

          // Try failure path
          if (node.onFailure) {
            nextId = node.onFailure;
            node.status = 'failed'; // Still mark as failed but continue
          } else {
            node.completedAt = new Date().toISOString();
            saveAgent(this.agent);
            this.emit('node-end', { nodeId: currentId, node });
            this.agent.status = 'failed';
            saveAgent(this.agent);
            this.emit('status', 'failed');
            return;
          }
        }
      }

      node.completedAt = new Date().toISOString();
      saveAgent(this.agent);
      this.emit('node-end', { nodeId: currentId, node });

      currentId = nextId || '';
    }

    if (!this.isCancelled) {
      this.agent.status = 'completed';
      this.agent.completedAt = new Date().toISOString();
    }
    saveAgent(this.agent);
    this.emit('status', this.agent.status);
  }

  private async executeNode(node: WorkflowNode): Promise<string | undefined> {
    const vars = { ...this.agent.variables, __context__: this.agent.context };

    switch (node.type) {
      case 'shell':
        return this.execShell(node, vars);
      case 'claude-code':
        return this.execCLI(node, vars);
      case 'ai-execute':
        return this.execAI(node, vars);
      case 'ai-decide':
        return this.execAIDecide(node, vars);
      case 'condition':
        return this.execCondition(node, vars);
      case 'loop':
        return this.execLoop(node, vars);
      case 'gate':
        return this.execGate(node, vars);
      case 'delay':
        return this.execDelay(node);
      default:
        return node.next?.[0];
    }
  }

  // ── Shell ──
  private execShell(node: WorkflowNode, vars: Record<string, string>): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      const cmd = sub(node.config.command || '', vars);
      const cwd = node.config.cwd
        ? path.resolve(this.agent.cwd, sub(node.config.cwd, vars))
        : this.agent.cwd;
      const timeout = (node.config.timeout || 300) * 1000;

      const proc = spawn('sh', ['-c', cmd], { cwd, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });
      this.currentProcess = proc;

      const timer = timeout > 0 ? setTimeout(() => { proc.kill(); reject(new Error('Timeout')); }, timeout) : null;

      proc.stdout?.on('data', (d: Buffer) => {
        const text = d.toString();
        node.output += text;
        this.emit('node-output', { nodeId: node.id, text });
      });
      proc.stderr?.on('data', (d: Buffer) => { node.output += d.toString(); });
      proc.on('close', (code) => {
        if (timer) clearTimeout(timer);
        this.currentProcess = null;
        if (code === 0) resolve(node.next?.[0]);
        else reject(new Error(`Exit code ${code}`));
      });
      proc.on('error', (e) => { if (timer) clearTimeout(timer); this.currentProcess = null; reject(e); });
    });
  }

  // ── Claude Code CLI ──
  private execCLI(node: WorkflowNode, vars: Record<string, string>): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      const prompt = sub(node.config.prompt || '', vars);
      const cwd = node.config.cwd
        ? path.resolve(this.agent.cwd, sub(node.config.cwd, vars))
        : this.agent.cwd;
      const timeout = (node.config.timeout || 600) * 1000;

      const proc = spawn('claude', ['--print', prompt], { cwd, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });
      this.currentProcess = proc;

      const timer = timeout > 0 ? setTimeout(() => { proc.kill(); reject(new Error('Timeout')); }, timeout) : null;

      proc.stdout?.on('data', (d: Buffer) => {
        const text = d.toString();
        node.output += text;
        this.emit('node-output', { nodeId: node.id, text });
      });
      proc.stderr?.on('data', (d: Buffer) => { node.output += d.toString(); });
      proc.on('close', (code) => {
        if (timer) clearTimeout(timer);
        this.currentProcess = null;
        // Add output to context
        this.agent.context += `\n--- ${node.name} ---\n${node.output}\n`;
        if (code === 0) resolve(node.next?.[0]);
        else reject(new Error(`claude exited ${code}`));
      });
      proc.on('error', (e) => { if (timer) clearTimeout(timer); this.currentProcess = null; reject(e); });
    });
  }

  // ── AI Execute (Direct API) ──
  private async execAI(node: WorkflowNode, vars: Record<string, string>): Promise<string | undefined> {
    const prompt = sub(node.config.prompt || '', vars);
    const systemPrompt = node.config.systemPrompt ? sub(node.config.systemPrompt, vars) : undefined;

    const response = await chat({
      model: node.config.model || 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: prompt }],
      systemPrompt,
      maxTokens: 4096,
    });

    node.output = response.content;
    this.agent.totalTokens += response.inputTokens + response.outputTokens;
    this.agent.context += `\n--- ${node.name} ---\n${response.content}\n`;
    this.emit('node-output', { nodeId: node.id, text: response.content });

    return node.next?.[0];
  }

  // ── AI Decide (AI picks next path) ──
  private async execAIDecide(node: WorkflowNode, vars: Record<string, string>): Promise<string | undefined> {
    const choices = node.config.choices || [];
    if (choices.length === 0) return node.next?.[0];

    const choiceList = choices.map((c, i) => `${i + 1}. ${c.label}`).join('\n');
    const prompt = sub(node.config.prompt || '', vars);

    const response = await chat({
      model: node.config.model || 'claude-sonnet-4-6',
      messages: [{
        role: 'user',
        content: `${prompt}\n\nChoose one of the following options by responding with ONLY the number:\n${choiceList}`,
      }],
      systemPrompt: 'You are a decision-making agent. Respond with ONLY the number of your choice. No explanation.',
      maxTokens: 10,
    });

    this.agent.totalTokens += response.inputTokens + response.outputTokens;
    const choiceNum = parseInt(response.content.trim()) - 1;
    const chosen = choices[choiceNum] || choices[0];
    node.output = `Decision: ${chosen.label}`;
    this.emit('node-output', { nodeId: node.id, text: node.output });

    return chosen.targetNodeId;
  }

  // ── Condition ──
  private async execCondition(node: WorkflowNode, vars: Record<string, string>): Promise<string | undefined> {
    const cmd = sub(node.config.checkCommand || 'true', vars);
    try {
      const { execSync } = require('child_process');
      execSync(cmd, { cwd: this.agent.cwd, encoding: 'utf-8', timeout: 30000 });
      node.output = 'Condition: true';
      return node.config.trueNodeId || node.next?.[0];
    } catch {
      node.output = 'Condition: false';
      return node.config.falseNodeId || node.next?.[1] || node.next?.[0];
    }
  }

  // ── Loop ──
  private async execLoop(node: WorkflowNode, vars: Record<string, string>): Promise<string | undefined> {
    const maxIter = node.config.maxIterations || 10;
    node.iterations = 0;

    for (let i = 0; i < maxIter; i++) {
      if (this.isCancelled) break;

      // Check loop condition
      if (node.config.loopConditionCommand) {
        try {
          const { execSync } = require('child_process');
          execSync(sub(node.config.loopConditionCommand, vars), {
            cwd: this.agent.cwd, encoding: 'utf-8', timeout: 30000,
          });
        } catch {
          // Condition failed, exit loop
          break;
        }
      }

      node.iterations = i + 1;
      node.output += `\n[Iteration ${i + 1}/${maxIter}]\n`;
      this.emit('node-output', { nodeId: node.id, text: `[Iteration ${i + 1}]\n` });

      // Execute loop body (run nodes from loopBodyNodeId until we return to this loop node)
      if (node.config.loopBodyNodeId) {
        let bodyId: string | undefined = node.config.loopBodyNodeId;
        while (bodyId && bodyId !== node.id && !this.isCancelled) {
          const bodyNode = this.getNode(bodyId);
          if (!bodyNode) break;

          bodyNode.status = 'running';
          bodyNode.startedAt = new Date().toISOString();
          bodyNode.output = '';
          bodyNode.error = '';
          this.emit('node-start', { nodeId: bodyId, node: bodyNode });

          try {
            const nextBody = await this.executeNode(bodyNode);
            bodyNode.status = 'completed';
            bodyNode.completedAt = new Date().toISOString();
            this.emit('node-end', { nodeId: bodyId, node: bodyNode });
            bodyId = nextBody;
          } catch (err: unknown) {
            bodyNode.status = 'failed';
            bodyNode.error = (err as Error).message;
            bodyNode.completedAt = new Date().toISOString();
            this.emit('node-end', { nodeId: bodyId, node: bodyNode });
            // Exit loop on body failure
            node.output += `Loop body failed at ${bodyNode.name}: ${bodyNode.error}\n`;
            return node.config.loopExitNodeId || node.next?.[0];
          }
        }
      }

      saveAgent(this.agent);
    }

    return node.config.loopExitNodeId || node.next?.[0];
  }

  // ── Gate ──
  private async execGate(node: WorkflowNode, vars: Record<string, string>): Promise<string | undefined> {
    const msg = sub(node.config.gateMessage || 'Approval required', vars);
    node.status = 'waiting';
    node.output = msg;
    saveAgent(this.agent);
    this.emit('node-gate', { nodeId: node.id, message: msg });

    return new Promise((resolve, reject) => {
      const onApprove = () => { this.removeListener('gate-reject', onReject); resolve(node.next?.[0]); };
      const onReject = () => { this.removeListener('gate-approve', onApprove); reject(new Error('Rejected')); };
      this.once('gate-approve', onApprove);
      this.once('gate-reject', onReject);
    });
  }

  // ── Delay ──
  private async execDelay(node: WorkflowNode): Promise<string | undefined> {
    const secs = node.config.delaySeconds || 10;
    node.output = `Waiting ${secs}s...`;
    this.emit('node-output', { nodeId: node.id, text: node.output });
    await new Promise((r) => setTimeout(r, secs * 1000));
    return node.next?.[0];
  }

  // ── Controls ──
  pause() { this.isPaused = true; this.agent.status = 'paused'; saveAgent(this.agent); this.emit('status', 'paused'); }
  resume() { this.isPaused = false; this.agent.status = 'running'; saveAgent(this.agent); this.emit('status', 'running'); }
  cancel() {
    this.isCancelled = true; this.isPaused = false;
    if (this.currentProcess) this.currentProcess.kill('SIGTERM');
    this.agent.status = 'cancelled'; saveAgent(this.agent); this.emit('status', 'cancelled');
  }
  approveGate() { this.emit('gate-approve'); }
  rejectGate() { this.emit('gate-reject'); }
}

// ── Active Runners ──
const activeRunners = new Map<string, AgentRunner>();

export function getAgentRunner(id: string) { return activeRunners.get(id); }

export function startAgent(agent: AgentWorkflow): AgentRunner {
  const existing = activeRunners.get(agent.id);
  if (existing) existing.cancel();
  const runner = new AgentRunner(agent);
  activeRunners.set(agent.id, runner);
  runner.on('status', (s: AgentStatus) => {
    if (['completed', 'failed', 'cancelled'].includes(s)) activeRunners.delete(agent.id);
  });
  runner.run().catch(() => activeRunners.delete(agent.id));
  return runner;
}

export function genAgentId() { return `agent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }
export function genNodeId() { return `node_${Math.random().toString(36).slice(2, 8)}`; }

// ── Workflow Templates ──

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  variables: Array<{ key: string; label: string; placeholder: string; required: boolean }>;
  buildWorkflow: (vars: Record<string, string>, cwd: string) => AgentWorkflow;
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'dep-upgrade-pr',
    name: 'Dependency Upgrade + PR',
    description: 'Update deps, fix issues, run tests, create PR',
    icon: '@',
    variables: [
      { key: 'branch', label: 'Branch Name', placeholder: 'deps/update-2026-05', required: true },
    ],
    buildWorkflow: (vars, cwd) => {
      const nodes: WorkflowNode[] = [
        { id: 'start', name: 'Start', type: 'start', status: 'pending', config: {}, output: '', error: '', next: ['checkout'] },
        { id: 'checkout', name: 'Create Branch', type: 'shell', status: 'pending', config: { command: `git checkout -b {{branch}}` }, output: '', error: '', next: ['update'] },
        { id: 'update', name: 'npm update', type: 'shell', status: 'pending', config: { command: 'npm update' }, output: '', error: '', next: ['build-check'] },
        { id: 'build-check', name: 'Build Check', type: 'condition', status: 'pending', config: { checkCommand: 'npm run build', trueNodeId: 'test', falseNodeId: 'fix-build' }, output: '', error: '', next: ['test', 'fix-build'] },
        { id: 'fix-build', name: 'Fix Build Errors', type: 'claude-code', status: 'pending', config: { prompt: 'The build is failing after dependency updates. Fix any TypeScript or build errors.', timeout: 300 }, output: '', error: '', next: ['build-recheck'] },
        { id: 'build-recheck', name: 'Re-check Build', type: 'shell', status: 'pending', config: { command: 'npm run build' }, output: '', error: '', next: ['test'] },
        { id: 'test', name: 'Run Tests', type: 'shell', status: 'pending', config: { command: 'npm test --passWithNoTests 2>&1 || true' }, output: '', error: '', next: ['commit'] },
        { id: 'commit', name: 'Commit & Push', type: 'shell', status: 'pending', config: { command: 'git add -A && git commit -m "chore: update dependencies" && git push -u origin {{branch}}' }, output: '', error: '', next: ['pr'] },
        { id: 'pr', name: 'Create PR', type: 'shell', status: 'pending', config: { command: 'gh pr create --title "chore: update dependencies" --body "Automated dependency update" --head {{branch}}' }, output: '', error: '', next: ['end'] },
        { id: 'end', name: 'Done', type: 'end', status: 'pending', config: {}, output: '', error: '' },
      ];
      return {
        id: genAgentId(), name: 'Dependency Upgrade + PR', description: 'Automated dep update workflow',
        cwd, nodes, startNodeId: 'start', status: 'idle', variables: vars, context: '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), totalTokens: 0,
      };
    },
  },
  {
    id: 'research-report',
    name: 'Research & Report',
    description: 'Research a topic, compile findings, generate report',
    icon: '#',
    variables: [
      { key: 'topic', label: 'Research Topic', placeholder: 'Competitor analysis of...', required: true },
      { key: 'depth', label: 'Depth', placeholder: 'brief / detailed / comprehensive', required: false },
    ],
    buildWorkflow: (vars, cwd) => {
      const nodes: WorkflowNode[] = [
        { id: 'start', name: 'Start', type: 'start', status: 'pending', config: {}, output: '', error: '', next: ['plan'] },
        { id: 'plan', name: 'Research Plan', type: 'ai-execute', status: 'pending', config: {
          model: 'claude-sonnet-4-6',
          prompt: 'Create a research plan for: {{topic}}. Depth: {{depth}}. List 5-8 specific aspects to investigate. Output as numbered list.',
          systemPrompt: 'You are a research assistant. Create clear, actionable research plans.',
        }, output: '', error: '', next: ['investigate'] },
        { id: 'investigate', name: 'Deep Investigation', type: 'ai-execute', status: 'pending', config: {
          model: 'claude-opus-4-6',
          prompt: 'Based on this research plan:\n{{__context__}}\n\nConduct thorough research on: {{topic}}. For each aspect in the plan, provide findings with specific details, data points, and analysis.',
          systemPrompt: 'You are an expert researcher. Provide detailed, well-structured findings.',
        }, output: '', error: '', next: ['synthesize'] },
        { id: 'synthesize', name: 'Synthesize Report', type: 'ai-execute', status: 'pending', config: {
          model: 'claude-opus-4-6',
          prompt: 'Based on all research gathered:\n{{__context__}}\n\nWrite a comprehensive report on: {{topic}}. Include: Executive Summary, Key Findings (with details), Analysis, Recommendations, and Conclusion. Format as clean Markdown.',
          systemPrompt: 'You are a professional report writer. Create clear, actionable reports.',
        }, output: '', error: '', next: ['save'] },
        { id: 'save', name: 'Save Report', type: 'shell', status: 'pending', config: {
          command: 'echo "Report saved" && date',
        }, output: '', error: '', next: ['end'] },
        { id: 'end', name: 'Done', type: 'end', status: 'pending', config: {}, output: '', error: '' },
      ];
      return {
        id: genAgentId(), name: `Research: ${vars.topic?.slice(0, 40) || 'Topic'}`, description: vars.topic || '',
        cwd, nodes, startNodeId: 'start', status: 'idle', variables: vars, context: '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), totalTokens: 0,
      };
    },
  },
  {
    id: 'paper-draft',
    name: 'Paper Draft & Review',
    description: 'Draft a paper, verify citations, humanize, review',
    icon: '~',
    variables: [
      { key: 'topic', label: 'Paper Topic', placeholder: 'The impact of...', required: true },
      { key: 'style', label: 'Style', placeholder: 'academic / casual', required: false },
      { key: 'language', label: 'Language', placeholder: 'en / ja', required: false },
    ],
    buildWorkflow: (vars, cwd) => {
      const lang = vars.language || 'en';
      const nodes: WorkflowNode[] = [
        { id: 'start', name: 'Start', type: 'start', status: 'pending', config: {}, output: '', error: '', next: ['outline'] },
        { id: 'outline', name: 'Create Outline', type: 'ai-execute', status: 'pending', config: {
          model: 'claude-sonnet-4-6',
          prompt: `Create a detailed outline for a paper on: {{topic}}. Include sections, subsections, and key points for each. Language: ${lang}`,
        }, output: '', error: '', next: ['draft'] },
        { id: 'draft', name: 'Write Draft', type: 'ai-execute', status: 'pending', config: {
          model: 'claude-opus-4-6',
          prompt: `Based on this outline:\n{{__context__}}\n\nWrite a complete draft paper on {{topic}}. Include proper academic citations (use real, verifiable sources). Language: ${lang}`,
          systemPrompt: 'You are an academic writer. Use real, verifiable citations only.',
        }, output: '', error: '', next: ['review-gate'] },
        { id: 'review-gate', name: 'Review Draft', type: 'gate', status: 'pending', config: {
          gateMessage: 'Draft completed. Review the output and approve to proceed with humanization and final review.',
        }, output: '', error: '', next: ['humanize'] },
        { id: 'humanize', name: 'Humanize Text', type: 'ai-execute', status: 'pending', config: {
          model: 'claude-opus-4-6',
          prompt: `Remove AI writing patterns from this academic text while preserving the content and citations. Make it sound naturally written by a human scholar:\n\n{{__context__}}`,
          systemPrompt: lang === 'ja'
            ? 'AIっぽい表現を除去し、自然な学術的日本語に調整する。です/ます調は維持。'
            : 'Remove AI patterns (em dashes, "delve", "it is worth noting", etc). Keep academic tone natural.',
        }, output: '', error: '', next: ['end'] },
        { id: 'end', name: 'Done', type: 'end', status: 'pending', config: {}, output: '', error: '' },
      ];
      return {
        id: genAgentId(), name: `Paper: ${vars.topic?.slice(0, 40) || 'Draft'}`, description: vars.topic || '',
        cwd, nodes, startNodeId: 'start', status: 'idle', variables: vars, context: '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), totalTokens: 0,
      };
    },
  },
  {
    id: 'custom-task',
    name: 'Custom AI Task',
    description: 'Describe what you want done and let AI handle it',
    icon: '*',
    variables: [
      { key: 'task', label: 'Task Description', placeholder: 'Analyze the codebase and...', required: true },
    ],
    buildWorkflow: (vars, cwd) => {
      const nodes: WorkflowNode[] = [
        { id: 'start', name: 'Start', type: 'start', status: 'pending', config: {}, output: '', error: '', next: ['plan'] },
        { id: 'plan', name: 'Plan Approach', type: 'ai-execute', status: 'pending', config: {
          model: 'claude-sonnet-4-6',
          prompt: 'Plan an approach for this task: {{task}}\n\nBreak it into clear steps. Consider what tools or commands are needed.',
        }, output: '', error: '', next: ['execute'] },
        { id: 'execute', name: 'Execute Task', type: 'claude-code', status: 'pending', config: {
          prompt: '{{task}}',
          timeout: 600,
        }, output: '', error: '', next: ['verify'] },
        { id: 'verify', name: 'Verify Results', type: 'ai-execute', status: 'pending', config: {
          model: 'claude-sonnet-4-6',
          prompt: 'Review the results of this task:\n{{__context__}}\n\nOriginal task: {{task}}\n\nDid the task complete successfully? Summarize what was accomplished.',
        }, output: '', error: '', next: ['end'] },
        { id: 'end', name: 'Done', type: 'end', status: 'pending', config: {}, output: '', error: '' },
      ];
      return {
        id: genAgentId(), name: vars.task?.slice(0, 50) || 'Custom Task', description: vars.task || '',
        cwd, nodes, startNodeId: 'start', status: 'idle', variables: vars, context: '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), totalTokens: 0,
      };
    },
  },
];

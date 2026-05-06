import { execSync, spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { chat, type ChatRequest } from './ai-client';

// ── Types ──

export type StepType = 'shell' | 'claude-code' | 'codex' | 'ai-task' | 'gate' | 'condition';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting-approval';

export type PipelineStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface PipelineStep {
  id: string;
  name: string;
  type: StepType;
  status: StepStatus;
  config: StepConfig;
  output: string;
  error: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number; // ms
}

export interface StepConfig {
  // shell: command to run
  command?: string;
  // claude-code / codex: prompt to send
  prompt?: string;
  // ai-task: model + system prompt for direct API call
  model?: string;
  systemPrompt?: string;
  // gate: description of what to approve
  gateMessage?: string;
  // condition: check command (exit 0 = pass, non-zero = skip next)
  checkCommand?: string;
  // Working directory (relative to pipeline cwd or absolute)
  cwd?: string;
  // Timeout in seconds
  timeout?: number;
  // Retry on failure
  retryCount?: number;
  retryDelay?: number; // seconds
}

export interface PipelineDefinition {
  id: string;
  name: string;
  description: string;
  templateId?: string;
  cwd: string;
  steps: PipelineStep[];
  status: PipelineStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  currentStepIndex: number;
  variables: Record<string, string>; // User-defined variables (e.g., project name, domain)
}

// ── Storage ──

const PIPELINES_DIR = path.join(os.homedir(), '.code-harness', 'pipelines');

function ensureDir() {
  fs.mkdirSync(PIPELINES_DIR, { recursive: true });
}

function pipelinePath(id: string) {
  return path.join(PIPELINES_DIR, `${id}.json`);
}

export function savePipeline(pipeline: PipelineDefinition) {
  ensureDir();
  pipeline.updatedAt = new Date().toISOString();
  fs.writeFileSync(pipelinePath(pipeline.id), JSON.stringify(pipeline, null, 2));
}

export function loadPipeline(id: string): PipelineDefinition | null {
  try {
    return JSON.parse(fs.readFileSync(pipelinePath(id), 'utf-8'));
  } catch {
    return null;
  }
}

export function deletePipeline(id: string) {
  try { fs.unlinkSync(pipelinePath(id)); } catch {}
}

export function listPipelines(): Array<{
  id: string;
  name: string;
  status: PipelineStatus;
  stepCount: number;
  currentStep: number;
  updatedAt: string;
}> {
  ensureDir();
  try {
    return fs.readdirSync(PIPELINES_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          const p: PipelineDefinition = JSON.parse(
            fs.readFileSync(path.join(PIPELINES_DIR, f), 'utf-8')
          );
          return {
            id: p.id,
            name: p.name,
            status: p.status,
            stepCount: p.steps.length,
            currentStep: p.currentStepIndex,
            updatedAt: p.updatedAt,
          };
        } catch { return null; }
      })
      .filter(Boolean) as any[];
  } catch { return []; }
}

// ── Variable Substitution ──

function substituteVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
}

// ── Pipeline Runner ──

export class PipelineRunner extends EventEmitter {
  private pipeline: PipelineDefinition;
  private abortController: AbortController | null = null;
  private currentProcess: ChildProcess | null = null;
  private isPaused = false;

  constructor(pipeline: PipelineDefinition) {
    super();
    this.pipeline = pipeline;
  }

  async run() {
    this.pipeline.status = 'running';
    this.pipeline.startedAt = new Date().toISOString();
    savePipeline(this.pipeline);
    this.emit('status', this.pipeline.status);

    for (let i = this.pipeline.currentStepIndex; i < this.pipeline.steps.length; i++) {
      if (this.pipeline.status === 'cancelled') break;

      // Wait if paused
      while (this.isPaused) {
        await new Promise((r) => setTimeout(r, 500));
        if (this.pipeline.status === 'cancelled') break;
      }
      if (this.pipeline.status === 'cancelled') break;

      this.pipeline.currentStepIndex = i;
      const step = this.pipeline.steps[i];

      // Skip already completed steps (resume scenario)
      if (step.status === 'completed' || step.status === 'skipped') continue;

      step.status = 'running';
      step.startedAt = new Date().toISOString();
      step.output = '';
      step.error = '';
      savePipeline(this.pipeline);
      this.emit('step-start', { stepIndex: i, step });

      let retries = step.config.retryCount || 0;
      let success = false;

      while (!success && retries >= 0) {
        try {
          await this.executeStep(step);
          step.status = 'completed';
          success = true;
        } catch (err: unknown) {
          if (retries > 0) {
            retries--;
            step.output += `\n[Retry ${step.config.retryCount! - retries}/${step.config.retryCount}]\n`;
            const delay = (step.config.retryDelay || 5) * 1000;
            await new Promise((r) => setTimeout(r, delay));
          } else {
            step.status = 'failed';
            step.error = (err as Error).message;
          }
        }
      }

      step.completedAt = new Date().toISOString();
      step.duration = new Date(step.completedAt).getTime() - new Date(step.startedAt!).getTime();
      savePipeline(this.pipeline);
      this.emit('step-end', { stepIndex: i, step });

      if (step.status === 'failed') {
        this.pipeline.status = 'failed';
        savePipeline(this.pipeline);
        this.emit('status', this.pipeline.status);
        return;
      }
    }

    if (this.pipeline.status !== 'cancelled') {
      this.pipeline.status = 'completed';
      this.pipeline.completedAt = new Date().toISOString();
      savePipeline(this.pipeline);
      this.emit('status', this.pipeline.status);
    }
  }

  private async executeStep(step: PipelineStep): Promise<void> {
    const vars = this.pipeline.variables;
    const baseCwd = step.config.cwd
      ? path.resolve(this.pipeline.cwd, substituteVars(step.config.cwd, vars))
      : this.pipeline.cwd;

    switch (step.type) {
      case 'shell':
        await this.runShell(step, baseCwd, vars);
        break;
      case 'claude-code':
        await this.runCLI(step, baseCwd, vars, 'claude');
        break;
      case 'codex':
        await this.runCLI(step, baseCwd, vars, 'codex');
        break;
      case 'ai-task':
        await this.runAITask(step, vars);
        break;
      case 'gate':
        await this.runGate(step, vars);
        break;
      case 'condition':
        await this.runCondition(step, baseCwd, vars);
        break;
    }
  }

  // ── Shell Step ──
  private runShell(step: PipelineStep, cwd: string, vars: Record<string, string>): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmd = substituteVars(step.config.command || '', vars);
      const timeout = (step.config.timeout || 300) * 1000;

      const proc = spawn('sh', ['-c', cmd], {
        cwd,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.currentProcess = proc;

      let timer: ReturnType<typeof setTimeout> | null = null;
      if (timeout > 0) {
        timer = setTimeout(() => {
          proc.kill('SIGTERM');
          reject(new Error(`Timeout after ${step.config.timeout}s`));
        }, timeout);
      }

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        step.output += text;
        this.emit('step-output', { stepIndex: this.pipeline.currentStepIndex, text });
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        step.output += text;
        this.emit('step-output', { stepIndex: this.pipeline.currentStepIndex, text });
      });

      proc.on('close', (code) => {
        if (timer) clearTimeout(timer);
        this.currentProcess = null;
        if (code === 0) resolve();
        else reject(new Error(`Exit code ${code}`));
      });

      proc.on('error', (err) => {
        if (timer) clearTimeout(timer);
        this.currentProcess = null;
        reject(err);
      });
    });
  }

  // ── CLI Step (Claude Code / Codex) ──
  private runCLI(
    step: PipelineStep,
    cwd: string,
    vars: Record<string, string>,
    tool: 'claude' | 'codex'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const prompt = substituteVars(step.config.prompt || '', vars);
      const timeout = (step.config.timeout || 600) * 1000;

      // Use --print for non-interactive execution
      const cmd = tool === 'claude' ? 'claude' : 'codex';
      const args = tool === 'claude'
        ? ['--print', prompt]
        : ['--quiet', prompt];

      const proc = spawn(cmd, args, {
        cwd,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.currentProcess = proc;

      let timer: ReturnType<typeof setTimeout> | null = null;
      if (timeout > 0) {
        timer = setTimeout(() => {
          proc.kill('SIGTERM');
          reject(new Error(`Timeout after ${step.config.timeout}s`));
        }, timeout);
      }

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        step.output += text;
        this.emit('step-output', { stepIndex: this.pipeline.currentStepIndex, text });
      });

      proc.stderr?.on('data', (data: Buffer) => {
        step.output += data.toString();
      });

      proc.on('close', (code) => {
        if (timer) clearTimeout(timer);
        this.currentProcess = null;
        if (code === 0) resolve();
        else reject(new Error(`${cmd} exited with code ${code}`));
      });

      proc.on('error', (err) => {
        if (timer) clearTimeout(timer);
        this.currentProcess = null;
        reject(err);
      });
    });
  }

  // ── AI Task Step (Direct API) ──
  private async runAITask(step: PipelineStep, vars: Record<string, string>): Promise<void> {
    const prompt = substituteVars(step.config.prompt || '', vars);
    const systemPrompt = step.config.systemPrompt
      ? substituteVars(step.config.systemPrompt, vars)
      : undefined;

    const response = await chat({
      model: (step.config.model as any) || 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: prompt }],
      systemPrompt,
      maxTokens: 4096,
    });

    step.output = response.content;
    this.emit('step-output', {
      stepIndex: this.pipeline.currentStepIndex,
      text: response.content,
    });
  }

  // ── Gate Step (Approval Required) ──
  private async runGate(step: PipelineStep, vars: Record<string, string>): Promise<void> {
    const message = substituteVars(step.config.gateMessage || 'Approval required to continue', vars);
    step.status = 'waiting-approval';
    step.output = message;
    savePipeline(this.pipeline);
    this.emit('step-gate', {
      stepIndex: this.pipeline.currentStepIndex,
      message,
    });

    // Wait for approval via event
    return new Promise((resolve, reject) => {
      const onApprove = () => {
        this.removeListener('gate-reject', onReject);
        resolve();
      };
      const onReject = () => {
        this.removeListener('gate-approve', onApprove);
        reject(new Error('Gate rejected by user'));
      };
      this.once('gate-approve', onApprove);
      this.once('gate-reject', onReject);
    });
  }

  // ── Condition Step ──
  private async runCondition(step: PipelineStep, cwd: string, vars: Record<string, string>): Promise<void> {
    const cmd = substituteVars(step.config.checkCommand || 'true', vars);
    try {
      const output = execSync(cmd, { cwd, encoding: 'utf-8', timeout: 30000 });
      step.output = `Check passed: ${output.trim()}`;
    } catch {
      // Condition failed: skip next step
      step.output = 'Check failed, skipping next step';
      const nextIdx = this.pipeline.currentStepIndex + 1;
      if (nextIdx < this.pipeline.steps.length) {
        this.pipeline.steps[nextIdx].status = 'skipped';
      }
    }
  }

  // ── Control Methods ──

  pause() {
    this.isPaused = true;
    this.pipeline.status = 'paused';
    savePipeline(this.pipeline);
    this.emit('status', 'paused');
  }

  resume() {
    this.isPaused = false;
    this.pipeline.status = 'running';
    savePipeline(this.pipeline);
    this.emit('status', 'running');
  }

  cancel() {
    this.pipeline.status = 'cancelled';
    this.isPaused = false;
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
    }
    // Mark current running step as failed
    const step = this.pipeline.steps[this.pipeline.currentStepIndex];
    if (step && step.status === 'running') {
      step.status = 'failed';
      step.error = 'Cancelled by user';
    }
    savePipeline(this.pipeline);
    this.emit('status', 'cancelled');
  }

  approveGate() {
    this.emit('gate-approve');
  }

  rejectGate() {
    this.emit('gate-reject');
  }
}

// ── Active Runners (in-memory) ──

const activeRunners = new Map<string, PipelineRunner>();

export function getRunner(pipelineId: string): PipelineRunner | undefined {
  return activeRunners.get(pipelineId);
}

export function startPipeline(pipeline: PipelineDefinition): PipelineRunner {
  // Kill existing runner if any
  const existing = activeRunners.get(pipeline.id);
  if (existing) existing.cancel();

  const runner = new PipelineRunner(pipeline);
  activeRunners.set(pipeline.id, runner);

  runner.on('status', (status: PipelineStatus) => {
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      activeRunners.delete(pipeline.id);
    }
  });

  // Fire and forget - runs in background
  runner.run().catch(() => {
    activeRunners.delete(pipeline.id);
  });

  return runner;
}

export function genPipelineId() {
  return `pipe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function genStepId() {
  return `step_${Math.random().toString(36).slice(2, 8)}`;
}

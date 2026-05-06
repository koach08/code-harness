import { useState, useEffect } from 'react';

interface AgentSummary {
  id: string; name: string; status: string; nodeCount: number; updatedAt: string; currentNodeId?: string;
}

interface AgentNode {
  id: string; name: string; type: string; status: string; output: string; error: string;
  next?: string[]; startedAt?: string; completedAt?: string; iterations?: number;
}

interface AgentFull {
  id: string; name: string; description: string; cwd: string; status: string;
  nodes: AgentNode[]; startNodeId: string; currentNodeId?: string;
  totalTokens: number; variables: Record<string, string>;
}

interface AgentTemplate {
  id: string; name: string; description: string; icon: string;
  variables: Array<{ key: string; label: string; placeholder: string; required: boolean }>;
}

const STATUS_COLORS: Record<string, string> = {
  idle: '#414868', pending: '#414868', running: '#7aa2f7', paused: '#e0af68',
  completed: '#9ece6a', failed: '#f7768e', cancelled: '#f7768e',
  skipped: '#414868', waiting: '#e0af68',
};

const NODE_TYPE_LABEL: Record<string, string> = {
  start: 'Start', end: 'End', 'ai-decide': 'AI Decision', 'ai-execute': 'AI Task',
  shell: 'Shell', 'claude-code': 'Claude Code', condition: 'Condition',
  loop: 'Loop', gate: 'Approval', delay: 'Delay',
};

export function AgentsView() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<AgentFull | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [createVars, setCreateVars] = useState<Record<string, string>>({});
  const [createCwd, setCreateCwd] = useState('');

  useEffect(() => { refreshAgents(); loadTemplates(); }, []);
  useEffect(() => { if (activeId) loadAgent(activeId); }, [activeId]);

  const api = window.api as any;

  const refreshAgents = async () => setAgents(await api.agentList());
  const loadTemplates = async () => setTemplates(await api.agentTemplates());
  const loadAgent = async (id: string) => { const a = await api.agentGet(id); if (a) setActiveAgent(a); };

  // Real-time events
  useEffect(() => {
    const unsubs = [
      api.onAgentStatus((d: { id: string; status: string }) => { refreshAgents(); if (d.id === activeId) loadAgent(d.id); }),
      api.onAgentNodeStart((d: { id: string; nodeId: string }) => { if (d.id === activeId) { loadAgent(d.id); setSelectedNodeId(d.nodeId); } }),
      api.onAgentNodeEnd((d: { id: string }) => { if (d.id === activeId) loadAgent(d.id); }),
      api.onAgentNodeOutput((d: { id: string; nodeId: string; text: string }) => {
        if (d.id === activeId) {
          setActiveAgent((prev) => {
            if (!prev) return prev;
            return { ...prev, nodes: prev.nodes.map((n) => n.id === d.nodeId ? { ...n, output: n.output + d.text } : n) };
          });
        }
      }),
      api.onAgentNodeGate((d: { id: string; nodeId: string }) => { if (d.id === activeId) { loadAgent(d.id); setSelectedNodeId(d.nodeId); } }),
    ];
    return () => unsubs.forEach((u: () => void) => u());
  }, [activeId]);

  const handleCreate = async () => {
    if (!selectedTemplate || !createCwd) return;
    const result = await api.agentCreateFromTemplate(selectedTemplate.id, createCwd, createVars);
    if (result.success) {
      setShowCreate(false); setSelectedTemplate(null); setCreateVars({}); setCreateCwd('');
      await refreshAgents(); setActiveId(result.agent.id);
    }
  };

  const handleDelete = async (id: string) => {
    await api.agentDelete(id);
    if (activeId === id) { setActiveAgent(null); setActiveId(null); }
    refreshAgents();
  };

  const selectedNode = activeAgent && selectedNodeId ? activeAgent.nodes.find((n) => n.id === selectedNodeId) : null;
  const hasGate = activeAgent?.nodes.some((n) => n.status === 'waiting');

  return (
    <div className="flex h-full">
      {/* Left: Agent List */}
      <div className="w-64 flex flex-col border-r border-white/10 bg-[#0c0c10]">
        <div className="p-3 border-b border-white/10">
          <button onClick={() => setShowCreate(true)} className="w-full px-3 py-2 text-sm rounded-lg bg-[#bb9af7]/15 text-[#bb9af7] hover:bg-[#bb9af7]/25 transition-colors">
            + New Agent
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {agents.map((a) => (
            <div key={a.id} onClick={() => setActiveId(a.id)}
              className={`group flex items-center mx-1 px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${a.id === activeId ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5'}`}>
              <span className="w-2 h-2 rounded-full flex-shrink-0 mr-2" style={{ backgroundColor: STATUS_COLORS[a.status] }} />
              <div className="flex-1 min-w-0">
                <div className="truncate">{a.name}</div>
                <div className="text-[10px] text-white/30">{a.nodeCount} nodes</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 ml-1">x</button>
            </div>
          ))}
          {agents.length === 0 && <p className="text-center text-white/20 text-xs py-8">No agents yet</p>}
        </div>
      </div>

      {/* Middle: Workflow Nodes */}
      <div className="w-72 flex flex-col border-r border-white/10">
        {activeAgent ? (
          <>
            <div className="p-3 border-b border-white/10">
              <h3 className="text-sm font-medium text-white/80 truncate">{activeAgent.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[activeAgent.status] + '20', color: STATUS_COLORS[activeAgent.status] }}>
                  {activeAgent.status}
                </span>
                {activeAgent.totalTokens > 0 && (
                  <span className="text-[10px] text-white/30">{activeAgent.totalTokens} tokens</span>
                )}
              </div>
              <div className="flex gap-1 mt-2">
                {['idle', 'completed', 'failed', 'cancelled'].includes(activeAgent.status) && (
                  <button onClick={() => api.agentStart(activeId!)} className="px-2 py-1 text-[10px] rounded bg-[#9ece6a]/20 text-[#9ece6a] hover:bg-[#9ece6a]/30">
                    {activeAgent.status === 'idle' ? 'Start' : 'Re-run'}
                  </button>
                )}
                {activeAgent.status === 'running' && (
                  <>
                    <button onClick={() => api.agentPause(activeId!)} className="px-2 py-1 text-[10px] rounded bg-[#e0af68]/20 text-[#e0af68]">Pause</button>
                    <button onClick={() => api.agentCancel(activeId!)} className="px-2 py-1 text-[10px] rounded bg-[#f7768e]/20 text-[#f7768e]">Cancel</button>
                  </>
                )}
                {activeAgent.status === 'paused' && (
                  <button onClick={() => api.agentResume(activeId!)} className="px-2 py-1 text-[10px] rounded bg-[#7aa2f7]/20 text-[#7aa2f7]">Resume</button>
                )}
                {hasGate && (
                  <>
                    <button onClick={() => api.agentApproveGate(activeId!)} className="px-2 py-1 text-[10px] rounded bg-[#9ece6a]/20 text-[#9ece6a]">Approve</button>
                    <button onClick={() => api.agentRejectGate(activeId!)} className="px-2 py-1 text-[10px] rounded bg-[#f7768e]/20 text-[#f7768e]">Reject</button>
                  </>
                )}
              </div>
            </div>

            {/* Node List (DAG visualization simplified to list) */}
            <div className="flex-1 overflow-y-auto py-1">
              {activeAgent.nodes.filter((n) => n.type !== 'start' && n.type !== 'end').map((node) => (
                <button key={node.id} onClick={() => setSelectedNodeId(node.id)}
                  className={`w-full flex items-start gap-2 px-3 py-2 text-left transition-colors ${node.id === selectedNodeId ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                  <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                    <div className={`w-3 h-3 rounded-full border-2 ${node.status === 'running' ? 'animate-pulse' : ''}`}
                      style={{ borderColor: STATUS_COLORS[node.status], backgroundColor: ['completed', 'running'].includes(node.status) ? STATUS_COLORS[node.status] : 'transparent' }}>
                      {node.status === 'completed' && (
                        <svg viewBox="0 0 12 12" className="w-full h-full text-black"><path d="M3 6l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white/70 truncate">{node.name}</div>
                    <div className="text-[10px] text-white/30 flex gap-2">
                      <span>{NODE_TYPE_LABEL[node.type] || node.type}</span>
                      {node.iterations && <span>{node.iterations} iter</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/20 text-xs">Select an agent</div>
        )}
      </div>

      {/* Right: Node Output */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedNode ? (
          <>
            <div className="px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[selectedNode.status] }} />
                <h4 className="text-sm font-medium text-white/80">{selectedNode.name}</h4>
                <span className="text-[10px] text-white/30">{NODE_TYPE_LABEL[selectedNode.type]}</span>
              </div>
              {selectedNode.status === 'waiting' && (
                <div className="mt-2 p-2 rounded-lg bg-[#e0af68]/10 border border-[#e0af68]/20 text-xs text-[#e0af68]">
                  Waiting for your approval.
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="text-xs text-white/60 font-mono whitespace-pre-wrap leading-relaxed">
                {selectedNode.output || (selectedNode.status === 'pending' ? 'Waiting...' : '')}
              </pre>
              {selectedNode.error && (
                <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap mt-2 p-2 rounded bg-red-400/10">
                  {selectedNode.error}
                </pre>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-white/20">
            <div className="text-3xl mb-3 opacity-20">@</div>
            <p className="text-sm">Agents</p>
            <p className="text-xs text-white/15 mt-1">Autonomous multi-step workflows</p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1a1b2e] rounded-xl border border-white/10 w-[520px] max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white/80">New Agent</h3>
              <button onClick={() => { setShowCreate(false); setSelectedTemplate(null); }} className="text-white/30 hover:text-white/60">x</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-white/40 mb-2 block">Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {templates.map((t) => (
                    <button key={t.id} onClick={() => { setSelectedTemplate(t); setCreateVars({}); }}
                      className={`p-3 rounded-lg text-left text-xs border transition-colors ${
                        selectedTemplate?.id === t.id ? 'border-[#bb9af7]/50 bg-[#bb9af7]/10' : 'border-white/10 hover:border-white/20 hover:bg-white/5'}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base opacity-50">{t.icon}</span>
                        <span className="text-white/70 font-medium">{t.name}</span>
                      </div>
                      <div className="text-white/30 text-[10px] mt-1">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedTemplate && (
                <>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Working Directory</label>
                    <div className="flex gap-2">
                      <input value={createCwd} onChange={(e) => setCreateCwd(e.target.value)} placeholder="/path/to/project"
                        className="flex-1 px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-white/70 outline-none focus:border-[#bb9af7]/40 font-mono" />
                      <button onClick={async () => { const f = await window.api.harnessPickFolder(); if (f) setCreateCwd(f); }}
                        className="px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-lg text-white/50 hover:bg-white/10">Browse</button>
                    </div>
                  </div>

                  {selectedTemplate.variables.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs text-white/40 block">Variables</label>
                      {selectedTemplate.variables.map((v) => (
                        <div key={v.key}>
                          <label className="text-[10px] text-white/30 mb-0.5 block">
                            {v.label} {v.required && <span className="text-red-400">*</span>}
                          </label>
                          <input value={createVars[v.key] || ''} onChange={(e) => setCreateVars({ ...createVars, [v.key]: e.target.value })}
                            placeholder={v.placeholder}
                            className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-white/70 outline-none focus:border-[#bb9af7]/40" />
                        </div>
                      ))}
                    </div>
                  )}

                  <button onClick={handleCreate}
                    disabled={!createCwd || selectedTemplate.variables.some((v) => v.required && !createVars[v.key])}
                    className="w-full py-2 text-sm rounded-lg bg-[#bb9af7] text-white hover:bg-[#aa8ae7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    Create Agent
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

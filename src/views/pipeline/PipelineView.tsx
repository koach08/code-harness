import { useState, useEffect, useCallback } from 'react';
import {
  usePipelineStore,
  type PipelineTemplate,
  type StepStatus,
} from '../../stores/pipeline.store';

const STATUS_COLORS: Record<string, string> = {
  idle: '#414868',
  pending: '#414868',
  running: '#7aa2f7',
  paused: '#e0af68',
  completed: '#9ece6a',
  failed: '#f7768e',
  cancelled: '#f7768e',
  skipped: '#414868',
  'waiting-approval': '#e0af68',
};

const STEP_TYPE_LABELS: Record<string, string> = {
  shell: 'Shell',
  'claude-code': 'Claude Code',
  codex: 'Codex',
  'ai-task': 'AI Task',
  gate: 'Approval Gate',
  condition: 'Condition',
};

export function PipelineView() {
  const {
    pipelines,
    activePipelineId,
    activePipeline,
    templates,
    showCreateDialog,
    setPipelines,
    setActivePipeline,
    setActivePipelineId,
    setTemplates,
    setShowCreateDialog,
    updateStepStatus,
    appendStepOutput,
  } = usePipelineStore();

  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [createVars, setCreateVars] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<PipelineTemplate | null>(null);
  const [createCwd, setCreateCwd] = useState('');

  // Load data
  useEffect(() => {
    refreshPipelines();
    loadTemplates();
  }, []);

  const refreshPipelines = async () => {
    const list = await (window.api as any).pipelineList();
    setPipelines(list);
  };

  const loadTemplates = async () => {
    const t = await (window.api as any).pipelineTemplates();
    setTemplates(t);
  };

  // Load active pipeline detail
  useEffect(() => {
    if (activePipelineId) {
      loadPipeline(activePipelineId);
    }
  }, [activePipelineId]);

  const loadPipeline = async (id: string) => {
    const p = await (window.api as any).pipelineGet(id);
    if (p) setActivePipeline(p);
  };

  // Wire up real-time events
  useEffect(() => {
    const unsubs = [
      (window.api as any).onPipelineStatus((data: { id: string; status: string }) => {
        refreshPipelines();
        if (data.id === activePipelineId) loadPipeline(data.id);
      }),
      (window.api as any).onPipelineStepStart((data: { id: string; stepIndex: number }) => {
        if (data.id === activePipelineId) {
          updateStepStatus(data.stepIndex, 'running');
          setSelectedStepIndex(data.stepIndex);
        }
      }),
      (window.api as any).onPipelineStepEnd((data: { id: string; stepIndex: number; step: { status: StepStatus } }) => {
        if (data.id === activePipelineId) {
          updateStepStatus(data.stepIndex, data.step.status);
          loadPipeline(data.id);
        }
      }),
      (window.api as any).onPipelineStepOutput((data: { id: string; stepIndex: number; text: string }) => {
        if (data.id === activePipelineId) {
          appendStepOutput(data.stepIndex, data.text);
        }
      }),
      (window.api as any).onPipelineStepGate((data: { id: string; stepIndex: number; message: string }) => {
        if (data.id === activePipelineId) {
          updateStepStatus(data.stepIndex, 'waiting-approval');
          setSelectedStepIndex(data.stepIndex);
        }
      }),
    ];
    return () => unsubs.forEach((u: () => void) => u());
  }, [activePipelineId]);

  // Create pipeline from template
  const handleCreate = async () => {
    if (!selectedTemplate || !createCwd) return;
    const result = await (window.api as any).pipelineCreateFromTemplate(
      selectedTemplate.id,
      createCwd,
      createVars
    );
    if (result.success) {
      setShowCreateDialog(false);
      setSelectedTemplate(null);
      setCreateVars({});
      setCreateCwd('');
      await refreshPipelines();
      setActivePipelineId(result.pipeline.id);
    }
  };

  const handlePickFolder = async () => {
    const folder = await window.api.harnessPickFolder();
    if (folder) setCreateCwd(folder);
  };

  // Controls
  const handleStart = () => activePipelineId && (window.api as any).pipelineStart(activePipelineId);
  const handlePause = () => activePipelineId && (window.api as any).pipelinePause(activePipelineId);
  const handleResume = () => activePipelineId && (window.api as any).pipelineResume(activePipelineId);
  const handleCancel = () => activePipelineId && (window.api as any).pipelineCancel(activePipelineId);
  const handleApprove = () => activePipelineId && (window.api as any).pipelineApproveGate(activePipelineId);
  const handleReject = () => activePipelineId && (window.api as any).pipelineRejectGate(activePipelineId);

  const handleDelete = async (id: string) => {
    await (window.api as any).pipelineDelete(id);
    if (activePipelineId === id) {
      setActivePipeline(null);
      setActivePipelineId(null);
    }
    refreshPipelines();
  };

  const selectedStep = activePipeline && selectedStepIndex !== null
    ? activePipeline.steps[selectedStepIndex]
    : null;

  const hasGateWaiting = activePipeline?.steps.some((s) => s.status === 'waiting-approval');

  return (
    <div className="flex h-full">
      {/* Left: Pipeline List */}
      <div className="w-64 flex flex-col border-r border-white/10 bg-[#0c0c10]">
        <div className="p-3 border-b border-white/10">
          <button
            onClick={() => setShowCreateDialog(true)}
            className="w-full px-3 py-2 text-sm rounded-lg bg-[#7aa2f7]/15 text-[#7aa2f7] hover:bg-[#7aa2f7]/25 transition-colors"
          >
            + New Pipeline
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {pipelines.map((p) => (
            <div
              key={p.id}
              onClick={() => setActivePipelineId(p.id)}
              className={`group flex items-center mx-1 px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                p.id === activePipelineId
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/70'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 mr-2"
                style={{ backgroundColor: STATUS_COLORS[p.status] }}
              />
              <div className="flex-1 min-w-0">
                <div className="truncate">{p.name}</div>
                <div className="text-[10px] text-white/30">
                  {p.currentStep}/{p.stepCount} steps
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 ml-1"
              >
                x
              </button>
            </div>
          ))}
          {pipelines.length === 0 && (
            <p className="text-center text-white/20 text-xs py-8">No pipelines yet</p>
          )}
        </div>
      </div>

      {/* Middle: Step List */}
      <div className="w-72 flex flex-col border-r border-white/10">
        {activePipeline ? (
          <>
            {/* Pipeline header */}
            <div className="p-3 border-b border-white/10">
              <h3 className="text-sm font-medium text-white/80 truncate">{activePipeline.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: STATUS_COLORS[activePipeline.status] + '20',
                    color: STATUS_COLORS[activePipeline.status],
                  }}
                >
                  {activePipeline.status}
                </span>
                <span className="text-[10px] text-white/30">
                  {activePipeline.cwd.split('/').pop()}
                </span>
              </div>

              {/* Controls */}
              <div className="flex gap-1 mt-2">
                {(activePipeline.status === 'idle' || activePipeline.status === 'completed' ||
                  activePipeline.status === 'failed' || activePipeline.status === 'cancelled') && (
                  <button onClick={handleStart} className="px-2 py-1 text-[10px] rounded bg-[#9ece6a]/20 text-[#9ece6a] hover:bg-[#9ece6a]/30">
                    {activePipeline.status === 'idle' ? 'Start' : 'Re-run'}
                  </button>
                )}
                {activePipeline.status === 'running' && (
                  <>
                    <button onClick={handlePause} className="px-2 py-1 text-[10px] rounded bg-[#e0af68]/20 text-[#e0af68] hover:bg-[#e0af68]/30">
                      Pause
                    </button>
                    <button onClick={handleCancel} className="px-2 py-1 text-[10px] rounded bg-[#f7768e]/20 text-[#f7768e] hover:bg-[#f7768e]/30">
                      Cancel
                    </button>
                  </>
                )}
                {activePipeline.status === 'paused' && (
                  <button onClick={handleResume} className="px-2 py-1 text-[10px] rounded bg-[#7aa2f7]/20 text-[#7aa2f7] hover:bg-[#7aa2f7]/30">
                    Resume
                  </button>
                )}
                {hasGateWaiting && (
                  <>
                    <button onClick={handleApprove} className="px-2 py-1 text-[10px] rounded bg-[#9ece6a]/20 text-[#9ece6a] hover:bg-[#9ece6a]/30">
                      Approve
                    </button>
                    <button onClick={handleReject} className="px-2 py-1 text-[10px] rounded bg-[#f7768e]/20 text-[#f7768e] hover:bg-[#f7768e]/30">
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Steps */}
            <div className="flex-1 overflow-y-auto py-1">
              {activePipeline.steps.map((step, i) => (
                <button
                  key={step.id}
                  onClick={() => setSelectedStepIndex(i)}
                  className={`w-full flex items-start gap-2 px-3 py-2 text-left transition-colors ${
                    i === selectedStepIndex
                      ? 'bg-white/10'
                      : 'hover:bg-white/5'
                  }`}
                >
                  {/* Step indicator */}
                  <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                    <div
                      className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                        step.status === 'running' ? 'animate-pulse' : ''
                      }`}
                      style={{
                        borderColor: STATUS_COLORS[step.status],
                        backgroundColor: step.status === 'completed' || step.status === 'running'
                          ? STATUS_COLORS[step.status]
                          : 'transparent',
                      }}
                    >
                      {step.status === 'completed' && (
                        <svg viewBox="0 0 12 12" className="w-2 h-2 text-black">
                          <path d="M3 6l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
                        </svg>
                      )}
                    </div>
                    {i < activePipeline.steps.length - 1 && (
                      <div className="w-px h-6 bg-white/10 mt-0.5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white/70 truncate">{step.name}</div>
                    <div className="text-[10px] text-white/30 flex gap-2">
                      <span>{STEP_TYPE_LABELS[step.type] || step.type}</span>
                      {step.duration && (
                        <span>{(step.duration / 1000).toFixed(1)}s</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/20 text-xs">
            Select a pipeline
          </div>
        )}
      </div>

      {/* Right: Step Detail / Output */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedStep ? (
          <>
            <div className="px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[selectedStep.status] }}
                />
                <h4 className="text-sm font-medium text-white/80">{selectedStep.name}</h4>
                <span className="text-[10px] text-white/30">{STEP_TYPE_LABELS[selectedStep.type]}</span>
              </div>
              {selectedStep.status === 'waiting-approval' && (
                <div className="mt-2 p-2 rounded-lg bg-[#e0af68]/10 border border-[#e0af68]/20 text-xs text-[#e0af68]">
                  Waiting for approval. Review the output and approve or reject above.
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="text-xs text-white/60 font-mono whitespace-pre-wrap leading-relaxed">
                {selectedStep.output || (selectedStep.status === 'pending' ? 'Waiting to run...' : '')}
              </pre>
              {selectedStep.error && (
                <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap mt-2 p-2 rounded bg-red-400/10">
                  {selectedStep.error}
                </pre>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-white/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 mb-3 opacity-20">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <p className="text-sm">Pipeline</p>
            <p className="text-xs text-white/15 mt-1">Automated development workflows</p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1a1b2e] rounded-xl border border-white/10 w-[520px] max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white/80">New Pipeline</h3>
              <button
                onClick={() => { setShowCreateDialog(false); setSelectedTemplate(null); }}
                className="text-white/30 hover:text-white/60"
              >
                x
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Template Selection */}
              <div>
                <label className="text-xs text-white/40 mb-2 block">Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTemplate(t);
                        setCreateVars({});
                      }}
                      className={`p-3 rounded-lg text-left text-xs transition-colors border ${
                        selectedTemplate?.id === t.id
                          ? 'border-[#7aa2f7]/50 bg-[#7aa2f7]/10'
                          : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                      }`}
                    >
                      <div className="text-white/70 font-medium">{t.name}</div>
                      <div className="text-white/30 text-[10px] mt-0.5">{t.stepCount} steps</div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedTemplate && (
                <>
                  {/* Working Directory */}
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Working Directory</label>
                    <div className="flex gap-2">
                      <input
                        value={createCwd}
                        onChange={(e) => setCreateCwd(e.target.value)}
                        placeholder="/path/to/project"
                        className="flex-1 px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-white/70 outline-none focus:border-[#7aa2f7]/40 font-mono"
                      />
                      <button
                        onClick={handlePickFolder}
                        className="px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-lg text-white/50 hover:bg-white/10"
                      >
                        Browse
                      </button>
                    </div>
                  </div>

                  {/* Variables */}
                  {selectedTemplate.variables.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs text-white/40 block">Variables</label>
                      {selectedTemplate.variables.map((v) => (
                        <div key={v.key}>
                          <label className="text-[10px] text-white/30 mb-0.5 block">
                            {v.label} {v.required && <span className="text-red-400">*</span>}
                          </label>
                          <input
                            value={createVars[v.key] || ''}
                            onChange={(e) =>
                              setCreateVars({ ...createVars, [v.key]: e.target.value })
                            }
                            placeholder={v.placeholder}
                            className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-white/70 outline-none focus:border-[#7aa2f7]/40"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleCreate}
                    disabled={!createCwd || selectedTemplate.variables.some((v) => v.required && !createVars[v.key])}
                    className="w-full py-2 text-sm rounded-lg bg-[#7aa2f7] text-white hover:bg-[#6a92e7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Create Pipeline
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

import { create } from 'zustand';

export type PipelineStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting-approval';

export interface PipelineStep {
  id: string;
  name: string;
  type: string;
  status: StepStatus;
  config: Record<string, unknown>;
  output: string;
  error: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
}

export interface PipelineSummary {
  id: string;
  name: string;
  status: PipelineStatus;
  stepCount: number;
  currentStep: number;
  updatedAt: string;
}

export interface PipelineFull {
  id: string;
  name: string;
  description: string;
  templateId?: string;
  cwd: string;
  steps: PipelineStep[];
  status: PipelineStatus;
  createdAt: string;
  updatedAt: string;
  currentStepIndex: number;
  variables: Record<string, string>;
}

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  variables: Array<{ key: string; label: string; placeholder: string; required: boolean }>;
  stepCount: number;
}

interface PipelineState {
  pipelines: PipelineSummary[];
  activePipelineId: string | null;
  activePipeline: PipelineFull | null;
  templates: PipelineTemplate[];
  showCreateDialog: boolean;

  setPipelines: (p: PipelineSummary[]) => void;
  setActivePipeline: (p: PipelineFull | null) => void;
  setActivePipelineId: (id: string | null) => void;
  setTemplates: (t: PipelineTemplate[]) => void;
  setShowCreateDialog: (show: boolean) => void;
  updateStepStatus: (stepIndex: number, status: StepStatus) => void;
  appendStepOutput: (stepIndex: number, text: string) => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  pipelines: [],
  activePipelineId: null,
  activePipeline: null,
  templates: [],
  showCreateDialog: false,

  setPipelines: (pipelines) => set({ pipelines }),
  setActivePipeline: (activePipeline) => set({ activePipeline }),
  setActivePipelineId: (activePipelineId) => set({ activePipelineId }),
  setTemplates: (templates) => set({ templates }),
  setShowCreateDialog: (showCreateDialog) => set({ showCreateDialog }),

  updateStepStatus: (stepIndex, status) =>
    set((s) => {
      if (!s.activePipeline) return s;
      const steps = [...s.activePipeline.steps];
      steps[stepIndex] = { ...steps[stepIndex], status };
      return { activePipeline: { ...s.activePipeline, steps } };
    }),

  appendStepOutput: (stepIndex, text) =>
    set((s) => {
      if (!s.activePipeline) return s;
      const steps = [...s.activePipeline.steps];
      steps[stepIndex] = { ...steps[stepIndex], output: steps[stepIndex].output + text };
      return { activePipeline: { ...s.activePipeline, steps } };
    }),
}));

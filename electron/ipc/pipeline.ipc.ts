import { ipcMain, BrowserWindow, Notification } from 'electron';
import {
  savePipeline,
  loadPipeline,
  deletePipeline,
  listPipelines,
  startPipeline,
  getRunner,
  genPipelineId,
  genStepId,
  type PipelineDefinition,
  type PipelineStep,
  type StepType,
} from '../services/pipeline-engine';
import { PIPELINE_TEMPLATES } from './pipeline-templates';

export function registerPipelineHandlers(getMainWindow: () => BrowserWindow | null) {
  const send = (channel: string, data: unknown) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, data);
  };

  // ── CRUD ──

  ipcMain.handle('pipeline:list', async () => listPipelines());

  ipcMain.handle('pipeline:get', async (_e, { id }: { id: string }) => loadPipeline(id));

  ipcMain.handle('pipeline:delete', async (_e, { id }: { id: string }) => {
    const runner = getRunner(id);
    if (runner) runner.cancel();
    deletePipeline(id);
    return { success: true };
  });

  ipcMain.handle('pipeline:templates', async () => {
    return PIPELINE_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      variables: t.variables,
      stepCount: t.steps.length,
    }));
  });

  // Create from template
  ipcMain.handle(
    'pipeline:create-from-template',
    async (_e, { templateId, cwd, variables, name }: {
      templateId: string;
      cwd: string;
      variables: Record<string, string>;
      name?: string;
    }) => {
      const template = PIPELINE_TEMPLATES.find((t) => t.id === templateId);
      if (!template) return { success: false, error: 'Template not found' };

      const pipeline: PipelineDefinition = {
        id: genPipelineId(),
        name: name || template.name,
        description: template.description,
        templateId,
        cwd,
        steps: template.steps.map((s) => ({
          ...s,
          id: genStepId(),
          status: 'pending' as const,
          output: '',
          error: '',
        })),
        status: 'idle',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentStepIndex: 0,
        variables,
      };

      savePipeline(pipeline);
      return { success: true, pipeline };
    }
  );

  // Create custom pipeline
  ipcMain.handle(
    'pipeline:create',
    async (_e, { name, description, cwd, steps, variables }: {
      name: string;
      description: string;
      cwd: string;
      steps: Array<{ name: string; type: StepType; config: PipelineStep['config'] }>;
      variables?: Record<string, string>;
    }) => {
      const pipeline: PipelineDefinition = {
        id: genPipelineId(),
        name,
        description,
        cwd,
        steps: steps.map((s) => ({
          ...s,
          id: genStepId(),
          status: 'pending' as const,
          output: '',
          error: '',
        })),
        status: 'idle',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentStepIndex: 0,
        variables: variables || {},
      };

      savePipeline(pipeline);
      return { success: true, pipeline };
    }
  );

  // ── Execution Control ──

  ipcMain.handle('pipeline:start', async (_e, { id }: { id: string }) => {
    const pipeline = loadPipeline(id);
    if (!pipeline) return { success: false, error: 'Pipeline not found' };

    // Reset steps if re-running
    if (pipeline.status === 'completed' || pipeline.status === 'failed' || pipeline.status === 'cancelled') {
      pipeline.currentStepIndex = 0;
      pipeline.steps.forEach((s) => {
        s.status = 'pending';
        s.output = '';
        s.error = '';
        s.startedAt = undefined;
        s.completedAt = undefined;
        s.duration = undefined;
      });
    }

    const runner = startPipeline(pipeline);

    // Wire up events to renderer
    runner.on('status', (status: string) => {
      send('pipeline:status', { id, status });

      // Native notification on completion/failure
      if (status === 'completed' || status === 'failed') {
        const notif = new Notification({
          title: 'Code Harness Pipeline',
          body: `${pipeline.name}: ${status === 'completed' ? 'Completed successfully' : 'Failed'}`,
        });
        notif.show();
      }
    });

    runner.on('step-start', (data: unknown) => {
      send('pipeline:step-start', { id, ...data as object });
    });

    runner.on('step-end', (data: unknown) => {
      send('pipeline:step-end', { id, ...data as object });
    });

    runner.on('step-output', (data: unknown) => {
      send('pipeline:step-output', { id, ...data as object });
    });

    runner.on('step-gate', (data: unknown) => {
      send('pipeline:step-gate', { id, ...data as object });

      // Notification for gate approval
      const notif = new Notification({
        title: 'Code Harness: Approval Required',
        body: (data as { message: string }).message,
      });
      notif.show();
    });

    return { success: true };
  });

  ipcMain.handle('pipeline:pause', async (_e, { id }: { id: string }) => {
    const runner = getRunner(id);
    if (!runner) return { success: false, error: 'Pipeline not running' };
    runner.pause();
    return { success: true };
  });

  ipcMain.handle('pipeline:resume', async (_e, { id }: { id: string }) => {
    const runner = getRunner(id);
    if (!runner) return { success: false, error: 'Pipeline not running' };
    runner.resume();
    return { success: true };
  });

  ipcMain.handle('pipeline:cancel', async (_e, { id }: { id: string }) => {
    const runner = getRunner(id);
    if (!runner) return { success: false, error: 'Pipeline not running' };
    runner.cancel();
    return { success: true };
  });

  ipcMain.handle('pipeline:approve-gate', async (_e, { id }: { id: string }) => {
    const runner = getRunner(id);
    if (!runner) return { success: false, error: 'Pipeline not running' };
    runner.approveGate();
    return { success: true };
  });

  ipcMain.handle('pipeline:reject-gate', async (_e, { id }: { id: string }) => {
    const runner = getRunner(id);
    if (!runner) return { success: false, error: 'Pipeline not running' };
    runner.rejectGate();
    return { success: true };
  });
}

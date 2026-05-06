import { ipcMain, BrowserWindow, Notification } from 'electron';
import {
  loadAgent,
  deleteAgent,
  listAgents,
  startAgent,
  getAgentRunner,
  AGENT_TEMPLATES,
  type AgentStatus,
} from '../services/agent-runner';

export function registerAgentHandlers(getMainWindow: () => BrowserWindow | null) {
  const send = (channel: string, data: unknown) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, data);
  };

  // CRUD
  ipcMain.handle('agent:list', async () => listAgents());
  ipcMain.handle('agent:get', async (_e, { id }: { id: string }) => loadAgent(id));
  ipcMain.handle('agent:delete', async (_e, { id }: { id: string }) => {
    const runner = getAgentRunner(id);
    if (runner) runner.cancel();
    deleteAgent(id);
    return { success: true };
  });

  // Templates
  ipcMain.handle('agent:templates', async () =>
    AGENT_TEMPLATES.map((t) => ({
      id: t.id, name: t.name, description: t.description, icon: t.icon,
      variables: t.variables,
    }))
  );

  // Create from template
  ipcMain.handle('agent:create-from-template', async (_e, {
    templateId, cwd, variables,
  }: { templateId: string; cwd: string; variables: Record<string, string> }) => {
    const template = AGENT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return { success: false, error: 'Template not found' };
    const agent = template.buildWorkflow(variables, cwd);
    const { saveAgent } = require('../services/agent-runner');
    saveAgent(agent);
    return { success: true, agent };
  });

  // Execution
  ipcMain.handle('agent:start', async (_e, { id }: { id: string }) => {
    const agent = loadAgent(id);
    if (!agent) return { success: false, error: 'Agent not found' };

    // Reset if re-running
    if (['completed', 'failed', 'cancelled'].includes(agent.status)) {
      agent.currentNodeId = undefined;
      agent.context = '';
      agent.totalTokens = 0;
      agent.nodes.forEach((n) => {
        n.status = 'pending';
        n.output = '';
        n.error = '';
        n.startedAt = undefined;
        n.completedAt = undefined;
        n.iterations = undefined;
      });
    }

    const runner = startAgent(agent);

    runner.on('status', (status: AgentStatus) => {
      send('agent:status', { id, status });
      if (status === 'completed' || status === 'failed') {
        new Notification({
          title: 'Code Harness Agent',
          body: `${agent.name}: ${status === 'completed' ? 'Completed' : 'Failed'}`,
        }).show();
      }
    });

    runner.on('node-start', (data: unknown) => send('agent:node-start', { id, ...data as object }));
    runner.on('node-end', (data: unknown) => send('agent:node-end', { id, ...data as object }));
    runner.on('node-output', (data: unknown) => send('agent:node-output', { id, ...data as object }));
    runner.on('node-gate', (data: unknown) => {
      send('agent:node-gate', { id, ...data as object });
      new Notification({ title: 'Agent: Approval Required', body: (data as { message: string }).message }).show();
    });

    return { success: true };
  });

  ipcMain.handle('agent:pause', async (_e, { id }: { id: string }) => {
    const r = getAgentRunner(id); if (!r) return { success: false }; r.pause(); return { success: true };
  });
  ipcMain.handle('agent:resume', async (_e, { id }: { id: string }) => {
    const r = getAgentRunner(id); if (!r) return { success: false }; r.resume(); return { success: true };
  });
  ipcMain.handle('agent:cancel', async (_e, { id }: { id: string }) => {
    const r = getAgentRunner(id); if (!r) return { success: false }; r.cancel(); return { success: true };
  });
  ipcMain.handle('agent:approve-gate', async (_e, { id }: { id: string }) => {
    const r = getAgentRunner(id); if (!r) return { success: false }; r.approveGate(); return { success: true };
  });
  ipcMain.handle('agent:reject-gate', async (_e, { id }: { id: string }) => {
    const r = getAgentRunner(id); if (!r) return { success: false }; r.rejectGate(); return { success: true };
  });
}

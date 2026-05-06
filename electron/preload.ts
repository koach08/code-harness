import { contextBridge, ipcRenderer } from 'electron';
import type { CodeHarnessAPI } from './types';

const api: CodeHarnessAPI = {
  // Session
  createSession: (opts) => ipcRenderer.invoke('create-session', opts || {}),
  switchMode: (sessionId, newMode) => ipcRenderer.invoke('switch-mode', { sessionId, newMode }),
  sendInput: (sessionId, input) => ipcRenderer.invoke('send-input', { sessionId, input }),
  resizeTerminal: (sessionId, cols, rows) => ipcRenderer.invoke('resize-terminal', { sessionId, cols, rows }),
  closeSession: (sessionId) => ipcRenderer.invoke('close-session', { sessionId }),

  // CLI
  checkClaudeCli: () => ipcRenderer.invoke('check-claude-cli'),
  installClaudeCli: () => ipcRenderer.invoke('install-claude-cli'),

  // Filesystem
  resolveCwd: (p) => ipcRenderer.invoke('resolve-cwd', p),
  scanProject: (cwd) => ipcRenderer.invoke('scan-project', { cwd }),

  // Persistence
  saveSessions: () => ipcRenderer.invoke('save-sessions'),
  loadSessions: () => ipcRenderer.invoke('load-sessions'),
  loadPrefs: () => ipcRenderer.invoke('load-prefs'),
  savePrefs: (prefs) => ipcRenderer.invoke('save-prefs', prefs),
  loadBuffer: (sessionId) => ipcRenderer.invoke('load-buffer', { sessionId }),
  cleanupOldBuffers: (oldIds) => ipcRenderer.invoke('cleanup-old-buffers', { oldIds }),

  // Work log
  logPrompt: (data) => ipcRenderer.invoke('log-prompt', data),
  loadWorkLog: () => ipcRenderer.invoke('load-work-log'),
  clearWorkLog: () => ipcRenderer.invoke('clear-work-log'),

  // Settings
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),

  // App
  openAppFolder: () => ipcRenderer.invoke('open-app-folder'),
  getAppDir: () => ipcRenderer.invoke('get-app-dir'),
  checkCrash: () => ipcRenderer.invoke('check-crash'),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  applyUpdate: () => ipcRenderer.invoke('apply-update'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // License
  licenseStatus: () => ipcRenderer.invoke('license-status'),
  licenseActivate: (key) => ipcRenderer.invoke('license-activate', { key }),
  licenseDeactivate: () => ipcRenderer.invoke('license-deactivate'),

  // Harness
  harnessReadClaudeMd: (cwd) => ipcRenderer.invoke('harness-read-claudemd', { cwd }),
  harnessWriteClaudeMd: (cwd, content) => ipcRenderer.invoke('harness-write-claudemd', { cwd, content }),
  harnessReadUserClaudeMd: () => ipcRenderer.invoke('harness-read-user-claudemd'),
  harnessWriteUserClaudeMd: (content) => ipcRenderer.invoke('harness-write-user-claudemd', { content }),
  harnessReadHooks: (cwd) => ipcRenderer.invoke('harness-read-hooks', { cwd }),
  harnessWriteHooks: (cwd, hooks) => ipcRenderer.invoke('harness-write-hooks', { cwd, hooks }),
  harnessReadMemory: () => ipcRenderer.invoke('harness-read-memory'),
  harnessReadMemoryContent: (file) => ipcRenderer.invoke('harness-read-memory-content', { file }),
  harnessWriteMemory: (file, content) => ipcRenderer.invoke('harness-write-memory', { file, content }),
  harnessDeleteMemory: (file) => ipcRenderer.invoke('harness-delete-memory', { file }),
  harnessLoadProjects: () => ipcRenderer.invoke('harness-load-projects'),
  harnessSaveProjects: (projects) => ipcRenderer.invoke('harness-save-projects', projects),
  harnessPickFolder: () => ipcRenderer.invoke('harness-pick-folder'),

  // Notebook
  notebookExecJs: (code: string) => ipcRenderer.invoke('notebook:exec-js', { code }),
  notebookExecPython: (code: string) => ipcRenderer.invoke('notebook:exec-python', { code }),
  notebookExecShell: (command: string) => ipcRenderer.invoke('notebook:exec-shell', { command }),
  notebookAiQuery: (prompt: string, model?: string, systemPrompt?: string, context?: string) =>
    ipcRenderer.invoke('notebook:ai-query', { prompt, model, systemPrompt, context }),
  notebookAiStream: (id: string, prompt: string, model?: string, systemPrompt?: string) =>
    ipcRenderer.invoke('notebook:ai-stream', { id, prompt, model, systemPrompt }),
  onNotebookAiStream: (id: string, cb: (chunk: { type: string; content: string }) => void) => {
    const ch = `notebook:ai-stream-${id}`;
    const h = (_e: unknown, d: { type: string; content: string }) => cb(d);
    ipcRenderer.on(ch, h); return () => ipcRenderer.removeListener(ch, h);
  },
  notebookSave: (id: string, data: string) => ipcRenderer.invoke('notebook:save', { id, data }),
  notebookLoad: (id: string) => ipcRenderer.invoke('notebook:load', { id }),
  notebookList: () => ipcRenderer.invoke('notebook:list'),
  notebookDelete: (id: string) => ipcRenderer.invoke('notebook:delete', { id }),

  // Document
  documentSave: (id: string, data: string) => ipcRenderer.invoke('document:save', { id, data }),
  documentLoad: (id: string) => ipcRenderer.invoke('document:load', { id }),
  documentList: () => ipcRenderer.invoke('document:list'),
  documentDelete: (id: string) => ipcRenderer.invoke('document:delete', { id }),
  documentOpenFile: () => ipcRenderer.invoke('document:open-file'),
  documentSaveFile: (filePath: string | undefined, content: string) =>
    ipcRenderer.invoke('document:save-file', { filePath, content }),

  // Builder / Store
  builderGenPrivacyPolicy: (meta: Record<string, string>) => ipcRenderer.invoke('builder:gen-privacy-policy', meta),
  builderGenTerms: (meta: Record<string, string>) => ipcRenderer.invoke('builder:gen-terms', meta),
  builderGenPrivacyInfo: (meta: Record<string, string>) => ipcRenderer.invoke('builder:gen-privacy-info', meta),
  builderGenStoreMetadata: (meta: Record<string, string>) => ipcRenderer.invoke('builder:gen-store-metadata', meta),
  builderGenChecklist: (meta: Record<string, string>) => ipcRenderer.invoke('builder:gen-checklist', meta),
  builderGenAllStoreAssets: (meta: Record<string, string>, projectDir: string) =>
    ipcRenderer.invoke('builder:gen-all-store-assets', { meta, projectDir }),

  // Agent
  agentList: () => ipcRenderer.invoke('agent:list'),
  agentGet: (id: string) => ipcRenderer.invoke('agent:get', { id }),
  agentDelete: (id: string) => ipcRenderer.invoke('agent:delete', { id }),
  agentTemplates: () => ipcRenderer.invoke('agent:templates'),
  agentCreateFromTemplate: (templateId: string, cwd: string, variables: Record<string, string>) =>
    ipcRenderer.invoke('agent:create-from-template', { templateId, cwd, variables }),
  agentStart: (id: string) => ipcRenderer.invoke('agent:start', { id }),
  agentPause: (id: string) => ipcRenderer.invoke('agent:pause', { id }),
  agentResume: (id: string) => ipcRenderer.invoke('agent:resume', { id }),
  agentCancel: (id: string) => ipcRenderer.invoke('agent:cancel', { id }),
  agentApproveGate: (id: string) => ipcRenderer.invoke('agent:approve-gate', { id }),
  agentRejectGate: (id: string) => ipcRenderer.invoke('agent:reject-gate', { id }),
  onAgentStatus: (cb: (data: { id: string; status: string }) => void) => {
    const h = (_e: unknown, d: { id: string; status: string }) => cb(d);
    ipcRenderer.on('agent:status', h); return () => ipcRenderer.removeListener('agent:status', h);
  },
  onAgentNodeStart: (cb: (data: unknown) => void) => {
    const h = (_e: unknown, d: unknown) => cb(d);
    ipcRenderer.on('agent:node-start', h); return () => ipcRenderer.removeListener('agent:node-start', h);
  },
  onAgentNodeEnd: (cb: (data: unknown) => void) => {
    const h = (_e: unknown, d: unknown) => cb(d);
    ipcRenderer.on('agent:node-end', h); return () => ipcRenderer.removeListener('agent:node-end', h);
  },
  onAgentNodeOutput: (cb: (data: { id: string; nodeId: string; text: string }) => void) => {
    const h = (_e: unknown, d: { id: string; nodeId: string; text: string }) => cb(d);
    ipcRenderer.on('agent:node-output', h); return () => ipcRenderer.removeListener('agent:node-output', h);
  },
  onAgentNodeGate: (cb: (data: { id: string; nodeId: string; message: string }) => void) => {
    const h = (_e: unknown, d: { id: string; nodeId: string; message: string }) => cb(d);
    ipcRenderer.on('agent:node-gate', h); return () => ipcRenderer.removeListener('agent:node-gate', h);
  },

  // Pipeline
  pipelineList: () => ipcRenderer.invoke('pipeline:list'),
  pipelineGet: (id: string) => ipcRenderer.invoke('pipeline:get', { id }),
  pipelineDelete: (id: string) => ipcRenderer.invoke('pipeline:delete', { id }),
  pipelineTemplates: () => ipcRenderer.invoke('pipeline:templates'),
  pipelineCreateFromTemplate: (templateId: string, cwd: string, variables: Record<string, string>, name?: string) =>
    ipcRenderer.invoke('pipeline:create-from-template', { templateId, cwd, variables, name }),
  pipelineCreate: (data: { name: string; description: string; cwd: string; steps: unknown[]; variables?: Record<string, string> }) =>
    ipcRenderer.invoke('pipeline:create', data),
  pipelineStart: (id: string) => ipcRenderer.invoke('pipeline:start', { id }),
  pipelinePause: (id: string) => ipcRenderer.invoke('pipeline:pause', { id }),
  pipelineResume: (id: string) => ipcRenderer.invoke('pipeline:resume', { id }),
  pipelineCancel: (id: string) => ipcRenderer.invoke('pipeline:cancel', { id }),
  pipelineApproveGate: (id: string) => ipcRenderer.invoke('pipeline:approve-gate', { id }),
  pipelineRejectGate: (id: string) => ipcRenderer.invoke('pipeline:reject-gate', { id }),
  onPipelineStatus: (cb: (data: { id: string; status: string }) => void) => {
    const handler = (_e: unknown, data: { id: string; status: string }) => cb(data);
    ipcRenderer.on('pipeline:status', handler);
    return () => ipcRenderer.removeListener('pipeline:status', handler);
  },
  onPipelineStepStart: (cb: (data: unknown) => void) => {
    const handler = (_e: unknown, data: unknown) => cb(data);
    ipcRenderer.on('pipeline:step-start', handler);
    return () => ipcRenderer.removeListener('pipeline:step-start', handler);
  },
  onPipelineStepEnd: (cb: (data: unknown) => void) => {
    const handler = (_e: unknown, data: unknown) => cb(data);
    ipcRenderer.on('pipeline:step-end', handler);
    return () => ipcRenderer.removeListener('pipeline:step-end', handler);
  },
  onPipelineStepOutput: (cb: (data: { id: string; stepIndex: number; text: string }) => void) => {
    const handler = (_e: unknown, data: { id: string; stepIndex: number; text: string }) => cb(data);
    ipcRenderer.on('pipeline:step-output', handler);
    return () => ipcRenderer.removeListener('pipeline:step-output', handler);
  },
  onPipelineStepGate: (cb: (data: { id: string; stepIndex: number; message: string }) => void) => {
    const handler = (_e: unknown, data: { id: string; stepIndex: number; message: string }) => cb(data);
    ipcRenderer.on('pipeline:step-gate', handler);
    return () => ipcRenderer.removeListener('pipeline:step-gate', handler);
  },

  // AI
  aiGetKeys: () => ipcRenderer.invoke('ai:get-keys'),
  aiSetKeys: (keys: Record<string, string | undefined>) => ipcRenderer.invoke('ai:set-keys', keys),
  aiCheckKeys: () => ipcRenderer.invoke('ai:check-keys'),
  aiListConversations: () => ipcRenderer.invoke('ai:list-conversations'),
  aiGetConversation: (id: string) => ipcRenderer.invoke('ai:get-conversation', { id }),
  aiCreateConversation: (model: string, title?: string) => ipcRenderer.invoke('ai:create-conversation', { model, title }),
  aiDeleteConversation: (id: string) => ipcRenderer.invoke('ai:delete-conversation', { id }),
  aiRenameConversation: (id: string, title: string) => ipcRenderer.invoke('ai:rename-conversation', { id, title }),
  aiChat: (conversationId: string, message: string, model?: string, systemPrompt?: string) =>
    ipcRenderer.invoke('ai:chat', { conversationId, message, model, systemPrompt }),
  aiChatStream: (conversationId: string, message: string, model?: string, systemPrompt?: string) =>
    ipcRenderer.invoke('ai:chat-stream', { conversationId, message, model, systemPrompt }),
  aiGenerateImage: (req: { prompt: string; model?: string; size?: string; quality?: string }) =>
    ipcRenderer.invoke('ai:generate-image', req),
  onAIStream: (conversationId: string, cb: (chunk: { type: string; content: string; inputTokens?: number; outputTokens?: number }) => void) => {
    const channel = `ai:stream-${conversationId}`;
    const handler = (_e: unknown, data: { type: string; content: string; inputTokens?: number; outputTokens?: number }) => cb(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },

  // Events
  onSessionOutput: (id, cb) => {
    const handler = (_e: unknown, data: string) => cb(data);
    ipcRenderer.on(`session-output-${id}`, handler);
    return () => ipcRenderer.removeListener(`session-output-${id}`, handler);
  },
  onSessionExit: (id, cb) => {
    const handler = (_e: unknown, data: { exitCode: number; signal?: number }) => cb(data);
    ipcRenderer.on(`session-exit-${id}`, handler);
    return () => ipcRenderer.removeListener(`session-exit-${id}`, handler);
  },
  onMenuAction: (cb) => {
    ipcRenderer.on('menu-action', (_e, action) => cb(action));
  },
  removeListeners: (id) => {
    ipcRenderer.removeAllListeners(`session-output-${id}`);
    ipcRenderer.removeAllListeners(`session-exit-${id}`);
  },
};

contextBridge.exposeInMainWorld('api', api);

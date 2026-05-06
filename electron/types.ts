// ── Shared IPC Types ──

export type SessionMode = 'claude' | 'codex' | 'aider' | 'shell';

export interface SessionCreateOpts {
  cwd?: string;
  name?: string;
  mode?: SessionMode;
  restoreFromId?: string;
  conversationId?: string;
}

export interface SessionInfo {
  id: string;
  name: string;
  cwd: string;
  mode: SessionMode;
}

export interface SessionSaved {
  id: string;
  name: string;
  cwd: string;
  mode: SessionMode;
  conversationId?: string | null;
  createdAt: string;
  savedAt: string;
}

export interface SessionExitInfo {
  exitCode: number;
  signal?: number;
}

// ── Project scanning ──

export interface ProjectInfo {
  name: string;
  cwd: string;
  framework: string | null;
  language: string | null;
  packageName?: string;
  version?: string;
  scripts?: string[];
  dependencies: string[];
  configs: string[];
  suggestions: string[];
}

// ── CLI ──

export interface CliCheckResult {
  installed: boolean;
  path?: string;
  version?: string;
}

// ── Harness ──

export interface FileContent {
  exists: boolean;
  content: string;
}

export interface HooksConfig {
  project: Record<string, unknown> | null;
  user: Record<string, unknown> | null;
}

export interface MemoryFile {
  file: string;
  name: string;
  type: string;
  description: string;
}

// ── License ──

export interface LicenseFeatures {
  maxTabs: number;
  maxProjects: number;
  aiderMode: boolean;
  hooksEdit: boolean;
  memoryEdit: boolean;
  builderTemplates: string[] | 'all';
}

export interface LicenseStatus {
  isPro: boolean;
  key: string;
  activatedAt: string;
  features: LicenseFeatures;
}

// ── Settings ──

export interface AppSettings {
  fontSize: number;
  autoSaveInterval: number;
  doubleEnterDelay: number;
}

// ── Update ──

export interface UpdateCheckResult {
  updateAvailable: boolean;
  changes?: string;
  latestVersion?: string;
  downloadUrl?: string;
  error?: string;
}

export interface AppInfo {
  version: string;
  gitHash: string;
  electronVersion: string;
  nodeVersion: string;
}

// ── Work Log ──

export interface WorkLogEntry {
  sessionId: string;
  sessionName: string;
  cwd: string;
  prompt: string;
  timestamp: string;
}

// ── Result types ──

export interface Result {
  success: boolean;
  error?: string;
}

// ── IPC API contract ──
// This defines the full API exposed via contextBridge

export interface CodeHarnessAPI {
  // Session
  createSession: (opts?: SessionCreateOpts) => Promise<SessionInfo>;
  switchMode: (sessionId: string, newMode: SessionMode) => Promise<SessionInfo | null>;
  sendInput: (sessionId: string, input: string) => Promise<void>;
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>;
  closeSession: (sessionId: string) => Promise<void>;

  // CLI
  checkClaudeCli: () => Promise<CliCheckResult>;
  installClaudeCli: () => Promise<Result>;

  // Filesystem
  resolveCwd: (path: string) => Promise<string>;
  scanProject: (cwd: string) => Promise<ProjectInfo>;

  // Persistence
  saveSessions: () => Promise<void>;
  loadSessions: () => Promise<SessionSaved[]>;
  loadPrefs: () => Promise<Record<string, unknown>>;
  savePrefs: (prefs: Record<string, unknown>) => Promise<void>;
  loadBuffer: (sessionId: string) => Promise<string | null>;
  cleanupOldBuffers: (oldIds: string[]) => Promise<void>;

  // Work log
  logPrompt: (data: Omit<WorkLogEntry, 'timestamp'>) => Promise<void>;
  loadWorkLog: () => Promise<WorkLogEntry[]>;
  clearWorkLog: () => Promise<void>;

  // Settings
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (s: AppSettings) => Promise<void>;

  // App
  openAppFolder: () => Promise<void>;
  getAppDir: () => Promise<string>;
  checkCrash: () => Promise<boolean>;
  checkUpdate: () => Promise<UpdateCheckResult>;
  applyUpdate: () => Promise<Result & { openedBrowser?: boolean }>;
  restartApp: () => Promise<void>;
  getAppInfo: () => Promise<AppInfo>;

  // License
  licenseStatus: () => Promise<LicenseStatus>;
  licenseActivate: (key: string) => Promise<Result>;
  licenseDeactivate: () => Promise<Result>;

  // Harness
  harnessReadClaudeMd: (cwd: string) => Promise<FileContent>;
  harnessWriteClaudeMd: (cwd: string, content: string) => Promise<Result>;
  harnessReadUserClaudeMd: () => Promise<FileContent>;
  harnessWriteUserClaudeMd: (content: string) => Promise<Result>;
  harnessReadHooks: (cwd: string) => Promise<HooksConfig>;
  harnessWriteHooks: (cwd: string, hooks: unknown) => Promise<Result>;
  harnessReadMemory: () => Promise<MemoryFile[]>;
  harnessReadMemoryContent: (file: string) => Promise<{ content: string; error?: string }>;
  harnessWriteMemory: (file: string, content: string) => Promise<Result>;
  harnessDeleteMemory: (file: string) => Promise<Result>;
  harnessLoadProjects: () => Promise<Array<{ path: string; name: string }>>;
  harnessSaveProjects: (projects: Array<{ path: string; name: string }>) => Promise<Result>;
  harnessPickFolder: () => Promise<string | null>;

  // Events
  onSessionOutput: (id: string, cb: (data: string) => void) => () => void;
  onSessionExit: (id: string, cb: (info: SessionExitInfo) => void) => () => void;
  onMenuAction: (cb: (action: string) => void) => void;
  removeListeners: (id: string) => void;
}

declare global {
  interface Window {
    api: CodeHarnessAPI;
  }
}

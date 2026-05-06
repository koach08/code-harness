import { app, BrowserWindow, ipcMain, Menu, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import type {
  SessionCreateOpts,
  SessionMode,
  SessionSaved,
  WorkLogEntry,
  AppSettings,
} from './types';
import { registerAIHandlers } from './ipc/ai.ipc';
import { registerPipelineHandlers } from './ipc/pipeline.ipc';
import { registerAgentHandlers } from './ipc/agent.ipc';
import { registerBuilderHandlers } from './ipc/builder.ipc';
import { registerNotebookHandlers } from './ipc/notebook.ipc';

// ── Constants ──
const APP_DIR = path.join(os.homedir(), '.code-harness');
const BUFFERS_DIR = path.join(APP_DIR, 'buffers');
const CRASH_FLAG = path.join(APP_DIR, '.running');
const SESSIONS_FILE = path.join(APP_DIR, 'sessions.json');
const PREFS_FILE = path.join(APP_DIR, 'prefs.json');
const SETTINGS_FILE = path.join(APP_DIR, 'settings.json');
const PROJECTS_FILE = path.join(APP_DIR, 'projects.json');
const WORKLOG_FILE = path.join(APP_DIR, 'work-log.json');
const LICENSE_PATH = path.join(APP_DIR, 'license.json');

const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const MAX_BUFFER = 1024 * 1024;
const MAX_LOG_ENTRIES = 200;
const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 14,
  autoSaveInterval: 10,
  doubleEnterDelay: 500,
};

// ── State ──
interface SessionData {
  pty: ReturnType<typeof import('node-pty').spawn>;
  cwd: string;
  name: string;
  mode: SessionMode;
  conversationId: string | null;
  createdAt: string;
}

const sessions = new Map<string, SessionData>();
const sessionBuffers = new Map<string, string>();
let mainWindow: BrowserWindow | null = null;
let pty: typeof import('node-pty') | null = null;
let saveTimer: ReturnType<typeof setInterval> | null = null;
let sessionsSavedOnClose = false;

// ── Resolve shell env ──
let shellEnv: Record<string, string> = { ...process.env } as Record<string, string>;
if (!IS_WIN) {
  try {
    const sh = IS_MAC ? '/bin/zsh' : '/bin/bash';
    const out = execSync(`${sh} -ilc "env"`, { encoding: 'utf-8', timeout: 10000 });
    out.split('\n').forEach((line) => {
      const i = line.indexOf('=');
      if (i > 0) shellEnv[line.substring(0, i)] = line.substring(i + 1);
    });
  } catch {}
}

function getPty() {
  if (!pty) pty = require('node-pty');
  return pty!;
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

// ── Window ──
function createWindow() {
  let bounds: Electron.Rectangle = { x: 0, y: 0, width: 1400, height: 900 };
  try {
    const saved = JSON.parse(
      fs.readFileSync(path.join(APP_DIR, 'window.json'), 'utf-8')
    );
    bounds = saved;
  } catch {}

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: '#00000000', // Transparent for vibrancy
    transparent: IS_MAC,
    vibrancy: IS_MAC ? 'under-window' : undefined,
    visualEffectState: IS_MAC ? 'active' : undefined,
    title: 'Code Harness',
    titleBarStyle: IS_MAC ? 'hiddenInset' : 'default',
    trafficLightPosition: IS_MAC ? { x: 16, y: 18 } : undefined,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    roundedCorners: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Dev mode: load Vite dev server. Prod: load built index.html
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('close', () => {
    saveSessionsSync();
    try {
      ensureDir(APP_DIR);
      fs.writeFileSync(
        path.join(APP_DIR, 'window.json'),
        JSON.stringify(mainWindow!.getBounds())
      );
    } catch {}
  });

  mainWindow.on('blur', () => saveSessionsSync());
}

// ── Menu ──
function createMenu() {
  const send = (action: string) => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('menu-action', action);
  };
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(IS_MAC
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => send('new-tab') },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => send('close-tab') },
        { type: 'separator' },
        {
          label: 'Save Session',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            saveSessionsSync();
            send('saved');
          },
        },
        ...(!IS_MAC ? [{ type: 'separator' as const }, { role: 'quit' as const }] : []),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'Settings...', accelerator: 'CmdOrCtrl+,', click: () => send('settings') },
        { type: 'separator' },
        { label: 'Check for Updates...', click: () => send('check-update') },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(IS_MAC ? [{ type: 'separator' as const }, { role: 'front' as const }] : []),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Session IPC ──
const MODE_NAMES: Record<SessionMode, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  aider: 'Aider',
  shell: 'Terminal',
};

function resolveCommand(mode: SessionMode, conversationId?: string | null) {
  let cmd: string;
  let args: string[];

  switch (mode) {
    case 'claude':
      cmd = IS_WIN ? 'claude.cmd' : 'claude';
      args = conversationId ? ['--resume', conversationId] : [];
      break;
    case 'codex':
      cmd = IS_WIN ? 'codex.cmd' : 'codex';
      args = [];
      break;
    case 'aider':
      cmd = IS_WIN ? 'aider.cmd' : 'aider';
      args = [];
      break;
    default:
      if (IS_WIN) {
        cmd = 'powershell.exe';
        args = [];
      } else {
        cmd = IS_MAC ? '/bin/zsh' : process.env.SHELL || '/bin/bash';
        args = ['--login', '-i'];
      }
  }
  return { cmd, args };
}

function genId() {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

ipcMain.handle('create-session', async (_e, opts: SessionCreateOpts = {}) => {
  const id = genId();
  const nodePty = getPty();
  const cwd = opts.cwd || os.homedir();
  const mode = opts.mode || 'claude';
  const { cmd, args } = resolveCommand(
    mode,
    opts.conversationId || (opts.restoreFromId ? '__continue__' : null)
  );

  const finalArgs =
    mode === 'claude' && opts.restoreFromId && !opts.conversationId
      ? ['--continue']
      : args;

  const ptyProcess = nodePty.spawn(cmd, finalArgs, {
    name: IS_WIN ? undefined : 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd,
    env: shellEnv,
  });

  const sessionData: SessionData = {
    pty: ptyProcess,
    cwd,
    name: opts.name || MODE_NAMES[mode] || 'Terminal',
    mode,
    conversationId: opts.conversationId || null,
    createdAt: new Date().toISOString(),
  };
  sessions.set(id, sessionData);

  let initialBuffer = '';
  if (opts.restoreFromId) {
    try {
      initialBuffer = fs.readFileSync(
        path.join(BUFFERS_DIR, `${opts.restoreFromId}.buf`),
        'utf-8'
      );
    } catch {}
  }
  sessionBuffers.set(id, initialBuffer);

  ptyProcess.onData((data: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`session-output-${id}`, data);
    }
    let buf = (sessionBuffers.get(id) || '') + data;
    if (buf.length > MAX_BUFFER) buf = buf.slice(-MAX_BUFFER);
    sessionBuffers.set(id, buf);
  });

  ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`session-exit-${id}`, { exitCode, signal });
    }
  });

  return { id, name: sessionData.name, cwd, mode };
});

ipcMain.handle('switch-mode', async (_e, { sessionId, newMode }: { sessionId: string; newMode: SessionMode }) => {
  const old = sessions.get(sessionId);
  if (!old) return null;
  const { cwd } = old;
  try { old.pty.kill(); } catch {}
  sessionBuffers.delete(sessionId);
  sessions.delete(sessionId);

  const nodePty = getPty();
  const { cmd, args } = resolveCommand(newMode);
  const newId = genId();

  const ptyProcess = nodePty.spawn(cmd, args, {
    name: IS_WIN ? undefined : 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd,
    env: shellEnv,
  });

  sessions.set(newId, {
    pty: ptyProcess,
    cwd,
    name: MODE_NAMES[newMode] || 'Terminal',
    mode: newMode,
    conversationId: null,
    createdAt: new Date().toISOString(),
  });
  sessionBuffers.set(newId, '');

  ptyProcess.onData((data: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`session-output-${newId}`, data);
    }
    let buf = (sessionBuffers.get(newId) || '') + data;
    if (buf.length > MAX_BUFFER) buf = buf.slice(-MAX_BUFFER);
    sessionBuffers.set(newId, buf);
  });

  ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`session-exit-${newId}`, { exitCode });
    }
  });

  return { newId, name: MODE_NAMES[newMode] || 'Terminal', cwd, mode: newMode };
});

ipcMain.handle('send-input', async (_e, { sessionId, input }: { sessionId: string; input: string }) => {
  const s = sessions.get(sessionId);
  if (s?.pty) try { s.pty.write(input); } catch {}
});

ipcMain.handle('resize-terminal', async (_e, { sessionId, cols, rows }: { sessionId: string; cols: number; rows: number }) => {
  const s = sessions.get(sessionId);
  if (s?.pty) try { s.pty.resize(cols, rows); } catch {}
});

ipcMain.handle('close-session', async (_e, { sessionId }: { sessionId: string }) => {
  const s = sessions.get(sessionId);
  if (s?.pty) try { s.pty.kill(); } catch {}
  sessions.delete(sessionId);
  sessionBuffers.delete(sessionId);
  try { fs.unlinkSync(path.join(BUFFERS_DIR, `${sessionId}.buf`)); } catch {}
});

// ── CLI check ──
ipcMain.handle('check-claude-cli', async () => {
  try {
    const whichCmd = IS_WIN
      ? 'where claude'
      : `${IS_MAC ? '/bin/zsh' : '/bin/bash'} -ilc "which claude"`;
    const result = execSync(whichCmd, { encoding: 'utf-8', timeout: 10000 }).trim();
    if (result?.includes('claude')) {
      let version = '';
      try {
        const verCmd = IS_WIN
          ? 'claude --version'
          : `${IS_MAC ? '/bin/zsh' : '/bin/bash'} -ilc "claude --version"`;
        version = execSync(verCmd, { encoding: 'utf-8', timeout: 10000 }).trim();
      } catch {}
      return { installed: true, path: result, version };
    }
    return { installed: false };
  } catch {
    return { installed: false };
  }
});

ipcMain.handle('install-claude-cli', async () => {
  try {
    const installCmd = IS_WIN
      ? 'npm install -g @anthropic-ai/claude-code'
      : `${IS_MAC ? '/bin/zsh' : '/bin/bash'} -ilc "npm install -g @anthropic-ai/claude-code"`;
    execSync(installCmd, { encoding: 'utf-8', timeout: 120000 });
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
});

ipcMain.handle('resolve-cwd', async (_e, droppedPath: string) => {
  try {
    const stat = fs.statSync(droppedPath);
    return stat.isDirectory() ? droppedPath : path.dirname(droppedPath);
  } catch {
    return os.homedir();
  }
});

// ── Project scanning ──
ipcMain.handle('scan-project', async (_e, { cwd }: { cwd: string }) => {
  const result = {
    name: path.basename(cwd),
    cwd,
    framework: null as string | null,
    language: null as string | null,
    packageName: undefined as string | undefined,
    version: undefined as string | undefined,
    scripts: [] as string[],
    dependencies: [] as string[],
    configs: [] as string[],
    suggestions: [] as string[],
  };

  try {
    const exists = (f: string) => fs.existsSync(path.join(cwd, f));
    const readJson = (f: string) => {
      try { return JSON.parse(fs.readFileSync(path.join(cwd, f), 'utf-8')); } catch { return null; }
    };
    const readText = (f: string) => {
      try { return fs.readFileSync(path.join(cwd, f), 'utf-8'); } catch { return ''; }
    };

    if (exists('package.json')) {
      const pkg = readJson('package.json');
      if (pkg) {
        result.packageName = pkg.name;
        result.version = pkg.version;
        result.scripts = pkg.scripts ? Object.keys(pkg.scripts) : [];
        const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        result.dependencies = Object.keys(allDeps);

        if (allDeps['next']) { result.framework = 'Next.js'; result.language = 'JavaScript'; }
        else if (allDeps['nuxt']) { result.framework = 'Nuxt'; result.language = 'JavaScript'; }
        else if (allDeps['react']) { result.framework = 'React'; result.language = 'JavaScript'; }
        else if (allDeps['vue']) { result.framework = 'Vue'; result.language = 'JavaScript'; }
        else if (allDeps['svelte'] || allDeps['@sveltejs/kit']) { result.framework = 'Svelte'; result.language = 'JavaScript'; }
        else if (allDeps['express']) { result.framework = 'Express'; result.language = 'JavaScript'; }
        else if (allDeps['electron']) { result.framework = 'Electron'; result.language = 'JavaScript'; }

        if (allDeps['typescript'] || exists('tsconfig.json')) result.language = 'TypeScript';

        const configChecks: [string, string][] = [
          ['vercel.json', 'vercel'], ['netlify.toml', 'netlify'],
          ['Dockerfile', 'docker'],
        ];
        for (const [file, name] of configChecks) {
          if (exists(file)) result.configs.push(name);
        }

        const depChecks: [string, string][] = [
          ['@supabase/supabase-js', 'supabase'], ['firebase', 'firebase'],
          ['stripe', 'stripe'], ['@prisma/client', 'prisma'],
          ['@capacitor/core', 'capacitor'],
        ];
        for (const [dep, name] of depChecks) {
          if (allDeps[dep]) result.configs.push(name);
        }
        if (exists('capacitor.config.ts') || exists('capacitor.config.json')) result.configs.push('capacitor');
        if (exists('tauri.conf.json') || exists('src-tauri')) result.configs.push('tauri');
      }
    }

    if (exists('requirements.txt') || exists('pyproject.toml')) {
      result.language = result.language || 'Python';
      const req = readText('requirements.txt') + readText('pyproject.toml');
      if (req.includes('streamlit')) result.framework = result.framework || 'Streamlit';
      else if (req.includes('fastapi')) result.framework = result.framework || 'FastAPI';
      else if (req.includes('django')) result.framework = result.framework || 'Django';
    }

    if (exists('Package.swift') || exists('.xcodeproj') || exists('.xcworkspace')) {
      result.language = result.language || 'Swift';
      result.framework = result.framework || 'Xcode';
    }

    if (exists('Cargo.toml')) { result.language = result.language || 'Rust'; }
    if (exists('go.mod')) { result.language = result.language || 'Go'; }
    if (exists('pubspec.yaml')) { result.language = result.language || 'Dart'; result.framework = result.framework || 'Flutter'; }

    // Suggestions
    if (result.framework || result.language) {
      result.suggestions.push('supabase', 'stripe', 'auth');
      if (['Next.js', 'React', 'Vue', 'Svelte', 'Nuxt'].includes(result.framework || '')) {
        result.suggestions.push('vercel', 'capacitor-ios', 'capacitor-android');
      }
    } else {
      result.suggestions.push('empty');
    }
  } catch {}

  return result;
});

// ── Persistence ──
function saveSessionsSync() {
  try {
    ensureDir(APP_DIR);
    ensureDir(BUFFERS_DIR);
    const data: SessionSaved[] = [];
    for (const [id, s] of sessions) {
      data.push({
        id,
        name: s.name,
        cwd: s.cwd,
        mode: s.mode,
        conversationId: s.conversationId,
        createdAt: s.createdAt,
        savedAt: new Date().toISOString(),
      });
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
    for (const [id, buf] of sessionBuffers) {
      fs.writeFileSync(path.join(BUFFERS_DIR, `${id}.buf`), buf, 'utf-8');
    }
  } catch {}
}

ipcMain.handle('save-sessions', async () => saveSessionsSync());
ipcMain.handle('load-sessions', async () => {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
  } catch { return []; }
});

ipcMain.handle('load-buffer', async (_e, { sessionId }: { sessionId: string }) => {
  try { return fs.readFileSync(path.join(BUFFERS_DIR, `${sessionId}.buf`), 'utf-8'); }
  catch { return null; }
});

ipcMain.handle('cleanup-old-buffers', async (_e, { oldIds }: { oldIds: string[] }) => {
  for (const id of oldIds) {
    try { fs.unlinkSync(path.join(BUFFERS_DIR, `${id}.buf`)); } catch {}
  }
});

// ── Crash detection ──
ipcMain.handle('check-crash', async () => {
  try { return fs.existsSync(CRASH_FLAG); } catch { return false; }
});

function setCrashFlag() {
  try { ensureDir(APP_DIR); fs.writeFileSync(CRASH_FLAG, new Date().toISOString()); } catch {}
}

function clearCrashFlag() {
  try { fs.unlinkSync(CRASH_FLAG); } catch {}
}

// ── Work Log ──
function loadWorkLogData(): WorkLogEntry[] {
  try {
    if (fs.existsSync(WORKLOG_FILE)) return JSON.parse(fs.readFileSync(WORKLOG_FILE, 'utf-8'));
  } catch {}
  return [];
}

ipcMain.handle('log-prompt', async (_e, data: Omit<WorkLogEntry, 'timestamp'>) => {
  try {
    ensureDir(APP_DIR);
    const log = loadWorkLogData();
    log.push({ ...data, timestamp: new Date().toISOString() });
    if (log.length > MAX_LOG_ENTRIES) log.splice(0, log.length - MAX_LOG_ENTRIES);
    fs.writeFileSync(WORKLOG_FILE, JSON.stringify(log, null, 2));
  } catch {}
});

ipcMain.handle('load-work-log', async () => loadWorkLogData());
ipcMain.handle('clear-work-log', async () => {
  try { fs.writeFileSync(WORKLOG_FILE, '[]'); } catch {}
});

// ── Prefs ──
ipcMain.handle('load-prefs', async () => {
  try { return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf-8')); } catch { return {}; }
});
ipcMain.handle('save-prefs', async (_e, prefs: Record<string, unknown>) => {
  try { ensureDir(APP_DIR); fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2)); } catch {}
});

// ── Settings ──
ipcMain.handle('load-settings', async () => {
  try {
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    return { ...DEFAULT_SETTINGS, ...data };
  } catch { return { ...DEFAULT_SETTINGS }; }
});
ipcMain.handle('save-settings', async (_e, settings: AppSettings) => {
  try { ensureDir(APP_DIR); fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2)); } catch {}
});

ipcMain.handle('open-app-folder', async () => { shell.openPath(__dirname); });
ipcMain.handle('get-app-dir', async () => __dirname);

// ── Harness: CLAUDE.md ──
ipcMain.handle('harness-read-claudemd', async (_e, { cwd }: { cwd: string }) => {
  const fp = path.join(cwd, 'CLAUDE.md');
  try {
    if (fs.existsSync(fp)) return { exists: true, content: fs.readFileSync(fp, 'utf-8') };
    return { exists: false, content: '' };
  } catch { return { exists: false, content: '' }; }
});

ipcMain.handle('harness-write-claudemd', async (_e, { cwd, content }: { cwd: string; content: string }) => {
  try { fs.writeFileSync(path.join(cwd, 'CLAUDE.md'), content, 'utf-8'); return { success: true }; }
  catch (e: unknown) { return { success: false, error: (e as Error).message }; }
});

ipcMain.handle('harness-read-user-claudemd', async () => {
  const fp = path.join(os.homedir(), '.claude', 'CLAUDE.md');
  try {
    if (fs.existsSync(fp)) return { exists: true, content: fs.readFileSync(fp, 'utf-8') };
    return { exists: false, content: '' };
  } catch { return { exists: false, content: '' }; }
});

ipcMain.handle('harness-write-user-claudemd', async (_e, { content }: { content: string }) => {
  const dir = path.join(os.homedir(), '.claude');
  try { ensureDir(dir); fs.writeFileSync(path.join(dir, 'CLAUDE.md'), content, 'utf-8'); return { success: true }; }
  catch (e: unknown) { return { success: false, error: (e as Error).message }; }
});

// ── Harness: Hooks ──
ipcMain.handle('harness-read-hooks', async (_e, { cwd }: { cwd: string }) => {
  const result = { project: null as Record<string, unknown> | null, user: null as Record<string, unknown> | null };
  try {
    const pf = path.join(cwd, '.claude', 'settings.json');
    if (fs.existsSync(pf)) { const d = JSON.parse(fs.readFileSync(pf, 'utf-8')); result.project = d.hooks || null; }
  } catch {}
  try {
    const uf = path.join(os.homedir(), '.claude', 'settings.json');
    if (fs.existsSync(uf)) { const d = JSON.parse(fs.readFileSync(uf, 'utf-8')); result.user = d.hooks || null; }
  } catch {}
  return result;
});

ipcMain.handle('harness-write-hooks', async (_e, { cwd, hooks }: { cwd: string; hooks: unknown }) => {
  const sp = path.join(cwd, '.claude', 'settings.json');
  try {
    ensureDir(path.join(cwd, '.claude'));
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(fs.readFileSync(sp, 'utf-8')); } catch {}
    data.hooks = hooks;
    fs.writeFileSync(sp, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (e: unknown) { return { success: false, error: (e as Error).message }; }
});

// ── Harness: Memory ──
ipcMain.handle('harness-read-memory', async () => {
  const memDir = path.join(os.homedir(), '.claude', 'memory');
  const result: Array<{ file: string; name: string; type: string; description: string }> = [];
  try {
    if (!fs.existsSync(memDir)) return result;
    const files = fs.readdirSync(memDir).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md');
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(memDir, file), 'utf-8');
        const nameMatch = content.match(/^name:\s*(.+)/m);
        const typeMatch = content.match(/^type:\s*(.+)/m);
        const descMatch = content.match(/^description:\s*(.+)/m);
        result.push({
          file,
          name: nameMatch?.[1]?.trim() || file.replace('.md', ''),
          type: typeMatch?.[1]?.trim() || 'unknown',
          description: descMatch?.[1]?.trim() || '',
        });
      } catch {}
    }
  } catch {}
  return result;
});

ipcMain.handle('harness-read-memory-content', async (_e, { file }: { file: string }) => {
  const memDir = path.join(os.homedir(), '.claude', 'memory');
  try { return { content: fs.readFileSync(path.join(memDir, file), 'utf-8') }; }
  catch (e: unknown) { return { content: '', error: (e as Error).message }; }
});

ipcMain.handle('harness-write-memory', async (_e, { file, content }: { file: string; content: string }) => {
  const memDir = path.join(os.homedir(), '.claude', 'memory');
  try { ensureDir(memDir); fs.writeFileSync(path.join(memDir, file), content, 'utf-8'); return { success: true }; }
  catch (e: unknown) { return { success: false, error: (e as Error).message }; }
});

ipcMain.handle('harness-delete-memory', async (_e, { file }: { file: string }) => {
  const memDir = path.join(os.homedir(), '.claude', 'memory');
  try { fs.unlinkSync(path.join(memDir, file)); return { success: true }; }
  catch (e: unknown) { return { success: false, error: (e as Error).message }; }
});

// ── Harness: Projects ──
ipcMain.handle('harness-load-projects', async () => {
  try { if (fs.existsSync(PROJECTS_FILE)) return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8')); }
  catch {}
  return [];
});

ipcMain.handle('harness-save-projects', async (_e, projects: unknown) => {
  try { ensureDir(APP_DIR); fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2)); return { success: true }; }
  catch (e: unknown) { return { success: false, error: (e as Error).message }; }
});

ipcMain.handle('harness-pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

// ── License ──
function readLicense() {
  try { if (fs.existsSync(LICENSE_PATH)) return JSON.parse(fs.readFileSync(LICENSE_PATH, 'utf-8')); }
  catch {}
  return null;
}

const FREE_FEATURES = { maxTabs: 3, maxProjects: 3, aiderMode: false, hooksEdit: false, memoryEdit: false, builderTemplates: ['build-saas', 'build-lp', 'build-blog', 'build-portfolio', 'build-pwa'] };
const PRO_FEATURES = { maxTabs: Infinity, maxProjects: Infinity, aiderMode: true, hooksEdit: true, memoryEdit: true, builderTemplates: 'all' as const };

ipcMain.handle('license-status', async () => {
  const license = readLicense();
  const isPro = !!license?.valid;
  return {
    isPro,
    key: license?.key ? license.key.slice(0, 8) + '...' : '',
    activatedAt: license?.activatedAt || '',
    features: isPro ? PRO_FEATURES : FREE_FEATURES,
  };
});

ipcMain.handle('license-activate', async (_e, { key }: { key: string }) => {
  try {
    const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: key, instance_name: `code-harness-${Date.now()}` }),
    });
    const data = await res.json();
    if (data.activated || data.meta?.store_id) {
      ensureDir(APP_DIR);
      fs.writeFileSync(LICENSE_PATH, JSON.stringify({ key, valid: true, activatedAt: new Date().toISOString(), instanceId: data.instance?.id || null }, null, 2));
      return { success: true };
    }
    if (data.error === 'license_key_already_activated' || res.status === 422) {
      const vRes = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: key }),
      });
      const vData = await vRes.json();
      if (vData.valid) {
        ensureDir(APP_DIR);
        fs.writeFileSync(LICENSE_PATH, JSON.stringify({ key, valid: true, activatedAt: new Date().toISOString() }, null, 2));
        return { success: true };
      }
    }
    return { success: false, error: data.error || 'Invalid license key' };
  } catch {
    return { success: false, error: 'Could not connect to license server.' };
  }
});

ipcMain.handle('license-deactivate', async () => {
  try { fs.unlinkSync(LICENSE_PATH); } catch {}
  return { success: true };
});

// ── Update ──
function getSourceDir() {
  try { fs.accessSync(path.join(__dirname, '..', '.git'), fs.constants.R_OK); return path.join(__dirname, '..'); }
  catch { return null; }
}

ipcMain.handle('check-update', async () => {
  const sourceDir = getSourceDir();
  if (sourceDir) {
    try {
      execSync('git fetch origin', { cwd: sourceDir, encoding: 'utf-8', timeout: 15000 });
      const status = execSync('git status -uno --porcelain -b', { cwd: sourceDir, encoding: 'utf-8', timeout: 5000 });
      const behind = status.includes('behind');
      let changes = '';
      if (behind) try { changes = execSync('git log HEAD..origin/main --oneline -10', { cwd: sourceDir, encoding: 'utf-8', timeout: 5000 }).trim(); } catch {}
      return { updateAvailable: behind, changes };
    } catch (e: unknown) {
      return { updateAvailable: false, error: (e as Error).message };
    }
  }
  return { updateAvailable: false };
});

ipcMain.handle('apply-update', async () => {
  const sourceDir = getSourceDir();
  if (sourceDir) {
    try {
      execSync('git stash', { cwd: sourceDir, encoding: 'utf-8', timeout: 10000 });
      execSync('git pull origin main', { cwd: sourceDir, encoding: 'utf-8', timeout: 30000 });
      try { execSync('git stash pop', { cwd: sourceDir, encoding: 'utf-8', timeout: 10000 }); } catch {}
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  }
  return { success: false, error: 'No source directory' };
});

ipcMain.handle('restart-app', async () => { app.relaunch(); app.exit(0); });

ipcMain.handle('get-app-info', async () => {
  let gitHash = '';
  try { gitHash = execSync('git rev-parse --short HEAD', { cwd: path.join(__dirname, '..'), encoding: 'utf-8', timeout: 3000 }).trim(); } catch {}
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
  return { version: pkg.version, gitHash, electronVersion: process.versions.electron, nodeVersion: process.versions.node };
});

// ── Lifecycle ──
app.whenReady().then(() => {
  setCrashFlag();
  createWindow();
  createMenu();
  registerAIHandlers(() => mainWindow);
  registerPipelineHandlers(() => mainWindow);
  registerAgentHandlers(() => mainWindow);
  registerBuilderHandlers();
  registerNotebookHandlers(() => mainWindow);
  saveTimer = setInterval(saveSessionsSync, 10000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (!sessionsSavedOnClose) { saveSessionsSync(); sessionsSavedOnClose = true; }
  clearCrashFlag();
  if (saveTimer) clearInterval(saveTimer);
});

app.on('window-all-closed', () => {
  if (!sessionsSavedOnClose) { saveSessionsSync(); sessionsSavedOnClose = true; }
  for (const [, s] of sessions) { try { s.pty.kill(); } catch {} }
  sessions.clear();
  sessionBuffers.clear();
  clearCrashFlag();
  app.quit();
});

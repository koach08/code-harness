const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync, spawn } = require('child_process');

const APP_DIR = path.join(os.homedir(), '.code-harness');
const BUFFERS_DIR = path.join(APP_DIR, 'buffers');
const CRASH_FLAG = path.join(APP_DIR, '.running');
const sessions = new Map();
const sessionBuffers = new Map();
const MAX_BUFFER = 1024 * 1024;
let mainWindow = null;
let pty = null;

// ── Resolve shell env ──
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';

let shellEnv = { ...process.env };
if (!IS_WIN) {
  try {
    const sh = IS_MAC ? '/bin/zsh' : '/bin/bash';
    const out = require('child_process').execSync(
      `${sh} -ilc "env"`, { encoding: 'utf-8', timeout: 10000 }
    );
    out.split('\n').forEach(line => {
      const i = line.indexOf('=');
      if (i > 0) shellEnv[line.substring(0, i)] = line.substring(i + 1);
    });
  } catch (_) {}
}

function getPty() {
  if (!pty) pty = require('node-pty');
  return pty;
}

function createWindow() {
  let bounds = { width: 1400, height: 900 };
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'window.json'), 'utf-8'));
    bounds = saved;
  } catch (_) {}

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 700,
    minHeight: 450,
    backgroundColor: '#1a1b26',
    title: 'Code Harness',
    titleBarStyle: IS_MAC ? 'hiddenInset' : 'default',
    trafficLightPosition: IS_MAC ? { x: 12, y: 12 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.on('close', () => {
    saveSessionsSync();
    try {
      fs.mkdirSync(APP_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(APP_DIR, 'window.json'),
        JSON.stringify(mainWindow.getBounds())
      );
    } catch (_) {}
  });

  mainWindow.on('blur', () => saveSessionsSync());
}

// ── Application Menu ──
function createMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('menu-action', 'new-tab'); }
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('menu-action', 'close-tab'); }
        },
        { type: 'separator' },
        {
          label: 'Save Session',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            saveSessionsSync();
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('menu-action', 'saved');
          }
        },
        ...(!isMac ? [{ type: 'separator' }, { role: 'quit' }] : [])
      ]
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
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Settings...',
          accelerator: 'CmdOrCtrl+,',
          click: () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('menu-action', 'settings'); }
        },
        { type: 'separator' },
        {
          label: 'Edit This App with Claude Code',
          click: () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('menu-action', 'edit-app-claude'); }
        },
        {
          label: 'Open App Folder',
          click: () => { shell.openPath(path.join(__dirname)); }
        },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('menu-action', 'check-update'); }
        },
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [])
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── IPC: Create session ──
ipcMain.handle('create-session', async (_event, { cwd, name, mode, restoreFromId, conversationId }) => {
  const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const nodePty = getPty();
  const sessionCwd = cwd || os.homedir();
  const sessionMode = mode || 'claude';

  let cmd, args;
  if (sessionMode === 'claude') {
    cmd = IS_WIN ? 'claude.cmd' : 'claude';
    if (conversationId) {
      args = ['--resume', conversationId];
    } else if (restoreFromId) {
      args = ['--continue'];
    } else {
      args = [];
    }
  } else if (sessionMode === 'codex') {
    cmd = IS_WIN ? 'codex.cmd' : 'codex';
    args = [];
  } else if (sessionMode === 'aider') {
    cmd = IS_WIN ? 'aider.cmd' : 'aider';
    args = [];
  } else {
    if (IS_WIN) {
      cmd = 'powershell.exe';
      args = [];
    } else {
      cmd = IS_MAC ? '/bin/zsh' : (process.env.SHELL || '/bin/bash');
      args = ['--login', '-i'];
    }
  }

  const ptyProcess = nodePty.spawn(cmd, args, {
    name: IS_WIN ? undefined : 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: sessionCwd,
    env: shellEnv,
  });

  const modeNames = { claude: 'Claude Code', codex: 'Codex', aider: 'Aider', shell: 'Terminal' };
  const sessionData = {
    pty: ptyProcess,
    cwd: sessionCwd,
    name: name || modeNames[sessionMode] || 'Terminal',
    mode: sessionMode,
    conversationId: conversationId || null,
    createdAt: new Date().toISOString(),
  };
  sessions.set(id, sessionData);

  let initialBuffer = '';
  if (restoreFromId) {
    try {
      initialBuffer = fs.readFileSync(path.join(BUFFERS_DIR, `${restoreFromId}.buf`), 'utf-8');
    } catch (_) {}
  }
  sessionBuffers.set(id, initialBuffer);

  ptyProcess.onData((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`session-output-${id}`, data);
    }
    let buf = (sessionBuffers.get(id) || '') + data;
    if (buf.length > MAX_BUFFER) buf = buf.slice(-MAX_BUFFER);
    sessionBuffers.set(id, buf);
  });
  ptyProcess.onExit(({ exitCode, signal }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`session-exit-${id}`, { exitCode, signal });
    }
  });

  return { id, name: sessionData.name, cwd: sessionData.cwd, mode: sessionMode };
});

// ── IPC: Switch mode ──
ipcMain.handle('switch-mode', async (_event, { sessionId, newMode }) => {
  const old = sessions.get(sessionId);
  if (!old) return null;
  const { cwd } = old;
  try { old.pty.kill(); } catch (_) {}
  sessionBuffers.delete(sessionId);
  sessions.delete(sessionId);

  const nodePty = getPty();
  let cmd, args;
  if (newMode === 'claude') {
    cmd = IS_WIN ? 'claude.cmd' : 'claude';
    args = [];
  } else if (newMode === 'codex') {
    cmd = IS_WIN ? 'codex.cmd' : 'codex';
    args = [];
  } else if (newMode === 'aider') {
    cmd = IS_WIN ? 'aider.cmd' : 'aider';
    args = [];
  } else {
    if (IS_WIN) { cmd = 'powershell.exe'; args = []; }
    else { cmd = IS_MAC ? '/bin/zsh' : (process.env.SHELL || '/bin/bash'); args = ['--login', '-i']; }
  }

  const newId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const ptyProcess = nodePty.spawn(cmd, args, {
    name: IS_WIN ? undefined : 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd,
    env: shellEnv,
  });

  const modeNames = { claude: 'Claude Code', codex: 'Codex', aider: 'Aider', shell: 'Terminal' };
  sessions.set(newId, {
    pty: ptyProcess,
    cwd,
    name: modeNames[newMode] || 'Terminal',
    mode: newMode,
    createdAt: new Date().toISOString(),
  });
  sessionBuffers.set(newId, '');

  ptyProcess.onData((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`session-output-${newId}`, data);
    }
    let buf = (sessionBuffers.get(newId) || '') + data;
    if (buf.length > MAX_BUFFER) buf = buf.slice(-MAX_BUFFER);
    sessionBuffers.set(newId, buf);
  });
  ptyProcess.onExit(({ exitCode }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`session-exit-${newId}`, { exitCode });
    }
  });

  return { newId, name: modeNames[newMode] || 'Terminal', cwd, mode: newMode };
});

ipcMain.handle('send-input', async (_e, { sessionId, input }) => {
  const s = sessions.get(sessionId);
  if (s && s.pty) { try { s.pty.write(input); } catch (_) {} }
});

ipcMain.handle('resize-terminal', async (_e, { sessionId, cols, rows }) => {
  const s = sessions.get(sessionId);
  if (s && s.pty) { try { s.pty.resize(cols, rows); } catch (_) {} }
});

ipcMain.handle('close-session', async (_e, { sessionId }) => {
  const s = sessions.get(sessionId);
  if (s && s.pty) { try { s.pty.kill(); } catch (_) {} sessions.delete(sessionId); }
  sessionBuffers.delete(sessionId);
  try { fs.unlinkSync(path.join(BUFFERS_DIR, `${sessionId}.buf`)); } catch (_) {}
});

// ── CLI check ──
ipcMain.handle('check-claude-cli', async () => {
  try {
    const whichCmd = IS_WIN
      ? 'where claude'
      : `${IS_MAC ? '/bin/zsh' : '/bin/bash'} -ilc "which claude"`;
    const result = require('child_process').execSync(
      whichCmd, { encoding: 'utf-8', timeout: 10000 }
    ).trim();
    if (result && result.includes('claude')) {
      let version = '';
      try {
        const verCmd = IS_WIN
          ? 'claude --version'
          : `${IS_MAC ? '/bin/zsh' : '/bin/bash'} -ilc "claude --version"`;
        version = require('child_process').execSync(
          verCmd, { encoding: 'utf-8', timeout: 10000 }
        ).trim();
      } catch (_) {}
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
    require('child_process').execSync(installCmd, { encoding: 'utf-8', timeout: 120000 });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('resolve-cwd', async (_e, droppedPath) => {
  try {
    const stat = fs.statSync(droppedPath);
    return stat.isDirectory() ? droppedPath : path.dirname(droppedPath);
  } catch {
    return os.homedir();
  }
});

ipcMain.handle('load-buffer', async (_e, { sessionId }) => {
  try {
    return fs.readFileSync(path.join(BUFFERS_DIR, `${sessionId}.buf`), 'utf-8');
  } catch { return null; }
});

ipcMain.handle('cleanup-old-buffers', async (_e, { oldIds }) => {
  for (const id of oldIds) {
    try { fs.unlinkSync(path.join(BUFFERS_DIR, `${id}.buf`)); } catch (_) {}
  }
});

ipcMain.handle('get-app-dir', async () => path.join(__dirname));

// ── Harness Engineering: CLAUDE.md ──
ipcMain.handle('harness-read-claudemd', async (_e, { cwd }) => {
  const filePath = path.join(cwd, 'CLAUDE.md');
  try {
    if (fs.existsSync(filePath)) {
      return { exists: true, content: fs.readFileSync(filePath, 'utf-8') };
    }
    return { exists: false, content: '' };
  } catch { return { exists: false, content: '' }; }
});

ipcMain.handle('harness-write-claudemd', async (_e, { cwd, content }) => {
  try {
    fs.writeFileSync(path.join(cwd, 'CLAUDE.md'), content, 'utf-8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ── Harness Engineering: Hooks (settings.json) ──
ipcMain.handle('harness-read-hooks', async (_e, { cwd }) => {
  // Check project-level settings
  const projectSettings = path.join(cwd, '.claude', 'settings.json');
  // Check user-level settings
  const userSettings = path.join(os.homedir(), '.claude', 'settings.json');

  const result = { project: null, user: null };
  try {
    if (fs.existsSync(projectSettings)) {
      const data = JSON.parse(fs.readFileSync(projectSettings, 'utf-8'));
      result.project = data.hooks || null;
    }
  } catch (_) {}
  try {
    if (fs.existsSync(userSettings)) {
      const data = JSON.parse(fs.readFileSync(userSettings, 'utf-8'));
      result.user = data.hooks || null;
    }
  } catch (_) {}
  return result;
});

ipcMain.handle('harness-write-hooks', async (_e, { cwd, hooks }) => {
  const settingsPath = path.join(cwd, '.claude', 'settings.json');
  try {
    fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
    let data = {};
    try { data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')); } catch (_) {}
    data.hooks = hooks;
    fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ── Harness Engineering: Memory ──
ipcMain.handle('harness-read-memory', async () => {
  const memoryDir = path.join(os.homedir(), '.claude', 'memory');
  const result = [];
  try {
    if (!fs.existsSync(memoryDir)) return result;
    const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md') && f !== 'MEMORY.md');
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(memoryDir, file), 'utf-8');
        const nameMatch = content.match(/^name:\s*(.+)/m);
        const typeMatch = content.match(/^type:\s*(.+)/m);
        const descMatch = content.match(/^description:\s*(.+)/m);
        result.push({
          file,
          name: nameMatch ? nameMatch[1].trim() : file.replace('.md', ''),
          type: typeMatch ? typeMatch[1].trim() : 'unknown',
          description: descMatch ? descMatch[1].trim() : '',
        });
      } catch (_) {}
    }
  } catch (_) {}
  return result;
});

// ── Harness Engineering: Projects ──
const PROJECTS_FILE = path.join(APP_DIR, 'projects.json');

ipcMain.handle('harness-load-projects', async () => {
  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
    }
  } catch (_) {}
  return [];
});

ipcMain.handle('harness-save-projects', async (_e, projects) => {
  try {
    fs.mkdirSync(APP_DIR, { recursive: true });
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('harness-pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

// ── Scan project ──
ipcMain.handle('scan-project', async (_e, { cwd }) => {
  const result = {
    name: path.basename(cwd),
    cwd,
    framework: null,
    language: null,
    dependencies: [],
    configs: [],
    suggestions: [],
  };

  try {
    const exists = (f) => fs.existsSync(path.join(cwd, f));
    const readJson = (f) => { try { return JSON.parse(fs.readFileSync(path.join(cwd, f), 'utf-8')); } catch { return null; } };
    const readText = (f) => { try { return fs.readFileSync(path.join(cwd, f), 'utf-8'); } catch { return ''; } };

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

        if (exists('vercel.json')) result.configs.push('vercel');
        if (exists('netlify.toml')) result.configs.push('netlify');
        if (exists('railway.json') || exists('railway.toml')) result.configs.push('railway');
        if (exists('Dockerfile')) result.configs.push('docker');
        if (exists('docker-compose.yml') || exists('docker-compose.yaml')) result.configs.push('docker-compose');
        if (exists('capacitor.config.ts') || exists('capacitor.config.json')) result.configs.push('capacitor');
        if (exists('electron-builder.yml') || (pkg.build && pkg.build.appId)) result.configs.push('electron-builder');
        if (exists('tauri.conf.json') || exists('src-tauri')) result.configs.push('tauri');

        if (allDeps['@supabase/supabase-js']) result.configs.push('supabase');
        if (allDeps['firebase'] || allDeps['firebase-admin']) result.configs.push('firebase');
        if (allDeps['stripe']) result.configs.push('stripe');
        if (allDeps['@capacitor/core']) result.configs.push('capacitor');
        if (allDeps['@prisma/client']) result.configs.push('prisma');
      }
    }

    if (exists('requirements.txt') || exists('pyproject.toml') || exists('setup.py')) {
      result.language = result.language || 'Python';
      const req = readText('requirements.txt') + readText('pyproject.toml');
      if (req.includes('streamlit')) result.framework = result.framework || 'Streamlit';
      else if (req.includes('fastapi')) result.framework = result.framework || 'FastAPI';
      else if (req.includes('django')) result.framework = result.framework || 'Django';
      else if (req.includes('flask')) result.framework = result.framework || 'Flask';
      if (req.includes('supabase')) result.configs.push('supabase');
    }

    if (exists('Package.swift') || exists('.xcodeproj') || exists('.xcworkspace')) {
      result.language = result.language || 'Swift';
      result.framework = result.framework || 'Xcode';
      result.configs.push('xcode');
    }
    try {
      const entries = fs.readdirSync(cwd);
      for (const e of entries) {
        if (e.endsWith('.xcodeproj') || e.endsWith('.xcworkspace')) {
          if (!result.configs.includes('xcode')) result.configs.push('xcode');
          result.language = result.language || 'Swift';
          break;
        }
      }
    } catch (_) {}

    if (exists('Cargo.toml')) {
      result.language = result.language || 'Rust';
      result.framework = result.framework || 'Cargo';
      const cargo = readText('Cargo.toml');
      if (cargo.includes('tauri')) result.configs.push('tauri');
    }

    if (exists('go.mod')) { result.language = result.language || 'Go'; }

    if (exists('pubspec.yaml')) {
      result.language = result.language || 'Dart';
      result.framework = result.framework || 'Flutter';
    }

    if (!result.framework && !result.language) {
      result.suggestions.push('empty');
    } else {
      if (['Next.js', 'React', 'Vue', 'Svelte', 'Nuxt'].includes(result.framework)) {
        result.suggestions.push('vercel', 'netlify', 'docker');
      }
      if (['Express', 'FastAPI', 'Flask', 'Django'].includes(result.framework)) {
        result.suggestions.push('railway', 'docker', 'vps');
      }
      if (result.framework === 'Streamlit') {
        result.suggestions.push('streamlit-cloud', 'docker');
      }
      if (result.framework === 'Electron') {
        result.suggestions.push('electron-mac', 'electron-win', 'electron-linux');
      }
      if (['Next.js', 'React', 'Vue', 'Svelte'].includes(result.framework)) {
        result.suggestions.push('tauri-mac', 'tauri-win', 'tauri-linux', 'capacitor-ios', 'capacitor-android');
      }
      if (result.language === 'Swift') {
        result.suggestions.push('xcode-ios', 'xcode-mac');
      }
      if (result.framework === 'Flutter') {
        result.suggestions.push('flutter-ios', 'flutter-android', 'flutter-mac', 'flutter-web');
      }
      result.suggestions.push('supabase', 'stripe', 'auth');
    }
  } catch (_) {}

  return result;
});

// ── Persistence ──
function saveSessionsSync() {
  try {
    fs.mkdirSync(APP_DIR, { recursive: true });
    fs.mkdirSync(BUFFERS_DIR, { recursive: true });
    const data = [];
    for (const [id, s] of sessions) {
      data.push({ id, name: s.name, cwd: s.cwd, mode: s.mode, conversationId: s.conversationId || null, createdAt: s.createdAt, savedAt: new Date().toISOString() });
    }
    fs.writeFileSync(path.join(APP_DIR, 'sessions.json'), JSON.stringify(data, null, 2));
    for (const [id, buf] of sessionBuffers) {
      fs.writeFileSync(path.join(BUFFERS_DIR, `${id}.buf`), buf, 'utf-8');
    }
  } catch (_) {}
}
ipcMain.handle('save-sessions', async () => saveSessionsSync());
ipcMain.handle('load-sessions', async () => {
  try {
    const f = path.join(APP_DIR, 'sessions.json');
    if (!fs.existsSync(f)) return [];
    return JSON.parse(fs.readFileSync(f, 'utf-8'));
  } catch { return []; }
});

// ── Crash detection ──
ipcMain.handle('check-crash', async () => {
  try {
    if (fs.existsSync(CRASH_FLAG)) return true;
  } catch (_) {}
  return false;
});

function setCrashFlag() {
  try {
    fs.mkdirSync(APP_DIR, { recursive: true });
    fs.writeFileSync(CRASH_FLAG, new Date().toISOString());
  } catch (_) {}
}

function clearCrashFlag() {
  try { fs.unlinkSync(CRASH_FLAG); } catch (_) {}
}

// ── Work Log ──
const WORKLOG_FILE = path.join(APP_DIR, 'work-log.json');
const MAX_LOG_ENTRIES = 200;

function loadWorkLog() {
  try {
    if (fs.existsSync(WORKLOG_FILE)) return JSON.parse(fs.readFileSync(WORKLOG_FILE, 'utf-8'));
  } catch (_) {}
  return [];
}

function saveWorkLogEntry(entry) {
  try {
    fs.mkdirSync(APP_DIR, { recursive: true });
    const log = loadWorkLog();
    log.push(entry);
    if (log.length > MAX_LOG_ENTRIES) log.splice(0, log.length - MAX_LOG_ENTRIES);
    fs.writeFileSync(WORKLOG_FILE, JSON.stringify(log, null, 2));
  } catch (_) {}
}

ipcMain.handle('log-prompt', async (_e, { sessionId, prompt, sessionName, cwd }) => {
  saveWorkLogEntry({
    sessionId,
    sessionName: sessionName || 'unknown',
    cwd: cwd || '',
    prompt,
    timestamp: new Date().toISOString(),
  });
});

ipcMain.handle('load-work-log', async () => loadWorkLog());

ipcMain.handle('clear-work-log', async () => {
  try { fs.writeFileSync(WORKLOG_FILE, '[]'); } catch (_) {}
});

// ── Prefs ──
const PREFS_FILE = path.join(APP_DIR, 'prefs.json');
ipcMain.handle('load-prefs', async () => {
  try { return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf-8')); } catch { return {}; }
});
ipcMain.handle('save-prefs', async (_e, prefs) => {
  try {
    fs.mkdirSync(APP_DIR, { recursive: true });
    fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2));
  } catch (_) {}
});

// ── Settings ──
const SETTINGS_FILE = path.join(APP_DIR, 'settings.json');
const DEFAULT_SETTINGS = {
  fontSize: 14,
  autoSaveInterval: 10,
  doubleEnterDelay: 500,
};

ipcMain.handle('load-settings', async () => {
  try {
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    return { ...DEFAULT_SETTINGS, ...data };
  } catch { return { ...DEFAULT_SETTINGS }; }
});

ipcMain.handle('save-settings', async (_e, settings) => {
  try {
    fs.mkdirSync(APP_DIR, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (_) {}
});

ipcMain.handle('open-app-folder', async () => {
  shell.openPath(path.join(__dirname));
});

// ── Auto-Update ──
function getSourceDir() {
  const appDir = path.join(__dirname);
  try {
    fs.accessSync(path.join(appDir, '.git'), fs.constants.R_OK);
    return appDir;
  } catch (_) {
    return null;
  }
}

ipcMain.handle('check-update', async () => {
  const sourceDir = getSourceDir();

  if (sourceDir) {
    try {
      execSync('git fetch origin', { cwd: sourceDir, encoding: 'utf-8', timeout: 15000 });
      const status = execSync('git status -uno --porcelain -b', { cwd: sourceDir, encoding: 'utf-8', timeout: 5000 });
      const behind = status.includes('behind');
      let remoteLog = '';
      if (behind) {
        try {
          remoteLog = execSync('git log HEAD..origin/main --oneline -10', { cwd: sourceDir, encoding: 'utf-8', timeout: 5000 }).trim();
        } catch (_) {}
      }
      return { updateAvailable: behind, changes: remoteLog };
    } catch (e) {
      return { updateAvailable: false, error: e.message };
    }
  }

  try {
    const https = require('https');
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
    const currentVersion = pkg.version;
    const repoUrl = (pkg.repository && pkg.repository.url) || '';
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (!match) return { updateAvailable: false, error: 'No repository URL' };

    const [, owner, repo] = match;
    const data = await new Promise((resolve, reject) => {
      https.get(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
        headers: { 'User-Agent': 'code-harness' }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          if (res.statusCode === 200) resolve(JSON.parse(body));
          else reject(new Error(`GitHub API: ${res.statusCode}`));
        });
      }).on('error', reject);
    });

    const latestTag = (data.tag_name || '').replace(/^v/, '');
    const updateAvailable = latestTag && latestTag !== currentVersion;
    return {
      updateAvailable,
      changes: updateAvailable ? `${currentVersion} → ${latestTag}\n${data.body || ''}`.trim() : '',
      latestVersion: latestTag,
      downloadUrl: data.html_url || '',
    };
  } catch (e) {
    return { updateAvailable: false, error: e.message };
  }
});

ipcMain.handle('apply-update', async () => {
  const sourceDir = getSourceDir();

  if (sourceDir) {
    try {
      execSync('git stash', { cwd: sourceDir, encoding: 'utf-8', timeout: 10000 });
      execSync('git pull origin main', { cwd: sourceDir, encoding: 'utf-8', timeout: 30000 });
      try { execSync('git stash pop', { cwd: sourceDir, encoding: 'utf-8', timeout: 10000 }); } catch (_) {}
      try {
        const diff = execSync('git diff HEAD~1 --name-only', { cwd: sourceDir, encoding: 'utf-8', timeout: 5000 });
        if (diff.includes('package.json') || diff.includes('package-lock.json')) {
          execSync('npm install', { cwd: sourceDir, encoding: 'utf-8', timeout: 120000 });
        }
      } catch (_) {}
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
  const repoUrl = (pkg.repository && pkg.repository.url) || '';
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (match) {
    shell.openExternal(`https://github.com/${match[1]}/${match[2]}/releases/latest`);
    return { success: true, openedBrowser: true };
  }
  return { success: false, error: 'No repository URL' };
});

ipcMain.handle('restart-app', async () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('get-app-info', async () => {
  let gitHash = '';
  try { gitHash = execSync('git rev-parse --short HEAD', { cwd: __dirname, encoding: 'utf-8', timeout: 3000 }).trim(); } catch (_) {}
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
  return { version: pkg.version, gitHash, electronVersion: process.versions.electron, nodeVersion: process.versions.node };
});

// ── Lifecycle ──
let timer;
app.whenReady().then(() => {
  setCrashFlag();
  createWindow();
  createMenu();
  timer = setInterval(saveSessionsSync, 10000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('before-quit', () => {
  if (!sessionsSavedOnClose) {
    saveSessionsSync();
    sessionsSavedOnClose = true;
  }
  clearCrashFlag();
  if (timer) clearInterval(timer);
});
let sessionsSavedOnClose = false;

app.on('window-all-closed', () => {
  if (!sessionsSavedOnClose) {
    saveSessionsSync();
    sessionsSavedOnClose = true;
  }
  for (const [, s] of sessions) { try { s.pty.kill(); } catch (_) {} }
  sessions.clear();
  sessionBuffers.clear();
  clearCrashFlag();
  app.quit();
});

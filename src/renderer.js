// ── i18n (inline, no ES modules in Electron renderer without bundler) ──
const I18N_STORAGE_KEY = 'code-harness-lang';
const SUPPORTED_LANGS = {
  en: 'English', ja: '日本語', zh: '中文（简体）', ko: '한국어',
  de: 'Deutsch', fr: 'Français', es: 'Español', pt: 'Português',
  ru: 'Русский', hi: 'हिन्दी', tr: 'Türkçe', vi: 'Tiếng Việt', id: 'Bahasa Indonesia',
};
let currentLang = 'en';
let translations = {};

function detectLanguage() {
  const saved = localStorage.getItem(I18N_STORAGE_KEY);
  if (saved && SUPPORTED_LANGS[saved]) return saved;
  const nav = (navigator.language || 'en').split('-')[0].toLowerCase();
  if (SUPPORTED_LANGS[nav]) return nav;
  return 'en';
}

async function loadTranslations(lang) {
  try {
    const resp = await fetch(`i18n/locales/${lang}.js`);
    if (!resp.ok) throw new Error();
    const text = await resp.text();
    // Parse ES module: extract the default export object
    const match = text.match(/export\s+default\s+(\{[\s\S]*\})\s*;?\s*$/);
    if (match) {
      return new Function(`return ${match[1]}`)();
    }
  } catch (_) {}
  return {};
}

async function initI18n(forceLang) {
  currentLang = forceLang || detectLanguage();
  const en = await loadTranslations('en');
  if (currentLang !== 'en') {
    const lang = await loadTranslations(currentLang);
    translations = { ...en, ...lang };
  } else {
    translations = en;
  }
  localStorage.setItem(I18N_STORAGE_KEY, currentLang);
  applyTranslations();
}

function t(key, params) {
  let str = translations[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, v);
    }
  }
  return str;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.documentElement.lang = currentLang;
}

// ── State ──
const tabs = new Map();
let activeId = null;
let currentMode = 'claude';
let uiMode = 'simple';
const history = [];
let histIdx = 0;
let appSettings = { fontSize: 14, autoSaveInterval: 10, doubleEnterDelay: 500 };
let builderDevMode = 'nocode';

// ── Boot ──
document.addEventListener('DOMContentLoaded', async () => {
  await initI18n();
  populateLangSelect();

  const prefs = await window.api.loadPrefs();
  if (prefs.uiMode) setUiMode(prefs.uiMode);
  if (prefs.lastMode) currentMode = prefs.lastMode;

  appSettings = await window.api.loadSettings();

  setupListeners();

  const cli = await window.api.checkClaudeCli();
  if (!cli.installed) {
    showSetupDialog();
    return;
  }

  const crashed = await window.api.checkCrash();
  const saved = await window.api.loadSessions();
  if (saved && saved.length > 0) {
    const oldIds = [];
    const activeIdx = prefs.activeTabIndex || 0;
    for (const s of saved) {
      oldIds.push(s.id);
      await restoreTab(s);
    }
    const tabIds = [...tabs.keys()];
    if (tabIds.length > 0) {
      const idx = Math.min(activeIdx, tabIds.length - 1);
      switchTab(tabIds[idx]);
    }
    window.api.cleanupOldBuffers(oldIds);

    const msgKey = crashed ? 'status.restored.crash' : 'status.restored';
    setStatus('ready', t(msgKey, { count: saved.length }));

    const log = await window.api.loadWorkLog();
    if (log && log.length > 0) {
      const lastEntries = log.slice(-3).reverse();
      const activeTab = tabs.get(activeId);
      if (activeTab) {
        activeTab.term.write(`\r\n\x1b[33m[${t('session.restore.recent')}]\x1b[0m\r\n`);
        for (const e of lastEntries) {
          const d = new Date(e.timestamp);
          const time = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
          const short = e.prompt.length > 80 ? e.prompt.slice(0, 80) + '...' : e.prompt;
          activeTab.term.write(`\x1b[36m  ${time}\x1b[0m \x1b[2m${e.sessionName}\x1b[0m ${short}\r\n`);
        }
        activeTab.term.write(`\r\n`);
      }
    }
  } else {
    await newTab(currentMode);
  }

  startAutoSave();
});

function populateLangSelect() {
  const sel = document.getElementById('lang-select');
  if (!sel) return;
  sel.innerHTML = '';
  for (const [code, name] of Object.entries(SUPPORTED_LANGS)) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    if (code === currentLang) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', async () => {
    await initI18n(sel.value);
  });
}

function startAutoSave() {
  setInterval(() => {
    window.api.saveSessions();
    saveTabState();
  }, (appSettings.autoSaveInterval || 10) * 1000);
}

function saveTabState() {
  const tabIds = [...tabs.keys()];
  const idx = tabIds.indexOf(activeId);
  window.api.savePrefs({
    uiMode,
    lastMode: currentMode,
    activeTabIndex: idx >= 0 ? idx : 0,
  });
}

async function restoreTab(savedSession) {
  try {
    const oldBuffer = await window.api.loadBuffer(savedSession.id);
    const session = await window.api.createSession({
      mode: savedSession.mode || 'claude',
      cwd: savedSession.cwd,
      name: savedSession.name,
      restoreFromId: savedSession.id,
      conversationId: savedSession.conversationId || null,
    });
    addTab(session, oldBuffer);
  } catch (err) {
    console.error('Session restore failed:', err);
    await newTab(savedSession.mode || currentMode);
  }
}

function getTabSessionId(tabEl) {
  return tabEl ? tabEl.dataset.sid : null;
}

// ── Listeners ──
function setupListeners() {
  document.getElementById('new-tab-btn').addEventListener('click', () => newTab(currentMode));
  document.getElementById('send-btn').addEventListener('click', send);
  document.getElementById('settings-btn').addEventListener('click', openSettings);

  document.getElementById('worklog-toggle').addEventListener('click', toggleWorkLog);
  document.getElementById('worklog-close').addEventListener('click', () => {
    document.getElementById('worklog-panel').classList.add('hidden');
  });

  // Settings dialog
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  document.getElementById('settings-dialog').addEventListener('click', (e) => {
    if (e.target.id === 'settings-dialog') closeSettings();
  });
  document.getElementById('font-dec').addEventListener('click', () => {
    applyFontSize(Math.max(10, (appSettings.fontSize || 14) - 1));
  });
  document.getElementById('font-inc').addEventListener('click', () => {
    applyFontSize(Math.min(24, (appSettings.fontSize || 14) + 1));
  });
  document.getElementById('double-enter-delay').addEventListener('input', (e) => {
    appSettings.doubleEnterDelay = parseInt(e.target.value);
    document.getElementById('double-enter-val').textContent = e.target.value;
    window.api.saveSettings(appSettings);
  });
  document.getElementById('autosave-interval').addEventListener('input', (e) => {
    appSettings.autoSaveInterval = parseInt(e.target.value);
    document.getElementById('autosave-val').textContent = e.target.value;
    window.api.saveSettings(appSettings);
  });

  // Builder
  document.getElementById('builder-scan-btn').addEventListener('click', scanCurrentProject);
  document.querySelectorAll('.bcard').forEach(card => {
    card.addEventListener('click', () => builderCardClicked(card.dataset.target));
  });
  document.querySelectorAll('.bdev-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bdev-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      builderDevMode = btn.dataset.devmode;
    });
  });
  document.getElementById('builder-send-btn').addEventListener('click', sendBuilderPrompt);
  document.getElementById('builder-prompt').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendBuilderPrompt();
    }
  });

  // Harness panel
  setupHarnessListeners();

  // Edit this app
  document.getElementById('btn-edit-claude').addEventListener('click', editAppWithClaude);
  document.getElementById('btn-edit-codex').addEventListener('click', editAppWithCodex);
  document.getElementById('btn-open-folder').addEventListener('click', () => window.api.openAppFolder());
  document.getElementById('btn-check-update').addEventListener('click', checkForUpdate);
  document.getElementById('btn-apply-update').addEventListener('click', applyUpdate);
  document.getElementById('btn-clear-worklog').addEventListener('click', async () => {
    await window.api.clearWorkLog();
    const btn = document.getElementById('btn-clear-worklog');
    btn.textContent = t('settings.data.cleared');
    setTimeout(() => { btn.textContent = t('settings.data.clear'); }, 2000);
  });
  document.getElementById('btn-build-app').addEventListener('click', buildApp);

  // Mode toggle
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.addEventListener('click', () => switchSessionMode(b.dataset.mode));
  });

  // UI toggle
  document.querySelectorAll('.ui-btn').forEach(b => {
    b.addEventListener('click', () => {
      setUiMode(b.dataset.ui);
      saveTabState();
    });
  });

  // Textarea input
  const ta = document.getElementById('prompt-input');
  let isComposing = false;

  ta.addEventListener('compositionstart', () => { isComposing = true; });
  ta.addEventListener('compositionend', () => { isComposing = false; });

  ta.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); navHist(-1); return; }
    if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); navHist(1); return; }

    if (e.key === 'Enter' && !e.shiftKey) {
      if (isComposing || e.isComposing) return;
      e.preventDefault();
      if (!ta.value.trim()) {
        if (activeId) window.api.sendInput(activeId, '\r');
      } else {
        send();
      }
    }
  });

  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  });

  // Quick buttons
  document.querySelectorAll('.qbtn[data-input]').forEach(b => {
    b.addEventListener('click', () => {
      if (!activeId || !b.dataset.input) return;
      const raw = b.dataset.input
        .replace(/\\r/g, '\r')
        .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      window.api.sendInput(activeId, raw);
      const tab = tabs.get(activeId);
      if (tab) tab.term.scrollToBottom();
      b.classList.add('qbtn-pressed');
      setTimeout(() => { b.classList.remove('qbtn-pressed'); }, 400);
    });
  });

  // Sidebar commands
  document.querySelectorAll('.cmd').forEach(el => {
    el.addEventListener('click', () => {
      if (!activeId) return;
      window.api.sendInput(activeId, el.dataset.cmd + '\r');
    });
  });

  // Sidebar prompts
  document.querySelectorAll('.prompt-ex').forEach(el => {
    el.addEventListener('click', () => {
      const ta = document.getElementById('prompt-input');
      ta.value = el.dataset.prompt;
      ta.focus();
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 't') { e.preventDefault(); newTab(currentMode); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'w') { e.preventDefault(); if (activeId) closeTab(activeId); }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      window.api.saveSessions();
      saveTabState();
      setStatus('ready', t('status.saved'));
      setTimeout(() => setStatus('ready', t('status.ready')), 2000);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); openSettings(); }
    if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const ids = [...tabs.keys()];
      if (ids[parseInt(e.key) - 1]) switchTab(ids[parseInt(e.key) - 1]);
    }
  });

  // Menu actions
  window.api.onMenuAction((action) => {
    switch (action) {
      case 'new-tab': newTab(currentMode); break;
      case 'close-tab': if (activeId) closeTab(activeId); break;
      case 'saved':
        setStatus('ready', t('status.saved'));
        setTimeout(() => setStatus('ready', t('status.ready')), 2000);
        break;
      case 'settings': openSettings(); break;
      case 'edit-app-claude': editAppWithClaude(); break;
      case 'check-update': openSettings(); checkForUpdate(); break;
    }
  });

  // Drag & Drop
  document.addEventListener('dragover', (e) => {
    e.preventDefault(); e.stopPropagation();
    document.getElementById('app').classList.add('drag-over');
  });
  document.addEventListener('dragleave', (e) => {
    if (e.target === document.documentElement || e.target === document.body) {
      document.getElementById('app').classList.remove('drag-over');
    }
  });
  document.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation();
    document.getElementById('app').classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].path) {
      newTabWithCwd(currentMode, files[0].path);
    }
  });
}

// ── Harness Panel ──
function setupHarnessListeners() {
  // Collapsible sections
  document.querySelectorAll('.harness-section-header').forEach(header => {
    header.addEventListener('click', () => {
      header.closest('.harness-section').classList.toggle('collapsed');
    });
  });

  // CLAUDE.md
  document.getElementById('claudemd-create-btn').addEventListener('click', async () => {
    const tab = tabs.get(activeId);
    if (!tab) return;
    const template = `# Project Instructions\n\n- Build: npm run build\n- Test: npm test\n- Lint: npm run lint\n\n## Architecture\n\n- Framework: \n- Database: \n\n## Conventions\n\n- \n`;
    const result = await window.api.harnessWriteClaudeMd(tab.session.cwd, template);
    if (result.success) loadClaudeMd();
  });

  document.getElementById('claudemd-save-btn').addEventListener('click', async () => {
    const tab = tabs.get(activeId);
    if (!tab) return;
    const content = document.getElementById('claudemd-textarea').value;
    const result = await window.api.harnessWriteClaudeMd(tab.session.cwd, content);
    const status = document.getElementById('claudemd-status');
    if (result.success) {
      status.textContent = t('harness.claudemd.saved');
      status.style.color = 'var(--green)';
    } else {
      status.textContent = result.error;
      status.style.color = 'var(--red)';
    }
    setTimeout(() => { status.textContent = ''; }, 3000);
  });

  // Hooks
  document.getElementById('hooks-add-btn').addEventListener('click', addNewHook);

  // Projects
  document.getElementById('projects-add-btn').addEventListener('click', async () => {
    const folder = await window.api.harnessPickFolder();
    if (!folder) return;
    const projects = await window.api.harnessLoadProjects();
    if (projects.find(p => p.path === folder)) return; // already exists
    const name = folder.split('/').pop() || folder;
    projects.push({ name, path: folder });
    await window.api.harnessSaveProjects(projects);
    loadProjects();
  });
}

async function loadClaudeMd() {
  const tab = tabs.get(activeId);
  if (!tab) return;
  const result = await window.api.harnessReadClaudeMd(tab.session.cwd);
  const emptyEl = document.getElementById('claudemd-empty');
  const editorEl = document.getElementById('claudemd-editor');
  const badge = document.getElementById('claudemd-badge');

  if (result.exists) {
    emptyEl.classList.add('hidden');
    editorEl.classList.remove('hidden');
    document.getElementById('claudemd-textarea').value = result.content;
    badge.textContent = '✓';
  } else {
    emptyEl.classList.remove('hidden');
    editorEl.classList.add('hidden');
    badge.textContent = '';
  }
}

async function loadHooks() {
  const tab = tabs.get(activeId);
  if (!tab) return;
  const result = await window.api.harnessReadHooks(tab.session.cwd);
  const emptyEl = document.getElementById('hooks-empty');
  const listEl = document.getElementById('hooks-list');
  const badge = document.getElementById('hooks-badge');

  listEl.innerHTML = '';
  const allHooks = { ...(result.user || {}), ...(result.project || {}) };
  const events = Object.keys(allHooks);

  if (events.length === 0) {
    emptyEl.classList.remove('hidden');
    badge.textContent = '';
    return;
  }

  emptyEl.classList.add('hidden');
  let count = 0;
  for (const event of events) {
    const hooks = allHooks[event];
    if (!Array.isArray(hooks)) continue;
    for (const hook of hooks) {
      count++;
      const item = document.createElement('div');
      item.className = 'hook-item';
      item.innerHTML = `
        <div class="hook-item-header">
          <span class="hook-event">${esc(event)}</span>
          <button class="hook-delete" data-event="${esc(event)}" data-idx="${count-1}">&times;</button>
        </div>
        <div class="hook-detail">${hook.matcher ? `<span>${esc(hook.matcher)}</span> → ` : ''}${esc(hook.command || '')}</div>
      `;
      listEl.appendChild(item);
    }
  }
  badge.textContent = count.toString();
}

async function addNewHook() {
  const tab = tabs.get(activeId);
  if (!tab) return;
  // Simple inline form
  const listEl = document.getElementById('hooks-list');
  const form = document.createElement('div');
  form.className = 'hook-item';
  form.style.borderColor = 'var(--accent)';
  form.innerHTML = `
    <select class="hook-event-select" style="width:100%;background:var(--bg1);color:var(--fg);border:1px solid var(--border);border-radius:4px;padding:4px;margin-bottom:4px;font-size:11px;">
      <option value="PreToolUse">PreToolUse</option>
      <option value="PostToolUse">PostToolUse</option>
      <option value="Notification">Notification</option>
      <option value="Stop">Stop</option>
    </select>
    <input class="hook-matcher-input" placeholder="Matcher (e.g. Edit|Write)" style="width:100%;background:var(--bg1);color:var(--fg);border:1px solid var(--border);border-radius:4px;padding:4px;margin-bottom:4px;font-size:11px;font-family:Menlo,monospace;">
    <input class="hook-command-input" placeholder="Command (e.g. npx eslint --fix)" style="width:100%;background:var(--bg1);color:var(--fg);border:1px solid var(--border);border-radius:4px;padding:4px;margin-bottom:4px;font-size:11px;font-family:Menlo,monospace;">
    <div style="display:flex;gap:4px;">
      <button class="harness-btn primary hook-save-new" style="margin:0;flex:1;">Save</button>
      <button class="harness-btn hook-cancel-new" style="margin:0;flex:1;">Cancel</button>
    </div>
  `;
  listEl.appendChild(form);

  form.querySelector('.hook-cancel-new').addEventListener('click', () => form.remove());
  form.querySelector('.hook-save-new').addEventListener('click', async () => {
    const event = form.querySelector('.hook-event-select').value;
    const matcher = form.querySelector('.hook-matcher-input').value.trim();
    const command = form.querySelector('.hook-command-input').value.trim();
    if (!command) return;

    const result = await window.api.harnessReadHooks(tab.session.cwd);
    const hooks = result.project || {};
    if (!hooks[event]) hooks[event] = [];
    const entry = { command };
    if (matcher) entry.matcher = matcher;
    hooks[event].push(entry);
    await window.api.harnessWriteHooks(tab.session.cwd, hooks);
    form.remove();
    loadHooks();
  });
}

async function loadMemory() {
  const memories = await window.api.harnessReadMemory();
  const emptyEl = document.getElementById('memory-empty');
  const listEl = document.getElementById('memory-list');
  const badge = document.getElementById('memory-badge');

  listEl.innerHTML = '';
  if (memories.length === 0) {
    emptyEl.classList.remove('hidden');
    badge.textContent = '';
    return;
  }

  emptyEl.classList.add('hidden');
  badge.textContent = memories.length.toString();

  const typeIcons = { user: '👤', feedback: '💬', project: '📁', reference: '🔗' };
  for (const mem of memories) {
    const item = document.createElement('div');
    item.className = 'memory-item';
    item.innerHTML = `
      <span class="memory-icon">${typeIcons[mem.type] || '📝'}</span>
      <div class="memory-info">
        <div class="memory-name">${esc(mem.name)}</div>
        <div class="memory-type">${esc(mem.type)} — ${esc(mem.description)}</div>
      </div>
    `;
    listEl.appendChild(item);
  }
}

async function loadProjects() {
  const projects = await window.api.harnessLoadProjects();
  const emptyEl = document.getElementById('projects-empty');
  const listEl = document.getElementById('projects-list');
  const badge = document.getElementById('projects-badge');

  listEl.innerHTML = '';
  if (projects.length === 0) {
    emptyEl.classList.remove('hidden');
    badge.textContent = '';
    return;
  }

  emptyEl.classList.add('hidden');
  badge.textContent = projects.length.toString();

  const tab = tabs.get(activeId);
  const currentCwd = tab ? tab.session.cwd : '';

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const isActive = currentCwd === p.path;
    const item = document.createElement('div');
    item.className = `project-item${isActive ? ' active' : ''}`;
    item.innerHTML = `
      <div style="flex:1;min-width:0;">
        <div class="project-name">${esc(p.name)}</div>
        <div class="project-path">${esc(p.path)}</div>
      </div>
      <button class="project-remove" data-idx="${i}">&times;</button>
    `;
    item.addEventListener('click', (e) => {
      if (e.target.closest('.project-remove')) return;
      newTab(currentMode, p.path);
    });
    item.querySelector('.project-remove').addEventListener('click', async (e) => {
      e.stopPropagation();
      projects.splice(i, 1);
      await window.api.harnessSaveProjects(projects);
      loadProjects();
    });
    listEl.appendChild(item);
  }
}

function refreshHarnessPanel() {
  if (uiMode !== 'harness') return;
  loadClaudeMd();
  loadHooks();
  loadMemory();
  loadProjects();
}

// ── UI Mode ──
function setUiMode(mode) {
  uiMode = mode;
  document.body.dataset.ui = mode;
  document.querySelectorAll('.ui-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.ui === mode);
  });
  tabs.forEach(t => {
    if (t.pane.classList.contains('active')) {
      setTimeout(() => {
        try {
          const wasAtBottom = t.term.buffer.active.viewportY >= t.term.buffer.active.baseY;
          const savedViewportY = t.term.buffer.active.viewportY;
          t.fit.fit();
          const sid = getTabSessionId(t.tabEl);
          if (sid) window.api.resizeTerminal(sid, t.term.cols, t.term.rows);
          if (wasAtBottom) t.term.scrollToBottom();
          else t.term.scrollToLine(savedViewportY);
        } catch (_) {}
      }, 80);
    }
  });
  if (mode === 'simple' || mode === 'builder' || mode === 'harness') {
    document.getElementById('prompt-input').focus();
    if (mode === 'builder') scanCurrentProject();
    if (mode === 'harness') refreshHarnessPanel();
  } else {
    const tab = tabs.get(activeId);
    if (tab) {
      tab.term.focus();
      tab.term.scrollToBottom();
    }
  }
}

// ── Session Mode Switch ──
async function switchSessionMode(newMode) {
  if (!activeId) return;
  const tab = tabs.get(activeId);
  if (!tab) return;

  currentMode = newMode;
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === newMode);
  });

  const oldSid = getTabSessionId(tab.tabEl);
  window.api.removeListeners(oldSid);
  tab.term.clear();
  const modeNames = { claude: 'Claude Code', codex: 'Codex', aider: 'Aider', shell: 'Terminal' };
  const modeLabel = modeNames[newMode] || newMode;
  tab.term.write(`\x1b[36m${t('session.starting', { mode: modeLabel })}\x1b[0m\r\n`);

  const result = await window.api.switchMode(oldSid, newMode);
  if (!result) return;

  tab.session = { id: result.newId, name: result.name, cwd: result.cwd, mode: newMode };
  tab.tabEl.dataset.sid = result.newId;
  tab.ended = false;
  tab.tabEl.classList.remove('ended');

  window.api.onSessionOutput(result.newId, (d) => {
    tab.term.write(d);
    detectActivity(d, result.newId);
  });
  window.api.onSessionExit(result.newId, () => {
    tab.term.write(`\r\n\x1b[33m[${t('status.ended')}]\x1b[0m\r\n`);
    tab.tabEl.classList.add('ended');
    tab.ended = true;
    setStatus('ended', t('session.ended'));
  });

  window.api.resizeTerminal(result.newId, tab.term.cols, tab.term.rows);

  tab.tabEl.querySelector('.tname').textContent = result.name;
  const iconMap = { claude: 'AI', codex: 'CX', aider: 'AD', shell: '>' };
  tab.tabEl.querySelector('.tab-icon').textContent = iconMap[newMode] || '>';

  tabs.delete(activeId);
  activeId = result.newId;
  tabs.set(result.newId, tab);

  updateStatusMode(newMode);
  saveTabState();
}

// ── Tab Management ──
async function newTab(mode, cwd) {
  try {
    const session = await window.api.createSession({ mode: mode || 'claude', cwd });
    addTab(session);
  } catch (err) {
    console.error('Session create failed:', err);
  }
}

async function newTabWithCwd(mode, droppedPath) {
  const cwd = await window.api.resolveCwd(droppedPath);
  await newTab(mode, cwd);
}

function addTab(session, replayBuffer) {
  const term = new Terminal({
    theme: {
      background: '#1a1b26', foreground: '#c0caf5', cursor: '#c0caf5',
      selectionBackground: '#33467c',
      black: '#15161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68',
      blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6',
      brightBlack: '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a',
      brightYellow: '#e0af68', brightBlue: '#7aa2f7', brightMagenta: '#bb9af7',
      brightCyan: '#7dcfff', brightWhite: '#c0caf5',
    },
    fontSize: appSettings.fontSize || 14,
    fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
    scrollback: 10000,
    cursorBlink: true,
    convertEol: true,
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);

  term.onData((data) => {
    if (activeId) window.api.sendInput(activeId, data);
  });

  const iconMap = { claude: 'AI', codex: 'CX', aider: 'AD', shell: '>' };
  const icon = iconMap[session.mode] || '>';
  const tabEl = document.createElement('div');
  tabEl.className = 'tab';
  tabEl.dataset.sid = session.id;
  tabEl.innerHTML = `<span class="tab-icon">${icon}</span><span class="tname">${esc(session.name)}</span><span class="tab-badge"></span><span class="tclose">&times;</span>`;
  document.getElementById('tabs').appendChild(tabEl);

  const pane = document.createElement('div');
  pane.className = 'pane';
  document.getElementById('terminal-container').appendChild(pane);
  term.open(pane);

  const data = { term, fit, tabEl, pane, session, ended: false };
  tabs.set(session.id, data);

  tabEl.addEventListener('click', (e) => {
    if (!e.target.closest('.tclose')) {
      const sid = getTabSessionId(tabEl);
      if (sid) switchTab(sid);
    }
  });
  tabEl.querySelector('.tclose').addEventListener('click', (e) => {
    e.stopPropagation();
    const sid = getTabSessionId(tabEl);
    if (sid) closeTab(sid);
  });

  if (replayBuffer) {
    term.write(replayBuffer);
    term.write(`\r\n\x1b[2m\x1b[36m── ${t('session.restore.separator')} ──\x1b[0m\r\n\r\n`);
  }

  window.api.onSessionOutput(session.id, (d) => {
    term.write(d);
    detectActivity(d, session.id);
  });
  window.api.onSessionExit(session.id, () => {
    term.write(`\r\n\x1b[33m[${t('status.ended')}]\x1b[0m\r\n`);
    tabEl.classList.add('ended');
    data.ended = true;
    setStatus('ended', t('session.ended'));
  });

  let resizeTimer = null;
  const ro = new ResizeObserver(() => {
    if (!pane.classList.contains('active')) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      try {
        const wasAtBottom = term.buffer.active.viewportY >= term.buffer.active.baseY;
        const savedViewportY = term.buffer.active.viewportY;
        fit.fit();
        const sid = getTabSessionId(tabEl);
        if (sid) window.api.resizeTerminal(sid, term.cols, term.rows);
        if (wasAtBottom) term.scrollToBottom();
        else term.scrollToLine(savedViewportY);
      } catch (_) {}
    }, 80);
  });
  ro.observe(pane);
  data.ro = ro;

  switchTab(session.id);
  setTimeout(() => {
    try {
      fit.fit();
      window.api.resizeTerminal(session.id, term.cols, term.rows);
    } catch (_) {}
  }, 100);

  document.getElementById('status-cwd').textContent = session.cwd || '';
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === session.mode);
  });
  currentMode = session.mode;
  updateStatusMode(session.mode);
}

function switchTab(id) {
  activeId = id;
  tabs.forEach((t, tid) => {
    const on = tid === id;
    t.tabEl.classList.toggle('active', on);
    t.pane.classList.toggle('active', on);
    if (on) {
      const badge = t.tabEl.querySelector('.tab-badge');
      if (badge) badge.classList.remove('visible', 'approval');
      const mode = t.session.mode || 'claude';
      document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
      });
      currentMode = mode;
      updateStatusMode(mode);
      document.getElementById('status-cwd').textContent = t.session.cwd || '';
      setTimeout(() => {
        try {
          const wasAtBottom = t.term.buffer.active.viewportY >= t.term.buffer.active.baseY;
          const savedViewportY = t.term.buffer.active.viewportY;
          t.fit.fit();
          window.api.resizeTerminal(tid, t.term.cols, t.term.rows);
          if (wasAtBottom) t.term.scrollToBottom();
          else t.term.scrollToLine(savedViewportY);
        } catch (_) {}
      }, 50);

      // Refresh harness panel when switching tabs
      if (uiMode === 'harness') refreshHarnessPanel();
    }
  });
  if (uiMode === 'simple' || uiMode === 'builder' || uiMode === 'harness') {
    document.getElementById('prompt-input').focus();
  } else {
    const tab = tabs.get(id);
    if (tab) tab.term.focus();
  }
}

async function closeTab(id) {
  const t = tabs.get(id);
  if (!t) return;
  if (t.ro) t.ro.disconnect();
  window.api.removeListeners(id);
  await window.api.closeSession(id);
  t.term.dispose();
  t.tabEl.remove();
  t.pane.remove();
  tabs.delete(id);
  if (tabs.size > 0) {
    switchTab(tabs.keys().next().value);
  } else {
    activeId = null;
    await newTab(currentMode);
  }
  saveTabState();
}

// ── Input ──
function send() {
  const ta = document.getElementById('prompt-input');
  const text = ta.value.trim();
  if (!text || !activeId) return;

  const tab = tabs.get(activeId);
  if (tab && tab.ended) {
    tab.term.write(`\r\n\x1b[33m[${t('session.ended.restart')}]\x1b[0m\r\n`);
    switchSessionMode(currentMode);
    return;
  }

  history.push(text);
  if (history.length > 100) history.shift();
  histIdx = history.length;
  window.api.sendInput(activeId, text + '\r');

  if (tab) tab.term.scrollToBottom();
  if (tab) {
    window.api.logPrompt({
      sessionId: activeId,
      prompt: text,
      sessionName: tab.session.name || '',
      cwd: tab.session.cwd || '',
    });
  }

  window.api.saveSessions();

  ta.value = '';
  ta.style.height = 'auto';
}

function navHist(dir) {
  if (!history.length) return;
  histIdx = Math.max(0, Math.min(histIdx + dir, history.length));
  document.getElementById('prompt-input').value =
    histIdx === history.length ? '' : history[histIdx];
}

// ── Activity Detection ──
let activityTimer = null;

function detectActivity(output, sessionId) {
  const isApproval = /\? ?\(y\/n\)|Allow|approve|permission/i.test(output);

  const patterns = [
    { re: /Reading|Read\s/i, key: 'status.reading' },
    { re: /Writing|Write\s|Edit\s/i, key: 'status.writing' },
    { re: /Running|Bash\s/i, key: 'status.running' },
    { re: /Searching|Grep|Glob/i, key: 'status.searching' },
    { re: /Agent/i, key: 'status.agent' },
    { re: /\? ?\(y\/n\)|Allow|approve|permission/i, key: 'status.approval' },
    { re: /Thinking|thinking/i, key: 'status.thinking' },
    { re: /\$\s*$|❯|>\s*$/m, key: 'status.input' },
  ];

  for (const { re, key } of patterns) {
    if (re.test(output)) {
      if (isApproval) setStatus('waiting', t(key));
      else if (/\$\s*$|❯|>\s*$/m.test(output)) setStatus('ready', t(key));
      else setStatus('busy', t(key));
      break;
    }
  }

  if (sessionId && sessionId !== activeId) {
    const tab = tabs.get(sessionId);
    if (tab) {
      const badge = tab.tabEl.querySelector('.tab-badge');
      if (badge) {
        if (isApproval) {
          badge.classList.add('visible', 'approval');
        } else {
          badge.classList.add('visible');
          badge.classList.remove('approval');
        }
      }
    }
  }

  if (isApproval) {
    const tab = sessionId ? tabs.get(sessionId) : null;
    const tabName = tab ? (tab.session.name || 'Claude Code') : 'Claude Code';
    try {
      new Notification('Code Harness', {
        body: `${tabName}: ${t('status.approval')}`,
        silent: false,
      });
    } catch (_) {}
  }

  clearTimeout(activityTimer);
  activityTimer = setTimeout(() => setStatus('ready', t('status.ready')), 5000);
}

function setStatus(state, text) {
  const indicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  indicator.className = '';
  indicator.classList.add(state);
  statusText.textContent = text;
}

function updateStatusMode(mode) {
  const labels = { claude: 'Claude Code', codex: 'Codex', aider: 'Aider', shell: 'Terminal' };
  document.getElementById('status-mode').textContent = labels[mode] || mode;
}

// ── Setup Dialog ──
function showSetupDialog() {
  const dlg = document.getElementById('setup-dialog');
  dlg.classList.remove('hidden');

  document.getElementById('setup-auto-install').addEventListener('click', async () => {
    const btn = document.getElementById('setup-auto-install');
    const status = document.getElementById('setup-status');
    btn.disabled = true;
    btn.textContent = t('setup.installing');
    status.textContent = 'npm install -g @anthropic-ai/claude-code ...';
    status.style.color = 'var(--yellow)';

    const result = await window.api.installClaudeCli();
    if (result.success) {
      status.textContent = t('setup.success');
      status.style.color = 'var(--green)';
      setTimeout(async () => {
        dlg.classList.add('hidden');
        await newTab(currentMode);
        startAutoSave();
      }, 1000);
    } else {
      status.textContent = t('setup.fail') + (result.error || '');
      status.style.color = 'var(--red)';
      btn.disabled = false;
      btn.textContent = t('setup.retry');
    }
  });

  document.getElementById('setup-skip').addEventListener('click', async () => {
    dlg.classList.add('hidden');
    currentMode = 'shell';
    await newTab('shell');
    startAutoSave();
  });
}

// ── Work Log ──
async function toggleWorkLog() {
  const panel = document.getElementById('worklog-panel');
  if (!panel.classList.contains('hidden')) {
    panel.classList.add('hidden');
    return;
  }
  const log = await window.api.loadWorkLog();
  const list = document.getElementById('worklog-list');

  if (!log || log.length === 0) {
    list.innerHTML = `<div class="worklog-empty">${t('worklog.empty')}</div>`;
  } else {
    const recent = log.slice(-50).reverse();
    list.innerHTML = recent.map(entry => {
      const d = new Date(entry.timestamp);
      const time = `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
      const prompt = esc(entry.prompt.length > 200 ? entry.prompt.slice(0, 200) + '...' : entry.prompt);
      return `<div class="worklog-entry" data-prompt="${esc(entry.prompt).replace(/"/g, '&quot;')}">
        <span class="wl-time">${time}</span><span class="wl-session">${esc(entry.sessionName)}</span>
        <div class="wl-prompt">${prompt}</div>
        <div class="wl-cwd">${esc(entry.cwd)}</div>
      </div>`;
    }).join('');

    list.querySelectorAll('.worklog-entry').forEach(el => {
      el.addEventListener('click', () => {
        document.getElementById('prompt-input').value = el.dataset.prompt;
        document.getElementById('prompt-input').focus();
        panel.classList.add('hidden');
      });
    });
  }

  panel.classList.remove('hidden');
}

// ── Settings Dialog ──
async function openSettings() {
  const dlg = document.getElementById('settings-dialog');
  dlg.classList.remove('hidden');

  appSettings = await window.api.loadSettings();
  document.getElementById('font-size-val').textContent = appSettings.fontSize;
  document.getElementById('double-enter-delay').value = appSettings.doubleEnterDelay;
  document.getElementById('double-enter-val').textContent = appSettings.doubleEnterDelay;
  document.getElementById('autosave-interval').value = appSettings.autoSaveInterval;
  document.getElementById('autosave-val').textContent = appSettings.autoSaveInterval;

  const info = await window.api.getAppInfo();
  document.getElementById('app-info').textContent =
    `Code Harness v${info.version} (${info.gitHash}) | Electron ${info.electronVersion} | Node ${info.nodeVersion}`;
}

function closeSettings() {
  document.getElementById('settings-dialog').classList.add('hidden');
}

function applyFontSize(size) {
  appSettings.fontSize = size;
  document.getElementById('font-size-val').textContent = size;
  tabs.forEach(t => { t.term.options.fontSize = size; t.fit.fit(); });
  window.api.saveSettings(appSettings);
}

async function editAppWithClaude() {
  closeSettings();
  const appDir = await window.api.getAppDir();
  await newTab('claude', appDir);
}

async function editAppWithCodex() {
  closeSettings();
  const appDir = await window.api.getAppDir();
  await newTab('codex', appDir);
}

async function buildApp() {
  const btn = document.getElementById('btn-build-app');
  const status = document.getElementById('build-status');
  btn.disabled = true;
  btn.textContent = t('settings.build.building');
  status.textContent = t('settings.build.building');
  status.style.color = 'var(--yellow)';

  closeSettings();
  const appDir = await window.api.getAppDir();
  const session = await window.api.createSession({ mode: 'shell', cwd: appDir });
  addTab(session);

  setTimeout(() => {
    window.api.sendInput(session.id, 'npm run build:mac\r');
  }, 500);

  btn.disabled = false;
  btn.textContent = t('settings.build.start');
}

async function checkForUpdate() {
  const label = document.getElementById('update-status-label');
  const btn = document.getElementById('btn-check-update');
  const infoEl = document.getElementById('update-info');

  btn.disabled = true;
  btn.textContent = t('settings.update.checking');
  label.textContent = t('settings.update.checking');

  const result = await window.api.checkUpdate();
  btn.disabled = false;
  btn.textContent = t('settings.update.btn');

  if (result.error) {
    label.textContent = `${t('settings.update.error')}: ${result.error}`;
    return;
  }

  if (result.updateAvailable) {
    label.textContent = t('settings.update.available');
    document.getElementById('update-changes').textContent = result.changes;
    infoEl.classList.remove('hidden');
  } else {
    label.textContent = t('settings.update.latest');
    infoEl.classList.add('hidden');
  }
}

async function applyUpdate() {
  const btn = document.getElementById('btn-apply-update');
  btn.disabled = true;
  btn.textContent = '...';

  const result = await window.api.applyUpdate();
  if (result.success && !result.openedBrowser) {
    await window.api.restartApp();
  } else if (!result.success) {
    btn.textContent = `${t('settings.update.error')}: ${result.error}`;
    btn.disabled = false;
  }
}

// ── Builder ──
async function scanCurrentProject() {
  const tab = tabs.get(activeId);
  if (!tab) return;

  const result = await window.api.scanProject(tab.session.cwd);
  if (!result) return;

  const noProject = document.getElementById('builder-no-project');
  const detected = document.getElementById('builder-detected');

  if (result.framework || result.language) {
    noProject.classList.add('hidden');
    detected.classList.remove('hidden');
    document.getElementById('bp-name').textContent = result.name || '-';
    document.getElementById('bp-framework').textContent = result.framework || '-';
    document.getElementById('bp-language').textContent = result.language || '-';
    document.getElementById('bp-configs').textContent = result.configs.length > 0 ? result.configs.join(', ') : '-';
  } else {
    noProject.classList.remove('hidden');
    detected.classList.add('hidden');
  }

  // Highlight cards matching detected configs
  document.querySelectorAll('.bcard').forEach(card => {
    card.classList.toggle('configured', result.configs.includes(card.dataset.target));
  });
}

let activeBuilderTarget = null;

function builderCardClicked(target) {
  document.querySelectorAll('.bcard').forEach(c => c.classList.remove('active'));
  const card = document.querySelector(`.bcard[data-target="${target}"]`);
  if (card) card.classList.add('active');
  activeBuilderTarget = target;
}

function sendBuilderPrompt() {
  const ta = document.getElementById('builder-prompt');
  const text = ta.value.trim();
  if (!text || !activeId) return;

  const tab = tabs.get(activeId);
  if (tab && tab.ended) {
    switchSessionMode(currentMode);
    return;
  }

  let prompt = text;
  if (activeBuilderTarget) {
    prompt = `[Builder: ${activeBuilderTarget}] ${text}`;
  }
  if (builderDevMode === 'nocode') {
    prompt += '\n\nPlease implement this fully without asking questions. Make all decisions yourself.';
  }

  history.push(prompt);
  if (history.length > 100) history.shift();
  histIdx = history.length;
  window.api.sendInput(activeId, prompt + '\r');

  if (tab) tab.term.scrollToBottom();
  if (tab) {
    window.api.logPrompt({
      sessionId: activeId,
      prompt: text,
      sessionName: tab.session.name || '',
      cwd: tab.session.cwd || '',
    });
  }

  window.api.saveSessions();
  ta.value = '';
}

// ── Utility ──
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

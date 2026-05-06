import { useState, useEffect } from 'react';

type SettingsTab = 'general' | 'api-keys' | 'projects' | 'context' | 'about';

interface Project {
  id: string;
  name: string;
  path: string;
  instructions: string;
  model?: string;
  createdAt: string;
}

interface ContextFile {
  id: string;
  name: string;
  content: string;
  type: 'instructions' | 'knowledge' | 'style';
}

export function SettingsView() {
  const [tab, setTab] = useState<SettingsTab>('general');

  // API Keys
  const [keys, setKeys] = useState({ anthropic: '', openai: '', perplexity: '' });
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [keySaved, setKeySaved] = useState(false);

  // General
  const [fontSize, setFontSize] = useState(14);
  const [theme, setTheme] = useState<'dark' | 'midnight' | 'dimmed'>('midnight');
  const [defaultModel, setDefaultModel] = useState('claude-sonnet-4-6');
  const [autoSave, setAutoSave] = useState(true);

  // Projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Context
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [editingContext, setEditingContext] = useState<ContextFile | null>(null);
  const [globalInstructions, setGlobalInstructions] = useState('');

  const api = window.api as any;

  useEffect(() => {
    loadKeys();
    loadSettings();
    loadProjects();
    loadContext();
  }, []);

  const loadKeys = async () => {
    const k = await api.aiGetKeys();
    setKeys({ anthropic: k.anthropic || '', openai: k.openai || '', perplexity: k.perplexity || '' });
    setAvailability(await api.aiCheckKeys());
  };

  const loadSettings = async () => {
    const s = await api.loadSettings();
    setFontSize(s.fontSize || 14);
  };

  const loadProjects = async () => {
    const p = await api.harnessLoadProjects();
    setProjects(Array.isArray(p) ? p.map((x: any) => ({
      id: x.id || x.path, name: x.name, path: x.path,
      instructions: x.instructions || '', model: x.model, createdAt: x.createdAt || '',
    })) : []);
  };

  const loadContext = async () => {
    // Load global instructions from user CLAUDE.md
    const claudeMd = await api.harnessReadUserClaudeMd();
    if (claudeMd.exists) setGlobalInstructions(claudeMd.content);

    // Load memory files as context
    const memories = await api.harnessReadMemory();
    setContextFiles(memories.map((m: any) => ({
      id: m.file, name: m.name, content: '', type: m.type === 'feedback' ? 'style' : 'knowledge',
    })));
  };

  const handleSaveKeys = async () => {
    await api.aiSetKeys(keys);
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
    loadKeys();
  };

  const handleSaveSettings = async () => {
    await api.saveSettings({ fontSize, autoSaveInterval: autoSave ? 10 : 0, doubleEnterDelay: 500 });
  };

  const handleSaveGlobalInstructions = async () => {
    await api.harnessWriteUserClaudeMd(globalInstructions);
  };

  const handleAddProject = async () => {
    const folder = await api.harnessPickFolder();
    if (!folder) return;
    const name = folder.split('/').pop() || 'Project';
    const newProject: Project = {
      id: `proj_${Date.now()}`, name, path: folder,
      instructions: '', createdAt: new Date().toISOString(),
    };
    const updated = [...projects, newProject];
    setProjects(updated);
    await api.harnessSaveProjects(updated);
    setEditingProject(newProject);
  };

  const handleSaveProject = async (project: Project) => {
    const updated = projects.map((p) => p.id === project.id ? project : p);
    setProjects(updated);
    await api.harnessSaveProjects(updated);
    setEditingProject(null);
  };

  const handleDeleteProject = async (id: string) => {
    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    await api.harnessSaveProjects(updated);
    if (editingProject?.id === id) setEditingProject(null);
  };

  const TABS: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'api-keys', label: 'API Keys' },
    { id: 'projects', label: 'Projects' },
    { id: 'context', label: 'Context & Skills' },
    { id: 'about', label: 'About' },
  ];

  const providers = [
    { key: 'anthropic' as const, label: 'Anthropic', desc: 'Claude Opus, Sonnet, Haiku', color: 'var(--purple)', ph: 'sk-ant-...' },
    { key: 'openai' as const, label: 'OpenAI', desc: 'GPT-4o, o3, DALL-E', color: 'var(--green)', ph: 'sk-...' },
    { key: 'perplexity' as const, label: 'Perplexity', desc: 'Sonar Pro, Web Search', color: 'var(--cyan)', ph: 'pplx-...' },
  ];

  const inputClass = "w-full px-3 py-2.5 rounded-[10px] text-[13px] outline-none transition-all font-mono" +
    " bg-white/[0.03] border border-white/[0.08] text-white/70 placeholder:text-white/15" +
    " focus:border-[var(--accent)]/40 focus:bg-white/[0.05]";

  const cardClass = "p-5 rounded-[14px] bg-white/[0.03] border border-white/[0.06]";

  return (
    <div className="h-full flex">
      {/* Settings sidebar */}
      <div className="w-[180px] flex-shrink-0 border-r py-4 px-3 space-y-[2px]" style={{ borderColor: 'var(--border-subtle)' }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`w-full text-left px-3 py-2 rounded-[8px] text-[13px] transition-all ${
              tab === t.id ? 'bg-white/[0.08] text-white/90' : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[560px] mx-auto px-8 py-8 space-y-6">

          {/* ── General ── */}
          {tab === 'general' && (
            <>
              <h2 className="text-[15px] font-semibold text-white/80">General</h2>

              <div className={cardClass}>
                <div className="space-y-5">
                  <div>
                    <label className="text-[12px] font-medium text-white/50 mb-2 block">Font Size</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min="10" max="20" value={fontSize} onChange={(e) => setFontSize(+e.target.value)}
                        className="flex-1 accent-[var(--accent)]" />
                      <span className="text-[13px] text-white/60 w-8 text-right">{fontSize}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[12px] font-medium text-white/50 mb-2 block">Theme</label>
                    <div className="flex gap-2">
                      {(['midnight', 'dark', 'dimmed'] as const).map((t) => (
                        <button key={t} onClick={() => setTheme(t)}
                          className={`px-4 py-2 rounded-[9px] text-[12px] capitalize transition-all border ${
                            theme === t ? 'border-[var(--accent)]/30 bg-[var(--accent-soft)] text-white/80' : 'border-white/[0.06] text-white/35 hover:bg-white/[0.04]'
                          }`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[12px] font-medium text-white/50 mb-2 block">Default AI Model</label>
                    <select value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)}
                      className={inputClass + ' cursor-pointer'} style={{ fontFamily: 'inherit' }}>
                      <option value="claude-opus-4-6" className="bg-[#1a1a24]">Claude Opus 4.6</option>
                      <option value="claude-sonnet-4-6" className="bg-[#1a1a24]">Claude Sonnet 4.6</option>
                      <option value="gpt-4o" className="bg-[#1a1a24]">GPT-4o</option>
                      <option value="o3" className="bg-[#1a1a24]">o3</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[13px] text-white/70">Auto-save sessions</div>
                      <div className="text-[11px] text-white/30">Save terminal sessions every 10 seconds</div>
                    </div>
                    <button onClick={() => setAutoSave(!autoSave)}
                      className={`w-[42px] h-[24px] rounded-full transition-all ${autoSave ? 'bg-[var(--accent)]' : 'bg-white/10'}`}>
                      <div className={`w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform ${autoSave ? 'translate-x-[21px]' : 'translate-x-[3px]'}`} />
                    </button>
                  </div>
                </div>
              </div>

              <button onClick={handleSaveSettings}
                className="px-5 py-2.5 text-[13px] rounded-[10px] bg-[var(--accent)] text-white hover:brightness-110 transition-all">
                Save
              </button>
            </>
          )}

          {/* ── API Keys ── */}
          {tab === 'api-keys' && (
            <>
              <h2 className="text-[15px] font-semibold text-white/80">API Keys</h2>

              <div className="space-y-3">
                {providers.map((p) => (
                  <div key={p.key} className={cardClass}>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="w-[8px] h-[8px] rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-[14px] font-medium text-white/75">{p.label}</span>
                      {availability[p.key] && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(92,203,143,0.12)', color: 'var(--green)' }}>
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/25 mb-3">{p.desc}</p>
                    <input type="password" value={keys[p.key]} onChange={(e) => setKeys({ ...keys, [p.key]: e.target.value })}
                      placeholder={p.ph} className={inputClass} />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button onClick={handleSaveKeys}
                  className="px-5 py-2.5 text-[13px] rounded-[10px] bg-[var(--accent)] text-white hover:brightness-110 transition-all">
                  {keySaved ? 'Saved' : 'Save Keys'}
                </button>
                <span className="text-[11px] text-white/20">Stored locally with restricted file permissions</span>
              </div>
            </>
          )}

          {/* ── Projects ── */}
          {tab === 'projects' && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-white/80">Projects</h2>
                <button onClick={handleAddProject}
                  className="px-3.5 py-2 text-[12px] rounded-[9px] bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-all">
                  + Add Project
                </button>
              </div>
              <p className="text-[12px] text-white/30 -mt-2">
                Each project can have its own AI instructions and preferred model. When chatting in AI Hub, select a project to automatically include its context.
              </p>

              <div className="space-y-2">
                {projects.map((p) => (
                  <div key={p.id} className={`${cardClass} cursor-pointer hover:border-white/[0.1] transition-all`}
                    onClick={() => setEditingProject(p)}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[14px] text-white/75 font-medium">{p.name}</div>
                        <div className="text-[11px] text-white/25 font-mono mt-0.5">{p.path}</div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id); }}
                        className="text-white/15 hover:text-[var(--red)] text-[12px] px-2 py-1 rounded-[6px] hover:bg-white/[0.04] transition-all">
                        Remove
                      </button>
                    </div>
                    {p.instructions && (
                      <div className="mt-2 text-[11px] text-white/30 line-clamp-2">{p.instructions}</div>
                    )}
                  </div>
                ))}
                {projects.length === 0 && (
                  <div className={`${cardClass} text-center py-8`}>
                    <p className="text-[13px] text-white/25">No projects yet</p>
                    <p className="text-[11px] text-white/15 mt-1">Add a project folder to give AI project-specific context</p>
                  </div>
                )}
              </div>

              {/* Edit project dialog */}
              {editingProject && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                  <div className="w-[480px] rounded-[16px] border shadow-2xl p-6 space-y-4"
                    style={{ background: 'rgba(22,22,30,0.98)', borderColor: 'var(--border)' }}>
                    <div className="flex justify-between items-center">
                      <h3 className="text-[14px] font-semibold text-white/80">Edit Project</h3>
                      <button onClick={() => setEditingProject(null)} className="text-white/30 hover:text-white/60 text-[13px]">Close</button>
                    </div>
                    <div>
                      <label className="text-[12px] text-white/40 mb-1 block">Name</label>
                      <input value={editingProject.name} onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                        className={inputClass} style={{ fontFamily: 'inherit' }} />
                    </div>
                    <div>
                      <label className="text-[12px] text-white/40 mb-1 block">Path</label>
                      <div className="text-[12px] text-white/30 font-mono">{editingProject.path}</div>
                    </div>
                    <div>
                      <label className="text-[12px] text-white/40 mb-1 block">AI Instructions</label>
                      <textarea value={editingProject.instructions}
                        onChange={(e) => setEditingProject({ ...editingProject, instructions: e.target.value })}
                        placeholder="Custom instructions for AI when working on this project. E.g., 'Use TypeScript, follow existing patterns, prefer functional components...'"
                        className={inputClass + ' h-32 resize-none'} style={{ fontFamily: 'inherit' }} />
                    </div>
                    <div>
                      <label className="text-[12px] text-white/40 mb-1 block">Preferred Model</label>
                      <select value={editingProject.model || ''} onChange={(e) => setEditingProject({ ...editingProject, model: e.target.value || undefined })}
                        className={inputClass + ' cursor-pointer'} style={{ fontFamily: 'inherit' }}>
                        <option value="" className="bg-[#1a1a24]">Default</option>
                        <option value="claude-opus-4-6" className="bg-[#1a1a24]">Claude Opus 4.6</option>
                        <option value="claude-sonnet-4-6" className="bg-[#1a1a24]">Claude Sonnet 4.6</option>
                        <option value="gpt-4o" className="bg-[#1a1a24]">GPT-4o</option>
                      </select>
                    </div>
                    <button onClick={() => handleSaveProject(editingProject)}
                      className="w-full py-2.5 text-[13px] rounded-[10px] bg-[var(--accent)] text-white hover:brightness-110 transition-all">
                      Save Project
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Context & Skills ── */}
          {tab === 'context' && (
            <>
              <h2 className="text-[15px] font-semibold text-white/80">Context & Skills</h2>
              <p className="text-[12px] text-white/30 -mt-2">
                Global instructions apply to all AI conversations. Like Claude's CLAUDE.md or GPT's custom instructions.
              </p>

              <div className={cardClass}>
                <label className="text-[12px] font-medium text-white/50 mb-2 block">Global AI Instructions</label>
                <textarea value={globalInstructions}
                  onChange={(e) => setGlobalInstructions(e.target.value)}
                  placeholder="Enter instructions that will be included in every AI conversation. E.g., coding style preferences, language, role context..."
                  className={inputClass + ' h-40 resize-y'} style={{ fontFamily: 'inherit' }} />
                <button onClick={handleSaveGlobalInstructions}
                  className="mt-3 px-4 py-2 text-[12px] rounded-[9px] bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-all">
                  Save Instructions
                </button>
              </div>

              <div className={cardClass}>
                <label className="text-[12px] font-medium text-white/50 mb-2 block">Memory Files ({contextFiles.length})</label>
                <p className="text-[11px] text-white/25 mb-3">
                  These are your Claude Code memory files (~/.claude/memory/). They're automatically used as context.
                </p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {contextFiles.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-white/[0.02] text-[12px]">
                      <span className="w-[6px] h-[6px] rounded-full" style={{
                        backgroundColor: f.type === 'style' ? 'var(--yellow)' : f.type === 'instructions' ? 'var(--accent)' : 'var(--green)',
                      }} />
                      <span className="text-white/50 truncate flex-1">{f.name}</span>
                      <span className="text-[10px] text-white/20">{f.type}</span>
                    </div>
                  ))}
                  {contextFiles.length === 0 && (
                    <p className="text-[12px] text-white/20 text-center py-4">No memory files found</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── About ── */}
          {tab === 'about' && (
            <>
              <h2 className="text-[15px] font-semibold text-white/80">About</h2>
              <div className={cardClass + ' text-center py-8'}>
                <div className="text-[20px] font-bold text-white/80 mb-1">Code Harness</div>
                <div className="text-[13px] text-white/30 mb-4">Personal AI Operating System</div>
                <div className="text-[12px] text-white/20 space-y-1">
                  <div>Version 2.0.0</div>
                  <div>Built with Electron + React + TypeScript</div>
                  <div>Language x AI Lab</div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

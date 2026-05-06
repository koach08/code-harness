import { useState } from 'react';

type BuilderTab = 'scan' | 'store' | 'infra';

interface ScanResult {
  name: string; cwd: string; framework: string | null; language: string | null;
  dependencies: string[]; configs: string[]; suggestions: string[];
}

interface StoreMeta {
  appName: string; bundleId: string; description: string;
  platform: string; developerName: string; developerEmail: string;
  websiteUrl: string; language: string;
}

export function BuilderView() {
  const [tab, setTab] = useState<BuilderTab>('scan');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanCwd, setScanCwd] = useState('');
  const [scanning, setScanning] = useState(false);

  // Store tab state
  const [storeMeta, setStoreMeta] = useState<StoreMeta>({
    appName: '', bundleId: '', description: '', platform: 'electron',
    developerName: 'Language x AI Lab', developerEmail: 'info@language-smartlearning.com',
    websiteUrl: '', language: 'en',
  });
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [savedDir, setSavedDir] = useState<string | null>(null);

  const api = window.api as any;

  // ── Scan ──
  const handleScan = async () => {
    if (!scanCwd) return;
    setScanning(true);
    const result = await api.scanProject(scanCwd);
    setScanResult(result);
    setScanning(false);
    // Auto-fill store meta
    if (result.packageName) setStoreMeta((m) => ({ ...m, appName: result.packageName || result.name }));
  };

  const handlePickScanFolder = async () => {
    const f = await api.harnessPickFolder();
    if (f) { setScanCwd(f); }
  };

  // ── Store Generation ──
  const handleGenSingle = async (type: 'privacy' | 'terms' | 'metadata' | 'checklist' | 'privacyInfo') => {
    setGenerating(type);
    try {
      let result;
      switch (type) {
        case 'privacy': result = await api.builderGenPrivacyPolicy(storeMeta); break;
        case 'terms': result = await api.builderGenTerms(storeMeta); break;
        case 'metadata': result = await api.builderGenStoreMetadata(storeMeta); break;
        case 'checklist': result = await api.builderGenChecklist(storeMeta); break;
        case 'privacyInfo': result = await api.builderGenPrivacyInfo(storeMeta); break;
      }
      if (result.success) {
        setGeneratedContent((prev) => ({
          ...prev,
          [type]: result.content || JSON.stringify(result.metadata, null, 2),
        }));
      }
    } catch {}
    setGenerating(null);
  };

  const handleGenAll = async () => {
    if (!scanCwd) return;
    setGenerating('all');
    const result = await api.builderGenAllStoreAssets(storeMeta, scanCwd);
    if (result.success) {
      setSavedDir(result.savedDir);
      setGeneratedContent({ all: `All assets saved to ${result.savedDir}` });
    }
    setGenerating(null);
  };

  const tabs: { id: BuilderTab; label: string }[] = [
    { id: 'scan', label: 'Project Scan' },
    { id: 'store', label: 'Store Assets' },
    { id: 'infra', label: 'Infrastructure' },
  ];

  const INFRA_CARDS = [
    { id: 'supabase', label: 'Supabase', desc: 'Auth, Database, Storage, RLS', color: '#9ece6a', cmd: 'Set up Supabase with auth helpers, middleware, and RLS policies' },
    { id: 'stripe', label: 'Stripe', desc: 'Payments, Subscriptions, Webhooks', color: '#bb9af7', cmd: 'Set up Stripe with checkout, webhooks, and customer portal' },
    { id: 'vercel', label: 'Vercel', desc: 'Deploy, Domains, Env Vars', color: '#7aa2f7', cmd: 'Deploy to Vercel with production settings' },
    { id: 'capacitor', label: 'Capacitor', desc: 'iOS & Android from Web', color: '#e0af68', cmd: 'Add Capacitor for iOS and Android builds' },
    { id: 'tauri', label: 'Tauri', desc: 'Desktop from Web (Rust)', color: '#f7768e', cmd: 'Add Tauri for native desktop builds' },
    { id: 'docker', label: 'Docker', desc: 'Containerize the app', color: '#7dcfff', cmd: 'Create Dockerfile and docker-compose.yml' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab header */}
      <div className="flex items-center h-10 px-4 border-b border-white/10 gap-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${tab === t.id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">

          {/* ── Scan Tab ── */}
          {tab === 'scan' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input value={scanCwd} onChange={(e) => setScanCwd(e.target.value)} placeholder="Project directory..."
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 outline-none focus:border-[#7aa2f7]/40 font-mono" />
                <button onClick={handlePickScanFolder} className="px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-lg text-white/50 hover:bg-white/10">Browse</button>
                <button onClick={handleScan} disabled={!scanCwd || scanning}
                  className="px-4 py-2 text-xs bg-[#7aa2f7] text-white rounded-lg hover:bg-[#6a92e7] disabled:opacity-30">
                  {scanning ? 'Scanning...' : 'Scan'}
                </button>
              </div>

              {scanResult && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-medium text-white/80 mb-2">{scanResult.name}</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-white/30">Framework:</span>
                        <span className="ml-2 text-white/70">{scanResult.framework || 'Unknown'}</span>
                      </div>
                      <div>
                        <span className="text-white/30">Language:</span>
                        <span className="ml-2 text-white/70">{scanResult.language || 'Unknown'}</span>
                      </div>
                    </div>
                    {scanResult.configs.length > 0 && (
                      <div className="mt-2 flex gap-1 flex-wrap">
                        {scanResult.configs.map((c) => (
                          <span key={c} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#7aa2f7]/15 text-[#7aa2f7]">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {scanResult.dependencies.length > 0 && (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <h4 className="text-xs text-white/40 mb-2">Dependencies ({scanResult.dependencies.length})</h4>
                      <div className="flex gap-1 flex-wrap max-h-24 overflow-y-auto">
                        {scanResult.dependencies.map((d) => (
                          <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Store Tab ── */}
          {tab === 'store' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white/70">App Store / Play Store Assets</h3>

              {/* Meta form */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'appName', label: 'App Name', placeholder: 'My App' },
                  { key: 'bundleId', label: 'Bundle ID', placeholder: 'com.example.myapp' },
                  { key: 'platform', label: 'Platform', placeholder: 'electron' },
                  { key: 'language', label: 'Language', placeholder: 'en' },
                  { key: 'developerName', label: 'Developer', placeholder: 'Your Name' },
                  { key: 'developerEmail', label: 'Email', placeholder: 'dev@example.com' },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="text-[10px] text-white/30 mb-0.5 block">{f.label}</label>
                    <input value={(storeMeta as any)[f.key]} onChange={(e) => setStoreMeta({ ...storeMeta, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white/70 outline-none focus:border-[#7aa2f7]/40" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="text-[10px] text-white/30 mb-0.5 block">Description</label>
                  <textarea value={storeMeta.description} onChange={(e) => setStoreMeta({ ...storeMeta, description: e.target.value })}
                    placeholder="What does your app do?"
                    className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white/70 outline-none focus:border-[#7aa2f7]/40 h-16 resize-none" />
                </div>
              </div>

              {/* Generate buttons */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'privacy', label: 'Privacy Policy', color: '#9ece6a' },
                  { id: 'terms', label: 'Terms of Service', color: '#bb9af7' },
                  { id: 'privacyInfo', label: 'PrivacyInfo.xcprivacy', color: '#7dcfff' },
                  { id: 'metadata', label: 'Store Metadata', color: '#e0af68' },
                  { id: 'checklist', label: 'Submission Checklist', color: '#f7768e' },
                ].map((g) => (
                  <button key={g.id} onClick={() => handleGenSingle(g.id as any)}
                    disabled={!storeMeta.appName || generating !== null}
                    className="p-3 rounded-lg text-left text-xs border border-white/10 hover:border-white/20 hover:bg-white/5 disabled:opacity-30 transition-colors">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                      <span className="text-white/70">{g.label}</span>
                    </div>
                    {generating === g.id && <div className="text-[10px] text-white/30 mt-1">Generating...</div>}
                    {generatedContent[g.id] && <div className="text-[10px] text-[#9ece6a] mt-1">Generated</div>}
                  </button>
                ))}

                <button onClick={handleGenAll} disabled={!storeMeta.appName || !scanCwd || generating !== null}
                  className="p-3 rounded-lg text-xs border border-[#7aa2f7]/30 bg-[#7aa2f7]/10 text-[#7aa2f7] hover:bg-[#7aa2f7]/20 disabled:opacity-30 transition-colors">
                  <div className="font-medium">Generate All & Save</div>
                  <div className="text-[10px] opacity-60 mt-0.5">All assets to store-assets/</div>
                  {generating === 'all' && <div className="text-[10px] mt-1">Generating...</div>}
                </button>
              </div>

              {savedDir && (
                <div className="p-3 rounded-lg bg-[#9ece6a]/10 border border-[#9ece6a]/20 text-xs text-[#9ece6a]">
                  Assets saved to: {savedDir}
                </div>
              )}

              {/* Preview */}
              {Object.keys(generatedContent).length > 0 && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-xs text-white/40 mb-2">Preview</h4>
                  <pre className="text-[11px] text-white/50 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
                    {Object.entries(generatedContent).map(([k, v]) => `=== ${k} ===\n${v.slice(0, 500)}${v.length > 500 ? '...' : ''}\n\n`).join('')}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* ── Infra Tab ── */}
          {tab === 'infra' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white/70">Infrastructure Setup</h3>
              <p className="text-xs text-white/30">Select a service to set up. This will open a Claude Code session with the appropriate prompt.</p>
              <div className="grid grid-cols-3 gap-3">
                {INFRA_CARDS.map((card) => (
                  <button key={card.id}
                    onClick={async () => {
                      const { useSessionStore } = await import('../../stores/session.store');
                      const session = await api.createSession({ mode: 'claude', cwd: scanCwd || undefined });
                      useSessionStore.getState().addTab(session);
                      const { useUIStore } = await import('../../stores/ui.store');
                      useUIStore.getState().setActiveView('workspace');
                      setTimeout(() => api.sendInput(session.id, card.cmd + '\n'), 1000);
                    }}
                    className="p-4 rounded-xl text-left border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: card.color }} />
                      <span className="text-sm font-medium text-white/80">{card.label}</span>
                    </div>
                    <p className="text-[10px] text-white/30">{card.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

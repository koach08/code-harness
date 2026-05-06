import { useEffect, useCallback } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { WorkspaceView } from './views/workspace/WorkspaceView';
import { AIHubView } from './views/ai-hub/AIHubView';
import { PipelineView } from './views/pipeline/PipelineView';
import { AgentsView } from './views/agents/AgentsView';
import { BuilderView } from './views/builder/BuilderView';
import { NotebookView } from './views/notebook/NotebookView';
import { DocumentView } from './views/document/DocumentView';
import { SettingsView } from './views/settings/SettingsView';
import { useUIStore } from './stores/ui.store';
import { useSessionStore } from './stores/session.store';

const VIEW_TITLES: Record<string, string> = {
  workspace: 'Workspace',
  'ai-hub': 'AI Hub',
  pipeline: 'Pipeline',
  builder: 'Builder',
  agents: 'Agents',
  notebook: 'Notebook',
  document: 'Document',
  settings: 'Settings',
};

export default function App() {
  const { activeView, setActiveView } = useUIStore();
  const { addTab } = useSessionStore();

  // Create initial session on first load
  useEffect(() => {
    const init = async () => {
      const saved = await window.api.loadSessions();
      if (saved.length > 0) {
        for (const s of saved) {
          const session = await window.api.createSession({
            cwd: s.cwd,
            mode: s.mode,
            name: s.name,
            restoreFromId: s.id,
            conversationId: s.conversationId || undefined,
          });
          addTab(session);
        }
      } else {
        const session = await window.api.createSession({ mode: 'claude' });
        addTab(session);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Menu action handler
  useEffect(() => {
    window.api.onMenuAction(async (action) => {
      switch (action) {
        case 'new-tab': {
          const session = await window.api.createSession({ mode: 'claude' });
          addTab(session);
          break;
        }
        case 'close-tab': {
          const { tabs, activeTabId, removeTab } = useSessionStore.getState();
          const tab = tabs.find((t) => t.id === activeTabId);
          if (tab) {
            await window.api.closeSession(tab.sessionId);
            window.api.removeListeners(tab.sessionId);
            removeTab(tab.id);
          }
          break;
        }
        case 'settings':
          setActiveView('settings');
          break;
      }
    });
  }, [addTab, setActiveView]);

  // Auto-save sessions periodically
  useEffect(() => {
    const interval = setInterval(() => {
      window.api.saveSessions();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key >= '1' && e.key <= '7') {
      e.preventDefault();
      const views = ['workspace', 'ai-hub', 'pipeline', 'builder', 'agents', 'notebook', 'document'] as const;
      const idx = parseInt(e.key) - 1;
      if (idx < views.length) setActiveView(views[idx]);
    }
  }, [setActiveView]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const renderView = () => {
    switch (activeView) {
      case 'workspace': return <WorkspaceView />;
      case 'ai-hub': return <AIHubView />;
      case 'pipeline': return <PipelineView />;
      case 'builder': return <BuilderView />;
      case 'agents': return <AgentsView />;
      case 'notebook': return <NotebookView />;
      case 'document': return <DocumentView />;
      case 'settings': return <SettingsView />;
      default: return <WorkspaceView />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Sidebar (glass panel) ── */}
      <Sidebar />

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* ── Title bar (draggable) ── */}
        <div className="titlebar-drag h-[52px] flex items-center px-5 flex-shrink-0 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          {/* Left spacer for traffic lights */}
          <div className="w-[4px] flex-shrink-0" />

          <div className="flex-1 flex items-center justify-center gap-2">
            <span className="text-[12px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
              {VIEW_TITLES[activeView] || 'Code Harness'}
            </span>
          </div>

          <div className="w-[4px] flex-shrink-0" />
        </div>

        {/* ── View content ── */}
        <main className="flex-1 min-h-0">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

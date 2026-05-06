import { useCallback } from 'react';
import { Terminal } from '../../components/terminal/Terminal';
import { TabBar } from '../../components/layout/TabBar';
import { useSessionStore } from '../../stores/session.store';
import type { SessionMode } from '../../../electron/types';

export function WorkspaceView() {
  const { tabs, activeTabId, addTab, removeTab } = useSessionStore();

  const handleNewTab = useCallback(async (mode: SessionMode) => {
    const session = await window.api.createSession({ mode });
    addTab(session);
  }, [addTab]);

  const handleCloseTab = useCallback(async (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      await window.api.closeSession(tab.sessionId);
      window.api.removeListeners(tab.sessionId);
    }
    removeTab(tabId);
  }, [tabs, removeTab]);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex flex-col h-full">
      <TabBar onNewTab={handleNewTab} onCloseTab={handleCloseTab} />

      <div className="flex-1 relative">
        {tabs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/30">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 mb-4 opacity-30">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            <p className="text-sm mb-2">No sessions</p>
            <p className="text-xs text-white/20">
              Press{' '}
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/40">
                Cmd+T
              </kbd>{' '}
              to open a new tab
            </p>
          </div>
        ) : (
          tabs.map((tab) => (
            <div
              key={tab.id}
              className={`absolute inset-0 ${
                tab.id === activeTabId ? 'visible' : 'invisible'
              }`}
            >
              <Terminal
                sessionId={tab.sessionId}
                fontSize={14}
              />
            </div>
          ))
        )}
      </div>

      {/* Status bar */}
      {activeTab && (
        <div className="h-[26px] flex items-center px-4 text-[11px] border-t gap-4" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-subtle)' }}>
          <span className="flex items-center gap-1.5">
            <span
              className="w-[5px] h-[5px] rounded-full"
              style={{ backgroundColor: activeTab.isAlive ? 'var(--green)' : 'var(--red)' }}
            />
            {activeTab.mode}
          </span>
          <span className="truncate opacity-60">{activeTab.cwd}</span>
        </div>
      )}
    </div>
  );
}

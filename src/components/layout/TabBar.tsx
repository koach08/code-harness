import { useSessionStore } from '../../stores/session.store';
import type { SessionMode } from '../../../electron/types';

const MODE_COLORS: Record<SessionMode, string> = {
  claude: 'var(--purple)',
  codex: 'var(--green)',
  aider: 'var(--yellow)',
  shell: 'var(--cyan)',
};

const MODE_LABELS: Record<SessionMode, string> = {
  claude: 'Claude',
  codex: 'Codex',
  aider: 'Aider',
  shell: 'Shell',
};

interface TabBarProps {
  onNewTab: (mode: SessionMode) => void;
  onCloseTab: (tabId: string) => void;
}

export function TabBar({ onNewTab, onCloseTab }: TabBarProps) {
  const { tabs, activeTabId, setActiveTab } = useSessionStore();

  return (
    <div className="flex items-center h-[38px] px-2 gap-1 overflow-x-auto flex-shrink-0 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group flex items-center gap-2 px-3 h-[28px] rounded-[7px] text-[12px] transition-all min-w-0 max-w-[160px] ${
              isActive
                ? 'text-white/90'
                : 'text-white/35 hover:text-white/55 hover:bg-white/[0.04]'
            }`}
            style={isActive ? { background: 'var(--bg-surface-active)' } : undefined}
          >
            <span
              className="w-[6px] h-[6px] rounded-full flex-shrink-0"
              style={{ backgroundColor: tab.isAlive ? MODE_COLORS[tab.mode] : 'var(--text-tertiary)' }}
            />
            <span className="truncate">{tab.name}</span>
            <span
              onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
              className="ml-auto flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-[4px] hover:bg-white/[0.1] opacity-0 group-hover:opacity-60 transition-opacity text-[10px]"
            >
              x
            </span>
          </button>
        );
      })}

      {/* New tab */}
      <div className="relative flex-shrink-0 group">
        <button
          className="w-[28px] h-[28px] flex items-center justify-center rounded-[7px] hover:bg-white/[0.05] text-white/25 hover:text-white/50 text-[14px] transition-all"
          title="New tab"
        >
          +
        </button>
        <div className="absolute top-full left-0 mt-1.5 bg-[rgba(28,28,36,0.95)] backdrop-blur-xl border rounded-[10px] shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[130px] p-1" style={{ borderColor: 'var(--border)' }}>
          {(Object.keys(MODE_LABELS) as SessionMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onNewTab(mode)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-white/60 hover:bg-white/[0.07] hover:text-white/85 rounded-[6px] transition-colors"
            >
              <span className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: MODE_COLORS[mode] }} />
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

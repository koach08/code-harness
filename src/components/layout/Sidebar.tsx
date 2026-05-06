import { useUIStore, type ViewId } from '../../stores/ui.store';

interface NavItem {
  id: ViewId;
  label: string;
  icon: JSX.Element;
}

const sideIcon = (children: JSX.Element) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    {children}
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { id: 'workspace', label: 'Terminal', icon: sideIcon(<><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></>) },
  { id: 'ai-hub', label: 'AI Chat', icon: sideIcon(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />) },
  { id: 'pipeline', label: 'Pipeline', icon: sideIcon(<><circle cx="6" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="M6 9v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9" /></>) },
  { id: 'builder', label: 'Builder', icon: sideIcon(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>) },
  { id: 'agents', label: 'Agents', icon: sideIcon(<><path d="M12 8V4H8" /><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M2 14h2M20 14h2" /></>) },
  { id: 'notebook', label: 'Notebook', icon: sideIcon(<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>) },
  { id: 'document', label: 'Document', icon: sideIcon(<><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></>) },
];

export function Sidebar() {
  const { activeView, setActiveView, sidebarCollapsed, toggleSidebar } = useUIStore();

  const navBtn = (id: ViewId | 'settings', label: string, icon: JSX.Element) => {
    const isActive = activeView === id;
    return (
      <button
        key={id}
        onClick={() => setActiveView(id as ViewId)}
        className={`w-full flex items-center h-[36px] rounded-[9px] text-[13px] font-normal transition-all ${
          sidebarCollapsed ? 'justify-center px-0' : 'px-3 gap-3'
        } ${
          isActive
            ? 'text-white/95'
            : 'text-white/40 hover:text-white/65 hover:bg-white/[0.05]'
        }`}
        style={isActive ? {
          background: 'linear-gradient(135deg, rgba(110,142,247,0.13) 0%, rgba(110,142,247,0.08) 100%)',
          boxShadow: 'inset 0 0 0 0.5px rgba(110,142,247,0.18)',
        } : undefined}
        title={label}
      >
        <span
          className="flex-shrink-0"
          style={{ color: isActive ? 'var(--accent)' : undefined, opacity: isActive ? 1 : 0.55 }}
        >
          {icon}
        </span>
        {!sidebarCollapsed && (
          <span
            className="truncate"
            style={{ color: isActive ? 'var(--accent)' : undefined }}
          >
            {label}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside
      className={`titlebar-no-drag glass flex flex-col flex-shrink-0 border-r transition-[width] duration-200 ease-out ${
        sidebarCollapsed ? 'w-[60px]' : 'w-[210px]'
      }`}
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Traffic light spacer (macOS close/min/max buttons are here) */}
      <div className="h-[52px] flex items-end px-3 pb-1.5">
        <button
          onClick={toggleSidebar}
          className="w-[32px] h-[32px] flex items-center justify-center rounded-[8px] hover:bg-white/[0.06] transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
          title={sidebarCollapsed ? 'Expand' : 'Collapse'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-[14px] h-[14px]">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
      </div>

      {/* Label */}
      {!sidebarCollapsed && (
        <div className="px-4 pt-2 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text-tertiary)' }}>
            Navigation
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-1.5 px-2.5 space-y-[3px] overflow-y-auto">
        {NAV_ITEMS.map((item) => navBtn(item.id, item.label, item.icon))}
      </nav>

      {/* Bottom */}
      <div className="px-2.5 py-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        {navBtn(
          'settings',
          'Settings',
          sideIcon(
            <>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </>
          )
        )}
      </div>
    </aside>
  );
}

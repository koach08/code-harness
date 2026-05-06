import { create } from 'zustand';

export type ViewId =
  | 'workspace'
  | 'ai-hub'
  | 'pipeline'
  | 'builder'
  | 'agents'
  | 'notebook'
  | 'document'
  | 'settings';

interface UIState {
  activeView: ViewId;
  sidebarCollapsed: boolean;

  setActiveView: (view: ViewId) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'workspace',
  sidebarCollapsed: false,

  setActiveView: (view) => set({ activeView: view }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));

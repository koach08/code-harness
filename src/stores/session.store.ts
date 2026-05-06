import { create } from 'zustand';
import type { SessionInfo, SessionMode } from '../../electron/types';

export interface Tab {
  id: string;
  sessionId: string;
  name: string;
  cwd: string;
  mode: SessionMode;
  isAlive: boolean;
}

interface SessionState {
  tabs: Tab[];
  activeTabId: string | null;
  defaultCwd: string;

  // Actions
  addTab: (session: SessionInfo) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  setTabDead: (sessionId: string) => void;
  renameTab: (tabId: string, name: string) => void;
  setDefaultCwd: (cwd: string) => void;
  setTabs: (tabs: Tab[]) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  tabs: [],
  activeTabId: null,
  defaultCwd: '',

  addTab: (session) => {
    const tab: Tab = {
      id: session.id,
      sessionId: session.id,
      name: session.name,
      cwd: session.cwd,
      mode: session.mode,
      isAlive: true,
    };
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    }));
  },

  removeTab: (tabId) => {
    set((state) => {
      const idx = state.tabs.findIndex((t) => t.id === tabId);
      const newTabs = state.tabs.filter((t) => t.id !== tabId);
      let newActive = state.activeTabId;
      if (state.activeTabId === tabId) {
        newActive = newTabs[Math.min(idx, newTabs.length - 1)]?.id || null;
      }
      return { tabs: newTabs, activeTabId: newActive };
    });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  setTabDead: (sessionId) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.sessionId === sessionId ? { ...t, isAlive: false } : t
      ),
    }));
  },

  renameTab: (tabId, name) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, name } : t)),
    }));
  },

  setDefaultCwd: (cwd) => set({ defaultCwd: cwd }),

  setTabs: (tabs) =>
    set({ tabs, activeTabId: tabs[0]?.id || null }),
}));

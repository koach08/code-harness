import { create } from 'zustand';

export type AIModel =
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5-20251001'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'o3'
  | 'o4-mini'
  | 'sonar-pro'
  | 'sonar';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  model: AIModel;
  updatedAt: string;
  messageCount: number;
}

export interface Conversation {
  id: string;
  title: string;
  model: AIModel;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  totalInputTokens: number;
  totalOutputTokens: number;
}

interface AIState {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  selectedModel: AIModel;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;

  setConversations: (convs: ConversationSummary[]) => void;
  setActiveConversation: (conv: Conversation | null) => void;
  setActiveConversationId: (id: string | null) => void;
  setSelectedModel: (model: AIModel) => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamContent: (text: string) => void;
  clearStreamContent: () => void;
  addMessage: (msg: ChatMessage) => void;
  setError: (error: string | null) => void;
}

export const MODEL_INFO: Record<AIModel, { label: string; provider: string; color: string }> = {
  'claude-opus-4-6': { label: 'Claude Opus 4.6', provider: 'Anthropic', color: '#bb9af7' },
  'claude-sonnet-4-6': { label: 'Claude Sonnet 4.6', provider: 'Anthropic', color: '#bb9af7' },
  'claude-haiku-4-5-20251001': { label: 'Claude Haiku 4.5', provider: 'Anthropic', color: '#bb9af7' },
  'gpt-4o': { label: 'GPT-4o', provider: 'OpenAI', color: '#9ece6a' },
  'gpt-4o-mini': { label: 'GPT-4o mini', provider: 'OpenAI', color: '#9ece6a' },
  'o3': { label: 'o3', provider: 'OpenAI', color: '#9ece6a' },
  'o4-mini': { label: 'o4-mini', provider: 'OpenAI', color: '#9ece6a' },
  'sonar-pro': { label: 'Sonar Pro', provider: 'Perplexity', color: '#7dcfff' },
  'sonar': { label: 'Sonar', provider: 'Perplexity', color: '#7dcfff' },
};

export const useAIStore = create<AIState>((set) => ({
  conversations: [],
  activeConversationId: null,
  activeConversation: null,
  selectedModel: 'claude-sonnet-4-6',
  isStreaming: false,
  streamingContent: '',
  error: null,

  setConversations: (convs) => set({ conversations: convs }),
  setActiveConversation: (conv) => set({ activeConversation: conv }),
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  appendStreamContent: (text) => set((s) => ({ streamingContent: s.streamingContent + text })),
  clearStreamContent: () => set({ streamingContent: '' }),
  addMessage: (msg) =>
    set((s) => ({
      activeConversation: s.activeConversation
        ? { ...s.activeConversation, messages: [...s.activeConversation.messages, msg] }
        : null,
    })),
  setError: (error) => set({ error }),
}));

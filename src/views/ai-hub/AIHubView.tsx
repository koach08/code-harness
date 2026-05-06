import { useState, useEffect, useRef, useCallback } from 'react';
import { useAIStore, MODEL_INFO, type AIModel } from '../../stores/ai.store';

export function AIHubView() {
  const {
    conversations,
    activeConversationId,
    activeConversation,
    selectedModel,
    isStreaming,
    streamingContent,
    error,
    setConversations,
    setActiveConversation,
    setActiveConversationId,
    setSelectedModel,
    setStreaming,
    appendStreamContent,
    clearStreamContent,
    addMessage,
    setError,
  } = useAIStore();

  const [input, setInput] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamCleanupRef = useRef<(() => void) | null>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    const convs = await (window.api as any).aiListConversations();
    setConversations(convs);
  };

  // Load active conversation
  useEffect(() => {
    if (activeConversationId) {
      loadConversation(activeConversationId);
    }
  }, [activeConversationId]);

  const loadConversation = async (id: string) => {
    const conv = await (window.api as any).aiGetConversation(id);
    if (conv) {
      setActiveConversation(conv);
      setSelectedModel(conv.model);
    }
  };

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, streamingContent]);

  // Create new conversation
  const handleNewConversation = async () => {
    const conv = await (window.api as any).aiCreateConversation(selectedModel);
    setActiveConversation(conv);
    setActiveConversationId(conv.id);
    await loadConversations();
    inputRef.current?.focus();
  };

  // Delete conversation
  const handleDeleteConversation = async (id: string) => {
    await (window.api as any).aiDeleteConversation(id);
    if (activeConversationId === id) {
      setActiveConversation(null);
      setActiveConversationId(null);
    }
    await loadConversations();
  };

  // Send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    let convId = activeConversationId;

    // Create conversation if needed
    if (!convId) {
      const conv = await (window.api as any).aiCreateConversation(selectedModel);
      setActiveConversation(conv);
      setActiveConversationId(conv.id);
      convId = conv.id;
    }

    const message = input.trim();
    setInput('');
    setError(null);

    // Add user message to UI immediately
    addMessage({ role: 'user', content: message });

    // Start streaming
    setStreaming(true);
    clearStreamContent();

    const result = await (window.api as any).aiChatStream(convId, message, selectedModel);

    if (!result.success) {
      setError(result.error || 'Failed to send message');
      setStreaming(false);
      return;
    }

    // Listen for stream events
    const cleanup = (window.api as any).onAIStream(convId, (chunk: { type: string; content: string; inputTokens?: number; outputTokens?: number }) => {
      if (chunk.type === 'text') {
        appendStreamContent(chunk.content);
      } else if (chunk.type === 'done') {
        // Finalize: add assistant message and reload
        const finalContent = useAIStore.getState().streamingContent;
        addMessage({ role: 'assistant', content: finalContent });
        clearStreamContent();
        setStreaming(false);
        loadConversations();
        cleanup();
      } else if (chunk.type === 'error') {
        setError(chunk.content);
        setStreaming(false);
        cleanup();
      }
    });

    streamCleanupRef.current = cleanup;
  }, [input, isStreaming, activeConversationId, selectedModel]);

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const models = Object.entries(MODEL_INFO) as [AIModel, typeof MODEL_INFO[AIModel]][];

  return (
    <div className="flex h-full">
      {/* Conversation Sidebar */}
      {showSidebar && (
        <div className="w-64 flex flex-col border-r border-white/10 bg-[#0c0c10]">
          <div className="p-3 border-b border-white/10">
            <button
              onClick={handleNewConversation}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#7aa2f7]/15 text-[#7aa2f7] hover:bg-[#7aa2f7]/25 transition-colors"
            >
              + New Chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center mx-1 px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                  conv.id === activeConversationId
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/70'
                }`}
                onClick={() => setActiveConversationId(conv.id)}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0 mr-2"
                  style={{ backgroundColor: MODEL_INFO[conv.model]?.color || '#666' }}
                />
                <span className="truncate flex-1">{conv.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 ml-1 text-white/30 hover:text-red-400"
                >
                  x
                </button>
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="text-center text-white/20 text-xs py-8">No conversations yet</p>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center h-10 px-3 border-b border-white/10 gap-2">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-white/40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>

          {/* Model Selector */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as AIModel)}
            className="bg-transparent text-xs text-white/70 border border-white/10 rounded-md px-2 py-1 outline-none focus:border-[#7aa2f7]/50"
          >
            {models.map(([id, info]) => (
              <option key={id} value={id} className="bg-[#1a1b2e]">
                {info.label} ({info.provider})
              </option>
            ))}
          </select>

          {activeConversation && (
            <span className="text-xs text-white/30 truncate ml-2">
              {activeConversation.totalInputTokens + activeConversation.totalOutputTokens} tokens
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!activeConversation || activeConversation.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white/20">
              <div className="text-3xl mb-4 opacity-30">*</div>
              <h3 className="text-base font-medium text-white/40 mb-1">AI Hub</h3>
              <p className="text-xs text-white/20 max-w-sm text-center">
                Chat with Claude, GPT, Perplexity. Switch models mid-conversation.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {activeConversation.messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#7aa2f7]/15 text-white/90'
                        : 'bg-white/5 text-white/80'
                    }`}
                  >
                    <pre className="whitespace-pre-wrap font-[inherit] m-0">{msg.content}</pre>
                  </div>
                </div>
              ))}

              {/* Streaming content */}
              {isStreaming && streamingContent && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-xl px-4 py-3 text-sm bg-white/5 text-white/80 leading-relaxed">
                    <pre className="whitespace-pre-wrap font-[inherit] m-0">{streamingContent}</pre>
                    <span className="inline-block w-2 h-4 bg-[#7aa2f7] animate-pulse ml-0.5" />
                  </div>
                </div>
              )}

              {/* Streaming indicator */}
              {isStreaming && !streamingContent && (
                <div className="flex justify-start">
                  <div className="rounded-xl px-4 py-3 text-sm bg-white/5 text-white/40">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex justify-center">
                  <div className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
                    {error}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 pb-4">
          <div className="max-w-3xl mx-auto relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${MODEL_INFO[selectedModel]?.label || selectedModel}...`}
              rows={1}
              className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-[#7aa2f7]/40 resize-none"
              style={{ minHeight: '48px', maxHeight: '200px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 200) + 'px';
              }}
              disabled={isStreaming}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="absolute right-2 bottom-2 w-8 h-8 flex items-center justify-center rounded-lg bg-[#7aa2f7] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#6a92e7] transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';

interface DocFile {
  id: string; title: string; updatedAt: string;
}

interface DocData {
  id: string;
  title: string;
  content: string;
  filePath?: string;
  updatedAt: string;
}

const genDocId = () => `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

export function DocumentView() {
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState('Untitled');
  const [content, setContent] = useState('');
  const [filePath, setFilePath] = useState<string | undefined>();
  const [showSidebar, setShowSidebar] = useState(true);
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const api = window.api as any;

  useEffect(() => { refreshList(); }, []);
  useEffect(() => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    setWordCount(words);
  }, [content]);

  const refreshList = async () => setDocs((await api.documentList()) || []);

  const save = async () => {
    const id = activeId || genDocId();
    if (!activeId) setActiveId(id);
    const data: DocData = { id, title, content, filePath, updatedAt: new Date().toISOString() };
    await api.documentSave(id, JSON.stringify(data));
    refreshList();
  };

  const load = async (id: string) => {
    const result = await api.documentLoad(id);
    if (result.success) {
      const data: DocData = JSON.parse(result.data);
      setActiveId(id); setTitle(data.title); setContent(data.content);
      setFilePath(data.filePath);
    }
  };

  const handleNew = () => {
    setActiveId(null); setTitle('Untitled'); setContent(''); setFilePath(undefined);
  };

  const handleDelete = async (id: string) => {
    await api.documentDelete(id);
    if (activeId === id) handleNew();
    refreshList();
  };

  const handleOpenFile = async () => {
    const result = await api.documentOpenFile();
    if (result) {
      setActiveId(null); setTitle(result.name); setContent(result.content); setFilePath(result.filePath);
    }
  };

  const handleSaveFile = async () => {
    const result = await api.documentSaveFile(filePath, content);
    if (result.success && result.filePath) setFilePath(result.filePath);
  };

  // AI operations
  const AI_ACTIONS = [
    { id: 'humanize-en', label: 'Humanize (EN)', prompt: 'Remove AI writing patterns from this English text. Make it sound naturally written by a human scholar. Preserve academic tone and all citations:\n\n' },
    { id: 'humanize-ja', label: 'Humanize (JA)', prompt: 'この日本語文章からAI生成っぽさを除去してください。です/ます調を維持し、自然な学術的文章に調整:\n\n' },
    { id: 'proofread', label: 'Proofread', prompt: 'Proofread and correct grammar, spelling, and style issues in this text. Show corrections with explanations:\n\n' },
    { id: 'summarize', label: 'Summarize', prompt: 'Summarize the key points of this text in bullet points:\n\n' },
    { id: 'expand', label: 'Expand', prompt: 'Expand on the ideas in this text. Add more detail, examples, and analysis:\n\n' },
    { id: 'translate-en', label: 'Translate EN', prompt: 'Translate this text into English, maintaining academic style:\n\n' },
    { id: 'translate-ja', label: 'Translate JA', prompt: 'この文章を日本語に翻訳してください。学術的な文体を維持:\n\n' },
    { id: 'cite-check', label: 'Check Citations', prompt: 'Check all citations and references in this text for accuracy. Flag any that appear fabricated or incorrect:\n\n' },
  ];

  const handleAIAction = async (action: typeof AI_ACTIONS[0]) => {
    // Use selected text or full content
    const textarea = textareaRef.current;
    const selected = textarea && textarea.selectionStart !== textarea.selectionEnd
      ? content.slice(textarea.selectionStart, textarea.selectionEnd)
      : content;

    setAiLoading(true); setAiOutput(''); setShowAI(true);
    const result = await api.notebookAiQuery(action.prompt + selected);
    setAiOutput(result.output || result.error || '');
    setAiLoading(false);
  };

  const handleCustomAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true); setAiOutput('');
    const result = await api.notebookAiQuery(aiPrompt + '\n\nText:\n' + content);
    setAiOutput(result.output || '');
    setAiLoading(false);
    setAiPrompt('');
  };

  const insertAIOutput = () => {
    if (!aiOutput) return;
    const textarea = textareaRef.current;
    if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
      const before = content.slice(0, textarea.selectionStart);
      const after = content.slice(textarea.selectionEnd);
      setContent(before + aiOutput + after);
    } else {
      setContent(content + '\n\n' + aiOutput);
    }
    setAiOutput('');
  };

  return (
    <div className="flex h-full">
      {/* File sidebar */}
      {showSidebar && (
        <div className="w-56 flex flex-col border-r border-white/10 bg-[#0c0c10]">
          <div className="p-3 border-b border-white/10 space-y-1">
            <button onClick={handleNew} className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#9ece6a]/15 text-[#9ece6a] hover:bg-[#9ece6a]/25">+ New</button>
            <button onClick={handleOpenFile} className="w-full px-3 py-1.5 text-xs rounded-lg bg-white/5 text-white/50 hover:bg-white/10">Open File...</button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {docs.map((d) => (
              <div key={d.id} onClick={() => load(d.id)}
                className={`group flex items-center mx-1 px-3 py-1.5 rounded-lg cursor-pointer text-xs ${d.id === activeId ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5'}`}>
                <span className="truncate flex-1">{d.title}</span>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}
                  className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 ml-1">x</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center h-10 px-3 border-b border-white/10 gap-2">
          <button onClick={() => setShowSidebar(!showSidebar)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-white/40">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-transparent text-sm text-white/80 outline-none flex-1" />
          <span className="text-[10px] text-white/20">{wordCount} words</span>
          <button onClick={() => setShowAI(!showAI)}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${showAI ? 'bg-[#bb9af7]/20 text-[#bb9af7]' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
            AI
          </button>
          <button onClick={save} className="px-2 py-1 text-[10px] rounded bg-[#7aa2f7]/20 text-[#7aa2f7] hover:bg-[#7aa2f7]/30">Save</button>
          <button onClick={handleSaveFile} className="px-2 py-1 text-[10px] rounded bg-white/5 text-white/40 hover:bg-white/10">
            Export .md
          </button>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Text area */}
          <div className="flex-1 overflow-hidden">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing..."
              className="w-full h-full px-8 py-6 bg-transparent text-sm text-white/80 outline-none resize-none font-[Georgia,serif] leading-relaxed placeholder:text-white/15"
              spellCheck
            />
          </div>

          {/* AI Panel */}
          {showAI && (
            <div className="w-80 flex flex-col border-l border-white/10 bg-[#0c0c10]">
              <div className="p-3 border-b border-white/10">
                <h4 className="text-xs text-white/50 mb-2">AI Actions</h4>
                <div className="grid grid-cols-2 gap-1">
                  {AI_ACTIONS.map((a) => (
                    <button key={a.id} onClick={() => handleAIAction(a)} disabled={!content.trim() || aiLoading}
                      className="px-2 py-1.5 text-[10px] rounded-lg border border-white/10 text-white/50 hover:bg-white/5 hover:text-white/70 disabled:opacity-30 text-left">
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom prompt */}
              <div className="p-3 border-b border-white/10">
                <div className="flex gap-1">
                  <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCustomAI(); }}
                    placeholder="Custom instruction..."
                    className="flex-1 px-2 py-1 bg-black/30 border border-white/10 rounded text-[10px] text-white/70 outline-none" />
                  <button onClick={handleCustomAI} disabled={!aiPrompt.trim() || aiLoading}
                    className="px-2 py-1 text-[10px] rounded bg-[#bb9af7]/20 text-[#bb9af7] disabled:opacity-30">Go</button>
                </div>
              </div>

              {/* AI Output */}
              <div className="flex-1 overflow-y-auto p-3">
                {aiLoading && (
                  <div className="flex gap-1 justify-center py-4">
                    <span className="w-1.5 h-1.5 bg-[#bb9af7] rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-[#bb9af7] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#bb9af7] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
                {aiOutput && (
                  <div>
                    <pre className="text-xs text-white/60 whitespace-pre-wrap leading-relaxed font-[inherit]">{aiOutput}</pre>
                    <button onClick={insertAIOutput}
                      className="mt-2 w-full px-2 py-1.5 text-[10px] rounded-lg bg-[#9ece6a]/15 text-[#9ece6a] hover:bg-[#9ece6a]/25">
                      Insert into document
                    </button>
                  </div>
                )}
                {!aiLoading && !aiOutput && (
                  <p className="text-[10px] text-white/15 text-center py-4">
                    Select text and use an AI action, or type a custom instruction
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

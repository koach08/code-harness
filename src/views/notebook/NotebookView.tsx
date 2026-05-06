import { useState, useEffect, useRef } from 'react';

type CellType = 'code' | 'ai' | 'markdown';
type CellLang = 'javascript' | 'python' | 'shell';

interface Cell {
  id: string;
  type: CellType;
  lang?: CellLang;
  content: string;
  output: string;
  isRunning: boolean;
}

interface NotebookData {
  id: string;
  title: string;
  cells: Cell[];
  updatedAt: string;
}

const genId = () => `cell_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

export function NotebookView() {
  const [notebooks, setNotebooks] = useState<Array<{ id: string; title: string; updatedAt: string }>>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState('Untitled Notebook');
  const [cells, setCells] = useState<Cell[]>([
    { id: genId(), type: 'code', lang: 'javascript', content: '', output: '', isRunning: false },
  ]);
  const [showSidebar, setShowSidebar] = useState(true);
  const api = window.api as any;

  useEffect(() => { refreshList(); }, []);

  const refreshList = async () => {
    const list = await api.notebookList();
    setNotebooks(list || []);
  };

  const save = async () => {
    const id = activeId || `nb_${Date.now()}`;
    if (!activeId) setActiveId(id);
    const data: NotebookData = { id, title, cells, updatedAt: new Date().toISOString() };
    await api.notebookSave(id, JSON.stringify(data));
    refreshList();
  };

  const load = async (id: string) => {
    const result = await api.notebookLoad(id);
    if (result.success) {
      const data: NotebookData = JSON.parse(result.data);
      setActiveId(id);
      setTitle(data.title);
      setCells(data.cells);
    }
  };

  const handleNew = () => {
    setActiveId(null);
    setTitle('Untitled Notebook');
    setCells([{ id: genId(), type: 'code', lang: 'javascript', content: '', output: '', isRunning: false }]);
  };

  const handleDelete = async (id: string) => {
    await api.notebookDelete(id);
    if (activeId === id) handleNew();
    refreshList();
  };

  // Cell operations
  const updateCell = (id: string, updates: Partial<Cell>) => {
    setCells((prev) => prev.map((c) => c.id === id ? { ...c, ...updates } : c));
  };

  const addCell = (afterId: string, type: CellType = 'code') => {
    const idx = cells.findIndex((c) => c.id === afterId);
    const newCell: Cell = { id: genId(), type, lang: type === 'code' ? 'javascript' : undefined, content: '', output: '', isRunning: false };
    setCells((prev) => [...prev.slice(0, idx + 1), newCell, ...prev.slice(idx + 1)]);
  };

  const removeCell = (id: string) => {
    if (cells.length <= 1) return;
    setCells((prev) => prev.filter((c) => c.id !== id));
  };

  const moveCell = (id: string, dir: -1 | 1) => {
    const idx = cells.findIndex((c) => c.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= cells.length) return;
    const newCells = [...cells];
    [newCells[idx], newCells[newIdx]] = [newCells[newIdx], newCells[idx]];
    setCells(newCells);
  };

  // Execute cell
  const runCell = async (cell: Cell) => {
    updateCell(cell.id, { isRunning: true, output: '' });

    if (cell.type === 'code') {
      let result;
      switch (cell.lang) {
        case 'python': result = await api.notebookExecPython(cell.content); break;
        case 'shell': result = await api.notebookExecShell(cell.content); break;
        default: result = await api.notebookExecJs(cell.content); break;
      }
      updateCell(cell.id, { isRunning: false, output: result.output || '' });
    } else if (cell.type === 'ai') {
      // Collect context from previous cells
      const idx = cells.findIndex((c) => c.id === cell.id);
      const context = cells.slice(0, idx)
        .filter((c) => c.output)
        .map((c) => `[${c.type}] ${c.output.slice(0, 500)}`)
        .join('\n');

      const result = await api.notebookAiQuery(cell.content, undefined, undefined, context);
      updateCell(cell.id, { isRunning: false, output: result.output || '' });
    }
  };

  const runAll = async () => {
    for (const cell of cells) {
      if (cell.type !== 'markdown' && cell.content.trim()) {
        await runCell(cell);
      }
    }
  };

  const CELL_COLORS: Record<CellType, string> = { code: '#7aa2f7', ai: '#bb9af7', markdown: '#9ece6a' };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      {showSidebar && (
        <div className="w-56 flex flex-col border-r border-white/10 bg-[#0c0c10]">
          <div className="p-3 border-b border-white/10">
            <button onClick={handleNew} className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#7aa2f7]/15 text-[#7aa2f7] hover:bg-[#7aa2f7]/25">
              + New Notebook
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {notebooks.map((nb) => (
              <div key={nb.id} onClick={() => load(nb.id)}
                className={`group flex items-center mx-1 px-3 py-1.5 rounded-lg cursor-pointer text-xs ${nb.id === activeId ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5'}`}>
                <span className="truncate flex-1">{nb.title}</span>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(nb.id); }}
                  className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 ml-1">x</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center h-10 px-3 border-b border-white/10 gap-2">
          <button onClick={() => setShowSidebar(!showSidebar)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-white/40">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-transparent text-sm text-white/80 outline-none flex-1" />
          <button onClick={runAll} className="px-2 py-1 text-[10px] rounded bg-[#9ece6a]/20 text-[#9ece6a] hover:bg-[#9ece6a]/30">Run All</button>
          <button onClick={save} className="px-2 py-1 text-[10px] rounded bg-[#7aa2f7]/20 text-[#7aa2f7] hover:bg-[#7aa2f7]/30">Save</button>
        </div>

        {/* Cells */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto space-y-2">
            {cells.map((cell) => (
              <div key={cell.id} className="group rounded-xl border border-white/10 hover:border-white/20 transition-colors">
                {/* Cell header */}
                <div className="flex items-center h-8 px-3 border-b border-white/5 gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CELL_COLORS[cell.type] }} />
                  {cell.type === 'code' && (
                    <select value={cell.lang} onChange={(e) => updateCell(cell.id, { lang: e.target.value as CellLang })}
                      className="bg-transparent text-[10px] text-white/40 outline-none">
                      <option value="javascript" className="bg-[#1a1b2e]">JavaScript</option>
                      <option value="python" className="bg-[#1a1b2e]">Python</option>
                      <option value="shell" className="bg-[#1a1b2e]">Shell</option>
                    </select>
                  )}
                  {cell.type === 'ai' && <span className="text-[10px] text-white/40">AI</span>}
                  {cell.type === 'markdown' && <span className="text-[10px] text-white/40">Markdown</span>}

                  <div className="flex-1" />

                  {cell.type !== 'markdown' && (
                    <button onClick={() => runCell(cell)} disabled={cell.isRunning}
                      className="px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 disabled:opacity-30">
                      {cell.isRunning ? '...' : 'Run'}
                    </button>
                  )}

                  <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 ml-1">
                    <button onClick={() => moveCell(cell.id, -1)} className="text-[10px] text-white/30 hover:text-white/60 px-0.5">^</button>
                    <button onClick={() => moveCell(cell.id, 1)} className="text-[10px] text-white/30 hover:text-white/60 px-0.5">v</button>
                    <button onClick={() => removeCell(cell.id)} className="text-[10px] text-white/30 hover:text-red-400 px-0.5">x</button>
                  </div>
                </div>

                {/* Cell input */}
                <textarea
                  value={cell.content}
                  onChange={(e) => updateCell(cell.id, { content: e.target.value })}
                  placeholder={cell.type === 'ai' ? 'Ask AI a question...' : cell.type === 'markdown' ? 'Write markdown...' : 'Write code...'}
                  className="w-full px-3 py-2 bg-transparent text-xs text-white/70 font-mono outline-none resize-none placeholder:text-white/15"
                  rows={Math.max(2, cell.content.split('\n').length)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      if (cell.type !== 'markdown') runCell(cell);
                    }
                  }}
                />

                {/* Cell output */}
                {cell.output && (
                  <div className="px-3 py-2 border-t border-white/5 bg-black/20">
                    <pre className="text-xs text-white/50 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {cell.output}
                    </pre>
                  </div>
                )}

                {cell.isRunning && (
                  <div className="px-3 py-1 border-t border-white/5">
                    <div className="h-0.5 bg-[#7aa2f7]/30 rounded overflow-hidden">
                      <div className="h-full bg-[#7aa2f7] rounded animate-pulse" style={{ width: '60%' }} />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add cell buttons */}
            <div className="flex justify-center gap-2 pt-2">
              {(['code', 'ai', 'markdown'] as CellType[]).map((type) => (
                <button key={type} onClick={() => addCell(cells[cells.length - 1].id, type)}
                  className="px-3 py-1 text-[10px] rounded-lg border border-white/10 text-white/30 hover:text-white/50 hover:border-white/20 transition-colors">
                  + {type === 'code' ? 'Code' : type === 'ai' ? 'AI' : 'Markdown'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { chat, chatStream, type AIModel } from '../services/ai-client';

const NOTEBOOKS_DIR = path.join(os.homedir(), '.code-harness', 'notebooks');
const DOCUMENTS_DIR = path.join(os.homedir(), '.code-harness', 'documents');

function ensureDirs() {
  fs.mkdirSync(NOTEBOOKS_DIR, { recursive: true });
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
}

function safeId(id: string): string {
  return path.basename(id).replace(/[^a-zA-Z0-9_-]/g, '');
}

export function registerNotebookHandlers(getMainWindow: () => BrowserWindow | null) {
  const send = (channel: string, data: unknown) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, data);
  };

  // ── Code Execution ──

  ipcMain.handle('notebook:exec-js', async (_e, { code }: { code: string }) => {
    try {
      // Run JS in isolated Node process
      const result = execSync(`node -e ${JSON.stringify(code)}`, {
        encoding: 'utf-8', timeout: 30000, env: { ...process.env },
      });
      return { success: true, output: result };
    } catch (err: unknown) {
      const e = err as { stderr?: string; message: string };
      return { success: false, output: e.stderr || e.message };
    }
  });

  ipcMain.handle('notebook:exec-python', async (_e, { code }: { code: string }) => {
    try {
      const result = execSync(`python3 -c ${JSON.stringify(code)}`, {
        encoding: 'utf-8', timeout: 30000, env: { ...process.env },
      });
      return { success: true, output: result };
    } catch (err: unknown) {
      const e = err as { stderr?: string; message: string };
      return { success: false, output: e.stderr || e.message };
    }
  });

  ipcMain.handle('notebook:exec-shell', async (_e, { command }: { command: string }) => {
    try {
      const result = execSync(command, { encoding: 'utf-8', timeout: 30000 });
      return { success: true, output: result };
    } catch (err: unknown) {
      const e = err as { stderr?: string; message: string };
      return { success: false, output: e.stderr || e.message };
    }
  });

  // ── AI Cell ──

  ipcMain.handle('notebook:ai-query', async (_e, {
    prompt, model, systemPrompt, context,
  }: { prompt: string; model?: AIModel; systemPrompt?: string; context?: string }) => {
    try {
      const fullPrompt = context ? `Context:\n${context}\n\nQuestion: ${prompt}` : prompt;
      const response = await chat({
        model: model || 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: fullPrompt }],
        systemPrompt,
        maxTokens: 4096,
      });
      return { success: true, output: response.content, tokens: response.inputTokens + response.outputTokens };
    } catch (e: unknown) {
      return { success: false, output: (e as Error).message };
    }
  });

  // AI streaming for document editor
  ipcMain.handle('notebook:ai-stream', async (_e, {
    id, prompt, model, systemPrompt,
  }: { id: string; prompt: string; model?: AIModel; systemPrompt?: string }) => {
    try {
      const generator = chatStream({
        model: model || 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: prompt }],
        systemPrompt,
        maxTokens: 4096,
      });

      (async () => {
        try {
          for await (const chunk of generator) {
            send(`notebook:ai-stream-${id}`, chunk);
          }
        } catch (err: unknown) {
          send(`notebook:ai-stream-${id}`, { type: 'error', content: (err as Error).message });
        }
      })();

      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  });

  // ── Notebook Persistence ──

  ipcMain.handle('notebook:save', async (_e, { id, data }: { id: string; data: string }) => {
    ensureDirs();
    try {
      fs.writeFileSync(path.join(NOTEBOOKS_DIR, `${safeId(id)}.json`), data, 'utf-8');
      return { success: true };
    } catch (e: unknown) { return { success: false, error: (e as Error).message }; }
  });

  ipcMain.handle('notebook:load', async (_e, { id }: { id: string }) => {
    try {
      return { success: true, data: fs.readFileSync(path.join(NOTEBOOKS_DIR, `${safeId(id)}.json`), 'utf-8') };
    } catch { return { success: false }; }
  });

  ipcMain.handle('notebook:list', async () => {
    ensureDirs();
    try {
      return fs.readdirSync(NOTEBOOKS_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(NOTEBOOKS_DIR, f), 'utf-8'));
            return { id: f.replace('.json', ''), title: data.title || 'Untitled', updatedAt: data.updatedAt || '' };
          } catch { return null; }
        })
        .filter(Boolean);
    } catch { return []; }
  });

  ipcMain.handle('notebook:delete', async (_e, { id }: { id: string }) => {
    try { fs.unlinkSync(path.join(NOTEBOOKS_DIR, `${safeId(id)}.json`)); return { success: true }; }
    catch { return { success: false }; }
  });

  // ── Document Persistence ──

  ipcMain.handle('document:save', async (_e, { id, data }: { id: string; data: string }) => {
    ensureDirs();
    try {
      fs.writeFileSync(path.join(DOCUMENTS_DIR, `${safeId(id)}.json`), data, 'utf-8');
      return { success: true };
    } catch (e: unknown) { return { success: false, error: (e as Error).message }; }
  });

  ipcMain.handle('document:load', async (_e, { id }: { id: string }) => {
    try {
      return { success: true, data: fs.readFileSync(path.join(DOCUMENTS_DIR, `${safeId(id)}.json`), 'utf-8') };
    } catch { return { success: false }; }
  });

  ipcMain.handle('document:list', async () => {
    ensureDirs();
    try {
      return fs.readdirSync(DOCUMENTS_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(DOCUMENTS_DIR, f), 'utf-8'));
            return { id: f.replace('.json', ''), title: data.title || 'Untitled', updatedAt: data.updatedAt || '' };
          } catch { return null; }
        })
        .filter(Boolean);
    } catch { return []; }
  });

  ipcMain.handle('document:delete', async (_e, { id }: { id: string }) => {
    try { fs.unlinkSync(path.join(DOCUMENTS_DIR, `${safeId(id)}.json`)); return { success: true }; }
    catch { return { success: false }; }
  });

  // Open / Save file dialog
  ipcMain.handle('document:open-file', async () => {
    const result = await dialog.showOpenDialog(getMainWindow()!, {
      filters: [{ name: 'Markdown', extensions: ['md', 'txt', 'markdown'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { filePath, content, name: path.basename(filePath) };
  });

  ipcMain.handle('document:save-file', async (_e, { filePath, content }: { filePath?: string; content: string }) => {
    let target = filePath;
    if (!target) {
      const result = await dialog.showSaveDialog(getMainWindow()!, {
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      if (result.canceled || !result.filePath) return { success: false };
      target = result.filePath;
    }
    fs.writeFileSync(target!, content, 'utf-8');
    return { success: true, filePath: target };
  });
}

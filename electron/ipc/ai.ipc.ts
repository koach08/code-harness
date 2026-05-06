import { ipcMain, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  chat,
  chatStream,
  generateImage,
  getAPIKeys,
  setAPIKeys,
  checkAPIKeys,
  type ChatRequest,
  type ImageRequest,
  type AIModel,
  type ChatMessage,
} from '../services/ai-client';

// ── Conversation Persistence ──
const CONVERSATIONS_DIR = path.join(os.homedir(), '.code-harness', 'conversations');

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

function ensureConvDir() {
  fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });
}

function safeId(id: string): string {
  return path.basename(id).replace(/[^a-zA-Z0-9_-]/g, '');
}

function convPath(id: string) {
  return path.join(CONVERSATIONS_DIR, `${safeId(id)}.json`);
}

function saveConversation(conv: Conversation) {
  ensureConvDir();
  fs.writeFileSync(convPath(conv.id), JSON.stringify(conv, null, 2));
}

function loadConversation(id: string): Conversation | null {
  try {
    return JSON.parse(fs.readFileSync(convPath(id), 'utf-8'));
  } catch {
    return null;
  }
}

function listConversations(): Array<{
  id: string;
  title: string;
  model: AIModel;
  updatedAt: string;
  messageCount: number;
}> {
  ensureConvDir();
  try {
    const files = fs.readdirSync(CONVERSATIONS_DIR).filter((f) => f.endsWith('.json'));
    const convs = files
      .map((f) => {
        try {
          const data: Conversation = JSON.parse(
            fs.readFileSync(path.join(CONVERSATIONS_DIR, f), 'utf-8')
          );
          return {
            id: data.id,
            title: data.title,
            model: data.model,
            updatedAt: data.updatedAt,
            messageCount: data.messages.length,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Array<{
      id: string;
      title: string;
      model: AIModel;
      updatedAt: string;
      messageCount: number;
    }>;

    return convs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

function genConvId() {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── Register IPC Handlers ──
export function registerAIHandlers(getMainWindow: () => BrowserWindow | null) {
  // API Key management
  ipcMain.handle('ai:get-keys', async () => getAPIKeys());
  ipcMain.handle('ai:set-keys', async (_e, keys) => {
    setAPIKeys(keys);
    return { success: true };
  });
  ipcMain.handle('ai:check-keys', async () => checkAPIKeys());

  // Conversation management
  ipcMain.handle('ai:list-conversations', async () => listConversations());

  ipcMain.handle('ai:get-conversation', async (_e, { id }: { id: string }) => {
    return loadConversation(id);
  });

  ipcMain.handle('ai:create-conversation', async (_e, { model, title }: { model: AIModel; title?: string }) => {
    const conv: Conversation = {
      id: genConvId(),
      title: title || 'New conversation',
      model,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalInputTokens: 0,
      totalOutputTokens: 0,
    };
    saveConversation(conv);
    return conv;
  });

  ipcMain.handle('ai:delete-conversation', async (_e, { id }: { id: string }) => {
    try {
      fs.unlinkSync(convPath(id));
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('ai:rename-conversation', async (_e, { id, title }: { id: string; title: string }) => {
    const conv = loadConversation(id);
    if (!conv) return { success: false, error: 'Not found' };
    conv.title = title;
    conv.updatedAt = new Date().toISOString();
    saveConversation(conv);
    return { success: true };
  });

  // Chat (non-streaming)
  ipcMain.handle(
    'ai:chat',
    async (
      _e,
      { conversationId, message, model, systemPrompt }: {
        conversationId: string;
        message: string;
        model?: AIModel;
        systemPrompt?: string;
      }
    ) => {
      const conv = loadConversation(conversationId);
      if (!conv) return { success: false, error: 'Conversation not found' };

      conv.messages.push({ role: 'user', content: message });
      if (model) conv.model = model;

      try {
        const response = await chat({
          model: conv.model,
          messages: conv.messages,
          systemPrompt,
          maxTokens: 4096,
        });

        conv.messages.push({ role: 'assistant', content: response.content });
        conv.totalInputTokens += response.inputTokens;
        conv.totalOutputTokens += response.outputTokens;
        conv.updatedAt = new Date().toISOString();

        // Auto-title on first message
        if (conv.messages.length === 2 && conv.title === 'New conversation') {
          conv.title = message.slice(0, 60) + (message.length > 60 ? '...' : '');
        }

        saveConversation(conv);
        return { success: true, response };
      } catch (e: unknown) {
        // Remove the user message we just added since the request failed
        conv.messages.pop();
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // Chat (streaming)
  ipcMain.handle(
    'ai:chat-stream',
    async (
      _e,
      { conversationId, message, model, systemPrompt }: {
        conversationId: string;
        message: string;
        model?: AIModel;
        systemPrompt?: string;
      }
    ) => {
      const conv = loadConversation(conversationId);
      if (!conv) return { success: false, error: 'Conversation not found' };

      conv.messages.push({ role: 'user', content: message });
      if (model) conv.model = model;

      const win = getMainWindow();
      if (!win) return { success: false, error: 'No window' };

      try {
        let fullContent = '';
        const streamChannel = `ai:stream-${conversationId}`;

        const generator = chatStream({
          model: conv.model,
          messages: conv.messages,
          systemPrompt,
          maxTokens: 4096,
        });

        // Process stream asynchronously
        (async () => {
          try {
            for await (const chunk of generator) {
              if (win.isDestroyed()) break;
              win.webContents.send(streamChannel, chunk);
              if (chunk.type === 'text') {
                fullContent += chunk.content;
              }
              if (chunk.type === 'done') {
                conv.messages.push({ role: 'assistant', content: fullContent });
                conv.totalInputTokens += chunk.inputTokens || 0;
                conv.totalOutputTokens += chunk.outputTokens || 0;
                conv.updatedAt = new Date().toISOString();
                if (conv.messages.length === 2 && conv.title === 'New conversation') {
                  conv.title = message.slice(0, 60) + (message.length > 60 ? '...' : '');
                }
                saveConversation(conv);
              }
            }
          } catch (err: unknown) {
            if (!win.isDestroyed()) {
              win.webContents.send(streamChannel, {
                type: 'error',
                content: (err as Error).message,
              });
            }
            // Remove user message on failure
            conv.messages.pop();
          }
        })();

        return { success: true, streamChannel };
      } catch (e: unknown) {
        conv.messages.pop();
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // Image generation
  ipcMain.handle('ai:generate-image', async (_e, req: ImageRequest) => {
    try {
      const results = await generateImage(req);
      return { success: true, images: results };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  });
}

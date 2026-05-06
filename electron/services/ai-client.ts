import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ── Types ──
export type AIProvider = 'anthropic' | 'openai' | 'perplexity';

export type AIModel =
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5-20251001'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'o3'
  | 'o4-mini'
  | 'sonar-pro'    // Perplexity
  | 'sonar';       // Perplexity

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  model: AIModel;
  messages: ChatMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  stopReason?: string;
}

export interface StreamChunk {
  type: 'text' | 'done' | 'error';
  content: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface ImageRequest {
  prompt: string;
  model?: 'dall-e-3' | 'dall-e-2' | 'gpt-image-1';
  size?: '1024x1024' | '1024x1792' | '1792x1024' | '512x512' | '256x256';
  quality?: 'standard' | 'hd' | 'high' | 'medium' | 'low';
  n?: number;
}

export interface ImageResponse {
  url?: string;
  b64_json?: string;
  revisedPrompt?: string;
}

export interface APIKeys {
  anthropic?: string;
  openai?: string;
  perplexity?: string;
}

// ── API Key Storage ──
const KEYS_PATH = path.join(os.homedir(), '.code-harness', 'api-keys.json');

function loadKeys(): APIKeys {
  try {
    if (fs.existsSync(KEYS_PATH)) {
      return JSON.parse(fs.readFileSync(KEYS_PATH, 'utf-8'));
    }
  } catch {}
  // Fallback to environment variables
  return {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    perplexity: process.env.PERPLEXITY_API_KEY,
  };
}

function saveKeys(keys: APIKeys) {
  const dir = path.dirname(KEYS_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2), { mode: 0o600 });
}

// ── Provider Detection ──
function getProvider(model: AIModel): AIProvider {
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('sonar')) return 'perplexity';
  return 'openai';
}

// ── Client Instances ──
let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;
let perplexityClient: OpenAI | null = null;

function getAnthropicClient(apiKey?: string): Anthropic {
  const key = apiKey || loadKeys().anthropic;
  if (!key) throw new Error('Anthropic API key not configured');
  if (!anthropicClient || apiKey) {
    anthropicClient = new Anthropic({ apiKey: key });
  }
  return anthropicClient;
}

function getOpenAIClient(apiKey?: string): OpenAI {
  const key = apiKey || loadKeys().openai;
  if (!key) throw new Error('OpenAI API key not configured');
  if (!openaiClient || apiKey) {
    openaiClient = new OpenAI({ apiKey: key });
  }
  return openaiClient;
}

function getPerplexityClient(apiKey?: string): OpenAI {
  const key = apiKey || loadKeys().perplexity;
  if (!key) throw new Error('Perplexity API key not configured');
  if (!perplexityClient || apiKey) {
    perplexityClient = new OpenAI({
      apiKey: key,
      baseURL: 'https://api.perplexity.ai',
    });
  }
  return perplexityClient;
}

// ── Chat (non-streaming) ──
export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const provider = getProvider(req.model);

  if (provider === 'anthropic') {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: req.model,
      max_tokens: req.maxTokens || 4096,
      temperature: req.temperature,
      system: req.systemPrompt || undefined,
      messages: req.messages.filter((m) => m.role !== 'system').map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    return {
      content: response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join(''),
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      stopReason: response.stop_reason || undefined,
    };
  }

  // OpenAI / Perplexity (both use OpenAI SDK)
  const client = provider === 'perplexity' ? getPerplexityClient() : getOpenAIClient();
  const msgs: OpenAI.ChatCompletionMessageParam[] = [];
  if (req.systemPrompt) msgs.push({ role: 'system', content: req.systemPrompt });
  msgs.push(
    ...req.messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }))
  );

  const response = await client.chat.completions.create({
    model: req.model,
    messages: msgs,
    max_tokens: req.maxTokens || 4096,
    temperature: req.temperature,
  });

  const choice = response.choices[0];
  return {
    content: choice?.message?.content || '',
    model: response.model,
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0,
    stopReason: choice?.finish_reason || undefined,
  };
}

// ── Chat (streaming) ──
export async function* chatStream(
  req: ChatRequest
): AsyncGenerator<StreamChunk> {
  const provider = getProvider(req.model);

  if (provider === 'anthropic') {
    const client = getAnthropicClient();
    const stream = await client.messages.stream({
      model: req.model,
      max_tokens: req.maxTokens || 4096,
      temperature: req.temperature,
      system: req.systemPrompt || undefined,
      messages: req.messages.filter((m) => m.role !== 'system').map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta as { type: string; text?: string };
        if (delta.type === 'text_delta' && delta.text) {
          yield { type: 'text', content: delta.text };
        }
      }
    }

    const finalMessage = await stream.finalMessage();
    yield {
      type: 'done',
      content: '',
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
    };
    return;
  }

  // OpenAI / Perplexity
  const client = provider === 'perplexity' ? getPerplexityClient() : getOpenAIClient();
  const msgs: OpenAI.ChatCompletionMessageParam[] = [];
  if (req.systemPrompt) msgs.push({ role: 'system', content: req.systemPrompt });
  msgs.push(
    ...req.messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }))
  );

  const stream = await client.chat.completions.create({
    model: req.model,
    messages: msgs,
    max_tokens: req.maxTokens || 4096,
    temperature: req.temperature,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (delta?.content) {
      yield { type: 'text', content: delta.content };
    }
  }

  yield { type: 'done', content: '' };
}

// ── Image Generation ──
export async function generateImage(req: ImageRequest): Promise<ImageResponse[]> {
  const client = getOpenAIClient();
  const response = await client.images.generate({
    model: req.model || 'dall-e-3',
    prompt: req.prompt,
    n: req.n || 1,
    size: req.size || '1024x1024',
    quality: req.quality || 'standard',
  });

  return response.data.map((img) => ({
    url: img.url || undefined,
    b64_json: img.b64_json || undefined,
    revisedPrompt: img.revised_prompt || undefined,
  }));
}

// ── Key Management ──
export function getAPIKeys(): APIKeys {
  const keys = loadKeys();
  // Mask keys for display
  return {
    anthropic: keys.anthropic ? keys.anthropic.slice(0, 10) + '...' : undefined,
    openai: keys.openai ? keys.openai.slice(0, 10) + '...' : undefined,
    perplexity: keys.perplexity ? keys.perplexity.slice(0, 10) + '...' : undefined,
  };
}

export function setAPIKeys(keys: APIKeys) {
  const existing = loadKeys();
  const merged: APIKeys = { ...existing };

  // Only update keys that are provided and not masked
  if (keys.anthropic && !keys.anthropic.endsWith('...')) merged.anthropic = keys.anthropic;
  if (keys.openai && !keys.openai.endsWith('...')) merged.openai = keys.openai;
  if (keys.perplexity && !keys.perplexity.endsWith('...')) merged.perplexity = keys.perplexity;

  saveKeys(merged);

  // Reset clients to pick up new keys
  anthropicClient = null;
  openaiClient = null;
  perplexityClient = null;
}

export function checkAPIKeys(): Record<AIProvider, boolean> {
  const keys = loadKeys();
  return {
    anthropic: !!keys.anthropic,
    openai: !!keys.openai,
    perplexity: !!keys.perplexity,
  };
}

// Model-provider adapters. Every request to OpenAI, Anthropic, Google Gemini, OpenRouter and
// DeepSeek is made here, in the Electron main process, so API keys never reach the renderer.

const { userError, MARK } = require('./errors.cjs');
const speech = require('./speech.cjs');

const TIMEOUT_MS = 60_000;
const COMPLETION_TIMEOUT_MS = 180_000;
// A streamed reply that goes quiet for this long is cut short. The text written so far is kept.
const STREAM_IDLE_MS = 60_000;
// The most text one request carries, counted in characters across all turns. Older turns go first.
const MAX_CONVERSATION_CHARS = 40_000;
// Pictures sent with one message: at most ten, each about 5 MB once encoded as base64.
const MAX_IMAGES = 10;
const MAX_IMAGE_CHARS = 7_000_000;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const PROVIDERS = Object.freeze({
  openai: { label: 'OpenAI', hint: 'sk-…' },
  anthropic: { label: 'Anthropic', hint: 'sk-ant-…' },
  gemini: { label: 'Google Gemini', hint: 'AIza…' },
  openrouter: { label: 'OpenRouter', hint: 'sk-or-v1-…' },
  deepseek: { label: 'DeepSeek', hint: 'sk-…' },
});

// Model ids that cannot hold a chat conversation.
const NON_CHAT = /(embed|whisper|tts|dall-e|image|audio|realtime|transcri|moderation|search|davinci|babbage|computer-use|instruct|codex|sora|guard)/i;

// Keys that start with "sk-" can belong to OpenAI or DeepSeek. Their formats do not tell them
// apart, so the app asks each provider whether it accepts the key.
function detectCandidates(rawKey) {
  const key = String(rawKey || '').trim();
  if (key.startsWith('sk-ant-')) return ['anthropic'];
  if (key.startsWith('sk-or-')) return ['openrouter'];
  // Google issues two key formats, "AIza..." and "AQ...". The Gemini API accepts both.
  if (/^(AIza[\w-]{30,}|AQ\.[\w-]{30,})$/.test(key)) return ['gemini'];
  if (key.startsWith('sk-proj-') || key.startsWith('sk-svcacct-') || key.startsWith('sk-admin-')) return ['openai'];
  if (key.startsWith('sk-')) return ['openai', 'deepseek'];
  return [];
}

function detectProvider(rawKey) {
  return detectCandidates(rawKey)[0] || null;
}

class ProviderError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// The message a provider sent back, read from its error body.
async function responseError(response) {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text.slice(0, 300) };
  }
  const detail = (data && data.error && data.error.message) || (data && data.error) || (data && data.message) || `HTTP ${response.status}`;
  return new ProviderError(typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 300), response.status);
}

async function request(url, { method = 'GET', headers = {}, body, timeoutMs = TIMEOUT_MS } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...headers },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reason = error && error.name === 'TimeoutError' ? 'the request timed out' : 'could not reach the server';
    throw new ProviderError(`Network error: ${reason}.`);
  }

  if (!response.ok) throw await responseError(response);
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text.slice(0, 300) };
  }
}

// A provider's message is quoted to the person only after anything that looks like a key is hidden.
function quoteDetail(message) {
  const clean = String(message || '')
    .replace(/sk-[\w-]{8,}/g, 'sk-…')
    .replace(/AIza[\w-]{20,}/g, 'AIza…')
    .replace(/AQ\.[\w-]{20,}/g, 'AQ.…')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  return clean ? `: ${clean}` : '';
}

function asProviderError(provider, error) {
  const label = PROVIDERS[provider].label;
  if (error && String(error.message || '').includes(MARK)) return error;
  const status = error && error.status;
  const message = error && error.message ? String(error.message) : '';
  if (status === 401 || status === 403 || (status === 400 && /api[ _-]?key|key not valid/i.test(message))) {
    return userError(`${label} did not accept this key. Check that it is still active.`);
  }
  if (status === 402) {
    return userError(`${label} says this account has no credit left. Add credit on ${label}, then try again.`);
  }
  if (status === 404 || (/model/i.test(message) && /not exist|not found|unavailable|no longer/i.test(message))) {
    return userError(`${label} no longer offers the selected model. Choose another model in Settings.`);
  }
  if (status === 400 || status === 422) {
    return userError(`${label} could not use this request${quoteDetail(message)}. Try a shorter message or another model.`);
  }
  if (status === 429) {
    return userError(`${label} is busy right now. Please try again in a moment.`);
  }
  if (error && /Network error/.test(message)) {
    return userError(`We could not reach ${label}. Check your internet connection.`);
  }
  return userError(`${label} could not finish that. Please try again.`);
}

const byNewest = (a, b) => b.createdAt - a.createdAt || a.label.localeCompare(b.label);

// Gemini does not return release dates, so rank by version, then stable over
// preview, then by tier (pro > flash > flash-lite).
function geminiRank(id) {
  const version = Number((id.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const stable = /preview|exp/i.test(id) ? 0 : 1;
  const tier = /flash-lite/i.test(id) ? 1 : /flash/i.test(id) ? 2 : /pro/i.test(id) ? 3 : 0;
  return version * 1000 + stable * 100 + tier * 10;
}

async function listOpenAI(key) {
  const data = await request('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  return (data.data || [])
    .filter((model) => /^(gpt-|o\d|chatgpt-)/.test(model.id) && !NON_CHAT.test(model.id))
    .map((model) => ({ id: model.id, label: model.id, createdAt: (model.created || 0) * 1000 }))
    .sort(byNewest);
}

async function listAnthropic(key) {
  const data = await request('https://api.anthropic.com/v1/models?limit=100', {
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
  });
  return (data.data || [])
    .filter((model) => model.id.startsWith('claude-'))
    .map((model) => ({ id: model.id, label: model.display_name || model.id, createdAt: Date.parse(model.created_at) || 0 }))
    .sort(byNewest);
}

async function listGemini(key) {
  const data = await request('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
    headers: { 'x-goog-api-key': key },
  });
  return (data.models || [])
    .filter((model) => (model.supportedGenerationMethods || []).includes('generateContent'))
    .map((model) => ({
      id: String(model.name || '').replace(/^models\//, ''),
      label: model.displayName || model.name,
      createdAt: 0,
    }))
    .filter((model) => /^gemini-/.test(model.id) && !/(embedding|aqa|image|tts|live|audio|robotics|computer-use)/i.test(model.id))
    .sort((a, b) => geminiRank(b.id) - geminiRank(a.id));
}

async function listOpenRouter(key) {
  const data = await request('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  return (data.data || [])
    .filter((model) => {
      const outputs = model.architecture && model.architecture.output_modalities;
      return !Array.isArray(outputs) || outputs.includes('text');
    })
    .map((model) => ({ id: model.id, label: model.name || model.id, createdAt: (model.created || 0) * 1000 }))
    .sort(byNewest);
}

// DeepSeek's model list has no release dates. Its release notes name deepseek-flash (V4.1 Flash)
// as the newest model, followed by the V4 and V3.2 names. Other names are ranked by version number.
const DEEPSEEK_VERSIONS = {
  'deepseek-flash': [4, 1],
  'deepseek-v4-pro': [4, 0],
  'deepseek-v4-flash': [4, 0],
  'deepseek-chat': [3, 2],
  'deepseek-reasoner': [3, 2],
};

function deepseekRank(id) {
  const name = String(id);
  const version = DEEPSEEK_VERSIONS[name.toLowerCase()] || (name.match(/v(\d+)(?:\.(\d+))?/i) || []).slice(1).map((part) => Number(part || 0));
  const [major = 0, minor = 0] = version;
  const tier = /pro/i.test(name) ? 3 : /flash/i.test(name) ? 2 : 1;
  return (major * 1000 + minor * 100) * 10 + tier;
}

function deepseekLabel(id) {
  const words = String(id)
    .replace(/^deepseek-/i, '')
    .split('-')
    .filter(Boolean)
    .map((word) => (/^v\d/i.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)));
  return `DeepSeek ${words.join(' ')}`;
}

async function listDeepSeek(key) {
  const data = await request('https://api.deepseek.com/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  return (data.data || [])
    .filter((model) => /^deepseek-/i.test(model.id) && !NON_CHAT.test(model.id))
    .map((model) => ({ id: model.id, label: deepseekLabel(model.id), createdAt: 0 }))
    .sort((a, b) => deepseekRank(b.id) - deepseekRank(a.id));
}

const LISTERS = { openai: listOpenAI, anthropic: listAnthropic, gemini: listGemini, openrouter: listOpenRouter, deepseek: listDeepSeek };

// Returns the live model list for a key, newest first. The first entry is
// flagged `latest`, which is the default the app selects.
async function listModels(provider, key) {
  if (!LISTERS[provider]) throw new Error('Unknown AI provider.');
  try {
    const models = await LISTERS[provider](key);
    return models.slice(0, 40).map((model, index) => ({ ...model, latest: index === 0 }));
  } catch (error) {
    throw asProviderError(provider, error);
  }
}

// Pictures of a type the app does not send, or too large, are dropped. The first ten that remain go with the message.
function cleanImages(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (image) =>
        image &&
        IMAGE_TYPES.includes(image.mime) &&
        typeof image.data === 'string' &&
        image.data.length > 0 &&
        image.data.length <= MAX_IMAGE_CHARS,
    )
    .slice(0, MAX_IMAGES)
    .map((image) => ({ mime: image.mime, data: image.data }));
}

function normalizeMessages(messages) {
  const out = [];
  for (const message of Array.isArray(messages) ? messages : []) {
    const content = String((message && message.content) || '').slice(0, 24000);
    const images = cleanImages(message && message.images);
    if (!content.trim() && images.length === 0) continue;
    const role = message && message.role === 'assistant' ? 'assistant' : 'user';
    const last = out[out.length - 1];
    if (last && last.role === role) {
      last.content = [last.content, content].filter(Boolean).join('\n\n');
      last.images = [...last.images, ...images].slice(0, MAX_IMAGES);
    } else {
      out.push({ role, content, images });
    }
  }
  // Keep the most recent turns that fit the budget. The newest turn is always kept.
  const kept = [];
  let total = 0;
  for (let index = out.length - 1; index >= 0; index -= 1) {
    total += out[index].content.length;
    if (total > MAX_CONVERSATION_CHARS && kept.length > 0) break;
    kept.unshift(out[index]);
  }
  // Anthropic and Gemini expect the conversation to open with a user turn.
  while (kept.length && kept[0].role !== 'user') kept.shift();
  if (!kept.length) throw userError('Write a message first.');
  return kept;
}

// A message with pictures takes each provider's own form for pictures. Text-only messages stay as they were.
const hasPictures = (message) => Array.isArray(message.images) && message.images.length > 0;
const pictureText = (message) => message.content || 'Look at the pictures.';

function openAIMessage(message) {
  if (!hasPictures(message)) return { role: message.role, content: message.content };
  return {
    role: message.role,
    content: [
      { type: 'text', text: pictureText(message) },
      ...message.images.map((image) => ({ type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.data}` } })),
    ],
  };
}

function anthropicMessage(message) {
  if (!hasPictures(message)) return { role: message.role, content: message.content };
  return {
    role: message.role,
    content: [
      ...message.images.map((image) => ({ type: 'image', source: { type: 'base64', media_type: image.mime, data: image.data } })),
      { type: 'text', text: pictureText(message) },
    ],
  };
}

function geminiParts(message) {
  const pictures = hasPictures(message) ? message.images.map((image) => ({ inline_data: { mime_type: image.mime, data: image.data } })) : [];
  return [...pictures, { text: pictureText(message) }];
}

const firstChoice = (data) => (data && Array.isArray(data.choices) && data.choices[0]) || {};
const choiceText = (choice) => String((choice.message && choice.message.content) || '');

// The request for a reply, for each provider. The same request is sent whole, or with `stream` set, when the
// reply comes in pieces as it is written.
const REQUESTS = {
  openai(key, model, system, messages, json, maxTokens, stream) {
    const body = {
      model,
      messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages.map(openAIMessage)],
      max_completion_tokens: maxTokens,
    };
    if (json) body.response_format = { type: 'json_object' };
    if (stream) body.stream = true;
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body,
    };
  },

  anthropic(key, model, system, messages, _json, maxTokens, stream) {
    const body = { model, max_tokens: maxTokens, messages: messages.map(anthropicMessage) };
    if (system) body.system = system;
    if (stream) body.stream = true;
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body,
    };
  },

  gemini(key, model, system, messages, json, maxTokens, stream) {
    const id = model.replace(/^models\//, '');
    const body = {
      contents: messages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: geminiParts(message),
      })),
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    const action = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(id)}:${action}`,
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body,
    };
  },

  openrouter(key, model, system, messages, _json, maxTokens, stream) {
    const body = {
      model,
      messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages.map(openAIMessage)],
      max_tokens: maxTokens,
    };
    if (stream) body.stream = true;
    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'danna' },
      body,
    };
  },

  deepseek(key, model, system, messages, json, maxTokens, stream) {
    if (messages.some(hasPictures)) {
      throw userError('DeepSeek cannot read pictures yet. Remove the pictures, or choose another provider in Settings.');
    }
    const body = {
      model,
      messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
      max_tokens: maxTokens,
      // Thinking is on by default. Its reasoning spends the same reply budget, so a short answer can
      // end up empty. The tutor, the graders and the set writer need a direct reply, so it is off.
      thinking: { type: 'disabled' },
    };
    if (json) body.response_format = { type: 'json_object' };
    if (stream) body.stream = true;
    return {
      url: 'https://api.deepseek.com/chat/completions',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body,
    };
  },
};

// A reply that is not streamed: its text, and whether the provider stopped because it ran out of room.
const READ = {
  openai(data) {
    const choice = firstChoice(data);
    return { text: choiceText(choice), cut: choice.finish_reason === 'length' };
  },
  anthropic(data) {
    return {
      text: (data.content || []).filter((block) => block.type === 'text').map((block) => block.text).join(''),
      cut: data.stop_reason === 'max_tokens',
    };
  },
  gemini(data) {
    const candidate = (data.candidates && data.candidates[0]) || {};
    return {
      text: ((candidate.content && candidate.content.parts) || []).map((part) => part.text || '').join(''),
      cut: candidate.finishReason === 'MAX_TOKENS',
    };
  },
  openrouter(data) {
    return READ.openai(data);
  },
  deepseek(data) {
    return READ.openai(data);
  },
};

// One event of a streamed reply: the text it adds, and whether the reply has stopped at the length limit.
const eventError = (data) => new ProviderError(String((data.error && data.error.message) || 'The reply stopped with an error.'));

const PIECE = {
  openai(data) {
    if (data.error) throw eventError(data);
    const choice = firstChoice(data);
    return { text: String((choice.delta && choice.delta.content) || ''), cut: choice.finish_reason === 'length' };
  },
  anthropic(data) {
    if (data.type === 'error') throw eventError(data);
    if (data.type === 'content_block_delta' && data.delta && data.delta.type === 'text_delta') {
      return { text: String(data.delta.text || ''), cut: false };
    }
    if (data.type === 'message_delta') return { text: '', cut: Boolean(data.delta && data.delta.stop_reason === 'max_tokens') };
    return { text: '', cut: false };
  },
  gemini(data) {
    if (data.error) throw eventError(data);
    const candidate = (data.candidates && data.candidates[0]) || {};
    return {
      text: ((candidate.content && candidate.content.parts) || []).map((part) => part.text || '').join(''),
      cut: candidate.finishReason === 'MAX_TOKENS',
    };
  },
  openrouter(data) {
    return PIECE.openai(data);
  },
  deepseek(data) {
    return PIECE.openai(data);
  },
};

const clampTokens = (value) => Math.min(Math.max(Number(value) || 2048, 256), 8192);
const clampSystem = (value) => String(value || '').slice(0, 24000);
const emptyReply = (cut) =>
  userError(cut ? 'The reply ran out of room before it was written. Try a shorter question.' : 'The assistant did not reply this time. Please try again.');

async function complete(provider, key, model, { system = '', messages = [], json = false, maxTokens = 2048 } = {}) {
  if (!REQUESTS[provider]) throw new Error('Unknown AI provider.');
  const cleanMessages = normalizeMessages(messages);
  try {
    const spec = REQUESTS[provider](key, model, clampSystem(system), cleanMessages, Boolean(json), clampTokens(maxTokens), false);
    const data = await request(spec.url, { method: 'POST', headers: spec.headers, body: spec.body, timeoutMs: COMPLETION_TIMEOUT_MS });
    const { text, cut } = READ[provider](data);
    if (!text.trim()) throw emptyReply(cut);
    return text;
  } catch (error) {
    throw asProviderError(provider, error);
  }
}

// Reads a stream of server-sent events. Each event's data is one JSON object, and the stream ends with [DONE].
async function readEvents(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let fields = [];
  // Hands on the event that is complete. Returns false when the stream has ended.
  const dispatch = () => {
    if (fields.length === 0) return true;
    const payload = fields.join('\n');
    fields = [];
    if (payload === '[DONE]') return false;
    let event;
    try {
      event = JSON.parse(payload);
    } catch {
      // A broken event is skipped. The events after it still count.
      return true;
    }
    onEvent(event);
    return true;
  };
  const line = (text) => {
    if (text === '') return dispatch();
    if (text.startsWith('data:')) fields.push(text.slice(5).replace(/^ /, ''));
    return true;
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    let end = pending.indexOf('\n');
    while (end !== -1) {
      const text = pending.slice(0, end).replace(/\r$/, '');
      pending = pending.slice(end + 1);
      if (!line(text)) {
        await reader.cancel();
        return;
      }
      end = pending.indexOf('\n');
    }
  }
  pending += decoder.decode();
  if (pending) line(pending.replace(/\r$/, ''));
  dispatch();
}

// Sends a request whose reply is streamed. Each piece of text goes to onDelta as it arrives, and the whole reply is
// returned at the end. Stopping (the signal) keeps the text written so far, and so does a reply that goes quiet.
async function streamReply(provider, spec, { signal, onDelta }) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', stop, { once: true });
  }
  let stalled = false;
  let timer = null;
  // Waits for the next piece. The first piece may take a while, as a model thinks first; later ones should come quickly.
  const wait = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      stalled = true;
      controller.abort();
    }, ms);
  };
  let text = '';
  let cut = false;
  try {
    wait(COMPLETION_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(spec.url, {
        method: 'POST',
        headers: { Accept: 'text/event-stream', ...spec.headers },
        body: JSON.stringify(spec.body),
        signal: controller.signal,
      });
    } catch (error) {
      if (signal && signal.aborted) return { text, cut, aborted: true };
      if (stalled) throw userError('The reply took too long to start. Please try again.');
      throw new ProviderError('Network error: could not reach the server.');
    }
    if (!response.ok) throw await responseError(response);
    await readEvents(response.body, (event) => {
      wait(STREAM_IDLE_MS);
      const piece = PIECE[provider](event);
      if (piece.text) {
        text += piece.text;
        if (onDelta) onDelta(piece.text);
      }
      if (piece.cut) cut = true;
    });
  } catch (error) {
    if (signal && signal.aborted) return { text, cut, aborted: true };
    if (!stalled) throw error;
    // The reply went quiet: what arrived is kept, and the rest is not waited for.
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', stop);
  }
  if (!text.trim()) {
    if (stalled) throw userError('The reply stopped coming. Please try again.');
    throw emptyReply(cut);
  }
  return { text, cut: cut || stalled, aborted: false };
}

/**
 * Streams a reply. Returns the whole text, whether the provider ran out of room (`cut`), and whether the learner
 * stopped it (`aborted`). `onDelta` receives each piece of text as it comes.
 */
async function streamComplete(provider, key, model, { system = '', messages = [], json = false, maxTokens = 2048 } = {}, { signal, onDelta } = {}) {
  if (!REQUESTS[provider]) throw new Error('Unknown AI provider.');
  const cleanMessages = normalizeMessages(messages);
  try {
    const spec = REQUESTS[provider](key, model, clampSystem(system), cleanMessages, Boolean(json), clampTokens(maxTokens), true);
    return await streamReply(provider, spec, { signal, onDelta });
  } catch (error) {
    throw asProviderError(provider, error);
  }
}

// Speech to text for speaking practice. Uses the OpenAI key only; the chat model
// selection does not matter here.
async function transcribe(key, audio, mime) {
  const type = String(mime || 'audio/webm').split(';')[0];
  const extension = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'mp4' : type.includes('wav') ? 'wav' : 'webm';
  let lastError = null;
  for (const model of ['gpt-4o-transcribe', 'whisper-1']) {
    const form = new FormData();
    form.append('model', model);
    form.append('response_format', 'json');
    form.append('file', new Blob([audio], { type }), `answer.${extension}`);
    try {
      const data = await request('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        timeoutMs: COMPLETION_TIMEOUT_MS,
      });
      return String((data && data.text) || '').trim();
    } catch (error) {
      lastError = error;
      // Only fall back to the older model when this one is unavailable.
      if (!error.status || (error.status !== 400 && error.status !== 404)) break;
    }
  }
  throw asProviderError('openai', lastError || new Error('Transcription failed.'));
}

// Gemini hears the recording and writes down its words. The recording comes as WAV, which the renderer makes. Only a
// model the key cannot use (404) moves on to the next one.
const GEMINI_TRANSCRIBE_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const GEMINI_TRANSCRIBE_PROMPT =
  'Write down exactly the words spoken in this recording, in the language they are spoken in. Write only the words: no labels, no quotation marks and no notes. If there are no words, write nothing.';

async function transcribeWithGemini(key, audio, mime) {
  const type = String(mime || 'audio/wav').split(';')[0];
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: GEMINI_TRANSCRIBE_PROMPT }, { inline_data: { mime_type: type, data: Buffer.from(audio).toString('base64') } }],
      },
    ],
    generationConfig: { temperature: 0, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
  };
  let lastError = null;
  for (const model of GEMINI_TRANSCRIBE_MODELS) {
    try {
      const data = await request(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body,
        timeoutMs: COMPLETION_TIMEOUT_MS,
      });
      const candidate = data && Array.isArray(data.candidates) ? data.candidates[0] : null;
      const parts = candidate && candidate.content && Array.isArray(candidate.content.parts) ? candidate.content.parts : [];
      return parts.map((part) => (part && typeof part.text === 'string' ? part.text : '')).join('').trim();
    } catch (error) {
      lastError = error;
      if (!error.status || error.status !== 404) break;
    }
  }
  throw asProviderError('gemini', lastError || new Error('Transcription failed.'));
}

// Speech models answer with audio, not JSON. Their errors are read like any other provider error.
async function requestBytes(url, { headers = {}, body, timeoutMs = COMPLETION_TIMEOUT_MS } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'audio/*, application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reason = error && error.name === 'TimeoutError' ? 'the request timed out' : 'could not reach the server';
    throw new ProviderError(`Network error: ${reason}.`);
  }
  if (!response.ok) throw await responseError(response);
  return Buffer.from(await response.arrayBuffer());
}

// The newest model first. An older one is tried only when the key cannot use the newer one.
const SPEECH_MODELS = {
  openai: ['gpt-4o-mini-tts', 'tts-1'],
  gemini: ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'],
};

async function speakOpenAI(key, text, voice) {
  let lastError = null;
  for (const model of SPEECH_MODELS.openai) {
    try {
      const bytes = await requestBytes('https://api.openai.com/v1/audio/speech', {
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: speech.openAISpeechBody(text, voice, model),
      });
      return { bytes, mime: 'audio/mpeg' };
    } catch (error) {
      lastError = error;
      if (!error.status || (error.status !== 400 && error.status !== 404)) break;
    }
  }
  throw lastError;
}

async function speakGemini(key, text, voice) {
  let lastError = null;
  for (const model of SPEECH_MODELS.gemini) {
    try {
      const data = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: speech.geminiSpeechBody(text, voice),
        timeoutMs: COMPLETION_TIMEOUT_MS,
      });
      const candidate = (data.candidates && data.candidates[0]) || {};
      const part = ((candidate.content && candidate.content.parts) || []).find((item) => item.inlineData && item.inlineData.data);
      if (!part) throw userError('The voice did not return any sound. Try again.');
      const pcm = Buffer.from(part.inlineData.data, 'base64');
      return { bytes: speech.pcmToWav(pcm, speech.sampleRateOf(part.inlineData.mimeType)), mime: 'audio/wav' };
    } catch (error) {
      lastError = error;
      if (!error.status || (error.status !== 400 && error.status !== 404)) break;
    }
  }
  throw lastError;
}

/** Reads a text aloud with a provider's speech model. Returns the audio bytes and their mime type. */
async function speak(provider, key, text, voice) {
  if (!SPEECH_MODELS[provider]) throw userError('This provider cannot read text aloud.');
  const input = speech.speechText(text);
  if (!input) throw userError('There is nothing to read aloud.');
  try {
    if (provider === 'openai') return await speakOpenAI(key, input, voice);
    return await speakGemini(key, input, voice);
  } catch (error) {
    throw asProviderError(provider, error);
  }
}

module.exports = { PROVIDERS, detectProvider, detectCandidates, deepseekRank, listModels, complete, streamComplete, transcribe, transcribeWithGemini, speak };

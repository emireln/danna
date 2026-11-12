// Model-provider adapters. Every request to OpenAI, Anthropic, Google Gemini, OpenRouter and
// DeepSeek is made here, in the Electron main process, so API keys never reach the renderer.

const { userError, MARK } = require('./errors.cjs');

const TIMEOUT_MS = 60_000;
const COMPLETION_TIMEOUT_MS = 180_000;
// The most text one request carries, counted in characters across all turns. Older turns go first.
const MAX_CONVERSATION_CHARS = 40_000;

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
  if (/^AIza[\w-]{30,}$/.test(key)) return ['gemini'];
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

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text.slice(0, 300) };
  }

  if (!response.ok) {
    const detail = (data && data.error && data.error.message) || (data && data.error) || (data && data.message) || `HTTP ${response.status}`;
    throw new ProviderError(typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 300), response.status);
  }
  return data;
}

// A provider's message is quoted to the person only after anything that looks like a key is hidden.
function quoteDetail(message) {
  const clean = String(message || '')
    .replace(/sk-[\w-]{8,}/g, 'sk-…')
    .replace(/AIza[\w-]{20,}/g, 'AIza…')
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

function normalizeMessages(messages) {
  const out = [];
  for (const message of Array.isArray(messages) ? messages : []) {
    const content = String((message && message.content) || '').slice(0, 24000);
    if (!content.trim()) continue;
    const role = message && message.role === 'assistant' ? 'assistant' : 'user';
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += `\n\n${content}`;
    else out.push({ role, content });
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

const firstChoice = (data) => (data && Array.isArray(data.choices) && data.choices[0]) || {};
const choiceText = (choice) => String((choice.message && choice.message.content) || '');

// Each completer returns the reply text and whether the provider stopped because it ran out of room.
const COMPLETERS = {
  async openai(key, model, system, messages, json, maxTokens) {
    const body = {
      model,
      messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
      max_completion_tokens: maxTokens,
    };
    if (json) body.response_format = { type: 'json_object' };
    const data = await request('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body,
      timeoutMs: COMPLETION_TIMEOUT_MS,
    });
    const choice = firstChoice(data);
    return { text: choiceText(choice), cut: choice.finish_reason === 'length' };
  },

  async anthropic(key, model, system, messages, _json, maxTokens) {
    const body = { model, max_tokens: maxTokens, messages };
    if (system) body.system = system;
    const data = await request('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body,
      timeoutMs: COMPLETION_TIMEOUT_MS,
    });
    return {
      text: (data.content || []).filter((block) => block.type === 'text').map((block) => block.text).join(''),
      cut: data.stop_reason === 'max_tokens',
    };
  },

  async gemini(key, model, system, messages, json, maxTokens) {
    const id = model.replace(/^models\//, '');
    const body = {
      contents: messages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    const data = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(id)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body,
      timeoutMs: COMPLETION_TIMEOUT_MS,
    });
    const candidate = (data.candidates && data.candidates[0]) || {};
    return {
      text: ((candidate.content && candidate.content.parts) || []).map((part) => part.text || '').join(''),
      cut: candidate.finishReason === 'MAX_TOKENS',
    };
  },

  async openrouter(key, model, system, messages, _json, maxTokens) {
    const body = {
      model,
      messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
      max_tokens: maxTokens,
    };
    const data = await request('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'danna' },
      body,
      timeoutMs: COMPLETION_TIMEOUT_MS,
    });
    const choice = firstChoice(data);
    return { text: choiceText(choice), cut: choice.finish_reason === 'length' };
  },

  async deepseek(key, model, system, messages, json, maxTokens) {
    const body = {
      model,
      messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
      max_tokens: maxTokens,
      // Thinking is on by default. Its reasoning spends the same reply budget, so a short answer can
      // end up empty. The tutor, the graders and the set writer need a direct reply, so it is off.
      thinking: { type: 'disabled' },
    };
    if (json) body.response_format = { type: 'json_object' };
    const data = await request('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body,
      timeoutMs: COMPLETION_TIMEOUT_MS,
    });
    const choice = firstChoice(data);
    return { text: choiceText(choice), cut: choice.finish_reason === 'length' };
  },
};

async function complete(provider, key, model, { system = '', messages = [], json = false, maxTokens = 2048 } = {}) {
  if (!COMPLETERS[provider]) throw new Error('Unknown AI provider.');
  const cleanMessages = normalizeMessages(messages);
  const limit = Math.min(Math.max(Number(maxTokens) || 2048, 256), 8192);
  try {
    const { text, cut } = await COMPLETERS[provider](key, model, String(system || '').slice(0, 24000), cleanMessages, Boolean(json), limit);
    if (!text.trim()) {
      throw userError(
        cut
          ? 'The reply ran out of room before it was written. Try a shorter question.'
          : 'The assistant did not reply this time. Please try again.',
      );
    }
    return text;
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

module.exports = { PROVIDERS, detectProvider, detectCandidates, deepseekRank, listModels, complete, transcribe };

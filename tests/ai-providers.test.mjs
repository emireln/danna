// Tests the model-provider adapters (electron/ai.cjs) without the network: key detection,
// DeepSeek's model ranking, the live model list and the chat request shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ai = require('../electron/ai.cjs');

// Replaces fetch for one test and restores it afterwards.
async function withFetch(reply, run) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', headers: options.headers || {}, body: options.body });
    return new Response(JSON.stringify(reply), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}

test('a key starting with sk- could be OpenAI or DeepSeek; other key formats are not ambiguous', () => {
  assert.deepEqual(ai.detectCandidates('sk-abc123'), ['openai', 'deepseek']);
  assert.deepEqual(ai.detectCandidates('sk-proj-abc123'), ['openai']);
  assert.deepEqual(ai.detectCandidates('sk-ant-abc123'), ['anthropic']);
  assert.deepEqual(ai.detectCandidates('sk-or-v1-abc123'), ['openrouter']);
  assert.deepEqual(ai.detectCandidates('not a key'), []);
});

test('DeepSeek: the newest model is ranked first, then the older names', () => {
  const ids = ['deepseek-chat', 'deepseek-v4-pro', 'deepseek-flash', 'deepseek-reasoner', 'deepseek-v4-flash'];
  const ranked = [...ids].sort((a, b) => ai.deepseekRank(b) - ai.deepseekRank(a));
  assert.equal(ranked[0], 'deepseek-flash');
  assert.equal(ranked[1], 'deepseek-v4-pro');
  assert.ok(ranked.indexOf('deepseek-chat') > ranked.indexOf('deepseek-v4-flash'));
  // A future version outranks every name above.
  assert.ok(ai.deepseekRank('deepseek-v5-pro') > ai.deepseekRank('deepseek-flash'));
});

test('listModels reads the live DeepSeek list and flags the newest model', async () => {
  const reply = { object: 'list', data: [{ id: 'deepseek-chat', object: 'model' }, { id: 'deepseek-flash', object: 'model' }] };
  await withFetch(reply, async (calls) => {
    const models = await ai.listModels('deepseek', 'sk-test');
    assert.equal(calls[0].url, 'https://api.deepseek.com/models');
    assert.equal(calls[0].headers.Authorization, 'Bearer sk-test');
    assert.equal(models[0].id, 'deepseek-flash');
    assert.equal(models[0].latest, true);
    assert.equal(models[1].latest, false);
    assert.equal(models[0].label, 'DeepSeek Flash');
  });
});

test('a DeepSeek reply goes to the chat endpoint with the chosen model and the system prompt', async () => {
  const reply = { choices: [{ message: { role: 'assistant', content: 'Hello there' } }] };
  await withFetch(reply, async (calls) => {
    const text = await ai.complete('deepseek', 'sk-test', 'deepseek-flash', {
      system: 'Be brief.',
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 300,
    });
    assert.equal(text, 'Hello there');
    assert.equal(calls[0].url, 'https://api.deepseek.com/chat/completions');
    const body = JSON.parse(calls[0].body);
    assert.equal(body.model, 'deepseek-flash');
    assert.equal(body.messages[0].role, 'system');
    assert.equal(body.max_tokens, 300);
  });
});

test('DeepSeek replies come with thinking switched off, so the whole reply budget goes to the answer', async () => {
  const reply = { choices: [{ message: { role: 'assistant', content: 'Short answer' }, finish_reason: 'stop' }] };
  await withFetch(reply, async (calls) => {
    await ai.complete('deepseek', 'sk-test', 'deepseek-flash', { messages: [{ role: 'user', content: 'Hi' }], maxTokens: 1400 });
    assert.deepEqual(JSON.parse(calls[0].body).thinking, { type: 'disabled' });
  });
});

test('an empty reply that stopped at the length limit says so, instead of a generic failure', async () => {
  const reply = { choices: [{ message: { role: 'assistant', content: null }, finish_reason: 'length' }] };
  await withFetch(reply, async () => {
    await assert.rejects(
      ai.complete('deepseek', 'sk-test', 'deepseek-flash', { messages: [{ role: 'user', content: 'Hi' }] }),
      (error) => /ran out of room/.test(error.message),
    );
  });
});

// Replaces fetch with one failing reply for one test.
async function withFailure(status, body, run) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test('a DeepSeek account without credit is told to add credit, and the key is never shown', async () => {
  await withFailure(402, { error: { message: 'Insufficient Balance' } }, async () => {
    await assert.rejects(
      ai.complete('deepseek', 'sk-test-secret-123456', 'deepseek-flash', { messages: [{ role: 'user', content: 'Hi' }] }),
      (error) => {
        assert.match(error.message, /no credit left/);
        assert.doesNotMatch(error.message, /sk-test/);
        return true;
      },
    );
  });
});

test('a rejected request quotes the provider reason, with anything that looks like a key hidden', async () => {
  await withFailure(400, { error: { message: 'Invalid value for sk-live-abcdef123456 in max_tokens' } }, async () => {
    await assert.rejects(
      ai.complete('deepseek', 'sk-test', 'deepseek-flash', { messages: [{ role: 'user', content: 'Hi' }] }),
      (error) => {
        assert.match(error.message, /could not use this request: Invalid value for sk-… in max_tokens/);
        assert.doesNotMatch(error.message, /abcdef/);
        return true;
      },
    );
  });
});

const PICTURE = { mime: 'image/jpeg', data: 'aGVsbG8=' };
const TEXT_REPLY = {
  choices: [{ message: { content: 'A cat' }, finish_reason: 'stop' }],
  content: [{ type: 'text', text: 'A cat' }],
  candidates: [{ content: { parts: [{ text: 'A cat' }] }, finishReason: 'STOP' }],
};

test('a message with a picture goes to each provider in that provider’s own form, with the text', async () => {
  const message = { role: 'user', content: 'What is this?', images: [PICTURE] };
  await withFetch(TEXT_REPLY, async (calls) => {
    await ai.complete('openai', 'sk-test', 'gpt-4o', { messages: [message] });
    assert.deepEqual(JSON.parse(calls[0].body).messages[0].content, [
      { type: 'text', text: 'What is this?' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,aGVsbG8=' } },
    ]);

    await ai.complete('openrouter', 'sk-or-v1-test', 'some-model', { messages: [message] });
    assert.deepEqual(JSON.parse(calls[1].body).messages[0].content[1], { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,aGVsbG8=' } });

    await ai.complete('anthropic', 'sk-ant-test', 'claude-sonnet-5-5', { messages: [message] });
    assert.deepEqual(JSON.parse(calls[2].body).messages[0].content, [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'aGVsbG8=' } },
      { type: 'text', text: 'What is this?' },
    ]);

    await ai.complete('gemini', 'AIzaTestKeyTestKeyTestKeyTestKey1', 'gemini-3-flash', { messages: [message] });
    assert.deepEqual(JSON.parse(calls[3].body).contents[0].parts, [
      { inline_data: { mime_type: 'image/jpeg', data: 'aGVsbG8=' } },
      { text: 'What is this?' },
    ]);
  });
});

test('a text-only message keeps the plain form each provider had before pictures', async () => {
  await withFetch(TEXT_REPLY, async (calls) => {
    await ai.complete('openai', 'sk-test', 'gpt-4o', { messages: [{ role: 'user', content: 'Hi' }] });
    assert.deepEqual(JSON.parse(calls[0].body).messages[0], { role: 'user', content: 'Hi' });
    await ai.complete('anthropic', 'sk-ant-test', 'claude-sonnet-5-5', { messages: [{ role: 'user', content: 'Hi' }] });
    assert.deepEqual(JSON.parse(calls[1].body).messages[0], { role: 'user', content: 'Hi' });
  });
});

test('DeepSeek is told it cannot read pictures, and no request is sent', async () => {
  await withFetch(TEXT_REPLY, async (calls) => {
    await assert.rejects(
      ai.complete('deepseek', 'sk-test', 'deepseek-flash', { messages: [{ role: 'user', content: 'Look', images: [PICTURE] }] }),
      /DeepSeek cannot read pictures yet/,
    );
    assert.equal(calls.length, 0);
  });
});

test('pictures of a type the app does not send are dropped, and ten pictures at most go with one message', async () => {
  const svg = { mime: 'image/svg+xml', data: 'PHN2Zz4=' };
  await withFetch(TEXT_REPLY, async (calls) => {
    await ai.complete('openai', 'sk-test', 'gpt-4o', {
      messages: [{ role: 'user', content: 'Hi', images: [svg, ...Array.from({ length: 12 }, () => PICTURE)] }],
    });
    const content = JSON.parse(calls[0].body).messages[0].content;
    assert.equal(content.filter((part) => part.type === 'image_url').length, 10);
  });
});

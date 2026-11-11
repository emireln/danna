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

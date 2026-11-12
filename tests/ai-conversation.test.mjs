// Tests how much of a conversation one request carries (electron/ai.cjs). A long chat is trimmed to a fixed
// budget, the newest turns are kept, and the request still opens with a user turn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ai = require('../electron/ai.cjs');

async function captureRequest(messages) {
  const original = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (url, options = {}) => {
    bodies.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    await ai.complete('deepseek', 'sk-test', 'deepseek-flash', { messages });
  } finally {
    globalThis.fetch = original;
  }
  return bodies[0];
}

test('a long conversation is trimmed to the budget, keeping the newest turns', async () => {
  // Sixty alternating turns of about 2,000 characters, ending with the learner's newest question.
  const turns = Array.from({ length: 60 }, (_, index) => ({
    role: index % 2 ? 'user' : 'assistant',
    content: `turn ${index} ${'x'.repeat(2000)}`,
  }));
  const body = await captureRequest(turns);
  const sent = body.messages;
  const total = sent.reduce((sum, message) => sum + message.content.length, 0);
  assert.ok(total <= 40000, `the text sent is ${total} characters, within the budget`);
  assert.ok(sent.length < turns.length, 'older turns are dropped');
  assert.equal(sent[0].role, 'user', 'the request opens with a user turn');
  assert.ok(sent[sent.length - 1].content.startsWith('turn 59 '), 'the newest turn is kept');
});

test('a short conversation is sent whole', async () => {
  const body = await captureRequest([
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there' },
    { role: 'user', content: 'Correct: she have went' },
  ]);
  assert.deepEqual(
    body.messages.map((message) => message.content),
    ['Hello', 'Hi there', 'Correct: she have went'],
  );
});

test('a single very long message is still sent, cut to its own limit', async () => {
  const body = await captureRequest([{ role: 'user', content: 'y'.repeat(30000) }]);
  assert.equal(body.messages.length, 1);
  assert.equal(body.messages[0].content.length, 24000);
});

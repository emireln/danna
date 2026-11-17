// Tests the streamed replies of the model-provider adapters (electron/ai.cjs) without the network: each provider's
// event format, the pieces handed on as they arrive, a reply that is stopped, a reply that fails, and a broken event.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ai = require('../electron/ai.cjs');
const encoder = new TextEncoder();

/** A response whose body is the given server-sent events, in the given pieces. */
function eventsResponse(pieces, status = 200) {
  const stream = new ReadableStream({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
  return new Response(stream, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

/** Replaces fetch for one test. `reply(index, options)` returns the response for each request. */
async function withStream(reply, run) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), headers: options.headers || {}, body: JSON.parse(options.body), signal: options.signal });
    return reply(calls.length - 1, options);
  };
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}

test('an OpenAI reply is streamed in pieces, and the whole reply is returned at the end', async () => {
  const pieces = [];
  await withStream(
    () =>
      eventsResponse([
        'data: {"choices":[{"delta":{"role":"assistant","content":"Hel"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    async (calls) => {
      const reply = await ai.streamComplete('openai', 'sk-test', 'gpt-4o', { system: 'Be brief.', messages: [{ role: 'user', content: 'Hi' }], maxTokens: 900 }, {
        onDelta: (piece) => pieces.push(piece),
      });
      assert.equal(reply.text, 'Hello');
      assert.equal(reply.cut, false);
      assert.equal(reply.aborted, false);
      assert.deepEqual(pieces, ['Hel', 'lo'], 'each piece goes on as it arrives');
      assert.equal(calls[0].url, 'https://api.openai.com/v1/chat/completions');
      assert.equal(calls[0].body.stream, true);
      assert.equal(calls[0].body.max_completion_tokens, 900);
      assert.equal(calls[0].body.messages[0].role, 'system');
    },
  );
});

test('an Anthropic reply is streamed from its text deltas, and a reply cut at the limit says so', async () => {
  await withStream(
    () =>
      eventsResponse([
        'event: message_start\ndata: {"type":"message_start","message":{"id":"m1"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Good "}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"morning"}}\n\n',
        'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"max_tokens"}}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ]),
    async (calls) => {
      const reply = await ai.streamComplete('anthropic', 'sk-ant-test', 'claude-sonnet-5-5', { messages: [{ role: 'user', content: 'Hi' }] });
      assert.equal(reply.text, 'Good morning');
      assert.equal(reply.cut, true, 'a reply that stopped at the limit is marked as cut');
      assert.equal(calls[0].body.stream, true);
    },
  );
});

test('a Gemini reply is streamed from the server-sent events endpoint', async () => {
  await withStream(
    () =>
      eventsResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"Ok, "}],"role":"model"}}]}\r\n\r\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"let us go."}],"role":"model"},"finishReason":"STOP"}]}\r\n\r\n',
      ]),
    async (calls) => {
      const reply = await ai.streamComplete('gemini', 'AIzaTestKeyTestKeyTestKeyTestKey1', 'gemini-3-flash', { messages: [{ role: 'user', content: 'Hi' }] });
      assert.equal(reply.text, 'Ok, let us go.');
      assert.match(calls[0].url, /:streamGenerateContent\?alt=sse$/);
      assert.equal(reply.cut, false);
    },
  );
});

test('an OpenRouter reply streams the same way, with the title of the app', async () => {
  await withStream(
    () => eventsResponse(['data: {"choices":[{"delta":{"content":"Fine."},"finish_reason":"stop"}]}\n\n', 'data: [DONE]\n\n']),
    async (calls) => {
      const reply = await ai.streamComplete('openrouter', 'sk-or-v1-test', 'some-model', { messages: [{ role: 'user', content: 'Hi' }] });
      assert.equal(reply.text, 'Fine.');
      assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
      assert.equal(calls[0].headers['X-Title'], 'danna');
    },
  );
});

test('a broken event in the middle is skipped, and the pieces after it still arrive', async () => {
  await withStream(
    () =>
      eventsResponse([
        'data: {"choices":[{"delta":{"content":"One "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"two"\n\n',
        'data: {"choices":[{"delta":{"content":" three"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    async () => {
      const reply = await ai.streamComplete('openai', 'sk-test', 'gpt-4o', { messages: [{ role: 'user', content: 'Hi' }] });
      assert.equal(reply.text, 'One  three');
    },
  );
});

test('a reply stopped by the learner keeps the text written so far', async () => {
  const controller = new AbortController();
  const pieces = [];
  await withStream(
    (_index, options) => {
      const stream = new ReadableStream({
        start(streamController) {
          streamController.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Part one"}}]}\n\n'));
          options.signal.addEventListener('abort', () => streamController.error(new DOMException('The operation was aborted.', 'AbortError')));
        },
      });
      return new Response(stream, { status: 200 });
    },
    async () => {
      const reply = await ai.streamComplete(
        'openai',
        'sk-test',
        'gpt-4o',
        { messages: [{ role: 'user', content: 'Hi' }] },
        {
          signal: controller.signal,
          onDelta: (piece) => {
            pieces.push(piece);
            if (pieces.length === 1) controller.abort();
          },
        },
      );
      assert.equal(reply.aborted, true);
      assert.equal(reply.text, 'Part one');
      assert.deepEqual(pieces, ['Part one']);
    },
  );
});

test('a key that is refused fails the streamed reply with the same message as a whole reply', async () => {
  await withStream(
    () => eventsResponse([JSON.stringify({ error: { message: 'Incorrect API key provided' } })], 401),
    async () => {
      await assert.rejects(
        ai.streamComplete('openai', 'sk-test-secret-123456', 'gpt-4o', { messages: [{ role: 'user', content: 'Hi' }] }),
        (error) => {
          assert.match(error.message, /did not accept this key/);
          assert.doesNotMatch(error.message, /sk-test/);
          return true;
        },
      );
    },
  );
});

test('an error that the provider sends inside the stream is reported, not shown as text', async () => {
  await withStream(
    () => eventsResponse(['event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n']),
    async () => {
      await assert.rejects(ai.streamComplete('anthropic', 'sk-ant-test', 'claude-sonnet-5-5', { messages: [{ role: 'user', content: 'Hi' }] }), /could not finish that/);
    },
  );
});

test('an empty stream is an error that says whether the reply ran out of room', async () => {
  await withStream(
    () => eventsResponse(['data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n', 'data: [DONE]\n\n']),
    async () => {
      await assert.rejects(
        ai.streamComplete('openai', 'sk-test', 'gpt-4o', { messages: [{ role: 'user', content: 'Hi' }] }),
        (error) => /ran out of room/.test(error.message),
      );
    },
  );
});

test('the request of a streamed reply and of a whole reply differ only in the streaming flag', async () => {
  const bodies = [];
  await withStream(
    (index) =>
      index === 0
        ? new Response(JSON.stringify({ choices: [{ message: { content: 'Hi' }, finish_reason: 'stop' }] }))
        : eventsResponse(['data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n', 'data: [DONE]\n\n']),
    async (calls) => {
      await ai.complete('deepseek', 'sk-test', 'deepseek-flash', { system: 'Be brief.', messages: [{ role: 'user', content: 'Hi' }], maxTokens: 500 });
      await ai.streamComplete('deepseek', 'sk-test', 'deepseek-flash', { system: 'Be brief.', messages: [{ role: 'user', content: 'Hi' }], maxTokens: 500 });
      bodies.push(calls[0].body, calls[1].body);
    },
  );
  assert.equal(bodies[0].stream, undefined, 'a whole reply is not streamed');
  assert.equal(bodies[1].stream, true);
  const { stream, ...streamed } = bodies[1];
  assert.equal(stream, true);
  assert.deepEqual(streamed, bodies[0]);
});

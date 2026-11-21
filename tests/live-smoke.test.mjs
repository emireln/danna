// A live check against the real Gemini Live service. It runs only when a Gemini key is given in the DANNA_GEMINI_KEY
// environment variable, so the key is never written to the repository. It opens a talk with the same main-process code the
// app uses, sends one short line, and expects the model's voice and words back. Without the variable the test is skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const key = process.env.DANNA_GEMINI_KEY ?? '';
const require = createRequire(import.meta.url);

test(
  'a live talk with Gemini answers with a voice and with words',
  { skip: key ? false : 'set DANNA_GEMINI_KEY to run the live check', timeout: 150000 },
  async () => {
    const { createLiveSessions } = require('../electron/live.cjs');
    const events = [];
    const sessions = createLiveSessions({
      send: (channel, payload) => {
        if (channel === 'live:event') events.push(payload);
      },
      getKey: (provider) => (provider === 'gemini' ? key : null),
    });
    const waitFor = async (predicate, milliseconds) => {
      const until = Date.now() + milliseconds;
      while (Date.now() < until) {
        if (predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return false;
    };
    sessions.start({ instructions: 'You are a friendly English coach. Reply with one short sentence.', voice: 'Kore', turnMode: 'auto' });
    try {
      assert.ok(await waitFor(() => events.some((event) => event.type === 'ready'), 40000), 'the model became ready');
      sessions.sendText('Say hello to me in one short sentence.');
      assert.ok(await waitFor(() => events.some((event) => event.type === 'turn-complete'), 100000), 'the model finished its turn');
      const bytes = events.filter((event) => event.type === 'audio').reduce((sum, event) => sum + event.data.byteLength, 0);
      assert.ok(bytes > 2000, `the voice came back (${bytes} bytes)`);
      assert.ok(
        events.some((event) => event.type === 'transcript' && event.role === 'model' && event.text.trim() !== ''),
        'the words came back as text',
      );
    } finally {
      sessions.stop();
    }
    assert.ok(!JSON.stringify(events).includes(key), 'the key never reaches the window');
  },
);

// A new talk replaces a talk that is still open, for example one left open by a window that reloaded. The window that
// starts the new talk must not be told that its own talk has ended, and the new talk must carry on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createLiveSessions } = require('../electron/live.cjs');

class FakeSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.sent = [];
    this.closed = false;
    FakeSocket.instances.push(this);
  }

  send(data) {
    this.sent.push(data);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }
}

test('a new talk replaces an open one without telling the window that its own talk ended', () => {
  FakeSocket.instances = [];
  const events = [];
  const sessions = createLiveSessions({
    send: (channel, payload) => {
      if (channel === 'live:event') events.push(payload);
    },
    getKey: () => 'test-key',
    WebSocketImpl: FakeSocket,
  });
  const options = { instructions: 'Be kind.', voice: 'Puck', turnMode: 'auto' };
  sessions.start(options);
  const first = FakeSocket.instances[0];
  first.onopen?.();
  first.onmessage({ data: JSON.stringify({ setupComplete: {} }) });
  assert.ok(events.some((event) => event.type === 'ready'), 'the first talk is ready');

  sessions.start(options);
  const second = FakeSocket.instances[1];
  second.onopen?.();
  second.onmessage({ data: JSON.stringify({ setupComplete: {} }) });

  assert.equal(
    events.filter((event) => event.type === 'closed').length,
    0,
    'no talk is reported as closed when it is replaced',
  );
  assert.equal(events.filter((event) => event.type === 'ready').length, 2, 'the new talk is ready');
  assert.equal(sessions.state(), 'ready');
  sessions.stop();
});

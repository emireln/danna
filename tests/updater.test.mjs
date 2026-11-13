// Updates: danna checks GitHub releases, downloads a newer version quietly, tells the interface when it is
// ready, and restarts into it only when the person asks. The real electron-updater is replaced by a stand-in
// that emits the same events.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { createUpdates } = require(join(fileURLToPath(new URL('..', import.meta.url)), 'electron', 'updater.cjs'));

function fakeUpdater() {
  const updater = new EventEmitter();
  updater.checks = 0;
  updater.installs = [];
  updater.checkForUpdates = async () => {
    updater.checks += 1;
    return null;
  };
  updater.quitAndInstall = (...args) => {
    updater.installs.push(args);
  };
  return updater;
}

test('a development build neither checks for updates nor installs them', async () => {
  const updater = fakeUpdater();
  const updates = createUpdates({ app: { isPackaged: false }, updater, send: () => {} });
  updates.start();
  await updates.check();
  updates.install();
  assert.equal(updater.checks, 0);
  assert.deepEqual(updater.installs, []);
  updates.stop();
});

test('a packaged app checks for a newer release and reports each step to the interface', async () => {
  const updater = fakeUpdater();
  const sent = [];
  const updates = createUpdates({ app: { isPackaged: true }, updater, send: (channel, payload) => sent.push({ channel, payload }) });
  await updates.check();
  assert.equal(updater.checks, 1);

  updater.emit('update-available', { version: '0.5.1' });
  assert.deepEqual(updates.status(), { state: 'downloading', version: '0.5.1' });

  updater.emit('update-downloaded', { version: '0.5.1' });
  assert.deepEqual(updates.status(), { state: 'ready', version: '0.5.1' });
  assert.deepEqual(sent.at(-1), { channel: 'update:status', payload: { state: 'ready', version: '0.5.1' } });
});

test('restarting waits until a version is ready, then installs it and opens danna again', () => {
  const updater = fakeUpdater();
  const updates = createUpdates({ app: { isPackaged: true }, updater, send: () => {} });
  updates.install();
  assert.deepEqual(updater.installs, [], 'nothing is ready yet');

  updater.emit('update-downloaded', { version: '0.5.1' });
  updates.install();
  assert.deepEqual(updater.installs, [[false, true]]);
});

test('no newer release returns to idle, and a failed check keeps the last state without an error screen', () => {
  const updater = fakeUpdater();
  const logged = [];
  const updates = createUpdates({ app: { isPackaged: true }, updater, send: () => {}, log: (message) => logged.push(message) });

  updater.emit('update-available', { version: '0.5.1' });
  updater.emit('error', new Error('offline'));
  assert.deepEqual(updates.status(), { state: 'downloading', version: '0.5.1' });
  assert.equal(logged.length, 1);

  updater.emit('update-not-available', {});
  assert.deepEqual(updates.status(), { state: 'idle', version: null });
});

test('a check that cannot reach GitHub is logged, not thrown', async () => {
  const updater = fakeUpdater();
  updater.checkForUpdates = async () => {
    throw new Error('no network');
  };
  const logged = [];
  const updates = createUpdates({ app: { isPackaged: true }, updater, send: () => {}, log: (message) => logged.push(message) });
  await updates.check();
  assert.equal(logged.length, 1);
});

// Updates: danna checks GitHub releases, tells the person when a newer version is there, downloads it when they ask,
// tells the interface when it is ready, and restarts into it only when the person asks. The real electron-updater is
// replaced by a stand-in that emits the same events.
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
  updater.downloads = 0;
  updater.installs = [];
  updater.checkForUpdates = async () => {
    updater.checks += 1;
    return null;
  };
  // A download takes a moment, so the 'ready' event comes after the caller has seen 'downloading'.
  updater.downloadUpdate = () =>
    new Promise((resolve) => {
      updater.downloads += 1;
      setTimeout(() => {
        updater.emit('update-downloaded', { version: '0.5.1' });
        resolve();
      }, 0);
    });
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

test('a packaged app checks for a newer release and tells the person it is available, without downloading it yet', async () => {
  const updater = fakeUpdater();
  const sent = [];
  const updates = createUpdates({ app: { isPackaged: true }, updater, send: (channel, payload) => sent.push({ channel, payload }) });
  await updates.check();
  assert.equal(updater.checks, 1);

  updater.emit('update-available', { version: '0.5.1' });
  assert.deepEqual(updates.status(), { state: 'available', version: '0.5.1' });
  assert.equal(updater.downloads, 0, 'nothing is downloaded until the person asks');
  assert.deepEqual(sent.at(-1), { channel: 'update:status', payload: { state: 'available', version: '0.5.1' } });
});

test('downloading starts when the person asks, and the version is ready when it has arrived', async () => {
  const updater = fakeUpdater();
  const sent = [];
  const updates = createUpdates({ app: { isPackaged: true }, updater, send: (channel, payload) => sent.push({ channel, payload }) });
  await updates.download();
  assert.equal(updater.downloads, 0, 'there is no newer version to download yet');

  updater.emit('update-available', { version: '0.5.1' });
  const pending = updates.download();
  assert.deepEqual(updates.status(), { state: 'downloading', version: '0.5.1' });
  await pending;
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

test('no newer release returns to idle, and a failed download can be tried again without an error screen', async () => {
  const updater = fakeUpdater();
  const logged = [];
  const updates = createUpdates({ app: { isPackaged: true }, updater, send: () => {}, log: (message) => logged.push(message) });

  updater.emit('update-available', { version: '0.5.1' });
  updater.emit('error', new Error('offline'));
  assert.deepEqual(updates.status(), { state: 'available', version: '0.5.1' }, 'an error while nothing downloads keeps the state');
  assert.equal(logged.length, 1);

  updater.downloadUpdate = async () => {
    throw new Error('connection lost');
  };
  await updates.download();
  assert.deepEqual(updates.status(), { state: 'available', version: '0.5.1' }, 'a failed download is offered again');
  assert.equal(logged.length, 2);

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

test('a later check that finds a version already downloaded keeps it ready, so the restart button stays', async () => {
  const updater = fakeUpdater();
  const updates = createUpdates({ app: { isPackaged: true }, updater, send: () => {} });
  updater.emit('update-available', { version: '0.5.1' });
  await updates.download();
  assert.deepEqual(updates.status(), { state: 'ready', version: '0.5.1' });

  await updates.check();
  updater.emit('update-available', { version: '0.5.1' });
  assert.deepEqual(updates.status(), { state: 'ready', version: '0.5.1' });
});

test('a download that ends without a ready version is offered again', async () => {
  const updater = fakeUpdater();
  const updates = createUpdates({ app: { isPackaged: true }, updater, send: () => {} });
  updater.emit('update-available', { version: '0.5.1' });
  updater.downloadUpdate = async () => {};
  await updates.download();
  assert.deepEqual(updates.status(), { state: 'available', version: '0.5.1' });
});

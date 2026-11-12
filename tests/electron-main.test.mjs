// Tests the desktop process (electron/main.cjs) through the same channels the interface uses. Electron is
// stood in for by a small module that records the handlers, so every check runs under plain Node. The tests
// cover who may call each channel, what each channel refuses, and that the keys and sessions stay on the device.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const mainPath = join(root, 'electron', 'main.cjs');
const preloadPath = join(root, 'electron', 'preload.cjs');
const electronPath = require.resolve('electron');

const handlers = new Map();
const opened = [];
let folder = '';

function electronStub() {
  return {
    app: {
      requestSingleInstanceLock: () => true,
      on() {},
      whenReady: () => Promise.resolve(),
      setAppUserModelId() {},
      getPath: () => folder,
      getVersion: () => '0.4.5',
      getLocale: () => 'pt-BR',
      isPackaged: false,
      quit() {},
    },
    BrowserWindow: class {
      constructor() {
        this.webContents = { setWindowOpenHandler() {}, on() {}, send() {} };
      }
      once() {}
      on() {}
      show() {}
      hide() {}
      focus() {}
      restore() {}
      minimize() {}
      maximize() {}
      unmaximize() {}
      close() {}
      isDestroyed() {
        return false;
      }
      isVisible() {
        return false;
      }
      isFocused() {
        return false;
      }
      isMinimized() {
        return false;
      }
      isMaximized() {
        return false;
      }
      loadURL() {
        return Promise.resolve();
      }
    },
    ipcMain: {
      handle(channel, handler) {
        handlers.set(channel, handler);
      },
    },
    shell: {
      openExternal(url) {
        opened.push(url);
        return Promise.resolve();
      },
    },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (text) => Buffer.from(`enc:${text}`, 'utf8'),
      decryptString: (buffer) => buffer.toString('utf8').replace(/^enc:/, ''),
    },
    session: { defaultSession: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} } },
    protocol: { registerSchemesAsPrivileged() {}, handle() {} },
    net: { fetch: async () => new Response('ok') },
    Tray: class {
      setToolTip() {}
      setContextMenu() {}
      on() {}
      displayBalloon() {}
    },
    Menu: { buildFromTemplate: () => ({}) },
    nativeImage: { createFromPath: () => ({}) },
  };
}

const APP_PAGE = 'app://danna/index.html';

// Calls a channel the way the interface does: from a danna page unless another address is given.
function invoke(channel, payload, url = APP_PAGE) {
  const handler = handlers.get(channel);
  assert.ok(handler, `the channel ${channel} is registered`);
  return handler({ senderFrame: { url } }, payload);
}

// The message a person would see for a refused call, or null when the call succeeded.
async function refusal(promise) {
  try {
    await promise;
    return null;
  } catch (error) {
    return error.message.replace('@@user@@', '');
  }
}

before(async () => {
  folder = mkdtempSync(join(tmpdir(), 'danna-main-'));
  require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: electronStub() };
  require(mainPath);
  // The desktop process registers its channels once the app is ready, on the next turn of the event loop.
  await new Promise((resolve) => setImmediate(resolve));
});

after(() => {
  try {
    rmSync(folder, { recursive: true, force: true });
  } catch {
    // The system cleans up the temporary folder later.
  }
});

test('every channel the interface calls is handled by the desktop process', () => {
  const preload = readFileSync(preloadPath, 'utf8');
  const used = [...preload.matchAll(/call\('([^']+)'/g)].map((match) => match[1]);
  assert.ok(used.length >= 15, 'the preload calls a list of channels');
  for (const channel of new Set(used)) assert.ok(handlers.has(channel), `${channel} has a handler`);
});

test('only danna pages can call the desktop process', async () => {
  for (const url of ['https://evil.example/', 'file:///C:/Users/someone/page.html', 'app://other/index.html']) {
    await assert.rejects(invoke('local:call', { method: 'getProfile', args: [] }, url), /untrusted page/, url);
  }
  await assert.rejects(invoke('settings:get', undefined, 'https://evil.example/'), /untrusted page/);
  await assert.rejects(invoke('keys:state', undefined, 'file:///C:/x.html'), /untrusted page/);
});

test('danna pages can read the app information', async () => {
  const info = await invoke('app:info');
  assert.equal(info.version, '0.4.5');
  assert.equal(info.packaged, false);
});

test('the local database accepts only short, listed calls', async () => {
  assert.equal(await refusal(invoke('local:call', { method: 'constructor', args: [] })), 'That action is not available right now.');
  assert.equal(await refusal(invoke('local:call', { method: 'x'.repeat(41), args: [] })), 'That action is not available right now.');
  assert.equal(await refusal(invoke('local:call', { method: 'getProfile', args: 'nope' })), 'That action is not available right now.');
  assert.equal(
    await refusal(invoke('local:call', { method: 'getProfile', args: new Array(9).fill(0) })),
    'That action is not available right now.',
  );
  const profile = await invoke('local:call', { method: 'getProfile', args: [] });
  assert.equal(profile.goal, 'english');
  assert.equal(profile.onboarding_done, false);
});

test('links open in the browser only when they are https', async () => {
  for (const url of ['http://example.com', 'file:///C:/secret.txt', 'javascript:alert(1)', 'https://example.com/a b']) {
    assert.equal(await refusal(invoke('shell:open', { url })), 'That link cannot be opened.', `${url} is refused`);
  }
  await invoke('shell:open', { url: 'https://example.com/lesson' });
  assert.ok(opened.includes('https://example.com/lesson'));
});

test('AI actions need a connected key first, and the key is checked before it is saved', async () => {
  assert.equal(await refusal(invoke('ai:complete', { messages: [{ role: 'user', content: 'hi' }] })), 'Add an AI key in Settings to use this feature.');
  assert.equal(await refusal(invoke('ai:models', { provider: 'openai' })), 'Connect this provider first.');
  assert.equal(await refusal(invoke('ai:select', { provider: 'openai', model: 'gpt-4o' })), 'Connect this provider first.');
  assert.equal(await refusal(invoke('ai:transcribe', { audio: new ArrayBuffer(8), mime: 'audio/webm' })), 'Add an OpenAI key in Settings to transcribe speaking answers.');
  assert.equal(await refusal(invoke('keys:remove', { provider: 'nope' })), 'That AI provider is not supported.');
  assert.equal(await refusal(invoke('keys:add', { key: '   ' })), 'Paste your AI key to connect it.');
  assert.match(await refusal(invoke('keys:add', { key: 'sk-abc def' })), /should not contain spaces/);
  assert.match(await refusal(invoke('keys:add', { key: 'not-a-known-key' })), /We do not recognize this key yet/);
});

test('a saved key is never sent to the interface, only its ending', async () => {
  const key = 'sk-test-SECRET-1234567890';
  writeFileSync(
    join(folder, 'danna-ai.json'),
    JSON.stringify({
      connections: {
        openai: { enc: Buffer.from(`enc:${key}`, 'utf8').toString('base64'), masked: 'sk-test…7890', addedAt: '2026-01-01T00:00:00.000Z' },
      },
      selection: { provider: 'openai', model: 'gpt-4o' },
    }),
  );
  const state = await invoke('keys:state');
  assert.equal(state.connections.length, 1);
  assert.equal(state.connections[0].label, 'OpenAI');
  assert.equal(state.connections[0].masked, 'sk-test…7890');
  assert.equal(state.selection.model, 'gpt-4o');
  assert.ok(!JSON.stringify(state).includes('SECRET'), 'the full key is not in the reply');
  assert.match(await refusal(invoke('ai:transcribe', { audio: new ArrayBuffer(0), mime: 'audio/webm' })), /No recording was found/);
  assert.match(await refusal(invoke('ai:transcribe', { audio: new ArrayBuffer(25 * 1024 * 1024), mime: 'audio/webm' })), /too long/);
  const after = await invoke('keys:remove', { provider: 'openai' });
  assert.equal(after.connections.length, 0);
  assert.equal(after.selection, null, 'removing the key clears the selection');
});

test('settings keep only the known preferences, and the file is written in one piece', async () => {
  const saved = await invoke('settings:set', { closeToTray: false, evil: 'x' });
  assert.deepEqual(saved, { closeToTray: false, language: null });
  const onDisk = JSON.parse(readFileSync(join(folder, 'danna-settings.json'), 'utf8'));
  assert.deepEqual(onDisk, { closeToTray: false, language: null });
  assert.equal(existsSync(join(folder, 'danna-settings.json.tmp')), false, 'no temporary file is left behind');
  assert.deepEqual(await invoke('settings:get'), { closeToTray: false, language: null });
});

test('the app language is saved as English or Portuguese, or follows the system', async () => {
  assert.equal((await invoke('settings:set', { language: 'pt' })).language, 'pt');
  assert.equal((await invoke('settings:set', { language: 'fr' })).language, 'pt', 'other languages are ignored');
  assert.equal((await invoke('settings:set', { language: null })).language, null);
});

test('the sign-in session keeps only danna keys, and small values', async () => {
  assert.equal(await refusal(invoke('session:set', { key: 'other', value: 'x' })), 'Unknown session value.');
  assert.equal(await refusal(invoke('session:set', { key: 'danna.auth', value: 'x'.repeat(70000) })), 'That sign-in data is too large to keep.');
  assert.equal(await invoke('session:set', { key: 'danna.auth', value: 'token-1' }), true);
  assert.equal(await invoke('session:get', { key: 'danna.auth' }), 'token-1');
  await invoke('session:remove', { key: 'danna.auth' });
  assert.equal(await invoke('session:get', { key: 'danna.auth' }), null);
});

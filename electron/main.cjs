// danna desktop shell: window management, locked-down IPC and AI key handling.
const { app, BrowserWindow, ipcMain, shell, safeStorage, session, protocol, net } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const keystore = require('./keystore.cjs');
const ai = require('./ai.cjs');

// Set by `npm run dev`; production builds always load the bundled files.
const DEV_URL = !app.isPackaged && process.env.DANNA_DEV_URL ? process.env.DANNA_DEV_URL : null;
const ICON_PATH = path.join(__dirname, '..', 'build', 'icon.ico');
const DIST = path.join(__dirname, '..', 'dist');
// The bundle is served from a privileged app:// origin. Module scripts load
// reliably there, unlike from file:// pages.
const APP_ORIGIN = 'app://danna';
let mainWindow = null;

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function serveApp(request) {
  const { pathname } = new URL(request.url);
  const relative = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const file = path.normalize(path.join(DIST, relative));
  if (!file.startsWith(DIST)) return new Response('Not found', { status: 404 });
  return net.fetch(pathToFileURL(file).toString());
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    protocol.handle('app', serveApp);
    // Only the microphone, and only for danna's own pages (speaking practice).
    // Camera, location, notifications and everything else stay denied.
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const url = webContents ? webContents.getURL() : '';
      callback(permission === 'media' && isAppUrl(url));
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      return permission === 'media' && isAppUrl(requestingOrigin || (webContents ? webContents.getURL() : ''));
    });
    registerIpc();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

function isAppUrl(url) {
  return DEV_URL ? url.startsWith(DEV_URL) : url.startsWith(`${APP_ORIGIN}/`);
}

function openExternal(url) {
  if (/^https:\/\//i.test(url)) shell.openExternal(url);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1000,
    minHeight: 680,
    show: false,
    title: 'danna',
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    // Frameless look with native window controls drawn over the top bar on Windows.
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'win32' ? { color: '#ffffff', symbolColor: '#0e1a33', height: 56 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  const { webContents } = mainWindow;
  mainWindow.once('ready-to-show', () => mainWindow.show());
  webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const loading = mainWindow.loadURL(DEV_URL ?? `${APP_ORIGIN}/index.html`);
  loading.catch((error) => console.error('danna failed to load its interface:', error));
}

function assertTrustedSender(event) {
  const url = event.senderFrame ? event.senderFrame.url : '';
  if (!isAppUrl(url)) throw new Error('Blocked a request from an untrusted page.');
}

function handle(channel, handler) {
  ipcMain.handle(channel, async (event, payload) => {
    assertTrustedSender(event);
    return handler(payload && typeof payload === 'object' ? payload : {});
  });
}

function assertProvider(provider) {
  if (!ai.PROVIDERS[provider]) throw new Error('Unknown AI provider.');
  return provider;
}

function keysState() {
  return {
    connections: keystore.listConnections().map((connection) => ({
      ...connection,
      label: ai.PROVIDERS[connection.provider] ? ai.PROVIDERS[connection.provider].label : connection.provider,
      hint: ai.PROVIDERS[connection.provider] ? ai.PROVIDERS[connection.provider].hint : '',
    })),
    selection: keystore.getSelection(),
  };
}

function registerIpc() {
  handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    packaged: app.isPackaged,
    secureStorage: safeStorage.isEncryptionAvailable(),
  }));

  handle('keys:state', () => keysState());

  // Validates the key against the provider before anything is stored.
  handle('keys:add', async ({ key }) => {
    const clean = typeof key === 'string' ? key.trim() : '';
    if (!clean || clean.length > 300 || /\s/.test(clean)) {
      throw new Error('Paste the full API key. It should contain no spaces.');
    }
    const provider = ai.detectProvider(clean);
    if (!provider) {
      throw new Error('This key format is not recognised. Supported: OpenAI (sk-), Anthropic (sk-ant-), Google Gemini (AIza…) and OpenRouter (sk-or-v1-).');
    }
    const models = await ai.listModels(provider, clean);
    if (models.length === 0) {
      throw new Error(`${ai.PROVIDERS[provider].label} accepted the key but returned no chat models.`);
    }
    keystore.saveKey(provider, clean);
    const current = keystore.getSelection();
    if (!current || !keystore.hasKey(current.provider)) {
      keystore.setSelection({ provider, model: models[0].id });
    }
    return { provider, label: ai.PROVIDERS[provider].label, models, ...keysState() };
  });

  handle('keys:remove', ({ provider }) => {
    keystore.removeKey(assertProvider(provider));
    return keysState();
  });

  handle('ai:models', async ({ provider }) => {
    assertProvider(provider);
    const key = keystore.getKey(provider);
    if (!key) throw new Error('No key is saved for this provider.');
    return ai.listModels(provider, key);
  });

  handle('ai:select', ({ provider, model }) => {
    assertProvider(provider);
    if (!keystore.hasKey(provider)) throw new Error('Connect this provider first.');
    if (typeof model !== 'string' || !model || model.length > 200) throw new Error('Choose a valid model.');
    keystore.setSelection({ provider, model });
    return keystore.getSelection();
  });

  handle('ai:complete', async ({ system, messages, json, maxTokens }) => {
    const selection = keystore.getSelection();
    if (!selection) throw new Error('Connect an AI key in Settings to use this feature.');
    const key = keystore.getKey(selection.provider);
    if (!key) throw new Error('The selected provider has no saved key. Reconnect it in Settings.');
    const text = await ai.complete(selection.provider, key, selection.model, {
      system: typeof system === 'string' ? system : '',
      messages,
      json: Boolean(json),
      maxTokens,
    });
    return { text, provider: selection.provider, model: selection.model };
  });

  handle('ai:transcribe', async ({ audio, mime }) => {
    if (!keystore.hasKey('openai')) {
      throw new Error('Add an OpenAI key in Settings to transcribe speaking answers.');
    }
    if (!(audio instanceof ArrayBuffer) || audio.byteLength === 0) throw new Error('No audio was recorded.');
    if (audio.byteLength > 24 * 1024 * 1024) throw new Error('That recording is too long to transcribe. Try a shorter answer.');
    const text = await ai.transcribe(keystore.getKey('openai'), Buffer.from(audio), typeof mime === 'string' ? mime : 'audio/webm');
    return { text };
  });

  handle('shell:open', ({ url }) => {
    if (typeof url !== 'string' || !/^https:\/\/\S+$/i.test(url)) throw new Error('Only https links can be opened.');
    return shell.openExternal(url);
  });
}

// danna desktop shell: custom window frame, tray, offline data, AI keys and secure IPC.
const { app, BrowserWindow, ipcMain, shell, safeStorage, session, protocol, net, Tray, Menu, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const keystore = require('./keystore.cjs');
const ai = require('./ai.cjs');
const localdb = require('./localdb.cjs');
const settings = require('./settings.cjs');
const sessionStore = require('./session.cjs');
const { userError } = require('./errors.cjs');

// Set by `npm run dev`; packaged builds always serve the bundled interface.
const DEV_URL = !app.isPackaged && process.env.DANNA_DEV_URL ? process.env.DANNA_DEV_URL : null;
const DIST = path.join(__dirname, '..', 'dist');
const APP_ORIGIN = 'app://danna';
const ICON = path.join(__dirname, 'assets', 'icon.png');
const TRAY_ICON = path.join(__dirname, 'assets', 'tray.png');

let mainWindow = null;
let tray = null;
let quitting = false;
let trayHintShown = false;

// Must run before the app is ready. The interface is served from this origin.
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
  app.on('before-quit', () => {
    quitting = true;
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('app.danna.desktop');
    protocol.handle('app', serveApp);
    // Only the microphone (speaking practice), and only for danna's own pages.
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const url = webContents ? webContents.getURL() : '';
      callback(permission === 'media' && isAppUrl(url));
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      return permission === 'media' && isAppUrl(requestingOrigin || (webContents ? webContents.getURL() : ''));
    });
    registerIpc();
    createTray();
    createWindow();
  });
}

function serveApp(request) {
  let relative;
  try {
    const { pathname } = new URL(request.url);
    relative = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  // Only files inside the bundled interface folder. The separator matters: a sibling folder
  // such as "dist-other" must not pass the check just because its name starts the same way.
  const file = path.resolve(DIST, `.${relative}`);
  if (!file.startsWith(DIST + path.sep)) return new Response('Not found', { status: 404 });
  return net.fetch(pathToFileURL(file).toString());
}

function isAppUrl(url) {
  return DEV_URL ? url.startsWith(DEV_URL) : url.startsWith(`${APP_ORIGIN}/`);
}

function openExternal(url) {
  if (/^https:\/\//i.test(url)) shell.openExternal(url);
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1000,
    minHeight: 680,
    show: false,
    // No system title bar: the interface draws its own, with window controls.
    frame: false,
    thickFrame: true,
    title: 'danna',
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    icon: fs.existsSync(ICON) ? ICON : undefined,
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
  mainWindow.on('maximize', () => send('window:state', { maximized: true }));
  mainWindow.on('unmaximize', () => send('window:state', { maximized: false }));
  mainWindow.on('close', (event) => {
    if (quitting || !settings.get().closeToTray) return;
    event.preventDefault();
    mainWindow.hide();
    if (!trayHintShown && tray && typeof tray.displayBalloon === 'function') {
      trayHintShown = true;
      tray.displayBalloon({ title: 'danna', content: 'danna is still running. Click the tray icon to open it again.' });
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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

  mainWindow.loadURL(DEV_URL ?? `${APP_ORIGIN}/index.html`).catch((error) => {
    console.error('danna could not load its interface:', error);
  });
}

function showWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray || !fs.existsSync(TRAY_ICON)) return;
  tray = new Tray(nativeImage.createFromPath(TRAY_ICON));
  tray.setToolTip('danna');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open danna', click: () => showWindow() },
      {
        label: 'Continue learning',
        click: () => {
          showWindow();
          send('app:navigate', '/');
        },
      },
      {
        label: 'Quick review',
        click: () => {
          showWindow();
          send('app:navigate', '/review');
        },
      },
      { type: 'separator' },
      {
        label: 'Quit danna',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('click', () => {
    if (mainWindow && mainWindow.isVisible() && mainWindow.isFocused()) mainWindow.hide();
    else showWindow();
  });
  tray.on('double-click', () => showWindow());
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
  if (!ai.PROVIDERS[provider]) throw userError('That AI provider is not supported.');
  return provider;
}

// The interface may only send short chat turns. Anything else is refused or trimmed.
function cleanMessages(list) {
  if (!Array.isArray(list) || list.length === 0 || list.length > 60) {
    throw userError('That message could not be sent. Try again.');
  }
  return list.map((item) => ({
    role: item && item.role === 'assistant' ? 'assistant' : 'user',
    content: item && typeof item.content === 'string' ? item.content.slice(0, 12000) : '',
  }));
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

  // A key is only saved after the provider accepts it.
  handle('keys:add', async ({ key }) => {
    const clean = typeof key === 'string' ? key.trim() : '';
    if (!clean) throw userError('Paste your AI key to connect it.');
    if (clean.length > 300 || /\s/.test(clean)) throw userError('Paste the whole key. It should not contain spaces.');
    const candidates = ai.detectCandidates(clean);
    if (candidates.length === 0) {
      throw userError('We do not recognise this key yet. Try an OpenAI, Anthropic, Gemini, OpenRouter or DeepSeek key.');
    }
    // A key that could belong to two providers is checked with each; the one that accepts it is used.
    let provider = null;
    let models = [];
    let lastError = null;
    for (const candidate of candidates) {
      try {
        models = await ai.listModels(candidate, clean);
        if (models.length > 0) {
          provider = candidate;
          break;
        }
      } catch (error) {
        lastError = error;
      }
    }
    if (!provider) {
      if (candidates.length === 1 && lastError) throw lastError;
      throw userError('This key was not accepted. Check that it is complete and still active.');
    }
    if (models.length === 0) throw userError(`${ai.PROVIDERS[provider].label} did not return any chat models for this key.`);
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
    if (!key) throw userError('Connect this provider first.');
    return ai.listModels(provider, key);
  });

  handle('ai:select', ({ provider, model }) => {
    assertProvider(provider);
    if (!keystore.hasKey(provider)) throw userError('Connect this provider first.');
    if (typeof model !== 'string' || !model || model.length > 200) throw userError('Choose a model from the list.');
    keystore.setSelection({ provider, model });
    return keystore.getSelection();
  });

  handle('ai:complete', async ({ system, messages, json, maxTokens }) => {
    const selection = keystore.getSelection();
    if (!selection) throw userError('Add an AI key in Settings to use this feature.');
    const key = keystore.getKey(selection.provider);
    if (!key) throw userError('Your AI key is missing. Add it again in Settings.');
    const text = await ai.complete(selection.provider, key, selection.model, {
      system: typeof system === 'string' ? system.slice(0, 20000) : '',
      messages: cleanMessages(messages),
      json: Boolean(json),
      maxTokens,
    });
    return { text, provider: selection.provider, model: selection.model };
  });

  handle('ai:transcribe', async ({ audio, mime }) => {
    if (!keystore.hasKey('openai')) throw userError('Add an OpenAI key in Settings to transcribe speaking answers.');
    if (!(audio instanceof ArrayBuffer) || audio.byteLength === 0) throw userError('No recording was found. Try again.');
    if (audio.byteLength > 24 * 1024 * 1024) throw userError('That recording is too long. Try a shorter answer.');
    const type = typeof mime === 'string' && /^audio\/[a-z0-9.+-]{1,40}$/i.test(mime) ? mime : 'audio/webm';
    const text = await ai.transcribe(keystore.getKey('openai'), Buffer.from(audio), type);
    return { text };
  });

  // Offline data: only the actions listed in localdb.cjs are reachable, with a short argument list.
  handle('local:call', ({ method, args }) => {
    if (typeof method !== 'string' || method.length > 40) throw userError('That action is not available right now.');
    if (args !== undefined && (!Array.isArray(args) || args.length > 8)) {
      throw userError('That action is not available right now.');
    }
    return localdb.call(method, args);
  });

  handle('settings:get', () => settings.get());
  handle('settings:set', (patch) => settings.set(patch));

  // The sign-in session is stored encrypted by the operating system.
  handle('session:get', ({ key }) => sessionStore.get(key));
  handle('session:set', ({ key, value }) => sessionStore.set(key, value));
  handle('session:remove', ({ key }) => sessionStore.remove(key));

  handle('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });
  handle('window:toggle-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  handle('window:close', () => {
    if (mainWindow) mainWindow.close();
  });
  handle('window:state', () => ({ maximized: Boolean(mainWindow && mainWindow.isMaximized()) }));

  handle('shell:open', ({ url }) => {
    if (typeof url !== 'string' || !/^https:\/\/\S+$/i.test(url)) throw userError('That link cannot be opened.');
    return shell.openExternal(url);
  });
}

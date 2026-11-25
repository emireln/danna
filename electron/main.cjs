// DANNA desktop shell: custom window frame, tray, offline data, AI keys and secure IPC.
const { app, BrowserWindow, ipcMain, shell, safeStorage, session, protocol, net, Tray, Menu, nativeImage, utilityProcess } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const keystore = require('./keystore.cjs');
const ai = require('./ai.cjs');
const speech = require('./speech.cjs');
const { createLiveSessions } = require('./live.cjs');
const localdb = require('./localdb.cjs');
const settings = require('./settings.cjs');
const { shellLanguage, shellText } = require('./i18n.cjs');
const sessionStore = require('./session.cjs');
const { userError } = require('./errors.cjs');
const { autoUpdater } = require('electron-updater');
const { createUpdates } = require('./updater.cjs');
const kokoro = require('./kokoro.cjs');
const { createSpeechHost } = require('./speech-host.cjs');
const { createWindowsVoices } = require('./winvoices.cjs');
const { createSpeechService } = require('./speech-service.cjs');

// The built-in voice ships with the app (resources/tts/kokoro). In development it is read from the same folder in the project.
const kokoroDir = app.isPackaged ? path.join(process.resourcesPath, 'tts', 'kokoro') : path.join(__dirname, '..', 'resources', 'tts', 'kokoro');
const kokoroEngine = kokoro.createSpeechEngine({ modelDir: kokoroDir });
// The voice runs in a utility process of its own, so loading a voice or making its sound never stalls this process.
const voiceHost = createSpeechHost({
  available: (voice) => kokoroEngine.available(voice),
  fork: () => utilityProcess.fork(path.join(__dirname, 'speech-worker.cjs'), [kokoroDir], { serviceName: 'DANNA voice', stdio: 'ignore' }),
});
const speechService = createSpeechService({
  kokoro: voiceHost,
  windows: createWindowsVoices(),
  cloud: ai,
  hasKey: (provider) => keystore.hasKey(provider),
  getKey: (provider) => keystore.getKey(provider),
});

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

// Installs newer GitHub releases in the background (see electron/updater.cjs).
const updates = createUpdates({
  app,
  updater: autoUpdater,
  send: (channel, payload) => send(channel, payload),
  log: (message) => console.error('DANNA updates:', message),
});

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
    // Only the microphone (speaking practice) and notifications (reminders), and only for DANNA's own pages.
    const allowedPermissions = new Set(['media', 'notifications']);
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const url = webContents ? webContents.getURL() : '';
      callback(allowedPermissions.has(permission) && isAppUrl(url));
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      return allowedPermissions.has(permission) && isAppUrl(requestingOrigin || (webContents ? webContents.getURL() : ''));
    });
    registerIpc();
    createTray();
    createWindow();
    updates.start();
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
    title: 'DANNA',
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
      tray.displayBalloon({ title: 'DANNA', content: shellText(shellLang()).hint });
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
    console.error('DANNA could not load its interface:', error);
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

// The shell's language: the one chosen in the app, else the system language.
function shellLang() {
  return shellLanguage(settings.get().language, app.getLocale());
}

function buildTrayMenu() {
  const text = shellText(shellLang());
  return Menu.buildFromTemplate([
    { label: text.open, click: () => showWindow() },
    {
      label: text.learn,
      click: () => {
        showWindow();
        send('app:navigate', '/');
      },
    },
    {
      label: text.review,
      click: () => {
        showWindow();
        send('app:navigate', '/review');
      },
    },
    { type: 'separator' },
    {
      label: text.quit,
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
}

function createTray() {
  if (tray || !fs.existsSync(TRAY_ICON)) return;
  tray = new Tray(nativeImage.createFromPath(TRAY_ICON));
  tray.setToolTip('DANNA');
  tray.setContextMenu(buildTrayMenu());
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

// The replies being streamed now, by their ids. A reply can be stopped while it is written.
const replyStreams = new Map();

function handle(channel, handler) {
  ipcMain.handle(channel, async (event, payload) => {
    assertTrustedSender(event);
    return handler(payload && typeof payload === 'object' ? payload : {}, event);
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
    content: item && typeof item.content === 'string' ? item.content.slice(0, 24000) : '',
    // The pictures themselves are checked in electron/ai.cjs, where each provider's request is built.
    images: item && Array.isArray(item.images) ? item.images.slice(0, 10) : [],
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
      throw userError('We do not recognize this key yet. Try an OpenAI, Anthropic, Gemini, OpenRouter or DeepSeek key.');
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

  // Keys saved in the account are sealed by the interface before they leave this device, and opened
  // there when they come back. These handlers only move a key between the device and the account.
  handle('keys:export', ({ provider }) => {
    assertProvider(provider);
    const key = keystore.getKey(provider);
    if (!key) throw userError('Connect this provider first.');
    return { key };
  });

  handle('keys:import', ({ provider, key }) => {
    assertProvider(provider);
    const clean = typeof key === 'string' ? key.trim() : '';
    if (!clean || clean.length > 300 || /\s/.test(clean)) {
      throw userError('A key saved in your account could not be opened. Add it again in Settings.');
    }
    keystore.saveKey(provider, clean, 'account');
    return keysState();
  });

  handle('keys:mark-account', ({ provider }) => {
    keystore.setSource(assertProvider(provider), 'account');
    return keysState();
  });

  // Signing out removes the copies that came from the account. Keys added on this device stay.
  handle('keys:forget-account', () => {
    keystore.forgetAccountKeys();
    return keysState();
  });

  // Leaving the account for this device keeps its keys here, as keys of this device.
  handle('keys:release-account', () => {
    keystore.moveSource('account', 'device');
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

  // A reply written piece by piece to the interface. The pieces go to the window that asked, and the interface can
  // stop the reply: the text written so far is kept, and the reply is returned as it stands.
  handle('ai:stream', async ({ id, system, messages, json, maxTokens }, event) => {
    if (typeof id !== 'string' || !/^[\w-]{8,64}$/.test(id)) throw userError('That reply could not be started. Try again.');
    const selection = keystore.getSelection();
    if (!selection) throw userError('Add an AI key in Settings to use this feature.');
    const key = keystore.getKey(selection.provider);
    if (!key) throw userError('Your AI key is missing. Add it again in Settings.');
    const controller = new AbortController();
    replyStreams.set(id, controller);
    try {
      const result = await ai.streamComplete(
        selection.provider,
        key,
        selection.model,
        {
          system: typeof system === 'string' ? system : '',
          messages: cleanMessages(messages),
          json: Boolean(json),
          maxTokens,
        },
        {
          signal: controller.signal,
          onDelta: (text) => {
            if (!event.sender.isDestroyed()) event.sender.send('ai:chunk', { id, text });
          },
        },
      );
      return { ...result, provider: selection.provider, model: selection.model };
    } finally {
      replyStreams.delete(id);
    }
  });

  handle('ai:stop', ({ id }) => {
    const controller = typeof id === 'string' ? replyStreams.get(id) : undefined;
    if (controller) controller.abort();
    return { stopped: Boolean(controller) };
  });

  // Reads a text aloud with the voice the learner chose. The sound comes back through speech:chunk, with the same id,
  // as it is made. The reply says which engine reads, and why a different one may be used.
  handle('speech:start', ({ id, text, voice }, event) => {
    const sender = event.sender;
    return speechService.start({ id, text, choice: voice }, (payload) => {
      if (!sender.isDestroyed()) sender.send('speech:chunk', payload);
    });
  });
  handle('speech:stop', ({ id }) => speechService.stop(id));
  handle('speech:voices', () => speechService.voices());

  // Live talk (electron/live.cjs): the conversation with the Gemini Live API. Microphone frames are sent without a reply,
  // so they use ipcMain.on; each one is checked for its sender like every other channel.
  const live = createLiveSessions({ send, getKey: (provider) => keystore.getKey(provider) });
  handle('live:start', ({ instructions, voice, turnMode, model }) => {
    if (typeof instructions !== 'string' || instructions.length > 12000) throw userError('The coach could not start. Try again.');
    return live.start({ instructions, voice, turnMode, model });
  });
  handle('live:text', ({ text }) => live.sendText(text));
  handle('live:stop', () => live.stop());
  ipcMain.on('live:audio', (event, frame) => {
    try {
      assertTrustedSender(event);
    } catch {
      return;
    }
    live.sendAudio(frame);
  });
  ipcMain.on('live:activity', (event, kind) => {
    try {
      assertTrustedSender(event);
    } catch {
      return;
    }
    live.sendActivity(kind);
  });

  handle('ai:transcribe', async ({ audio, mime }) => {
    const openai = keystore.hasKey('openai');
    if (!openai && !keystore.hasKey('gemini')) throw userError('Add an OpenAI or Gemini key in Settings to transcribe speaking answers.');
    if (!(audio instanceof ArrayBuffer) || audio.byteLength === 0) throw userError('No recording was found. Try again.');
    if (audio.byteLength > 24 * 1024 * 1024) throw userError('That recording is too long. Try a shorter answer.');
    const type = typeof mime === 'string' && /^audio\/[a-z0-9.+-]{1,40}$/i.test(mime) ? mime : 'audio/webm';
    // OpenAI writes the recording down when its key is connected; otherwise Gemini does.
    const text = openai
      ? await ai.transcribe(keystore.getKey('openai'), Buffer.from(audio), type)
      : await ai.transcribeWithGemini(keystore.getKey('gemini'), Buffer.from(audio), type);
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

  handle('update:status', () => updates.status());
  handle('update:check', () => updates.check());
  handle('update:download', () => updates.download());
  handle('update:install', () => updates.install());
  handle('settings:get', () => settings.get());
  handle('settings:set', (patch) => {
    const next = settings.set(patch);
    // The tray menu follows the app's language.
    if (tray && patch && typeof patch === 'object' && Object.hasOwn(patch, 'language')) tray.setContextMenu(buildTrayMenu());
    return next;
  });

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
  handle('window:show', () => showWindow());
  handle('window:state', () => ({ maximized: Boolean(mainWindow && mainWindow.isMaximized()) }));

  handle('shell:open', ({ url }) => {
    if (typeof url !== 'string' || !/^https:\/\/\S+$/i.test(url)) throw userError('That link cannot be opened.');
    return shell.openExternal(url);
  });
}

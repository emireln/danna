// Preload runs in an isolated context. It exposes a small, typed surface to the
// interface and nothing else: no Node APIs, no raw IPC, no keys.
const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, payload) => ipcRenderer.invoke(channel, payload);

const listen = (channel, callback) => {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld(
  'danna',
  Object.freeze({
    info: () => call('app:info'),
    keys: Object.freeze({
      state: () => call('keys:state'),
      add: (key) => call('keys:add', { key }),
      remove: (provider) => call('keys:remove', { provider }),
      models: (provider) => call('ai:models', { provider }),
      select: (provider, model) => call('ai:select', { provider, model }),
    }),
    ai: Object.freeze({
      complete: (request) => call('ai:complete', request),
      transcribe: (audio, mime) => call('ai:transcribe', { audio, mime }),
      speak: (text, voice) => call('ai:speak', { text, voice }),
    }),
    local: Object.freeze({
      call: (method, args) => call('local:call', { method, args }),
    }),
    settings: Object.freeze({
      get: () => call('settings:get'),
      set: (patch) => call('settings:set', patch),
    }),
    session: Object.freeze({
      get: (key) => call('session:get', { key }),
      set: (key, value) => call('session:set', { key, value }),
      remove: (key) => call('session:remove', { key }),
    }),
    window: Object.freeze({
      minimize: () => call('window:minimize'),
      toggleMaximize: () => call('window:toggle-maximize'),
      close: () => call('window:close'),
      state: () => call('window:state'),
      onState: (callback) => listen('window:state', callback),
    }),
    update: Object.freeze({
      status: () => call('update:status'),
      check: () => call('update:check'),
      install: () => call('update:install'),
      onStatus: (callback) => listen('update:status', callback),
    }),
    onNavigate: (callback) => listen('app:navigate', callback),
    openExternal: (url) => call('shell:open', { url }),
  }),
);

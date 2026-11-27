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
      exportKey: (provider) => call('keys:export', { provider }),
      importKey: (provider, key) => call('keys:import', { provider, key }),
      markAccount: (provider) => call('keys:mark-account', { provider }),
      forgetAccount: () => call('keys:forget-account'),
      releaseAccount: () => call('keys:release-account'),
    }),
    ai: Object.freeze({
      complete: (request) => call('ai:complete', request),
      stream: (id, request) => call('ai:stream', { ...request, id }),
      stop: (id) => call('ai:stop', { id }),
      onChunk: (callback) => listen('ai:chunk', callback),
      transcribe: (audio, mime) => call('ai:transcribe', { audio, mime }),
    }),
    speech: Object.freeze({
      start: (id, text, voice) => call('speech:start', { id, text, voice }),
      stop: (id) => call('speech:stop', { id }),
      voices: () => call('speech:voices'),
      onChunk: (callback) => listen('speech:chunk', callback),
    }),
    live: Object.freeze({
      start: (options) => call('live:start', options),
      stop: () => call('live:stop'),
      sendText: (text) => call('live:text', { text }),
      // Audio frames and turn signals are sent without a reply, so they do not wait for one.
      sendAudio: (frame) => ipcRenderer.send('live:audio', frame),
      sendActivity: (kind) => ipcRenderer.send('live:activity', kind),
      onEvent: (callback) => listen('live:event', callback),
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
      show: () => call('window:show'),
      state: () => call('window:state'),
      onState: (callback) => listen('window:state', callback),
    }),
    update: Object.freeze({
      status: () => call('update:status'),
      check: () => call('update:check'),
      download: () => call('update:download'),
      install: () => call('update:install'),
      onStatus: (callback) => listen('update:status', callback),
    }),
    auth: Object.freeze({
      openSignIn: (url) => call('auth:open-sign-in', { url }),
      onCallback: (callback) => listen('auth:callback', callback),
      onRejected: (callback) => listen('auth:rejected', callback),
    }),
    onNavigate: (callback) => listen('app:navigate', callback),
    openExternal: (url) => call('shell:open', { url }),
  }),
);

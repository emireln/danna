// Preload runs in an isolated context. It exposes a small, typed surface to the
// interface and nothing else: no Node APIs, no raw IPC, no keys.
const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, payload) => ipcRenderer.invoke(channel, payload);

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
    }),
    openExternal: (url) => call('shell:open', { url }),
  }),
);

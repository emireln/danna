// Encrypted storage for AI provider keys.
// Keys are encrypted with the operating-system keychain (Windows DPAPI through
// Electron safeStorage) and are only decrypted inside the main process.
const { app, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

function filePath() {
  return path.join(app.getPath('userData'), 'danna-ai.json');
}

function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath(), 'utf8'));
    return {
      connections: parsed.connections && typeof parsed.connections === 'object' ? parsed.connections : {},
      selection: parsed.selection && parsed.selection.provider ? parsed.selection : null,
    };
  } catch {
    return { connections: {}, selection: null };
  }
}

function writeState(state) {
  const target = filePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, target);
}

function maskKey(key) {
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

function assertEncryption() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage is unavailable on this device, so danna will not save API keys.');
  }
}

function listConnections() {
  const { connections } = readState();
  return Object.entries(connections).map(([provider, entry]) => ({
    provider,
    masked: entry.masked,
    addedAt: entry.addedAt,
  }));
}

function hasKey(provider) {
  return Boolean(readState().connections[provider]);
}

function getKey(provider) {
  const entry = readState().connections[provider];
  if (!entry) return null;
  return safeStorage.decryptString(Buffer.from(entry.enc, 'base64'));
}

function saveKey(provider, key) {
  assertEncryption();
  const state = readState();
  state.connections[provider] = {
    enc: safeStorage.encryptString(key).toString('base64'),
    masked: maskKey(key),
    addedAt: new Date().toISOString(),
  };
  writeState(state);
}

function removeKey(provider) {
  const state = readState();
  delete state.connections[provider];
  if (state.selection && state.selection.provider === provider) state.selection = null;
  writeState(state);
}

function getSelection() {
  return readState().selection;
}

function setSelection(selection) {
  const state = readState();
  state.selection = selection;
  writeState(state);
}

module.exports = {
  listConnections,
  hasKey,
  getKey,
  saveKey,
  removeKey,
  getSelection,
  setSelection,
};

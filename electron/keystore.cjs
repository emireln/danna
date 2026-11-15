// Encrypted storage for AI provider keys on this device.
// Keys are encrypted with the operating-system keychain (Windows DPAPI through
// Electron safeStorage) and are only decrypted inside the main process.
// A key comes from this device ("device") or is a copy of a key saved in the signed-in account
// ("account"). Account copies are removed when the account is signed out of.
const { app, safeStorage } = require('electron');
const { userError } = require('./errors.cjs');
const fs = require('node:fs');
const path = require('node:path');

const SOURCES = ['device', 'account'];

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
    throw userError('We could not save your key on this device.');
  }
}

// Keys saved before the source was recorded were added on this device.
function sourceOf(entry) {
  return entry.source === 'account' ? 'account' : 'device';
}

function listConnections() {
  const { connections } = readState();
  return Object.entries(connections).map(([provider, entry]) => ({
    provider,
    masked: entry.masked,
    addedAt: entry.addedAt,
    source: sourceOf(entry),
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

function saveKey(provider, key, source = 'device') {
  assertEncryption();
  const state = readState();
  state.connections[provider] = {
    enc: safeStorage.encryptString(key).toString('base64'),
    masked: maskKey(key),
    addedAt: new Date().toISOString(),
    source: SOURCES.includes(source) ? source : 'device',
  };
  writeState(state);
}

// Changes where one key came from: 'account' once it is saved in the account, 'device' otherwise.
function setSource(provider, source) {
  const state = readState();
  if (state.connections[provider] && SOURCES.includes(source)) {
    state.connections[provider].source = source;
    writeState(state);
  }
}

// Moves every key of one source to the other, for example when the device keeps the keys it had
// from the account after leaving the account.
function moveSource(from, to) {
  const state = readState();
  let changed = false;
  for (const entry of Object.values(state.connections)) {
    if (sourceOf(entry) === from) {
      entry.source = to;
      changed = true;
    }
  }
  if (changed) writeState(state);
}

// Removes the copies that came from the account. The keys stay saved in the account itself.
function forgetAccountKeys() {
  const state = readState();
  let changed = false;
  for (const [provider, entry] of Object.entries(state.connections)) {
    if (sourceOf(entry) === 'account') {
      delete state.connections[provider];
      if (state.selection && state.selection.provider === provider) state.selection = null;
      changed = true;
    }
  }
  if (changed) writeState(state);
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
  setSource,
  moveSource,
  forgetAccountKeys,
  removeKey,
  getSelection,
  setSelection,
};

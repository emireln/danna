// The sign-in session for an online account. It is encrypted with the operating system
// (safeStorage: Windows DPAPI), so the tokens are never stored in plain text on disk.
// If encryption is not available, nothing is saved and the person signs in again next time.
const { app, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { userError } = require('./errors.cjs');

const KEY_PATTERN = /^danna\.[a-z]{2,30}$/;
const MAX_VALUE_LENGTH = 64 * 1024;

function file() {
  return path.join(app.getPath('userData'), 'danna-session.bin');
}

function readAll() {
  if (!safeStorage.isEncryptionAvailable()) return {};
  try {
    const parsed = JSON.parse(safeStorage.decryptString(fs.readFileSync(file())));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(values) {
  if (!safeStorage.isEncryptionAvailable()) return false;
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), safeStorage.encryptString(JSON.stringify(values)));
  return true;
}

function checkKey(key) {
  if (typeof key !== 'string' || !KEY_PATTERN.test(key)) throw new Error('Unknown session value.');
  return key;
}

function get(key) {
  const value = readAll()[checkKey(key)];
  return typeof value === 'string' ? value : null;
}

function set(key, value) {
  checkKey(key);
  if (typeof value !== 'string' || value.length > MAX_VALUE_LENGTH) throw userError('That sign-in data is too large to keep.');
  const values = readAll();
  values[key] = value;
  return writeAll(values);
}

function remove(key) {
  checkKey(key);
  const values = readAll();
  delete values[key];
  if (Object.keys(values).length === 0) fs.rmSync(file(), { force: true });
  else writeAll(values);
}

module.exports = { get, set, remove };

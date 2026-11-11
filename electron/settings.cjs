// Small app preferences, kept in the app's data folder.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = { closeToTray: true };

function file() {
  return path.join(app.getPath('userData'), 'danna-settings.json');
}

function get() {
  const result = { ...DEFAULTS };
  try {
    const stored = JSON.parse(fs.readFileSync(file(), 'utf8'));
    for (const key of Object.keys(DEFAULTS)) {
      if (typeof stored[key] === typeof DEFAULTS[key]) result[key] = stored[key];
    }
  } catch {
    // First launch: defaults apply.
  }
  return result;
}

function set(patch = {}) {
  const next = get();
  for (const key of Object.keys(DEFAULTS)) {
    if (patch && typeof patch[key] === typeof DEFAULTS[key]) next[key] = patch[key];
  }
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

module.exports = { get, set };

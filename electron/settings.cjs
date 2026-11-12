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
  // Written to a temporary file first, so a crash cannot leave a half-written settings file behind.
  const tmp = `${file()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmp, file());
  return next;
}

module.exports = { get, set };

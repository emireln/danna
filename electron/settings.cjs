// Small app preferences, kept in the app's data folder.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = { closeToTray: true, language: null };

// Each setting has its own check, so a bad value in the file is ignored. A null language follows the system.
const VALID = {
  closeToTray: (value) => typeof value === 'boolean',
  language: (value) => value === null || value === 'en' || value === 'pt',
};

function file() {
  return path.join(app.getPath('userData'), 'danna-settings.json');
}

function get() {
  const result = { ...DEFAULTS };
  try {
    const stored = JSON.parse(fs.readFileSync(file(), 'utf8'));
    for (const key of Object.keys(DEFAULTS)) {
      if (VALID[key](stored[key])) result[key] = stored[key];
    }
  } catch {
    // First launch: defaults apply.
  }
  return result;
}

function set(patch = {}) {
  const next = get();
  for (const key of Object.keys(DEFAULTS)) {
    if (patch && VALID[key](patch[key])) next[key] = patch[key];
  }
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  // Written to a temporary file first, so a crash cannot leave a half-written settings file behind.
  const tmp = `${file()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmp, file());
  return next;
}

module.exports = { get, set };

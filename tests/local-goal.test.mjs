// Tests the local database upgrade. A database from before 0.4.0 keeps the TOEFL track, a new one
// starts as General English, and the level A1 is accepted. The app's database module runs without
// Electron: a stand-in for the app folder is put in place before the module is loaded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const localdbPath = join(here, '..', 'electron', 'localdb.cjs');
const electronPath = require.resolve('electron');

// The profile table as it was before 0.4.0: the same columns, without the goal.
const LEGACY_PROFILE = `CREATE TABLE profile (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_color TEXT NOT NULL DEFAULT '#2f6bff',
  target_score INTEGER NOT NULL DEFAULT 100,
  exam_date TEXT,
  daily_minutes INTEGER NOT NULL DEFAULT 15,
  level TEXT NOT NULL DEFAULT 'B1',
  xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_active TEXT,
  onboarding_done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);`;

// Loads the module fresh, with the app folder set to `folder`.
function loadLocalDb(folder) {
  require.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: { app: { getPath: () => folder } },
  };
  delete require.cache[localdbPath];
  return require(localdbPath);
}

function tempFolder() {
  return mkdtempSync(join(tmpdir(), 'danna-goal-'));
}

// Windows keeps the database file open while the process runs, so cleanup is best effort.
function removeQuietly(folder) {
  try {
    rmSync(folder, { recursive: true, force: true });
  } catch {
    // The system cleans up the temporary folder later.
  }
}

test('a database from before 0.4.0 keeps the TOEFL track when it opens', () => {
  const folder = tempFolder();
  try {
    const old = new DatabaseSync(join(folder, 'danna.db'));
    old.exec(LEGACY_PROFILE);
    old
      .prepare(
        "INSERT INTO profile (id, username, display_name, level, onboarding_done, created_at) VALUES ('p1', 'learner', 'Ana', 'B2', 1, '2026-10-01T00:00:00Z')",
      )
      .run();
    old.close();

    const local = loadLocalDb(folder);
    const profile = local.call('getProfile');
    assert.equal(profile.goal, 'toefl');
    assert.equal(profile.level, 'B2');
    assert.equal(local.call('updateProfile', [{ goal: 'english' }]).goal, 'english', 'the learner can switch');
  } finally {
    removeQuietly(folder);
  }
});

test('a new database starts as General English, and A1 is a level', () => {
  const folder = tempFolder();
  try {
    const local = loadLocalDb(folder);
    assert.equal(local.call('getProfile').goal, 'english');
    assert.equal(local.call('updateProfile', [{ level: 'A1' }]).level, 'A1');
    assert.equal(local.call('updateProfile', [{ goal: 'toefl' }]).goal, 'toefl');
    assert.equal(local.call('updateProfile', [{ goal: 'other' }]).goal, 'toefl', 'an unknown goal is ignored');
  } finally {
    removeQuietly(folder);
  }
});

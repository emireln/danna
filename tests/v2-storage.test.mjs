// The look and the XP of each run, on the desktop database (electron/localdb.cjs) in a real SQLite file.
// The look is one of two values and an unknown look is refused. Each run keeps the XP it earned, and XP is
// never below zero. tests/data-parity.test.mjs runs the same calls on the browser preview too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const localdbPath = join(here, '..', 'electron', 'localdb.cjs');
const electronPath = require.resolve('electron');

// A fresh database in its own folder, loaded the way the app loads it.
function withDatabase(use) {
  const folder = mkdtempSync(join(tmpdir(), 'danna-v2-'));
  require.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: { app: { getPath: () => folder } },
  };
  delete require.cache[localdbPath];
  try {
    return use(require(localdbPath));
  } finally {
    // Windows keeps the file open while the process runs, so cleanup is best effort.
    try {
      rmSync(folder, { recursive: true, force: true });
    } catch {
      // The system cleans up the temporary folder later.
    }
  }
}

const sampleRun = (overrides = {}) => ({
  kind: 'practice',
  ref_id: 'flashcards',
  title: 'Flashcards',
  score_pct: 80,
  predicted: null,
  skills: {},
  answers: [],
  duration_s: 60,
  created_at: '2026-03-01T10:00:00.000Z',
  ...overrides,
});

test('the look is one of two values, and an unknown look is refused', () => {
  withDatabase((local) => {
    assert.equal(local.call('getProfile').ui_style, 'classic');
    assert.equal(local.call('updateProfile', [{ ui_style: 'playful' }]).ui_style, 'playful');
    assert.equal(local.call('updateProfile', [{ ui_style: 'neon' }]).ui_style, 'playful');
    assert.equal(local.call('getProfile').ui_style, 'playful');
  });
});

test('each run keeps its XP, and XP is never below zero', () => {
  withDatabase((local) => {
    assert.equal(local.call('insertAttempt', [sampleRun({ id: 'run-1', xp: 42 })]).xp, 42);
    assert.equal(local.call('insertAttempt', [sampleRun({ id: 'run-2', xp: -9 })]).xp, 0);
    assert.equal(local.call('insertAttempt', [sampleRun({ id: 'run-3' })]).xp, 0);
    assert.equal(local.call('getAttempt', ['run-1']).xp, 42);
  });
});

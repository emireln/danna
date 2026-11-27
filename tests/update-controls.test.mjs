// The update controls. The title bar has no download or update button. The check is in Settings, and the pop-up about a
// new version offers the download and the restart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

test('the title bar has no download or update button', () => {
  const titlebar = read('src', 'components', 'TitleBar.tsx');
  assert.doesNotMatch(titlebar, /UpdateButton|useUpdateStatus|bridge\.update/, 'the title bar does not offer updates');
  assert.equal(existsSync(join(root, 'src', 'components', 'UpdateButton.tsx')), false, 'the title bar button file is gone');
});

test('Settings keeps the whole update flow: the check, the download and the restart', () => {
  const settings = read('src', 'screens', 'SettingsScreen.tsx');
  assert.match(settings, /t\('Check for updates'\)/);
  assert.match(settings, /t\('Download update'\)/);
  assert.match(settings, /t\('Restart to update'\)/);
  assert.match(settings, /bridge\?\.update\.download\(\)/);
  assert.match(settings, /bridge\?\.update\.install\(\)/);
});

test('the pop-up about a new version offers the download and the restart, not the title bar', () => {
  const notice = read('src', 'components', 'UpdateNotice.tsx');
  assert.doesNotMatch(notice, /title bar/i);
  assert.match(notice, /t\('Download update'\)/);
  assert.match(notice, /t\('Restart to update'\)/);
  assert.match(notice, /bridge\?\.update\.download\(\)/);
  assert.match(notice, /bridge\?\.update\.install\(\)/);
});

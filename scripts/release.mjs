// Publishes the current version to GitHub. The installer is attached to a release named after
// the version (tag v<version>), with the commit messages since the previous release as notes.
// Run it after the commit has been pushed: npm run release
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const tag = `v${version}`;
const installer = join(root, 'release', `danna-setup-${version}-x64.exe`);
// electron-builder writes these next to the installer. The app reads latest.yml to find a newer version,
// and the blockmap lets it download only the changed parts.
const updateInfo = join(root, 'release', 'latest.yml');
const blockmap = `${installer}.blockmap`;

const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gh = (args) => execFileSync('gh', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

if (git(['status', '--porcelain']) !== '') {
  throw new Error('Commit or stash your changes first: the release must match a pushed commit.');
}
// Tags are fetched too: the notes start from the previous release tag, which a fresh clone may not have yet.
git(['fetch', '--tags', 'origin', 'main']);
const head = git(['rev-parse', 'HEAD']);
if (head !== git(['rev-parse', 'origin/main'])) {
  throw new Error('Push the commit to origin/main first (git push origin main).');
}

try {
  gh(['release', 'view', tag]);
  throw new Error(`A release named ${tag} already exists on GitHub.`);
} catch (error) {
  if (String(error.message).includes('already exists')) throw error;
  // Not published yet: continue.
}

if (!existsSync(installer) || !existsSync(updateInfo) || !existsSync(blockmap)) {
  console.log(`Building ${installer} ...`);
  execSync('npm run dist', { cwd: root, stdio: 'inherit' });
}
for (const file of [installer, updateInfo, blockmap]) {
  if (!existsSync(file)) throw new Error(`Missing ${file} after the build.`);
}

let range = 'HEAD~30..HEAD';
try {
  const previous = git(['describe', '--tags', '--abbrev=0', '--match', 'v*']);
  range = `${previous}..HEAD`;
} catch {
  // No earlier release: the last 30 commits are used.
}
const notes = git(['log', range, '--pretty=- %s']) || '- Maintenance release.';

console.log(`Publishing ${tag} from ${head.slice(0, 7)} ...`);
const url = gh([
  'release',
  'create',
  tag,
  installer,
  updateInfo,
  blockmap,
  '--target',
  head,
  '--title',
  `danna ${version}`,
  '--notes',
  `${notes}\n\nWindows installer: danna-setup-${version}-x64.exe`,
]);
console.log(`Released: ${url}`);

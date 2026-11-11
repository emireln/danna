// Bumps the app version. It runs as a pre-commit hook (see .husky/pre-commit):
//  - On every commit the patch number goes up by one, and the new version is staged.
//  - If the commit already changes the version by hand, that version is kept.
//  - Manual bumps: `npm run bump -- minor` or `npm run bump -- major` (lower numbers reset).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE = join(root, 'package.json');
const LOCK = join(root, 'package-lock.json');

const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function bump(version, part) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (part === 'major') return `${major + 1}.0.0`;
  if (part === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function writeVersion(next) {
  const pkg = JSON.parse(readFileSync(PACKAGE, 'utf8'));
  pkg.version = next;
  writeFileSync(PACKAGE, `${JSON.stringify(pkg, null, 2)}\n`);

  const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
  lock.version = next;
  if (lock.packages && lock.packages['']) lock.packages[''].version = next;
  writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
}

const argument = process.argv[2];

if (argument === 'minor' || argument === 'major') {
  const current = JSON.parse(readFileSync(PACKAGE, 'utf8')).version;
  const next = bump(current, argument);
  writeVersion(next);
  console.log(`Version ${current} -> ${next}. Commit it; later commits keep counting from here.`);
} else {
  let committed = null;
  try {
    committed = JSON.parse(git(['show', 'HEAD:package.json'])).version;
  } catch {
    // No commit yet: nothing to compare with.
  }
  const staged = JSON.parse(git(['show', ':package.json'])).version;

  if (committed === null) {
    console.log(`First commit: version ${staged} is kept.`);
  } else if (staged !== committed) {
    console.log(`Version ${staged} is kept for this commit.`);
  } else {
    const next = bump(staged, 'patch');
    writeVersion(next);
    execFileSync('git', ['add', 'package.json', 'package-lock.json'], { cwd: root });
    console.log(`Version ${staged} -> ${next}`);
  }
}

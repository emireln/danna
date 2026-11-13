// Tests saving the text of a library file on the desktop database (electron/localdb.cjs): a TXT or Markdown
// file keeps its name and place, the tutor reads the new text, and a PDF keeps its own pages.
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
const folders = [];

// A fresh desktop database in its own folder, loaded the way the app loads it.
function freshDatabase() {
  const folder = mkdtempSync(join(tmpdir(), 'danna-edit-'));
  folders.push(folder);
  require.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: { app: { getPath: () => folder } },
  };
  delete require.cache[localdbPath];
  return require(localdbPath);
}

const bytesOf = (text) => new TextEncoder().encode(text).buffer;

test('a text file keeps its name and place when its text is saved, and the tutor reads the new text', () => {
  const local = freshDatabase();
  const file = local.call('insertLibraryFile', [{ name: 'Notes.md', kind: 'md', data: bytesOf('# Old\n'), extracted_text: '# Old\n', pages: null }]);
  const next = '# New\n\nMore words.';
  const saved = local.call('updateLibraryFile', [file.id, { data: bytesOf(next), extracted_text: next }]);
  assert.equal(saved.id, file.id);
  assert.equal(saved.name, 'Notes.md');
  assert.equal(saved.kind, 'md');
  assert.equal(saved.size_bytes, Buffer.byteLength(next));
  assert.equal(local.call('getLibraryText', [file.id]), next);
  assert.equal(local.call('listLibraryFiles', []).length, 1, 'no copy is made');
});

test('an empty text is refused, and the file keeps its text', () => {
  const local = freshDatabase();
  const file = local.call('insertLibraryFile', [{ name: 'Plain.txt', kind: 'txt', data: bytesOf('words'), extracted_text: 'words', pages: null }]);
  assert.throws(() => local.call('updateLibraryFile', [file.id, { data: bytesOf(''), extracted_text: '' }]), /is empty/);
  assert.equal(local.call('getLibraryText', [file.id]), 'words');
});

test('a PDF keeps its pages, so saving changes to it is refused', () => {
  const local = freshDatabase();
  const pdf = local.call('insertLibraryFile', [{ name: 'Unit.pdf', kind: 'pdf', data: bytesOf('%PDF-1.4'), extracted_text: 'Hello', pages: 1 }]);
  assert.throws(() => local.call('updateLibraryFile', [pdf.id, { data: bytesOf('x'), extracted_text: 'x' }]), /A PDF keeps its pages/);
  assert.equal(local.call('getLibraryText', [pdf.id]), 'Hello', 'the text is not changed');
});

test('a file that is no longer in the library, or a text larger than 20 MB, is refused with the reason', () => {
  const local = freshDatabase();
  assert.throws(() => local.call('updateLibraryFile', ['missing', { data: bytesOf('x'), extracted_text: 'x' }]), /no longer in your library/);
  const file = local.call('insertLibraryFile', [{ name: 'Notes.txt', kind: 'txt', data: bytesOf('a'), extracted_text: 'a', pages: null }]);
  assert.throws(
    () => local.call('updateLibraryFile', [file.id, { data: new ArrayBuffer(20 * 1024 * 1024 + 1), extracted_text: '' }]),
    /too large/,
  );
});

test.after(() => {
  for (const folder of folders) {
    try {
      rmSync(folder, { recursive: true, force: true });
    } catch {
      // The system cleans up the temporary folder later.
    }
  }
});

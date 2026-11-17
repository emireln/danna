// Tests the coach's chat names, the files it accepts and their limits (src/lib/coach.ts), and the rules
// that keep a chat name and the names of a message's files valid (src/lib/data/rules.ts).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { MAX_FILES, attachmentsOf, fileKind, titleFromQuestion } from '../src/lib/coach.ts';
import { fileURLToPath } from 'node:url';

// The chat rules are loaded through Vite, as the app loads them: they import the bridge without a file extension.
const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let cleanAttachments;
let cleanChatTitle;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  ({ cleanAttachments, cleanChatTitle } = await server.ssrLoadModule('/src/lib/data/rules.ts'));
});

after(async () => {
  await server?.close();
});

test('a chat is named from its first question: the first sentence, at most five words, in the same language', () => {
  assert.equal(titleFromQuestion('  Explain   the   past  simple, please. '), 'Explain the past simple');
  assert.equal(titleFromQuestion('How do I use the present perfect with ever and never?'), 'How do I use');
  assert.equal(titleFromQuestion('wassup mate'), 'Wassup mate', 'the first letter is a capital');
  assert.equal(titleFromQuestion('Hello there'), 'Hello there');
  assert.equal(titleFromQuestion('notes.pdf, chapter-2.pdf'), 'Notes.pdf, chapter-2.pdf', 'a file name keeps its dot');
  assert.equal(titleFromQuestion('?!'), '', 'a question with no words gives no name');
  assert.equal(titleFromQuestion(''), '');
});

test('a chat name is one clean line of at most 120 characters, and an empty name clears it', () => {
  assert.equal(cleanChatTitle('  Verb \n tenses  '), 'Verb tenses');
  assert.equal(cleanChatTitle('   '), null);
  assert.equal(cleanChatTitle(undefined), null);
  assert.equal(cleanChatTitle('a'.repeat(200)).length, 120);
});

test('the files a message carries are pictures, PDF, TXT and Markdown, and nothing else', () => {
  assert.equal(fileKind({ name: 'photo.JPG', type: 'image/jpeg' }), 'image');
  assert.equal(fileKind({ name: 'scan', type: 'image/webp' }), 'image');
  assert.equal(fileKind({ name: 'unit.pdf', type: '' }), 'pdf');
  assert.equal(fileKind({ name: 'notes.md', type: '' }), 'text');
  assert.equal(fileKind({ name: 'notes.txt', type: 'text/plain' }), 'text');
  assert.equal(fileKind({ name: 'sheet.xlsx', type: 'application/vnd.ms-excel' }), null);
  assert.equal(fileKind({ name: 'icon.svg', type: 'image/svg+xml' }), null);
  assert.equal(MAX_FILES, 10);
});

test('a message keeps the names, kinds and sizes of its files, not their contents', () => {
  const files = [
    { key: 'a', kind: 'document', name: 'notes.txt', size: 12, text: 'hello' },
    { key: 'b', kind: 'library', name: 'Unit 3.pdf', size: 900, fileId: 'f1' },
  ];
  assert.deepEqual(attachmentsOf(files), [
    { name: 'notes.txt', kind: 'document', size: 12 },
    { name: 'Unit 3.pdf', kind: 'library', size: 900 },
  ]);
});

test('stored file names are short, valid kinds, whole sizes, and at most ten', () => {
  assert.deepEqual(
    cleanAttachments([
      { name: '  notes.pdf  ', kind: 'document', size: 42.6 },
      { name: '', kind: 'image' },
      null,
      { name: 'x'.repeat(200), kind: 'unknown' },
    ]),
    [
      { name: 'notes.pdf', kind: 'document', size: 43 },
      { name: 'x'.repeat(160), kind: 'document', size: 0 },
    ],
  );
  assert.equal(cleanAttachments(Array.from({ length: 14 }, (_, index) => ({ name: `f${index}`, kind: 'image', size: 1 }))).length, 10);
  assert.deepEqual(cleanAttachments('not a list'), []);
});

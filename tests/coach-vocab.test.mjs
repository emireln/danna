// Tests the vocabulary cards of the coach: the example is blanked at its word, a word inside a longer word is not
// taken, and the review item saved from a card is a gap whose answer is the word.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let vocab;
let grading;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  vocab = await server.ssrLoadModule('/src/lib/coachVocab.ts');
  grading = await server.ssrLoadModule('/src/lib/grading.ts');
});

after(async () => {
  await server?.close();
});

test('the example is blanked at its word, keeping the capitals and the ending of the sentence', () => {
  assert.equal(vocab.vocabCloze({ word: 'reliable', meaning: 'can be trusted', example: 'Reliable friends are rare.', note: '' }), '{{Reliable}} friends are rare.');
  assert.equal(vocab.vocabCloze({ word: 'reliable', meaning: 'can be trusted', example: 'She is very reliable.', note: '' }), 'She is very {{reliable}}.');
});

test('a word inside a longer word is not taken, and an example without the word cannot be kept', () => {
  assert.equal(vocab.vocabCloze({ word: 'run', meaning: '', example: 'She is running fast.', note: '' }), null);
  assert.equal(vocab.vocabCloze({ word: 'run', meaning: '', example: 'The run was long.', note: '' }), 'The {{run}} was long.');
  assert.equal(vocab.vocabCloze({ word: 'reliable', meaning: '', example: 'Trust her.', note: '' }), null);
  assert.equal(vocab.vocabReview({ word: 'reliable', meaning: '', example: 'Trust her.', note: '' }), null);
});

test('the review item saved from a card is a gap whose answer is the word, and the review grades it', () => {
  const row = vocab.vocabReview({ word: 'Reliable', meaning: 'can be trusted', example: 'She is reliable.', note: '' }, new Date('2026-11-17T09:00:00Z'));
  assert.equal(row.item_key, 'coach-vocab:reliable');
  assert.equal(row.skill, 'language');
  assert.equal(row.payload.question.type, 'cloze');
  assert.equal(row.payload.question.explanation, 'can be trusted');
  assert.deepEqual(grading.clozeAnswers(row.payload.question.text), ['reliable']);
  assert.equal(grading.gradeCloze(row.payload.question, ['RELIABLE.']).fraction, 1, 'the answer ignores capitals and the final full stop');
  assert.equal(grading.gradeCloze(row.payload.question, ['trustworthy']).fraction, 0);
});

test('the same word is kept once, whatever its capitals and spaces', () => {
  assert.equal(vocab.vocabKey('Reliable'), vocab.vocabKey('  reliable '));
  assert.equal(vocab.vocabKey('Ice   cream'), 'coach-vocab:ice cream');
});

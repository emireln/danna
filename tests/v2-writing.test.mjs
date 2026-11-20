// The writing check (2.0.0): a reply from the model is checked before it is used. A wrong position is found by its
// words, an invented or ambiguous issue is dropped, overlaps keep the first, and the local rules find the basics.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
let server;
let parseCheck;
let localCheck;
let applyIssue;
let wordCount;
let writingCheckRequest;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  ({ parseCheck, localCheck, applyIssue, wordCount, writingCheckRequest } = await server.ssrLoadModule('/src/lib/writingCheck.ts'));
});

after(async () => {
  await server?.close();
});

const TEXT = 'I goes to school every day. It is definately fun.';

test('a reply from the model keeps the issues whose words are where it says', () => {
  const reply = {
    score: 72,
    tone: 'friendly',
    summary: '  Mostly clear.  ',
    issues: [
      { start: 2, end: 6, original: 'goes', suggestion: 'go', category: 'grammar', reason: 'Use the base form after "I".' },
      { start: 30, end: 40, original: 'definately', suggestion: 'definitely', category: 'spelling', reason: 'Spelling.' },
    ],
  };
  const result = parseCheck(reply, TEXT);
  assert.equal(result.score, 72);
  assert.equal(result.tone, 'friendly');
  assert.equal(result.summary, 'Mostly clear.');
  assert.equal(result.byModel, true);
  assert.deepEqual(
    result.issues.map((issue) => [issue.original, issue.suggestion, issue.category]),
    [
      ['goes', 'go', 'grammar'],
      ['definately', 'definitely', 'spelling'],
    ],
  );
});

test('an issue with the wrong position is found by its words, when they appear once', () => {
  const result = parseCheck({ issues: [{ start: 0, end: 3, original: 'definately', suggestion: 'definitely', category: 'spelling', reason: '' }] }, TEXT);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].start, TEXT.indexOf('definately'));
});

test('an invented issue, and one whose words appear twice, are dropped', () => {
  const invented = parseCheck({ issues: [{ start: 0, end: 4, original: 'banana', suggestion: 'apple', category: 'spelling', reason: '' }] }, TEXT);
  assert.equal(invented.issues.length, 0);
  const ambiguous = parseCheck({ issues: [{ start: 40, end: 41, original: 'a', suggestion: 'the', category: 'grammar', reason: '' }] }, 'a cat and a dog');
  assert.equal(ambiguous.issues.length, 0, 'a position that is wrong, for words that appear twice, cannot say which one is meant');
});

test('overlapping issues keep the first; unknown categories become grammar; unknown tones become neutral', () => {
  const reply = {
    score: 999,
    tone: 'angry',
    issues: [
      { start: 2, end: 6, original: 'goes', suggestion: 'go', category: 'nonsense', reason: '' },
      { start: 2, end: 10, original: 'goes to', suggestion: 'go to', category: 'grammar', reason: '' },
    ],
  };
  const result = parseCheck(reply, TEXT);
  assert.equal(result.score, 100, 'the score is kept in range');
  assert.equal(result.tone, 'neutral');
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].category, 'grammar');
});

test('a reply that is not an object is refused, and a huge list is cut to the limit', () => {
  assert.throws(() => parseCheck('not json', TEXT), /right form/);
  const many = Array.from({ length: 200 }, (_, index) => ({ original: `w${index}`, suggestion: 'x', category: 'grammar', reason: '' }));
  const text = Array.from({ length: 200 }, (_, index) => `w${index}`).join(' ');
  assert.ok(parseCheck({ issues: many }, text).issues.length <= 25);
  assert.equal(parseCheck({ issues: 'not a list' }, TEXT).issues.length, 0);
});

test('text inside a reason is kept as plain text, never as markup', () => {
  const result = parseCheck({ issues: [{ start: 0, end: 1, original: 'I', suggestion: 'I', category: 'grammar', reason: '<img src=x onerror=alert(1)>' }] }, 'I am');
  assert.equal(result.issues[0].reason, '<img src=x onerror=alert(1)>');
});

test('the local rules find the basics: lowercase I, a contraction, a repeated word, double spaces and a capital', () => {
  const result = localCheck('i dont know, the the  cat is here. it is fine');
  const found = result.issues.map((issue) => issue.suggestion);
  assert.ok(found.includes('I'), 'a lone i');
  assert.ok(found.includes("don't"), 'a contraction without its apostrophe');
  assert.ok(found.includes('the'), 'a repeated word');
  assert.ok(found.includes(' '), 'double spaces');
  assert.ok(found.includes('. I'), 'a sentence start keeps its full stop and gets a capital on its first letter');
  assert.equal(result.byModel, false);
  assert.equal(result.tone, null);
  assert.ok(result.score < 100);
});

test('the local rules do not touch a clean text, or a word that only contains an i', () => {
  const clean = localCheck('I like the ideas in this text, and I think they are clear.');
  assert.equal(clean.issues.length, 0);
  assert.equal(clean.score, 100);
});

test('applying a fix moves the issues after it, and drops any that no longer match', () => {
  const first = { start: 0, end: 1, original: 'i', suggestion: 'I', category: 'grammar', reason: '' };
  const second = { start: 7, end: 11, original: 'dont', suggestion: "don't", category: 'punctuation', reason: '' };
  const text = 'i think dont';
  const applied = applyIssue(text, first, [first, { ...second, start: 8, end: 12 }]);
  assert.equal(applied.text, 'I think dont');
  assert.equal(applied.issues.length, 1);
  assert.equal(applied.issues[0].original, 'dont');
  assert.equal(applied.issues[0].start, 8);
});

test('the request asks for one JSON object and the language of the reply', () => {
  const request = writingCheckRequest('I goes home.', 'Portuguese');
  assert.match(request.system, /one JSON object only/);
  assert.match(request.system, /in Portuguese/);
  assert.match(request.prompt, /I goes home\./);
});

test('word counts ignore spaces around the text', () => {
  assert.equal(wordCount('  one two  three '), 3);
  assert.equal(wordCount('   '), 0);
});

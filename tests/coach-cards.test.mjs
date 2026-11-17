// Tests the cards of the coach's replies beyond exercises: the feedback on a text, the vocabulary cards, the actions
// that send the learner to a practice in the app, and how the cards keep their order around the text.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let reply;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  reply = await server.ssrLoadModule('/src/lib/coachReply.ts');
});

after(async () => {
  await server?.close();
});

test('a feedback card reads its scores, its corrections and its model version, and drops what cannot be used', () => {
  const text = [
    'Here is my check.',
    '```feedback',
    '{"title":"Your email","scores":[{"label":"Task","score":4.2},{"label":"Grammar","score":3},{"label":"","score":2}],"summary":"Clear and polite.",',
    '"corrections":[{"before":"I am agree","after":"I agree","why":"Agree is a verb."},{"before":"same","after":"same","why":"no change"}],',
    '"model":"Dear Ana,\\nThank you for the offer."}',
    '```',
  ].join('\n');
  const [, card] = reply.parseCoachReply(text);
  assert.equal(card.kind, 'feedback');
  assert.equal(card.feedback.title, 'Your email');
  assert.deepEqual(card.feedback.scores, [
    { label: 'Task', score: 4 },
    { label: 'Grammar', score: 3 },
  ], 'scores round to halves, and a score with no label is dropped');
  assert.deepEqual(card.feedback.corrections, [{ before: 'I am agree', after: 'I agree', why: 'Agree is a verb.' }], 'a correction that changes nothing is dropped');
  assert.equal(card.feedback.summary, 'Clear and polite.');
  assert.equal(card.feedback.model, 'Dear Ana,\nThank you for the offer.', 'the model version keeps its line breaks');
});

test('a feedback card with nothing in it is left out, and so is a card with no usable part', () => {
  assert.deepEqual(reply.parseCoachReply('```feedback\n{"scores":[],"corrections":[]}\n```'), []);
  assert.deepEqual(reply.parseCoachReply('```feedback\n{"scores":[{"label":"Task"}]}\n```'), []);
});

test('a vocabulary card keeps up to eight words, each with a meaning, and drops a word that is not a word', () => {
  const names = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa'];
  const words = names.map((word) => ({ word, meaning: 'a meaning', example: `An ${word} example.` }));
  const [card] = reply.parseCoachReply(`\`\`\`vocab\n${JSON.stringify({ items: words })}\n\`\`\``);
  assert.equal(card.kind, 'vocab');
  assert.equal(card.items.length, 8, 'no more than eight words in one card');
  assert.deepEqual(reply.parseCoachReply('```vocab\n{"items":[{"word":"word1","meaning":"digits are not letters"}]}\n```'), []);
  const kept = reply.parseCoachReply(
    '```vocab\n{"items":[{"word":"reliable","meaning":"can be trusted","example":"She is reliable.","note":"Stress: re-LI-a-ble"},{"word":"no meaning"},{"word":"","meaning":"x"}]}\n```',
  )[0];
  assert.deepEqual(kept.items.map((item) => item.word), ['reliable']);
  assert.equal(kept.items[0].note, 'Stress: re-LI-a-ble');
});

test('an actions card keeps only the paths of the app, so the learner is sent only where danna goes', () => {
  const [card] = reply.parseCoachReply(
    '```actions\n{"items":[{"label":"Listening","to":"/study/listening"},{"label":"Outside","to":"https://evil.example"},{"label":"A lesson","to":"/play/lesson/a1-first-words"},{"label":"Settings","to":"/settings"},{"label":"Review","to":"/review"}]}\n```',
  );
  assert.equal(card.kind, 'actions');
  assert.deepEqual(card.actions, [
    { label: 'Listening', to: '/study/listening' },
    { label: 'A lesson', to: '/play/lesson/a1-first-words' },
    { label: 'Review', to: '/review' },
  ]);
  assert.equal(reply.isAppRoute('/play/test/mock-b1-reading-listening'), true);
  assert.equal(reply.isAppRoute('//evil.example'), false);
});

test('the cards keep their order around the text, and the text around them stays', () => {
  const text = 'Start.\n```vocab\n{"items":[{"word":"gain","meaning":"to get","example":"They gain trust."}]}\n```\nMiddle.\n```chips\n["More"]\n```\nEnd.';
  assert.deepEqual(
    reply.parseCoachReply(text).map((part) => part.kind),
    ['text', 'vocab', 'text', 'chips', 'text'],
  );
});

test('the average of the scores is shown to one decimal, and no scores give no average', () => {
  assert.equal(reply.averageScore([{ label: 'a', score: 4 }, { label: 'b', score: 3 }]), 3.5);
  assert.equal(reply.averageScore([{ label: 'a', score: 4 }, { label: 'b', score: 4 }, { label: 'c', score: 3 }]), 3.7);
  assert.equal(reply.averageScore([]), null);
});

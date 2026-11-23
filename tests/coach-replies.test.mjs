// Tests the coach's replies: the exercise and quick-reply blocks are read into parts, a block that is broken is left out,
// answers are graded the same way on every screen, and the coach is told the rules of those blocks.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let reply;
let ai;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  reply = await server.ssrLoadModule('/src/lib/coachReply.ts');
  ai = await server.ssrLoadModule('/src/lib/ai.ts');
});

after(async () => {
  await server?.close();
});

const EXERCISE = [
  'Let us practise articles.',
  '```exercise',
  '{"title":"Articles","items":[',
  '{"type":"choice","prompt":"Choose the right article: ___ apple","options":["a","an","the"],"answer":1,"explain":"Apple starts with a vowel sound."},',
  '{"type":"gap","prompt":"She ___ to school every day.","answers":["goes"],"hint":"third person","explain":"Use goes with she."},',
  '{"type":"free","prompt":"Write one sentence with a gerund."}',
  ']}',
  '```',
  'Good luck!',
].join('\n');

test('a reply without blocks is one text part, with its spaces at the ends removed', () => {
  assert.deepEqual(reply.parseCoachReply('  Hello there.  \n'), [{ kind: 'text', text: 'Hello there.' }]);
  assert.deepEqual(reply.parseCoachReply(''), []);
});

test('an exercise block is read into its items, between the text around it', () => {
  const parts = reply.parseCoachReply(EXERCISE);
  assert.deepEqual(
    parts.map((part) => part.kind),
    ['text', 'exercise', 'text'],
  );
  assert.equal(parts[0].text, 'Let us practise articles.');
  assert.equal(parts[2].text, 'Good luck!');
  const { exercise } = parts[1];
  assert.equal(exercise.title, 'Articles');
  assert.deepEqual(
    exercise.items.map((item) => item.type),
    ['choice', 'gap', 'free'],
  );
  assert.deepEqual(exercise.items[0].options, ['a', 'an', 'the']);
  assert.equal(exercise.items[0].answer, 1);
  assert.deepEqual(exercise.items[1].answers, ['goes']);
  assert.equal(exercise.items[1].hint, 'third person');
});

test('quick replies are a short list with no repeats', () => {
  const parts = reply.parseCoachReply('Try these:\n```chips\n["Explain the rule", "Another one", "Explain the rule", "Harder", "Easier", "Read it"]\n```');
  assert.deepEqual(parts.map((part) => part.kind), ['text', 'chips']);
  assert.deepEqual(parts[1].chips, ['Explain the rule', 'Another one', 'Harder', 'Easier']);
});

test('a block that is not valid JSON is left out, and the text around it stays', () => {
  const parts = reply.parseCoachReply('Before.\n```exercise\n{oops\n```\nAfter.');
  assert.equal(parts.some((part) => part.kind === 'exercise'), false);
  assert.equal(parts.map((part) => part.text).join(' '), 'Before. After.');
});

test('a trailing comma, which models leave, is forgiven', () => {
  const parts = reply.parseCoachReply('```exercise\n{"items":[{"type":"free","prompt":"Say hello.",},],}\n```');
  assert.equal(parts[0].kind, 'exercise');
  assert.equal(parts[0].exercise.items[0].prompt, 'Say hello.');
});

test('a block cut short at the end of a reply is left out with what follows it', () => {
  const parts = reply.parseCoachReply('Start here.\n```exercise\n{"items":[');
  assert.deepEqual(parts, [{ kind: 'text', text: 'Start here.' }]);
});

test('an item that does not read as it should is skipped; an exercise with none left is dropped', () => {
  const mixed = reply.parseCoachReply(
    '```exercise\n{"items":[' +
      '{"type":"choice","prompt":"Pick one","options":["a","b"],"answer":5},' +
      '{"type":"gap","prompt":"I ___ and ___.","answers":["go"]},' +
      '{"type":"essay","prompt":"Nope"},' +
      '{"type":"free","prompt":"Keep this one"}' +
      ']}\n```',
  );
  assert.equal(mixed[0].exercise.items.length, 1);
  assert.equal(mixed[0].exercise.items[0].prompt, 'Keep this one');
  const none = reply.parseCoachReply('```exercise\n{"items":[{"type":"choice","prompt":"x","options":["a"],"answer":0}]}\n```');
  assert.deepEqual(none, []);
});

test('an exercise has at most eight items, and blanks are written the same way', () => {
  const many = Array.from({ length: 10 }, (_, index) => ({ type: 'free', prompt: `Item ${index + 1}` }));
  const [part] = reply.parseCoachReply(`\`\`\`exercise\n${JSON.stringify({ items: many })}\n\`\`\``);
  assert.equal(part.exercise.items.length, 8);
  const [blanks] = reply.parseCoachReply('```exercise\n{"items":[{"type":"gap","prompt":"She ____ home.","answers":["goes"]}]}\n```');
  assert.equal(blanks.exercise.items[0].prompt, 'She ___ home.');
});

test('a typed word matches when the letters match, and any accepted alternative counts', () => {
  assert.equal(reply.gapMatches(' Goes. ', 'goes'), true);
  assert.equal(reply.gapMatches('go', 'goes|go'), true);
  assert.equal(reply.gapMatches('an', 'a|an'), true);
  assert.equal(reply.gapMatches('', 'goes'), false, 'an empty blank is not right');
  assert.equal(reply.gapMatches('went', 'goes'), false);
});

test('answers are graded: choices and blanks count, a free answer does not', () => {
  const [exercise] = reply.parseCoachReply(EXERCISE).filter((part) => part.kind === 'exercise').map((part) => part.exercise);
  assert.equal(reply.gradeItem(exercise.items[0], 1), true);
  assert.equal(reply.gradeItem(exercise.items[0], 0), false);
  assert.equal(reply.gradeItem(exercise.items[0], undefined), false, 'unanswered is not right');
  assert.equal(reply.gradeItem(exercise.items[1], ['goes']), true);
  assert.equal(reply.gradeItem(exercise.items[1], ['go']), false);
  assert.equal(reply.gradeItem(exercise.items[2], 'I like swimming.'), null);

  assert.deepEqual(reply.scoreExercise(exercise.items, { 0: 1, 1: ['goes'], 2: 'Any words' }), { graded: 2, correct: 2, wrong: [] });
  assert.deepEqual(reply.scoreExercise(exercise.items, { 0: 0 }), { graded: 2, correct: 0, wrong: [0, 1] });
});

test('the text read aloud has no exercise, no quick reply and no markdown marks', () => {
  const parts = reply.parseCoachReply(`**Hello**, learner.\n${EXERCISE}\n\`\`\`chips\n["Harder"]\n\`\`\``);
  assert.equal(reply.spokenText(parts), 'Hello, learner. Let us practise articles. Good luck!');
});

test('the coach is told how to write exercises and quick replies, and never to print the answers', () => {
  const system = ai.coachSystem({ level: 'B1', goal: 'english', target_score: 100 });
  assert.match(system, /```exercise/);
  assert.match(system, /```chips/);
  assert.match(system, /"choice"/);
  assert.match(system, /"gap"/);
  assert.match(system, /"free"/);
  assert.match(system, /counting from 0/);
  assert.match(system, /Never write the answers in the text/);
  assert.match(system, /Every item has a "type"/);
});

// What the model really wrote when it was asked for multiple-choice questions: its items have no "type".
const FENCE = '```';
const UNTYPED_REPLY = [
  'Okay, I can help you with that! Here are four multiple-choice questions about prepositions of place.',
  '',
  `${FENCE}exercise`,
  `{"title": "Prepositions of Place", "items": [{"prompt": "The keys are ___ the table. Can you see them?", "options": ["in", "on", "at"], "answer": 1, "explain": "Use 'on' when something is resting on a surface."}, {"prompt": "We usually meet ___ the coffee shop near my office.", "options": ["in", "on", "at"], "answer": 2, "explain": "Use 'at' for a specific location or point."}, {"prompt": "My dog loves to hide ___ my bed when it hears thunder.", "options": ["on", "under", "in"], "answer": 1, "explain": "Use 'under' when something is directly below another object."}, {"prompt": "The bank is ___ the supermarket and the post office.", "options": ["in", "between", "on"], "answer": 1, "explain": "Use 'between' when something is in the middle of two other things."}]}`,
  FENCE,
  'I hope these are helpful for your study!',
  '',
  `${FENCE}chips`,
  `["Can I get more questions?", "What are prepositions?", "Let's review this topic."]`,
  FENCE,
].join('\n');

test('a real reply whose items have no type is read as the questions it was asked for', () => {
  const parts = reply.parseCoachReply(UNTYPED_REPLY);
  assert.deepEqual(
    parts.map((part) => part.kind),
    ['text', 'exercise', 'text', 'chips'],
  );
  const { exercise } = parts[1];
  assert.equal(exercise.title, 'Prepositions of Place');
  assert.deepEqual(exercise.items.map((item) => item.type), ['choice', 'choice', 'choice', 'choice']);
  assert.deepEqual(exercise.items[0].options, ['in', 'on', 'at']);
  assert.equal(exercise.items[0].answer, 1);
  assert.equal(exercise.items[1].answer, 2);
  assert.equal(exercise.items[0].explain, "Use 'on' when something is resting on a surface.");
  assert.deepEqual(parts[3].chips, ['Can I get more questions?', 'What are prepositions?', "Let's review this topic."]);
});

test('an item with no type is read from its fields, and the answer can be a letter or the text of an option', () => {
  const [exercise] = reply
    .parseCoachReply(
      '```exercise\n{"items":[' +
        '{"prompt":"Pick one","options":["in","on","at"],"answer":"B"},' +
        '{"prompt":"Pick two","options":["in","on","at"],"answer":"at"},' +
        '{"prompt":"She ___ home.","answer":"goes"},' +
        '{"prompt":"Write about your day."}' +
        ']}\n```',
    )
    .map((part) => part.exercise);
  assert.deepEqual(exercise.items.map((item) => item.type), ['choice', 'choice', 'gap', 'free']);
  assert.equal(exercise.items[0].answer, 1);
  assert.equal(exercise.items[1].answer, 2);
  assert.deepEqual(exercise.items[2].answers, ['goes']);
});

test('a type is matched by its name, and a name the app does not know leaves the item out', () => {
  const [exercise] = reply
    .parseCoachReply(
      '```exercise\n{"items":[' +
        '{"type":"Multiple choice","prompt":"Pick","options":["a","b"],"answer":0},' +
        '{"type":"fill-in","prompt":"I ___ it.","answers":["did"]},' +
        '{"type":"constructor","prompt":"Not a kind"},' +
        '{"type":"essay","prompt":"Not a kind either"}' +
        ']}\n```',
    )
    .map((part) => part.exercise);
  assert.deepEqual(exercise.items.map((item) => item.type), ['choice', 'gap']);
});

// Checks the rules behind the screens' flows: what a review card shows, which keys move a session on, where
// sign-in returns the person, and that a save which fails part way can be retried without writing twice.
// The TypeScript modules load the same way the app loads them.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let srs;
let keyboard;
let navigation;
let stepsModule;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  srs = await server.ssrLoadModule('/src/lib/srs.ts');
  keyboard = await server.ssrLoadModule('/src/lib/keyboard.ts');
  navigation = await server.ssrLoadModule('/src/lib/navigation.ts');
  stepsModule = await server.ssrLoadModule('/src/lib/steps.ts');
});

after(async () => {
  await server?.close();
});

test('a review card shows the question without the answer', () => {
  const cloze = { id: 'c', type: 'cloze', skill: 'language', prompt: 'Fill in the gaps.', text: 'She {{has}} gone and {{went:2}} home.' };
  assert.equal(srs.questionPreview(cloze), 'She ___ gone and ___ home.');
  const reorder = { id: 'r', type: 'reorder', skill: 'language', prompt: 'Put the words in the right order.', answer: 'I like tea' };
  assert.equal(srs.questionPreview(reorder), 'Put the words of this sentence in the right order.');
  assert.ok(!srs.questionPreview(reorder).includes('like'), 'the sentence itself is not shown');
  const choice = { id: 'q', type: 'choice', skill: 'reading', prompt: 'What is the main idea?', options: ['a', 'b', 'c'], answer: 0 };
  assert.equal(srs.questionPreview(choice), 'What is the main idea?');
});

test('a review card with a broken or missing question still shows a line', () => {
  assert.equal(srs.questionPreview(undefined), 'Review question');
  assert.equal(srs.questionPreview(null), 'Review question');
  assert.equal(srs.questionPreview({ id: 'x', type: 'choice', skill: 'reading', prompt: '   ', options: [], answer: 0 }), 'Review question');
  const long = { id: 'l', type: 'cloze', skill: 'language', prompt: 'x', text: `${'word '.repeat(60)}{{end}}` };
  assert.ok(srs.questionPreview(long).length <= 140);
});

test('only Enter outside a button, a link, a text box or a list starts the next step', () => {
  assert.equal(keyboard.enterPressesPrimary('INPUT', false), true, 'a blank in a sentence can be finished with Enter');
  assert.equal(keyboard.enterPressesPrimary(undefined, false), true, 'Enter on the page itself');
  assert.equal(keyboard.enterPressesPrimary('BUTTON', false), false, 'a focused button handles its own press');
  assert.equal(keyboard.enterPressesPrimary('A', false), false, 'a focused link handles its own press');
  assert.equal(keyboard.enterPressesPrimary('TEXTAREA', false), false, 'Enter in a text box is a new line');
  assert.equal(keyboard.enterPressesPrimary('SELECT', false), false);
  assert.equal(keyboard.enterPressesPrimary('INPUT', true), false, 'Shift with Enter does not start the next step');
});

test('sign-in returns to the page the person asked for, inside danna only', () => {
  assert.equal(navigation.returnPath('/library'), '/library');
  assert.equal(navigation.returnPath('/study/reading?tab=2'), '/study/reading?tab=2');
  assert.equal(navigation.returnPath('/report/abc#top'), '/report/abc#top');
  assert.equal(navigation.returnPath(undefined), '/');
  assert.equal(navigation.returnPath(''), '/');
  assert.equal(navigation.returnPath('https://evil.example/'), '/');
  assert.equal(navigation.returnPath('//evil.example/'), '/');
  assert.equal(navigation.returnPath('/\\evil'), '/');
  assert.equal(navigation.returnPath('/auth'), '/', 'the sign-in page does not return to itself');
  assert.equal(navigation.returnPath('/welcome?x=1'), '/');
  assert.equal(navigation.returnPath(42), '/');
});

test('a save that fails part way is retried without writing the finished steps again', async () => {
  const steps = stepsModule.createSteps();
  const writes = [];
  let failNext = true;
  const save = async () => {
    await steps.run('attempt', async () => writes.push('attempt'));
    await steps.run('skills', async () => writes.push('skills'));
    await steps.run('progress', async () => {
      if (failNext) {
        failNext = false;
        throw new Error('the connection dropped');
      }
      writes.push('progress');
    });
    await steps.run('profile', async () => writes.push('profile'));
  };

  await assert.rejects(save(), /connection dropped/);
  assert.deepEqual(writes, ['attempt', 'skills'], 'the steps before the failure were written once');
  assert.equal(steps.has('progress'), false, 'the failed step is not marked as done');

  await save();
  assert.deepEqual(writes, ['attempt', 'skills', 'progress', 'profile'], 'the retry writes only what is missing');

  await save();
  assert.equal(writes.length, 4, 'a finished save writes nothing again');
});

test('a reset starts a new session with no finished steps', async () => {
  const steps = stepsModule.createSteps();
  await steps.run('attempt', async () => 1);
  assert.equal(steps.has('attempt'), true);
  steps.reset();
  let ran = 0;
  await steps.run('attempt', async () => {
    ran += 1;
    return 1;
  });
  assert.equal(ran, 1);
});

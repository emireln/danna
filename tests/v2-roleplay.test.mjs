// Role-play scenes (2.0.0): the catalogue of twelve scenes, the mode each scene is, its instructions, and the reading of
// the fluency score in a summary. Every title, character and goal has a Portuguese translation.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
let server;
let scenes;
let modes;
let reply;
let i18n;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  scenes = await server.ssrLoadModule('/src/lib/scenarios.ts');
  modes = await server.ssrLoadModule('/src/lib/coachModes.ts');
  reply = await server.ssrLoadModule('/src/lib/coachReply.ts');
  i18n = await server.ssrLoadModule('/src/lib/i18n/index.ts');
});

after(async () => {
  await server?.close();
});

// The chat modes are free text matched by this pattern in the coach, so a scene's mode id must match it too.
const MODE_PATTERN = /^[a-z-]{1,40}$/;

test('the catalogue has twelve scenes, each with its own id and title', () => {
  assert.equal(scenes.SCENARIOS.length, 12);
  const ids = scenes.SCENARIOS.map((scene) => scene.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  for (const id of ids) assert.match(id, /^[a-z]+(-[a-z]+)*$/, `${id} is lower-case words with dashes`);
  const titles = scenes.SCENARIOS.map((scene) => scene.title);
  assert.equal(new Set(titles).size, titles.length, 'titles are unique');
});

test('every scene has an English title, character and goal, and each has a Portuguese translation', () => {
  i18n.setLang('pt');
  try {
    for (const scene of scenes.SCENARIOS) {
      for (const field of ['title', 'character', 'goal']) {
        const text = scene[field];
        assert.ok(text && text.trim().length > 0, `${scene.id} has no ${field}`);
        assert.notEqual(i18n.t(text), text, `${scene.id}: no Portuguese for the ${field} "${text}"`);
      }
    }
    for (const text of ['Role-play scenes', 'With {who}', 'Finish and score', 'End the role-play and give me my score.', 'Start the role-play.']) {
      assert.notEqual(i18n.t(text), text, `no Portuguese for "${text}"`);
    }
  } finally {
    i18n.setLang('en');
  }
});

test('a scene is a chat mode the coach stores, and it starts with the learner\'s message', () => {
  for (const scene of scenes.SCENARIOS) {
    const id = scenes.roleplayModeId(scene.id);
    assert.match(id, MODE_PATTERN, `${id} matches the coach's mode pattern`);
    assert.equal(scenes.isRoleplayMode(id), true);
    const mode = modes.coachMode(id);
    assert.equal(mode.id, id);
    assert.equal(mode.title, scene.title);
    assert.equal(mode.blurb, scene.goal);
    assert.equal(mode.start, 'send');
    assert.equal(mode.opener, 'Start the role-play.');
  }
});

test('the instructions give the character, the goal, the hint, and a summary with the fluency score first', () => {
  const scene = scenes.SCENARIOS[0];
  const text = modes.coachMode(scenes.roleplayModeId(scene.id)).instructions;
  assert.ok(text.includes(scene.character), 'the character');
  assert.ok(text.includes(scene.goal), 'the goal');
  assert.ok(text.includes('"Hint:"'), 'a hint on its own line');
  assert.ok(text.includes('"Fluency"'), 'the fluency score');
  assert.ok(text.includes('first score'), 'the app reads the first score');
});

test('an unknown or missing mode is not a scene, and falls back to the free chat', () => {
  assert.equal(scenes.isRoleplayMode('roleplay-unknown'), false);
  assert.equal(scenes.isRoleplayMode('roleplay-'), false);
  assert.equal(scenes.isRoleplayMode(null), false);
  assert.equal(modes.coachMode('roleplay-unknown').id, 'chat');
  assert.equal(modes.coachMode(null).id, 'chat');
  assert.equal(modes.coachMode('chat').id, 'chat');
});

test('the fluency of a summary is its first score, from 0 to 100', () => {
  const feedback = (scores) => ({ kind: 'feedback', feedback: { title: 'Summary', scores, summary: '', corrections: [], model: '' } });
  assert.equal(scenes.fluencyOf([feedback([{ label: 'Fluency', score: 4 }, { label: 'Grammar', score: 1 }])]), 80);
  assert.equal(scenes.fluencyOf([feedback([{ label: 'Fluency', score: 9 }])]), 100);
  assert.equal(scenes.fluencyOf([feedback([{ label: 'Fluency', score: -2 }])]), 0);
  assert.equal(scenes.fluencyOf([feedback([{ label: 'Fluency', score: Number.NaN }])]), null);
  assert.equal(scenes.fluencyOf([{ kind: 'text', text: 'Good job.' }]), null, 'a reply with no feedback block');
  assert.equal(scenes.fluencyOf([feedback([])]), null, 'a feedback block with no scores');
  assert.equal(scenes.fluencyOf([]), null);
});

test('a summary is read from the feedback block of a reply, with a half point', () => {
  const text = [
    'Thank you, that was a lovely conversation.',
    '```feedback',
    '{"title":"Summary","scores":[{"label":"Fluência","score":3.5},{"label":"Gramática","score":4}],"summary":"Good pace.","corrections":[],"model":""}',
    '```',
  ].join('\n');
  assert.equal(scenes.fluencyOf(reply.parseCoachReply(text)), 70);
});

test('the XP of a summary is a whole number above zero', () => {
  assert.ok(Number.isInteger(scenes.ROLEPLAY_XP) && scenes.ROLEPLAY_XP > 0);
});

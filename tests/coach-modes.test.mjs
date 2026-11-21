// Tests the coach's modes: every mode has its own card and instructions, the free chat is the default, the modes that
// send at once have an opener, and every word the interface shows for a mode is translated.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let modes;
let pt;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  modes = await server.ssrLoadModule('/src/lib/coachModes.ts');
  ({ APP_PT: pt } = await server.ssrLoadModule('/src/lib/i18n/pt/app.ts'));
});

after(async () => {
  await server?.close();
});

test('every mode has its own id and card, and the free chat is first', () => {
  const ids = modes.COACH_MODES.map((mode) => mode.id);
  assert.equal(new Set(ids).size, ids.length, 'no two modes share an id');
  assert.equal(ids[0], 'chat');
  for (const mode of modes.COACH_MODES) {
    assert.ok(mode.title.length > 0 && mode.blurb.length > 0, `${mode.id} has a title and a blurb`);
    assert.ok(['send', 'write', 'open'].includes(mode.start), `${mode.id} starts in a known way`);
  }
});

test('a mode that starts at once has an opener, and a mode the learner starts by writing has none', () => {
  for (const mode of modes.COACH_MODES) {
    if (mode.start === 'send') assert.ok(mode.opener.length > 0, `${mode.id} has an opening message`);
    else assert.equal(mode.opener, '', `${mode.id} waits for the learner`);
  }
});

test('the modes that teach have instructions for the model, and the free chat needs none', () => {
  assert.equal(modes.coachMode('chat').instructions, '');
  for (const mode of modes.COACH_MODES.filter((item) => item.id !== 'chat')) {
    assert.ok(mode.instructions.length > 80, `${mode.id} tells the model what to do`);
  }
  assert.match(modes.coachMode('writing').instructions, /feedback block/);
  assert.match(modes.coachMode('vocabulary').instructions, /vocab block/);
});

test('a missing or unknown mode is the free chat, as chats from before modes are', () => {
  assert.equal(modes.coachMode(null).id, 'chat');
  assert.equal(modes.coachMode(undefined).id, 'chat');
  assert.equal(modes.coachMode('no-such-mode').id, 'chat');
  assert.equal(modes.coachMode('review').id, 'review');
});

test('every word the interface shows for a mode has a Portuguese translation', () => {
  const texts = modes.COACH_MODES.flatMap((mode) => [mode.title, mode.blurb, ...(mode.opener ? [mode.opener] : [])]);
  const missing = texts.filter((text) => !Object.hasOwn(pt, text));
  assert.deepEqual(missing, [], `no Portuguese for: ${missing.join(' | ')}`);
});

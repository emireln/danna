// Tests the character's body language (src/avatar/rig.ts): blinks, the gaze and the head follow the status and the sound,
// the mouth opens with the voice and closes in silence, intonation lifts the head, and reduced motion keeps still.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let rigModule;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  rigModule = await server.ssrLoadModule('/src/avatar/rig.ts');
});

after(async () => {
  await server?.close();
});

const quiet = { level: 0, pitch: 0, low: 0, mid: 0, high: 0 };
const voice = { level: 0.25, pitch: 260, low: 0.5, mid: 0.15, high: 0.05 };
const FRAME = 1 / 60;

test('the character blinks now and then, and rests with its eyes closed once the talk has ended', () => {
  const rig = rigModule.createRig({ random: () => 0.5 });
  let blinks = 0;
  let closed = false;
  for (let i = 0; i < 60 * 12; i += 1) {
    const pose = rig.update({ status: 'listening', coach: quiet, user: 0 }, FRAME);
    const shut = pose.blink > 0.5;
    if (shut && !closed) blinks += 1;
    closed = shut;
  }
  assert.ok(blinks >= 3 && blinks <= 8, `${blinks} blinks in twelve seconds`);
  const resting = rigModule.createRig({ random: () => 0 }).update({ status: 'ended', coach: quiet, user: 0 }, FRAME);
  assert.ok(resting.blink >= 0.85, 'the eyes rest closed');
});

test('the mouth opens with the voice, and closes again in silence', () => {
  const rig = rigModule.createRig({ random: () => 0.5 });
  let pose;
  for (let i = 0; i < 30; i += 1) pose = rig.update({ status: 'speaking', coach: voice, user: 0 }, FRAME);
  assert.ok(pose.open > 0.5, `the mouth opens to ${pose.open}`);
  for (let i = 0; i < 120; i += 1) pose = rig.update({ status: 'speaking', coach: quiet, user: 0 }, FRAME);
  assert.ok(pose.open < 0.05, `the mouth closes to ${pose.open}`);
});

test('a question rises in the brows and the head, and a thinking character leans, looks up and waves', () => {
  const rising = rigModule.createRig({ random: () => 0.5 });
  let pose;
  for (let i = 0; i < 120; i += 1) pose = rising.update({ status: 'speaking', coach: { ...voice, pitch: 300 }, user: 0 }, FRAME);
  assert.ok(pose.lift > 0.7, `the brows rise to ${pose.lift}`);
  assert.ok(pose.pitch < 0, `the head tilts up to ${pose.pitch}`);

  const thinking = rigModule.createRig({ random: () => 0.5 });
  for (let i = 0; i < 120; i += 1) pose = thinking.update({ status: 'thinking', coach: quiet, user: 0 }, FRAME);
  assert.ok(pose.lean > 0.9, 'the character leans');
  assert.ok(pose.gazeY > 0.3 && pose.gazeX < -0.3, 'the eyes look up and to the left');
  assert.ok(pose.wave > 0.3, 'an arm is raised');
});

test('with reduced motion the head sways much less', () => {
  const sway = (reducedMotion) => {
    const rig = rigModule.createRig({ reducedMotion, random: () => 0.5 });
    let low = Infinity;
    let high = -Infinity;
    for (let i = 0; i < 600; i += 1) {
      const pose = rig.update({ status: 'idle', coach: quiet, user: 0 }, FRAME);
      low = Math.min(low, pose.yaw);
      high = Math.max(high, pose.yaw);
    }
    return high - low;
  };
  assert.ok(sway(true) < sway(false) * 0.5, `reduced ${sway(true)} against ${sway(false)}`);
});

test('every value of the pose is a finite number, whatever the status and the sound', () => {
  const rig = rigModule.createRig({ random: Math.random });
  for (const status of ['idle', 'connecting', 'listening', 'thinking', 'speaking', 'ended']) {
    for (const coach of [quiet, voice, { level: 9, pitch: -40, low: 2, mid: 2, high: 2 }]) {
      const pose = rig.update({ status, coach, user: 3 }, 5);
      for (const [name, value] of Object.entries(pose)) assert.ok(Number.isFinite(value), `${status} ${name} is ${value}`);
      assert.ok(pose.open >= 0 && pose.open <= 1 && pose.blink >= 0 && pose.blink <= 1, `${status} stays in range`);
    }
  }
});

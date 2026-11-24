// Tests the coach of the talk screen: Ana is a model file that ships with the app, small enough to open at once, that carries
// the face shapes TalkingHead moves (the ARKit shapes and the Oculus visemes), the bones it moves by name (the Mixamo names,
// with the eyes and the toes), and the credits and the license texts kept beside the app's models.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let characters;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  characters = await server.ssrLoadModule('/src/avatar/characters.ts');
});

after(async () => {
  await server?.close();
});

/** The 52 ARKit face shapes. TalkingHead moves them for the eyes, the brows, the jaw and the mouth. */
const ARKIT = [
  'jawOpen', 'jawForward', 'jawLeft', 'jawRight', 'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight', 'mouthDimpleLeft', 'mouthDimpleRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight', 'mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthPressLeft', 'mouthPressRight',
  'mouthStretchLeft', 'mouthStretchRight', 'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeLookDownLeft', 'eyeLookDownRight', 'eyeLookInLeft', 'eyeLookInRight',
  'eyeLookOutLeft', 'eyeLookOutRight', 'eyeLookUpLeft', 'eyeLookUpRight', 'eyeSquintLeft', 'eyeSquintRight',
  'eyeWideLeft', 'eyeWideRight', 'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight', 'noseSneerLeft', 'noseSneerRight', 'tongueOut',
];

/** The Oculus visemes that move the mouth. Silence (viseme_sil) is not in the model: TalkingHead skips a shape a model lacks. */
const VISEMES = [
  'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 'viseme_kk', 'viseme_CH', 'viseme_SS',
  'viseme_nn', 'viseme_RR', 'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U',
];

/** The bones TalkingHead finds by name: the spine, the head and the eyes, the arms, the hands and the legs. */
const BONES = [
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftEye', 'RightEye',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
];

/** The JSON part of a binary glTF file, which holds its nodes, meshes and blend shape names. */
function gltfOf(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF', 'a binary glTF file');
  assert.equal(buffer.readUInt32LE(4), 2, 'glTF version 2');
  const length = buffer.readUInt32LE(12);
  return JSON.parse(buffer.toString('utf8', 20, 20 + length));
}

test('the coach is the model file that ships with the app, small enough to open at once', async () => {
  assert.equal(characters.COACHES.length, 1, 'Ana is the only coach');
  const [ana] = characters.COACHES;
  assert.equal(ana.id, 'ana');
  const info = await stat(join(root, 'public', ana.file));
  assert.ok(info.size < 6 * 1024 * 1024, `${ana.name} is ${info.size} bytes`);
});

test('Ana carries the face shapes and the bones TalkingHead moves, under the root that TalkingHead looks for', async () => {
  const [ana] = characters.COACHES;
  const json = gltfOf(await readFile(join(root, 'public', ana.file)));
  const shapes = new Set();
  for (const mesh of json.meshes) for (const name of mesh.extras?.targetNames ?? []) shapes.add(name);
  assert.deepEqual(ARKIT.filter((name) => !shapes.has(name)), [], 'every ARKit shape is there');
  assert.deepEqual(VISEMES.filter((name) => !shapes.has(name)), [], 'every Oculus viseme but silence is there');
  const roots = json.scenes[0].nodes.map((index) => json.nodes[index].name);
  assert.ok(roots.includes('Armature'), 'TalkingHead looks for the root named Armature');
  const bones = new Set(json.nodes.map((node) => node.name));
  assert.deepEqual(BONES.filter((name) => !bones.has(name)), [], 'every bone TalkingHead moves is there');
});

test('Ana is credited, and the TalkingHead license and lip-sync modules ship beside the app', async () => {
  const credits = await readFile(join(root, 'public', 'characters', 'CREDITS.md'), 'utf8');
  assert.match(credits, /## Ana: MakeHuman \(CC0\)/);
  assert.match(credits, /creativecommons\.org\/publicdomain\/zero\/1\.0/);
  assert.match(credits, /## TalkingHead: Mika Suominen \(MIT\)/);
  const license = await readFile(join(root, 'public', 'talkinghead', 'TALKINGHEAD-LICENSE.txt'), 'utf8');
  assert.match(license, /Permission is hereby granted, free of charge/);
  assert.match(license, /Mika Suominen/);
  for (const file of ['lipsync-en.mjs', 'lipsync-pt_br.mjs']) {
    await stat(join(root, 'public', 'talkinghead', file));
  }
});

test('an unknown or missing coach is Ana, the only coach', () => {
  assert.equal(characters.coachOf('nobody').id, 'ana');
  assert.equal(characters.coachOf(null).id, 'ana');
  assert.equal(characters.coachOf('leo').id, 'ana', 'the coaches that were removed fall back to Ana');
});

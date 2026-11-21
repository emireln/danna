// Tests the coaches: each one is a model file that ships with the app, small enough to open at once, that carries every face
// shape the talk uses (the ARKit shapes and the Oculus visemes) and the bones that move the head, neck and chest. The
// credits and the license texts are kept beside the models, and the conversion script is kept with the app.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let characters;
let morphs;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  characters = await server.ssrLoadModule('/src/avatar/characters.ts');
  morphs = await server.ssrLoadModule('/src/avatar/morphs.ts');
});

after(async () => {
  await server?.close();
});

/** The JSON part of a binary glTF file, which holds its meshes, nodes and blend shape names. */
function gltfOf(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF', 'a binary glTF file');
  assert.equal(buffer.readUInt32LE(4), 2, 'glTF version 2');
  const length = buffer.readUInt32LE(12);
  return JSON.parse(buffer.toString('utf8', 20, 20 + length));
}

test('every coach is a model file that ships with the app, small enough to open at once', async () => {
  assert.equal(characters.COACHES.length, 3);
  for (const coach of characters.COACHES) {
    const info = await stat(join(root, 'public', coach.file));
    assert.ok(info.size < 6 * 1024 * 1024, `${coach.name} is ${info.size} bytes`);
  }
});

test('every coach carries the face shapes the talk uses, and the bones that move the head, neck and chest', async () => {
  for (const coach of characters.COACHES) {
    const json = gltfOf(await readFile(join(root, 'public', coach.file)));
    const shapes = new Set();
    for (const mesh of json.meshes) for (const name of mesh.extras?.targetNames ?? []) shapes.add(name);
    const missing = morphs.FACE_SHAPES.filter((name) => !shapes.has(name));
    assert.deepEqual(missing, [], `${coach.name} lacks ${missing.join(', ')}`);
    const bones = new Set(json.nodes.map((node) => (node.name ?? '').replace(/^Bip01\s+/, '')));
    for (const bone of ['Head', 'Neck', 'Spine1']) assert.ok(bones.has(bone), `${coach.name} has the ${bone} bone`);
  }
});

test('the coaches are credited, and the license texts ship beside the models', async () => {
  const credits = await readFile(join(root, 'public', 'characters', 'CREDITS.md'), 'utf8');
  for (const coach of characters.COACHES) {
    assert.ok(credits.includes(`## ${coach.name}`), `${coach.name} has a credit`);
  }
  assert.match(credits, /MakeHuman/);
  assert.match(credits, /CC0/);
  assert.match(credits, /Microsoft RocketBox/);
  assert.match(credits, /MIT License/);
  assert.match(credits, /Permission is hereby granted, free of charge/);
});

test('an unknown or missing coach is Ana, the first coach', () => {
  assert.equal(characters.coachOf('nobody').id, 'ana');
  assert.equal(characters.coachOf(null).id, 'ana');
  assert.equal(characters.coachOf('leo').name, 'Leo');
});

test('the conversion of the RocketBox models is kept with the app', async () => {
  const script = await readFile(join(root, 'scripts', 'characters', 'convert-rocketbox.py'), 'utf8');
  assert.match(script, /AK_/);
  assert.match(script, /AA_VI_/);
});

// Fetches the built-in voice (Kokoro-82M, Apache-2.0) into resources/tts/kokoro, so danna can read aloud with no
// internet. The files come from the Hugging Face repository onnx-community/Kokoro-82M-v1.0-ONNX. Each file is checked
// against its SHA-256 before it is kept, and a file that is already there and correct is not downloaded again.
// The installer build runs this first (npm run dist). Run it by hand with: npm run tts:fetch
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'resources', 'tts', 'kokoro');
const REPO = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main';

// The built-in voices. Their ids and their order match electron/speech.cjs (BUILTIN_VOICES).
const VOICE_HASHES = {
  af_heart: 'd583ccff3cdca2f7fae535cb998ac07e9fcb90f09737b9a41fa2734ec44a8f0b',
  af_bella: 'f69d836209b78eb8c66e75e3cda491e26ea838a3674257e9d4e5703cbaf55c8b',
  af_nicole: 'cd2191ab31b914ed7b318416b0e4440fdf392ddad9106a060819aa600a64f59a',
  af_sarah: '4409fbc125afabacc615d94db5398d847006a737b0247d6892b7a9a0007a2f0a',
  am_michael: '1d1f21dd8da39c30705cd4c75d039d265e9bc4a2a93ed09bc9e1b1225eb95ba1',
  bf_emma: '669fe0647f9dd04fcab92f1439a40eeb4c8b4ab1f82e4996fe3d918ce4a63b73',
  bm_george: 'c4b235a4c1f2cd3b939fed08b899ce9385638b763f7b73a59616c4fc9bd6c9bc',
};

const FILES = [
  { from: 'tokenizer.json', to: 'tokenizer.json', sha256: '77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34' },
  {
    from: 'onnx/model_quantized.onnx',
    to: 'model.onnx',
    sha256: 'fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478',
  },
  ...Object.entries(VOICE_HASHES).map(([id, sha256]) => ({ from: `voices/${id}.bin`, to: `voices/${id}.bin`, sha256 })),
];

const NOTICE = `Built-in voice of danna
=======================

The speech model is Kokoro-82M by hexgrad (https://huggingface.co/hexgrad/Kokoro-82M), licensed under Apache-2.0.
The ONNX files are the conversion published by onnx-community (https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX),
with the voices of that repository. The text rules follow kokoro-js (Apache-2.0), and the phonemes come from
phonemizer (Apache-2.0), which uses eSpeak NG (GPL-3.0).
`;

function sha256Of(file) {
  const hash = createHash('sha256');
  hash.update(readFileSync(file));
  return hash.digest('hex');
}

async function download(url, file) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`Could not download ${url} (${response.status}).`);
  const partial = `${file}.part`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
  return partial;
}

async function main() {
  mkdirSync(join(target, 'voices'), { recursive: true });
  let fetched = 0;
  for (const item of FILES) {
    const file = join(target, item.to);
    if (existsSync(file) && sha256Of(file) === item.sha256) continue;
    console.log(`Downloading ${item.to} ...`);
    const partial = await download(`${REPO}/${item.from}`, file);
    const actual = sha256Of(partial);
    if (actual !== item.sha256) {
      rmSync(partial, { force: true });
      throw new Error(`${item.to} does not match its checksum (got ${actual}). Try again.`);
    }
    renameSync(partial, file);
    fetched += 1;
  }
  writeFileSync(join(target, 'NOTICE.txt'), NOTICE);
  console.log(fetched ? `Built-in voice ready: ${fetched} file(s) downloaded.` : 'Built-in voice already in place.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

// The built-in voice: the Kokoro-82M speech model, run on this computer by ONNX Runtime. The model, the voices and the
// tokenizer ship with the app (scripts/fetch-tts-model.mjs), so it reads with no internet. The text rules and the
// phoneme steps follow kokoro-js (Apache-2.0), without its web and download code. Each piece of text is turned into
// phonemes, then into the model's ids, and the model returns the sound of that piece.
const fs = require('node:fs');
const path = require('node:path');
const { pcmToWav } = require('./speech.cjs');

const SAMPLE_RATE = 24000;
const STYLE_LENGTH = 256;
const STYLE_ROWS = 510;
// A little slower than normal speech, which is easier to follow when learning.
const SPEED = 0.95;
// The longest piece of text sent to the model at once. Short pieces let the first words play sooner.
const PIECE_CHARS = 160;

const PUNCTUATION = ";:,.!?¡¿—…\"«»“”(){}[]'";
const PUNCTUATION_RUN = new RegExp(`(\\s*[${PUNCTUATION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+\\s*)+`, 'g');

function yearOrTime(match) {
  if (match.includes('.')) return match;
  if (match.includes(':')) {
    const [hour, minute] = match.split(':').map(Number);
    return minute === 0 ? `${hour} o'clock` : minute < 10 ? `${hour} oh ${minute}` : `${hour} ${minute}`;
  }
  const year = parseInt(match.slice(0, 4), 10);
  if (year < 1100 || year % 1000 < 10) return match;
  const head = match.slice(0, 2);
  const tail = parseInt(match.slice(2, 4), 10);
  const plural = match.endsWith('s') ? 's' : '';
  if (year % 1000 >= 100 && year % 1000 <= 999) {
    if (tail === 0) return `${head} hundred${plural}`;
    if (tail < 10) return `${head} oh ${tail}${plural}`;
  }
  return `${head} ${tail}${plural}`;
}

function currency(match) {
  const unit = match[0] === '$' ? 'dollar' : 'pound';
  if (Number.isNaN(Number(match.slice(1)))) return `${match.slice(1)} ${unit}s`;
  if (!match.includes('.')) {
    const plural = match.slice(1) === '1' ? '' : 's';
    return `${match.slice(1)} ${unit}${plural}`;
  }
  const [whole, fraction] = match.slice(1).split('.');
  const cents = parseInt(fraction.padEnd(2, '0'), 10);
  const centWord = match[0] === '$' ? (cents === 1 ? 'cent' : 'cents') : cents === 1 ? 'penny' : 'pence';
  return `${whole} ${unit}${whole === '1' ? '' : 's'} and ${cents} ${centWord}`;
}

function decimal(match) {
  const [whole, fraction] = match.split('.');
  return `${whole} point ${fraction.split('').join(' ')}`;
}

/** The text as it is spoken: quotes and brackets are simplified, and numbers, years and money become words. */
function normalizeText(input) {
  return String(input)
    .replace(/[‘’]/g, "'")
    .replace(/«/g, '“')
    .replace(/»/g, '”')
    .replace(/[“”]/g, '"')
    .replace(/\(/g, '«')
    .replace(/\)/g, '»')
    .replace(/、/g, ', ')
    .replace(/。/g, '. ')
    .replace(/！/g, '! ')
    .replace(/，/g, ', ')
    .replace(/：/g, ': ')
    .replace(/；/g, '; ')
    .replace(/？/g, '? ')
    .replace(/[^\S \n]/g, ' ')
    .replace(/  +/, ' ')
    .replace(/(?<=\n) +(?=\n)/g, '')
    .replace(/\bD[Rr]\.(?= [A-Z])/g, 'Doctor')
    .replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, 'Mister')
    .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, 'Miss')
    .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, 'Mrs')
    .replace(/\betc\.(?! [A-Z])/gi, 'etc')
    .replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, yearOrTime)
    .replace(/(?<=\d),(?=\d)/g, '')
    .replace(/[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi, currency)
    .replace(/\d*\.\d+/g, decimal)
    .replace(/(?<=\d)-(?=\d)/g, ' to ')
    .replace(/(?<=\d)S/g, ' S')
    .replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S")
    .replace(/(?<=X')S\b/g, 's')
    .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (match) => match.replace(/\./g, '-'))
    .replace(/(?<=[A-Z])\.(?=[A-Z])/gi, '-')
    .trim();
}

/** The parts of a text: the words to be spoken, and the punctuation between them, which is kept as it is. */
function segments(text) {
  const found = [];
  let last = 0;
  for (const match of text.matchAll(PUNCTUATION_RUN)) {
    if (match.index > last) found.push({ spoken: true, text: text.slice(last, match.index) });
    if (match[0].length > 0) found.push({ spoken: false, text: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) found.push({ spoken: true, text: text.slice(last) });
  return found;
}

/**
 * The phonemes of a text, for one voice. The first letter of a voice name says its accent: "a" is American, any
 * other letter is British. `phonemize` turns the words into phonemes, one list for each sentence.
 */
async function phonemesOf(text, voice, phonemize) {
  const accent = String(voice).charAt(0);
  const language = accent === 'a' ? 'en-us' : 'en';
  let phonemes = '';
  for (const segment of segments(normalizeText(text))) {
    if (!segment.spoken) {
      phonemes += segment.text;
    } else {
      phonemes += (await phonemize(segment.text, language)).join(' ');
    }
  }
  phonemes = phonemes
    .replace(/kəkˈoːɹoʊ/g, 'kˈoʊkəɹoʊ')
    .replace(/kəkˈɔːɹəʊ/g, 'kˈəʊkəɹəʊ')
    .replace(/ʲ/g, 'j')
    .replace(/r/g, 'ɹ')
    .replace(/x/g, 'k')
    .replace(/ɬ/g, 'l')
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, ' ')
    .replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, 'z');
  if (accent === 'a') phonemes = phonemes.replace(/(?<=nˈaɪn)ti(?!ː)/g, 'di');
  return phonemes.trim();
}

/** The model's alphabet: its tokenizer file names the symbols it keeps, and the id of each one. */
function loadTokenizer(file) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { keep: new RegExp(json.normalizer.pattern.Regex, 'g'), vocab: json.model.vocab };
}

/** The ids of a phoneme string, with the start and end marks (id 0) around them. Unknown symbols become 0. */
function tokenize(phonemes, tokenizer) {
  const kept = phonemes.replace(tokenizer.keep, '');
  const ids = [0];
  for (const symbol of kept) {
    ids.push(Object.hasOwn(tokenizer.vocab, symbol) ? tokenizer.vocab[symbol] : 0);
  }
  ids.push(0);
  return ids;
}

/** A voice holds 510 rows of style numbers. The row is chosen by the length of the text, as the model expects. */
function styleFor(voiceData, idCount) {
  const row = Math.min(Math.max(idCount - 2, 0), STYLE_ROWS - 1);
  return voiceData.slice(row * STYLE_LENGTH, row * STYLE_LENGTH + STYLE_LENGTH);
}

/** A voice file: 510 rows of 256 numbers, each a 32-bit float. */
function readVoiceFile(file) {
  const bytes = fs.readFileSync(file);
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Float32Array(copy.buffer);
}

/** Sentences, packed into pieces that are short enough for the model. A sentence that is too long is cut at a space. */
function speechPieces(text, maxChars = PIECE_CHARS) {
  const clean = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?…]["”’)\]]*)\s+/).flatMap((sentence) => cutLong(sentence, maxChars));
  const pieces = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && `${current} ${sentence}`.length > maxChars) {
      pieces.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

function cutLong(sentence, maxChars) {
  const parts = [];
  let rest = sentence;
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf(' ', maxChars);
    if (cut <= 0) cut = maxChars;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** Float samples (from -1 to 1) as a 16-bit mono WAV file at the model's rate. */
function wavFromSamples(samples, sampleRate = SAMPLE_RATE) {
  const data = Buffer.alloc(samples.length * 2);
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    data.writeInt16LE(Math.round(clamped * 32767), index * 2);
  }
  return pcmToWav(data, sampleRate);
}

/**
 * The engine. `modelDir` holds `model.onnx`, `tokenizer.json` and `voices/<name>.bin`. The runtime and the
 * phonemizer are loaded when they are first needed, and tests pass stand-ins for them.
 */
function createSpeechEngine({
  modelDir,
  loadRuntime = () => require('onnxruntime-node'),
  loadPhonemizer = () => require('phonemizer'),
}) {
  const modelFile = path.join(modelDir, 'model.onnx');
  const tokenizerFile = path.join(modelDir, 'tokenizer.json');
  const voiceFile = (voice) => path.join(modelDir, 'voices', `${voice}.bin`);
  const voices = new Map();
  let loading = null;

  /** True when the model, the tokenizer and (for a voice) its file are all on this computer. */
  function available(voice) {
    return fs.existsSync(modelFile) && fs.existsSync(tokenizerFile) && (voice === undefined || fs.existsSync(voiceFile(voice)));
  }

  function ready() {
    if (!loading) {
      loading = (async () => {
        const runtime = loadRuntime();
        const session = await runtime.InferenceSession.create(modelFile, { executionProviders: ['cpu'] });
        return { runtime, session, tokenizer: loadTokenizer(tokenizerFile), phonemize: loadPhonemizer().phonemize };
      })();
      // A failed start is not kept, so the next request tries again.
      loading.catch(() => {
        loading = null;
      });
    }
    return loading;
  }

  function voiceData(voice) {
    if (!voices.has(voice)) voices.set(voice, readVoiceFile(voiceFile(voice)));
    return voices.get(voice);
  }

  /** The sound of one piece of text, as a WAV file. Null when the piece has nothing to say. */
  async function speakPiece(piece, voice) {
    const { runtime, session, tokenizer, phonemize } = await ready();
    const ids = tokenize(await phonemesOf(piece, voice, phonemize), tokenizer);
    if (ids.length <= 2) return null;
    const feeds = {
      input_ids: new runtime.Tensor('int64', BigInt64Array.from(ids, (id) => BigInt(id)), [1, ids.length]),
      style: new runtime.Tensor('float32', styleFor(voiceData(voice), ids.length), [1, STYLE_LENGTH]),
      speed: new runtime.Tensor('float32', Float32Array.of(SPEED), [1]),
    };
    const result = await session.run(feeds);
    return wavFromSamples(result.waveform.data);
  }

  /** The sound of a text, one WAV file for each piece, as each piece is ready. Stops when the signal is aborted. */
  async function* speakPieces(text, voice, { signal } = {}) {
    for (const piece of speechPieces(text)) {
      if (signal && signal.aborted) return;
      const wav = await speakPiece(piece, voice);
      if (signal && signal.aborted) return;
      if (wav) yield wav;
    }
  }

  return { available, ready, speakPiece, speakPieces };
}

module.exports = {
  SAMPLE_RATE,
  SPEED,
  PIECE_CHARS,
  normalizeText,
  segments,
  phonemesOf,
  loadTokenizer,
  tokenize,
  styleFor,
  readVoiceFile,
  speechPieces,
  wavFromSamples,
  createSpeechEngine,
};

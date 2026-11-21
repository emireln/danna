// The voices installed on this PC (electron/winvoices.cjs): the list read from the speech service, the choice of the
// most natural one, the WAV bytes of a text, and the checks before PowerShell runs. The PowerShell run is replaced by a
// stand-in, except for one test that reads the real voices on Windows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const winvoices = require('../electron/winvoices.cjs');

const LIST = [
  'VOICE|Microsoft David|en-US|Male|HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Speech_OneCore\\Voices\\Tokens\\MSTTS_V110_enUS_DavidM|Microsoft David - English (United States)',
  'VOICE|Microsoft Aria Online (Natural)|en-US|Female|HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Speech_OneCore\\Voices\\Tokens\\Aria|Microsoft Aria Online (Natural) - English (United States)',
  'VOICE|Microsoft Maria|pt-BR|Female|HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Speech_OneCore\\Voices\\Tokens\\MSTTS_V110_ptBR_MariaM|Microsoft Maria - Portuguese(Brazil)',
].join('\r\n');

function wavBytes() {
  const bytes = Buffer.alloc(60);
  bytes.write('RIFF', 0);
  bytes.write('WAVE', 8);
  return bytes;
}

test('the voices are read line by line, and a voice with a natural description is marked natural', () => {
  const voices = winvoices.parseVoiceLines(`progress text\r\n${LIST}\r\n`);
  assert.equal(voices.length, 3);
  assert.deepEqual(voices[0], {
    id: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Speech_OneCore\\Voices\\Tokens\\MSTTS_V110_enUS_DavidM',
    name: 'Microsoft David',
    language: 'en-US',
    gender: 'male',
    natural: false,
  });
  assert.equal(voices[1].natural, true, 'the natural voice is marked');
  assert.equal(voices[2].language, 'pt-BR');
});

test('the recommended voice is a natural American English voice, and none is recommended when there is none', () => {
  const voices = winvoices.parseVoiceLines(LIST);
  assert.equal(winvoices.recommendedVoice(voices).name, 'Microsoft Aria Online (Natural)');
  assert.equal(winvoices.recommendedVoice(voices.filter((voice) => !voice.natural)), null);
});

test('a failed read of the list says so, and the voices read earlier are kept for a few minutes', async () => {
  let clock = 0;
  let calls = 0;
  const windows = winvoices.createWindowsVoices({
    now: () => clock,
    run: async () => {
      calls += 1;
      return { stdout: calls === 1 ? 'ERROR|no speech service' : LIST, error: calls === 1 ? new Error('exit 1') : null };
    },
  });
  const failed = await windows.list();
  assert.equal(failed.voices.length, 0);
  assert.equal(failed.error, 'Could not read the voices on this PC.');

  const read = await windows.list();
  assert.equal(read.voices.length, 3, 'a failed read is not kept, so the next read tries again');
  assert.equal(read.error, null);
  assert.equal(calls, 2);

  await windows.list();
  assert.equal(calls, 2, 'the voices read a moment ago are kept');
  clock += 6 * 60 * 1000;
  await windows.list();
  assert.equal(calls, 3, 'after six minutes they are read again');
  assert.equal(windows.known().length, 3);
});

test('the WAV bytes come from the output; a message from the speech service becomes the error', () => {
  const encoded = wavBytes().toString('base64');
  assert.deepEqual(winvoices.parseSpeechOutput(`loading\nWAV|${encoded}\n`), wavBytes());
  assert.throws(() => winvoices.parseSpeechOutput('ERROR|That voice is not installed.'), /That voice is not installed/);
  assert.throws(() => winvoices.parseSpeechOutput('nothing here'), /did not return any sound/);
  assert.throws(() => winvoices.parseSpeechOutput(`WAV|${Buffer.from('short').toString('base64')}`), /damaged sound/);
});

test('the text and the voice reach PowerShell through the environment, and a strange voice id is refused first', async () => {
  const calls = [];
  const windows = winvoices.createWindowsVoices({
    run: async (script, env) => {
      calls.push({ script, env });
      return { stdout: `WAV|${wavBytes().toString('base64')}`, error: null };
    },
  });
  const sound = await windows.synthesize('Read this; "quoted" $HOME', 'MSTTS_V110_enUS_ZiraM');
  assert.equal(sound.toString('ascii', 0, 4), 'RIFF');
  assert.equal(calls[0].env.DANNA_TTS_TEXT, 'Read this; "quoted" $HOME', 'the text is not part of the command');
  assert.equal(calls[0].env.DANNA_TTS_VOICE, 'MSTTS_V110_enUS_ZiraM');
  assert.ok(!calls[0].script.includes('Read this'), 'the script itself never contains the text');

  await assert.rejects(() => windows.synthesize('Hi', 'bad; Remove-Item *'), /not installed/);
  assert.equal(calls.length, 1, 'PowerShell did not run for the refused id');
});

test('on Windows, the real voices of this PC are read, and one of them speaks', { skip: process.platform !== 'win32' }, async () => {
  const windows = winvoices.createWindowsVoices();
  const found = await windows.list();
  assert.equal(found.error, null);
  assert.ok(found.voices.length >= 1, 'at least one voice is installed');
  const sound = await windows.synthesize('Hello from danna.', found.voices[0].id);
  assert.equal(sound.toString('ascii', 0, 4), 'RIFF');
  assert.ok(sound.length > 1000, 'the voice made a sentence of sound');
});

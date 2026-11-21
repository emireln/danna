// The voices installed on this PC, read through the Windows speech service (the same list that the Narrator and the
// natural voices use). Windows PowerShell runs the small scripts below: one lists the voices, the other turns a text
// into a WAV file with one voice. Nothing is installed, and nothing is sent anywhere: the speech happens on this PC.
const { execFile } = require('node:child_process');

const NATURAL = /natural|neural|online/i;

// Prints one line per voice: VOICE|name|language|gender|id|description. The console is set to UTF-8 first.
const LIST_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime] | Out-Null
  foreach ($voice in [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices) {
    'VOICE|' + $voice.DisplayName + '|' + $voice.Language + '|' + $voice.Gender + '|' + $voice.Id + '|' + $voice.Description
  }
} catch {
  'ERROR|' + $_.Exception.Message
  exit 1
}
`;

// Reads the text and the voice id from the environment, and prints the WAV file as one base64 line: WAV|<base64>.
const SPEAK_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
  })[0]
  function Await-WinRt($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
  }
  [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime] | Out-Null
  [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
  $wanted = $env:DANNA_TTS_VOICE
  $text = $env:DANNA_TTS_TEXT
  $voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Id -eq $wanted } | Select-Object -First 1
  if (-not $voice) {
    'ERROR|That voice is not installed.'
    exit 2
  }
  $synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
  $synth.Voice = $voice
  $stream = Await-WinRt ($synth.SynthesizeTextToStreamAsync($text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
  $size = [uint32]$stream.Size
  $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
  $loaded = Await-WinRt ($reader.LoadAsync($size)) ([uint32])
  $bytes = New-Object byte[] $loaded
  $reader.ReadBytes($bytes)
  'WAV|' + [Convert]::ToBase64String($bytes)
} catch {
  'ERROR|' + $_.Exception.Message
  exit 1
}
`;

/** One voice from a line of the list. Null for a line that is not a voice. */
function voiceFromLine(line) {
  if (!line.startsWith('VOICE|')) return null;
  const [name = '', language = '', gender = '', id = '', ...description] = line.slice('VOICE|'.length).split('|');
  if (!id) return null;
  const text = description.join('|');
  const sex = gender.trim().toLowerCase();
  return {
    id: id.trim(),
    name: name.trim(),
    language: language.trim(),
    gender: sex === 'female' || sex === 'male' ? sex : 'unknown',
    natural: NATURAL.test(`${name} ${text}`),
  };
}

/** The voices in the output of the list script. Lines that are not voices are skipped. */
function parseVoiceLines(output) {
  return String(output)
    .split(/\r?\n/)
    .map(voiceFromLine)
    .filter(Boolean);
}

/** The voice that sounds most natural: a natural English voice, American first. Null when there is none. */
function recommendedVoice(voices) {
  const english = voices.filter((voice) => /^en([-_]|$)/i.test(voice.language) && voice.natural);
  return english.find((voice) => /^en[-_]US$/i.test(voice.language)) ?? english[0] ?? null;
}

/** The WAV bytes in the output of the speak script. Throws the message the script gave when it failed. */
function parseSpeechOutput(output) {
  const lines = String(output).split(/\r?\n/);
  const error = lines.find((line) => line.startsWith('ERROR|'));
  if (error) throw new Error(error.slice('ERROR|'.length) || 'The voice on this PC could not speak.');
  const wav = lines.find((line) => line.startsWith('WAV|'));
  if (!wav) throw new Error('The voice on this PC did not return any sound.');
  const bytes = Buffer.from(wav.slice('WAV|'.length), 'base64');
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF') throw new Error('The voice on this PC returned a damaged sound.');
  return bytes;
}

/** Runs a script with Windows PowerShell. The script is passed encoded, so nothing in it is read by the shell. */
function runPowerShell(script, env = {}, { signal, timeout = 60000 } = {}) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true, timeout, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8', env: { ...process.env, ...env }, signal },
      (error, stdout, stderr) => resolve({ stdout: String(stdout || ''), stderr: String(stderr || ''), error: error || null }),
    );
  });
}

/**
 * The voices of this PC, with a short cache: the list changes only when a voice is added or removed. `run` runs a
 * script and returns its output; tests stand in for it, and the app uses PowerShell.
 */
function createWindowsVoices({ run = runPowerShell, now = () => Date.now(), cacheMs = 5 * 60 * 1000 } = {}) {
  let cache = null;

  async function list() {
    if (cache && now() - cache.at < cacheMs) return cache.result;
    const { stdout, error } = await run(LIST_SCRIPT, {});
    const voices = parseVoiceLines(stdout);
    const failed = voices.length === 0 && (error !== null || stdout.includes('ERROR|'));
    const result = {
      voices,
      recommended: recommendedVoice(voices)?.id ?? null,
      error: failed ? 'Could not read the voices on this PC.' : null,
    };
    if (!failed) cache = { at: now(), result };
    return result;
  }

  /** The voices already read, without starting PowerShell again. Null when they were never read. */
  function known() {
    return cache ? cache.result.voices : null;
  }

  /** The WAV bytes of a text, read with one voice of this PC. Throws when the voice cannot speak. */
  async function synthesize(text, id, { signal } = {}) {
    if (!WINDOWS_ID_PATTERN.test(id)) throw new Error('That voice is not installed.');
    const { stdout, error } = await run(SPEAK_SCRIPT, { DANNA_TTS_TEXT: text, DANNA_TTS_VOICE: id }, { signal });
    if (error && !stdout.includes('WAV|') && !stdout.includes('ERROR|')) throw new Error('The voice on this PC could not speak.');
    return parseSpeechOutput(stdout);
  }

  return { list, known, synthesize };
}

const WINDOWS_ID_PATTERN = /^[A-Za-z0-9_.\\:\- ]{1,300}$/;

module.exports = {
  LIST_SCRIPT,
  SPEAK_SCRIPT,
  parseVoiceLines,
  recommendedVoice,
  parseSpeechOutput,
  createWindowsVoices,
  runPowerShell,
};

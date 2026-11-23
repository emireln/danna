// A recording as a WAV file. The browser records in its own format, which the speech services do not all take, so every
// recording is decoded and written again here: 16 kHz, mono, 16-bit. encodeWav is pure. recordingToWav needs the
// browser's audio decoder.

/** The rate of the WAV files sent for speech to text. Speech needs no more than this. */
export const SPEECH_RATE = 16000;

/** The samples as a WAV file: a 44-byte header, then the samples as 16-bit little-endian numbers. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true); // the size of the format part
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // one channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // bytes per second: the rate times 2 bytes per sample
  view.setUint16(32, 2, true); // bytes per sample
  view.setUint16(34, 16, true); // bits per sample
  text(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return buffer;
}

/** A recording, in whatever format the browser made it, as a 16 kHz mono WAV file. Throws when the browser cannot read it. */
export async function recordingToWav(recording: Blob): Promise<ArrayBuffer> {
  const decoder = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decoder.decodeAudioData(await recording.arrayBuffer());
  } finally {
    void decoder.close();
  }
  // Playing the buffer into a one-channel context at the speech rate mixes it down to mono and resamples it.
  const frames = Math.max(1, Math.ceil(decoded.duration * SPEECH_RATE));
  const context = new OfflineAudioContext(1, frames, SPEECH_RATE);
  const source = context.createBufferSource();
  source.buffer = decoded;
  source.connect(context.destination);
  source.start();
  const rendered = await context.startRendering();
  return encodeWav(rendered.getChannelData(0), SPEECH_RATE);
}

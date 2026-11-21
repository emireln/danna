// The sound formats of the live conversation. The microphone goes up as 16-bit PCM at 16 kHz; the coach's voice comes
// down as 16-bit PCM at 24 kHz. Both are mono and little-endian.

export const MIC_RATE = 16000;
export const VOICE_RATE = 24000;

/** Floats between -1 and 1 become 16-bit samples. Values outside that range are clamped. */
export function floatToPcm16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const value = Math.max(-1, Math.min(1, input[i]));
    out[i] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }
  return out;
}

/** 16-bit little-endian bytes become floats between -1 and 1. A trailing odd byte is left out. */
export function pcm16ToFloat(bytes: Uint8Array): Float32Array<ArrayBuffer> {
  const count = bytes.byteLength >> 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, count * 2);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i += 1) out[i] = view.getInt16(i * 2, true) / 0x8000;
  return out;
}

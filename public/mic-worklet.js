// The microphone of the live conversation, in the audio thread. The browser gives the sound at its own rate (often 48 kHz).
// This turns it into 16 kHz, 16-bit mono frames of 40 ms, and posts each frame to the page with its loudness from 0 to 1.
// It is plain JavaScript because an audio worklet is loaded from a file beside the page.
const OUT_RATE = 16000;
const FRAME = 640; // 40 ms at 16 kHz

class MicFrames extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / OUT_RATE; // input samples for each output sample
    this.position = 0; // where the next output sample lies, counted from the start of the current block
    this.previous = 0; // the last input sample of the block before
    this.frame = new Float32Array(FRAME);
    this.filled = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input || input.length === 0) return true;
    let position = this.position;
    // Each output sample is interpolated between the two input samples around its position.
    while (position < input.length - 1) {
      const index = Math.floor(position);
      const fraction = position - index;
      const a = index < 0 ? this.previous : input[index];
      const b = input[index + 1];
      this.push(a + (b - a) * fraction);
      position += this.step;
    }
    this.position = position - input.length;
    this.previous = input[input.length - 1];
    return true;
  }

  push(value) {
    this.frame[this.filled] = value;
    this.filled += 1;
    if (this.filled < FRAME) return;
    const pcm = new Int16Array(FRAME);
    let sum = 0;
    for (let i = 0; i < FRAME; i += 1) {
      const sample = Math.max(-1, Math.min(1, this.frame[i]));
      pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      sum += sample * sample;
    }
    this.filled = 0;
    const level = Math.min(1, Math.sqrt(sum / FRAME) * 4);
    this.port.postMessage({ pcm: pcm.buffer, level }, [pcm.buffer]);
  }
}

registerProcessor('danna-mic', MicFrames);

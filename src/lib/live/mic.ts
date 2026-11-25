// The microphone of the live conversation. The sound is read in the audio thread (public/mic-worklet.js), which turns it
// into frames of 16 kHz, 16-bit mono PCM, 40 ms each. A frame goes to `onFrame` only while `sending()` says so.
import { userError } from '../bridge';

export interface Microphone {
  /** Stops the capture and releases the microphone, so the browser's microphone light goes off. */
  stop: () => void;
}

/** The learner's words about a microphone that could not be used, in the words of the app. */
function microphoneError(error: unknown): Error {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return userError('Danna needs the microphone. Allow it for Danna in the Windows settings, then try again.');
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return userError('No microphone was found. Connect one, then try again.');
  }
  return userError('The microphone could not start. Try again.');
}

/** Opens the microphone and sends its frames while `sending()` is true. */
export async function openMicrophone(
  onFrame: (frame: ArrayBuffer, level: number) => void,
  sending: () => boolean,
): Promise<Microphone> {
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined') {
    throw userError('The microphone is not available on this device.');
  }
  let stream: MediaStream;
  try {
    // The echo canceller keeps the coach's own voice out of what the learner's microphone hears.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (error) {
    throw microphoneError(error);
  }
  // The browser's own rate is used; the worklet converts it to 16 kHz.
  const context = new AudioContext();
  try {
    await context.audioWorklet.addModule(new URL('mic-worklet.js', document.baseURI).href);
    const source = context.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(context, 'danna-mic', { numberOfOutputs: 1, outputChannelCount: [1] });
    // The worklet makes no sound. It is wired to the output at zero volume, so the browser keeps running it.
    const silent = context.createGain();
    silent.gain.value = 0;
    source.connect(node);
    node.connect(silent);
    silent.connect(context.destination);
    node.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => {
      if (sending()) onFrame(event.data.pcm, event.data.level);
    };
    if (context.state !== 'running') await context.resume().catch(() => undefined);
    return {
      stop() {
        node.port.onmessage = null;
        try {
          source.disconnect();
          node.disconnect();
          silent.disconnect();
        } catch {
          // The nodes are already disconnected.
        }
        stream.getTracks().forEach((track) => track.stop());
        void context.close().catch(() => undefined);
      },
    };
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    void context.close().catch(() => undefined);
    throw error instanceof Error && error.message.includes('@@user@@') ? error : userError('The microphone could not start. Try again.');
  }
}

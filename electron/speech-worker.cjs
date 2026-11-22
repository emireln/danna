// The built-in voice, in its own process. Loading the model and making the sound take a few seconds of processor time,
// and that time is spent here, so the window keeps answering while a voice is being made. The main process starts this
// file as a utility process and sends it the texts (electron/speech-host.cjs); the sound comes back piece by piece.
const os = require('node:os');
const kokoro = require('./kokoro.cjs');

/**
 * All but two of the processors, and at least two. The voice runs at a lower priority than the window (electron/speech-host.cjs),
 * so the window keeps its share of the processor; the two left out are for the rest of the computer.
 */
function defaultThreads() {
  return Math.max(2, os.cpus().length - 2);
}

/**
 * Serves speak and stop requests from `port` (a message port: the utility process's parent port in the app, a stand-in
 * in the tests). `engine` is the built-in engine from electron/kokoro.cjs.
 */
function createWorker({ port, engine }) {
  const jobs = new Map();

  async function speak({ id, text, voice }) {
    const controller = new AbortController();
    jobs.set(id, controller);
    try {
      for await (const wav of engine.speakPieces(text, voice, { signal: controller.signal })) {
        // A stopped reading sends nothing more, even if the engine had one more piece ready.
        if (controller.signal.aborted) break;
        // A copy, so the message carries exactly these bytes and nothing else from the buffer.
        port.postMessage({ type: 'chunk', id, audio: new Uint8Array(wav) });
      }
      port.postMessage({ type: 'done', id });
    } catch (error) {
      port.postMessage({ type: 'done', id, error: (error && error.message) || 'The voice could not speak. Try again.' });
    } finally {
      jobs.delete(id);
    }
  }

  function onMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'speak' && typeof message.id === 'string') {
      void speak(message);
    } else if (message.type === 'stop' && typeof message.id === 'string') {
      const job = jobs.get(message.id);
      if (job) job.abort();
    }
  }

  // The utility process's parent port hands over a message event; a plain port hands over the message itself.
  port.on('message', (event) => onMessage(event && event.data !== undefined ? event.data : event));
  return { onMessage, jobs };
}

// Started as a utility process by electron/speech-host.cjs, which passes the folder of the model as the first argument.
if (process.parentPort) {
  const engine = kokoro.createSpeechEngine({ modelDir: process.argv[2], threads: defaultThreads() });
  createWorker({ port: process.parentPort, engine });
}

module.exports = { createWorker, defaultThreads };

// The built-in voice's host in the main process. The voice runs in its own process (electron/speech-worker.cjs), so the
// main process and the window never wait for it. This host starts that process on the first request, sends it each text,
// receives the sound back piece by piece, and starts it again if it has stopped.
const os = require('node:os');

// The voice is lower in priority than the window, so making a sound never takes time from the screen.
function lowerPriority(pid) {
  try {
    os.setPriority(pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
  } catch {
    // The process keeps its priority: the voice is slower, but the window is not affected.
  }
}

/**
 * `available(voice)` says whether the built-in voice can read with a voice, without starting the process. `fork()` starts
 * the utility process and returns it. `setPriority` is replaceable, so the tests can stand in for it.
 */
function createSpeechHost({ available, fork, setPriority = lowerPriority }) {
  let child = null;
  let counter = 0;
  const waiting = new Map();

  function finishAll(reason) {
    for (const deliver of waiting.values()) deliver({ type: 'done', error: reason });
    waiting.clear();
  }

  function connect() {
    if (child) return child;
    const started = fork();
    child = started;
    started.on('message', (message) => {
      const deliver = message && typeof message.id === 'string' ? waiting.get(message.id) : undefined;
      if (deliver) deliver(message);
    });
    started.on('spawn', () => setPriority(started.pid));
    started.on('exit', () => {
      if (child === started) child = null;
      finishAll('The voice stopped unexpectedly. Try again.');
    });
    return started;
  }

  /** The sound of a text, piece by piece, as the voice makes it. Stops when the signal is aborted. */
  async function* speakPieces(text, voice, { signal } = {}) {
    if (signal && signal.aborted) return;
    const proc = connect();
    const id = `voice-${++counter}`;
    const queue = [];
    let wake = null;
    let ended = false;
    let failure = null;
    const awaken = () => {
      if (wake) {
        const resolve = wake;
        wake = null;
        resolve();
      }
    };
    waiting.set(id, (message) => {
      if (message.type === 'chunk') {
        queue.push(message.audio);
      } else {
        ended = true;
        failure = message.error || null;
        waiting.delete(id);
      }
      awaken();
    });
    const stop = () => proc.postMessage({ type: 'stop', id });
    if (signal) signal.addEventListener('abort', stop, { once: true });
    proc.postMessage({ type: 'speak', id, text, voice });
    try {
      for (;;) {
        if (queue.length > 0) {
          yield queue.shift();
        } else if (ended) {
          break;
        } else {
          await new Promise((resolve) => {
            wake = resolve;
          });
        }
      }
    } finally {
      if (signal) signal.removeEventListener('abort', stop);
      waiting.delete(id);
    }
    if (failure) throw new Error(failure);
  }

  return { available, speakPieces };
}

module.exports = { createSpeechHost };

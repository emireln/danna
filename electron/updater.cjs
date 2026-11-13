// Keeps danna up to date with the newest GitHub release (see the publish settings in package.json).
// A newer installer is downloaded in the background. When it is ready, the interface is told, and the
// update is installed when danna closes, or at once if the person chooses to restart. Nothing is
// installed while danna is in use.
const FIRST_CHECK_MS = 20 * 1000;
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

/**
 * @param {object} options
 * @param {object} options.app         Electron's app (only isPackaged is read).
 * @param {object} options.updater     electron-updater's autoUpdater, or a stand-in in tests.
 * @param {(channel: string, payload: unknown) => void} options.send  Sends a message to the interface.
 * @param {(message: unknown) => void} [options.log]
 */
function createUpdates({ app, updater, send, log = () => {} }) {
  let current = { state: 'idle', version: null };
  let timers = [];

  const publish = (next) => {
    current = next;
    send('update:status', current);
  };

  if (updater) {
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.logger = { info: log, warn: log, error: log, debug: () => {} };
    updater.on('update-available', (info) => publish({ state: 'downloading', version: info.version }));
    updater.on('update-downloaded', (info) => publish({ state: 'ready', version: info.version }));
    updater.on('update-not-available', () => publish({ state: 'idle', version: null }));
    // A failed check is not shown as an error: the next check tries again, and the last state stays.
    updater.on('error', (error) => log(error));
  }

  // Checks now and says what was found: 'downloading' or 'ready' for a newer version (it is fetched in the
  // background), 'idle' when this is the newest, 'unavailable' outside the installed app, or 'failed'.
  async function check() {
    if (!updater || !app.isPackaged) return { state: 'unavailable', version: null };
    try {
      await updater.checkForUpdates();
    } catch (error) {
      log(error);
      return { state: 'failed', version: null };
    }
    return { state: current.state, version: current.version };
  }

  return {
    status: () => current,
    check,
    /** Restarts now, with the new version, when one is ready. */
    install() {
      if (current.state === 'ready' && updater) updater.quitAndInstall(false, true);
    },
    /** Starts the checks: once shortly after launch, then every few hours. */
    start() {
      if (!updater || !app.isPackaged) return;
      timers.push(setTimeout(() => {
        check();
        timers.push(setInterval(check, CHECK_EVERY_MS));
      }, FIRST_CHECK_MS));
    },
    stop() {
      for (const timer of timers) {
        clearTimeout(timer);
        clearInterval(timer);
      }
      timers = [];
    },
  };
}

module.exports = { createUpdates };

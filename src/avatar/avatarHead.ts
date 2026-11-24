// The coach's face and voice. TalkingHead (MIT, Mika Suominen, github.com/met4citizen/TalkingHead) draws the avatar,
// lip-syncs it to the voice, and moves its head, eyes, hands and mood. This file loads it, shows the coach, and gives
// the talk its voice (src/lib/live/voice.ts). The lip-sync language modules are served from public/talkinghead/.
import type { CoachInfo } from './characters';
import type { VoiceHead } from '../lib/live/voice';

/** The hand gestures the learner can ask the coach for. TalkingHead knows these names. */
export const GESTURES = ['handup', 'thumbup', 'ok', 'shrug'] as const;
export type Gesture = (typeof GESTURES)[number];

/** The coach as the screen uses it: its voice, and the gestures. */
export interface AvatarHead extends VoiceHead {
  gesture(name: Gesture): void;
  dispose(): void;
}

/** The Gemini voice is 24 kHz 16-bit PCM. The audio context runs at the same rate, so nothing is resampled. */
const VOICE_RATE = 24000;

type LipsyncLang = 'en' | 'pt_br';

/**
 * The address of a file of the app's own folder. It is built from the app's origin, not from the page's path, so a page
 * that is open at a deeper address still finds its files.
 */
function appFileUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, `${window.location.origin}/`).href;
}

/** Loads the lip-sync processor of a language: its module is a plain file of the app, so it is imported by its address. */
async function loadLipsync(lipsync: Record<string, unknown>, lang: LipsyncLang): Promise<void> {
  const url = appFileUrl(`talkinghead/lipsync-${lang}.mjs`);
  const module = (await import(/* @vite-ignore */ url)) as Record<string, new () => unknown>;
  const className = lang === 'en' ? 'LipsyncEn' : 'LipsyncPt_br';
  lipsync[lang] = new module[className]();
}

/** One buffer with the sound of several, one after another. */
function joinBuffers(context: AudioContext, buffers: AudioBuffer[]): AudioBuffer {
  if (buffers.length === 1) return buffers[0];
  const length = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
  const channels = Math.max(...buffers.map((buffer) => buffer.numberOfChannels));
  const joined = context.createBuffer(channels, length, context.sampleRate);
  for (let channel = 0; channel < channels; channel += 1) {
    const out = joined.getChannelData(channel);
    let offset = 0;
    for (const buffer of buffers) {
      out.set(buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1)), offset);
      offset += buffer.length;
    }
  }
  return joined;
}

/**
 * Draws the coach on `node` and returns its voice. Rejects when the model cannot be loaded, for example without WebGL,
 * so the screen can say so. Call `dispose` to remove the coach and free the sound.
 */
export async function mountAvatarHead(node: HTMLElement, coach: CoachInfo, lang: 'en' | 'pt'): Promise<AvatarHead> {
  const { TalkingHead } = await import('@met4citizen/talkinghead');
  const audio = new AudioContext({ sampleRate: VOICE_RATE });
  // TalkingHead resumes the sound without a catch. When the coach leaves the screen while the sound still waits for a
  // click, the context is closed and that resume is refused. The refusal is expected, so it is handled here.
  const resumeSound = audio.resume.bind(audio);
  audio.resume = (): Promise<void> => resumeSound().catch((): void => undefined);
  const lipsyncLang: LipsyncLang = lang === 'pt' ? 'pt_br' : 'en';
  const head = new TalkingHead(node, {
    audioCtx: audio,
    // The modules are loaded below, by their address, so the class does not load them from its own folder.
    lipsyncModules: [],
    lipsyncLang,
    cameraView: 'mid',
    cameraRotateEnable: false,
    cameraPanEnable: false,
    cameraZoomEnable: false,
    avatarMood: 'neutral',
    modelPixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    modelFPS: 30,
  });
  try {
    await loadLipsync(head.lipsync, lipsyncLang);
    await head.showAvatar({
      url: appFileUrl(coach.file),
      body: coach.gender === 'male' ? 'M' : 'F',
      lipsyncLang,
      avatarMood: 'neutral',
    });
  } catch (error) {
    head.dispose();
    void audio.close().catch(() => undefined);
    throw error;
  }

  return {
    async decode(pieces) {
      const parts = pieces.filter((piece) => piece.byteLength > 0);
      if (parts.length === 0) return null;
      const buffers: AudioBuffer[] = [];
      for (const piece of parts) {
        // decodeAudioData takes its own copy of the bytes, so each piece is copied first.
        buffers.push(await audio.decodeAudioData(piece.slice().buffer));
      }
      return joinBuffers(audio, buffers);
    },

    async streamStart(onAudioStart, onAudioEnd) {
      await head.streamStart(
        { sampleRate: VOICE_RATE, lipsyncType: 'words', lipsyncLang, waitForAudioChunks: true },
        onAudioStart,
        onAudioEnd,
      );
    },

    streamAudio(chunk) {
      head.streamAudio(chunk);
    },

    streamNotifyEnd() {
      head.streamNotifyEnd();
    },

    streamInterrupt() {
      head.streamInterrupt();
    },

    streamStop() {
      head.streamStop();
    },

    speak(buffer, words, wtimes, wdurations, onDone) {
      head.speakAudio(
        {
          audio: buffer,
          words,
          wtimes,
          wdurations,
          // The marker sits at the very end of the sound, so `onDone` runs when the sentence has been said.
          markers: [onDone],
          mtimes: [Math.max(0, buffer.duration * 1000 - 1)],
        },
        { lipsyncLang },
      );
    },

    stopSpeaking() {
      head.stopSpeaking();
    },

    gesture(name) {
      head.playGesture(name, 3, false, 800);
    },

    dispose() {
      head.dispose();
      void audio.close().catch(() => undefined);
    },
  };
}

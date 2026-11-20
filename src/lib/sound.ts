// The app's short sounds. Each one is made here with the Web Audio API, so no sound file is shipped: a few soft, musical
// notes with a quick attack and a long release, so a sound never clicks or jars.
import { readSoundPrefs, type SoundId } from './preferences';

interface Note {
  /** When the note starts, in seconds from the start of the sound. */
  at: number;
  /** The pitch, in hertz. */
  hz: number;
  /** How long the note rings, in seconds. */
  length: number;
  /** The loudness of the note at full volume. */
  level: number;
  wave?: OscillatorType;
}

// Each sound is a short phrase. The notes are a major triad or a rising or falling step, so they sound pleasant.
const RECIPES: Record<SoundId, Note[]> = {
  // Two bright notes going up: a right answer.
  correct: [
    { at: 0, hz: 659.25, length: 0.26, level: 0.2 },
    { at: 0.085, hz: 880, length: 0.36, level: 0.2 },
  ],
  // Two soft, round notes going down: a wrong answer, without a buzzer.
  wrong: [
    { at: 0, hz: 311.13, length: 0.3, level: 0.16, wave: 'triangle' },
    { at: 0.12, hz: 261.63, length: 0.4, level: 0.14, wave: 'triangle' },
  ],
  // A rising arpeggio that settles on a chord: a lesson or a test is finished.
  complete: [
    { at: 0, hz: 523.25, length: 0.3, level: 0.18 },
    { at: 0.11, hz: 659.25, length: 0.3, level: 0.18 },
    { at: 0.22, hz: 783.99, length: 0.3, level: 0.18 },
    { at: 0.34, hz: 1046.5, length: 1, level: 0.2 },
    { at: 0.34, hz: 783.99, length: 1, level: 0.1 },
  ],
  // A soft glide of two notes: the coach has answered.
  coach: [
    { at: 0, hz: 587.33, length: 0.22, level: 0.13 },
    { at: 0.09, hz: 783.99, length: 0.36, level: 0.12 },
  ],
  // A bell: two long notes, a reminder has arrived.
  reminder: [
    { at: 0, hz: 783.99, length: 0.9, level: 0.16 },
    { at: 0.2, hz: 1046.5, length: 1.2, level: 0.14 },
  ],
};

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructor) return null;
  context ??= new Constructor();
  // A browser may start the context paused. A sound is always played after a press, so resuming it is allowed.
  if (context.state === 'suspended') void context.resume();
  return context;
}

// The volume setting runs from 0 to 100; full volume is 3 times each note's level, so the default sits in the middle.
function play(id: SoundId, volume: number): void {
  const ctx = audioContext();
  if (!ctx || volume <= 0) return;
  const master = (volume / 100) * 3;
  const start = ctx.currentTime + 0.02;
  for (const note of RECIPES[id]) {
    const at = start + note.at;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = note.wave ?? 'sine';
    oscillator.frequency.value = note.hz;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, note.level * master), at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + note.length);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + note.length + 0.05);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
}

/** Plays a sound if the sound settings allow it: the master switch on, and this sound switched on. */
export function playSound(id: SoundId): void {
  const prefs = readSoundPrefs();
  if (!prefs.enabled || !prefs.items[id]) return;
  play(id, prefs.volume);
}

/** Plays a sound on the settings screen, whatever the switches say, so it can be heard before it is switched on. */
export function previewSound(id: SoundId): void {
  play(id, readSoundPrefs().volume);
}

// The character's body language: where the eyes look, when it blinks, how it tilts its head with the intonation, and how
// its mouth moves with the voice. These are pure functions of time and sound, so the tests need no 3D scene. The scene
// (scene.ts) only shows the pose this file computes.
import { CLOSED_MOUTH, ease, mouthFor, type Mouth, type SoundFrame } from '../lib/live/analysis';
import type { LiveStatus } from '../lib/live/conversation';

export interface RigInput {
  status: LiveStatus;
  /** The coach's voice now (silence when it is not speaking). */
  coach: SoundFrame;
  /** How loud the learner is now, from 0 to 1. */
  user: number;
}

/** Everything the scene needs for one frame. Angles are in radians; the others run from 0 to 1 unless stated. */
export interface Pose extends Mouth {
  yaw: number;
  pitch: number;
  roll: number;
  /** How high the brows are raised. */
  lift: number;
  /** Where the eyes look: -1 left to 1 right, -1 down to 1 up. */
  gazeX: number;
  gazeY: number;
  /** 0 with the eyes open, 1 closed. */
  blink: number;
  /** 1 while the character is thinking (a tilted head, an arm raised). */
  lean: number;
  /** How bright the character's lights are. */
  glow: number;
  /** How far an arm is raised. */
  wave: number;
  /** The body moves up and down, from -1 to 1. */
  bob: number;
}

export interface RigOptions {
  /** Keeps the head still and the body quiet, for people who ask the system for less motion. */
  reducedMotion?: boolean;
  /** Chooses when the character blinks. Tests pass a fixed sequence. */
  random?: () => number;
}

const BLINK_SECONDS = 0.16;
/** The intonation: a voice that rises above this pitch (in hertz) lifts the brows and tilts the head up. */
const PITCH_MIDDLE = 170;
const PITCH_RANGE = 120;

function clampRange(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

interface Target {
  yaw: number;
  pitch: number;
  roll: number;
  lift: number;
  gazeX: number;
  gazeY: number;
  lean: number;
  glow: number;
  wave: number;
  bob: number;
}

/** The pose the character is moving towards, for this status and sound. */
function targetFor(input: RigInput, time: number, motion: number): Target {
  const idle = Math.sin(time * 0.5) * 0.04 * motion;
  // The intonation of the coach: above the middle pitch the voice rises, and the head follows it.
  const intonation = input.coach.pitch > 0 ? clampRange((input.coach.pitch - PITCH_MIDDLE) / PITCH_RANGE, -1, 1) : 0;
  switch (input.status) {
    case 'listening':
      return {
        yaw: 0.08 * motion,
        pitch: (0.04 + input.user * 0.1) * motion,
        roll: 0,
        lift: 0.2,
        gazeX: 0.1 * motion,
        gazeY: 0,
        lean: 0,
        glow: 0.6,
        wave: 0,
        bob: input.user * 0.2 * motion,
      };
    case 'thinking':
      return {
        yaw: -0.22 * motion,
        pitch: -0.05 * motion,
        roll: 0.12 * motion,
        lift: 0.4,
        gazeX: -0.6 * motion,
        gazeY: 0.5 * motion,
        lean: 1,
        glow: 0.4 + 0.2 * Math.sin(time * 4) * motion,
        wave: 0.6 * motion,
        bob: 0,
      };
    case 'speaking':
      return {
        yaw: 0.05 * Math.sin(time * 0.7) * motion,
        pitch: (-0.06 * Math.max(0, intonation) + 0.02 * Math.sin(time * 0.9)) * motion,
        roll: 0.04 * Math.sin(time * 0.5) * motion,
        lift: clampRange(0.15 + Math.max(0, intonation) * 0.8, 0, 1),
        gazeX: 0,
        gazeY: 0,
        lean: 0,
        glow: clampRange(0.8 + input.coach.level * 0.4, 0, 1),
        wave: 0.2 * motion,
        bob: input.coach.level * 0.35 * motion,
      };
    case 'ended':
      return { yaw: 0, pitch: 0, roll: 0, lift: 0, gazeX: 0, gazeY: 0, lean: 0, glow: 0, wave: 0, bob: 0 };
    default:
      // idle and connecting: a calm breathing sway.
      return {
        yaw: idle,
        pitch: idle * 0.5,
        roll: 0,
        lift: 0,
        gazeX: 0,
        gazeY: 0,
        lean: 0,
        glow: 0.25 + 0.1 * Math.sin(time * 1.2),
        wave: 0,
        bob: Math.sin(time * 1.3) * 0.03 * motion,
      };
  }
}

export function createRig(options: RigOptions = {}) {
  const random = options.random ?? Math.random;
  const motion = options.reducedMotion ? 0.25 : 1;
  let time = 0;
  let mouth: Mouth = CLOSED_MOUTH;
  let nextBlink = 1.5 + random() * 2;
  let blinkStart = -1;
  let current: Target = targetFor({ status: 'idle', coach: { level: 0, pitch: 0, low: 0, mid: 0, high: 0 }, user: 0 }, 0, motion);

  return {
    update(input: RigInput, seconds: number): Pose {
      const dt = clampRange(seconds, 0, 0.1);
      time += dt;
      mouth = mouthFor(input.coach, mouth, dt);

      if (blinkStart < 0 && time >= nextBlink) blinkStart = time;
      let blink = 0;
      if (blinkStart >= 0) {
        const phase = (time - blinkStart) / BLINK_SECONDS;
        if (phase >= 1) {
          blinkStart = -1;
          nextBlink = time + 2 + random() * 3.5;
        } else {
          blink = Math.sin(Math.PI * phase);
        }
      }
      // A character that has ended rests with its eyes closed.
      if (input.status === 'ended') blink = Math.max(blink, 0.85);

      const target = targetFor(input, time, motion);
      const rate = 6;
      current = {
        yaw: ease(current.yaw, target.yaw, dt, rate),
        pitch: ease(current.pitch, target.pitch, dt, rate),
        roll: ease(current.roll, target.roll, dt, rate),
        lift: ease(current.lift, target.lift, dt, rate),
        gazeX: ease(current.gazeX, target.gazeX, dt, rate * 2),
        gazeY: ease(current.gazeY, target.gazeY, dt, rate * 2),
        lean: ease(current.lean, target.lean, dt, rate),
        glow: ease(current.glow, target.glow, dt, rate),
        wave: ease(current.wave, target.wave, dt, rate),
        bob: ease(current.bob, target.bob, dt, rate),
      };
      return {
        open: mouth.open,
        round: mouth.round,
        wide: mouth.wide,
        yaw: current.yaw,
        pitch: current.pitch,
        roll: current.roll,
        lift: current.lift,
        gazeX: current.gazeX,
        gazeY: current.gazeY,
        blink,
        lean: current.lean,
        glow: current.glow,
        wave: current.wave,
        bob: current.bob,
      };
    },
  };
}

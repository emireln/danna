// The coach's body language: where the eyes look, when it blinks, how the head moves with the status and the intonation,
// and how the mouth moves with the voice. These are pure functions of time and sound, so the tests need no 3D scene. The
// 3D scene (coach3d.ts) turns the pose into blend shape weights (morphs.ts) and bone turns.
import { CLOSED_MOUTH, ease, mouthFor, SILENCE, type Mouth, type SoundFrame } from '../lib/live/analysis';
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
  /** A gentle smile. */
  smile: number;
  /** Where the eyes look: -1 the viewer's left to 1 the viewer's right, and -1 down to 1 up. */
  gazeX: number;
  gazeY: number;
  /** 0 with the eyes open, 1 closed. */
  blink: number;
  /** 1 while the coach is thinking: the head tilts and the eyes look up. */
  lean: number;
  /** The breath, from -1 (out) to 1 (in). */
  breath: number;
}

export interface RigOptions {
  /** Keeps the head still and the breath quiet, for people who ask the system for less motion. */
  reducedMotion?: boolean;
  /** Chooses when the coach blinks. Tests pass a fixed sequence. */
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
  smile: number;
  gazeX: number;
  gazeY: number;
  lean: number;
  breath: number;
}

/** The pose the coach is moving towards, for this status and sound. */
function targetFor(input: RigInput, time: number, motion: number): Target {
  const sway = Math.sin(time * 0.5) * 0.04 * motion;
  const intonation = input.coach.pitch > 0 ? clampRange((input.coach.pitch - PITCH_MIDDLE) / PITCH_RANGE, -1, 1) : 0;
  const breath = Math.sin(time * 1.1) * motion;
  switch (input.status) {
    case 'listening':
      return {
        yaw: 0.06 * motion,
        pitch: (0.03 + input.user * 0.07) * motion,
        roll: 0,
        lift: 0.2,
        smile: 0.3,
        gazeX: 0.05 * motion,
        gazeY: 0,
        lean: 0,
        breath,
      };
    case 'thinking':
      return {
        yaw: -0.18 * motion,
        pitch: -0.04 * motion,
        roll: 0.1 * motion,
        lift: 0.45,
        smile: 0,
        gazeX: -0.5 * motion,
        gazeY: 0.4 * motion,
        lean: 1,
        breath,
      };
    case 'speaking':
      return {
        yaw: 0.04 * Math.sin(time * 0.7) * motion,
        pitch: (-0.06 * Math.max(0, intonation) + 0.015 * Math.sin(time * 0.9)) * motion,
        roll: 0.03 * Math.sin(time * 0.5) * motion,
        lift: clampRange(0.15 + Math.max(0, intonation) * 0.6, 0, 1),
        smile: 0.1,
        gazeX: 0,
        gazeY: 0,
        lean: 0,
        breath,
      };
    case 'ended':
      return { yaw: 0, pitch: 0, roll: 0, lift: 0, smile: 0, gazeX: 0, gazeY: 0, lean: 0, breath: 0 };
    default:
      // idle and connecting: a calm sway and a slow breath.
      return { yaw: sway, pitch: sway * 0.5, roll: 0, lift: 0, smile: 0.1, gazeX: 0, gazeY: 0, lean: 0, breath };
  }
}

export function createRig(options: RigOptions = {}) {
  const random = options.random ?? Math.random;
  const motion = options.reducedMotion ? 0.25 : 1;
  let time = 0;
  let mouth: Mouth = CLOSED_MOUTH;
  let nextBlink = 1.5 + random() * 2;
  let blinkStart = -1;
  let current: Target = targetFor({ status: 'idle', coach: SILENCE, user: 0 }, 0, motion);

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
      // A coach that has ended rests with its eyes closed.
      if (input.status === 'ended') blink = Math.max(blink, 0.85);

      const target = targetFor(input, time, motion);
      const rate = 6;
      current = {
        yaw: ease(current.yaw, target.yaw, dt, rate),
        pitch: ease(current.pitch, target.pitch, dt, rate),
        roll: ease(current.roll, target.roll, dt, rate),
        lift: ease(current.lift, target.lift, dt, rate),
        smile: ease(current.smile, target.smile, dt, rate),
        gazeX: ease(current.gazeX, target.gazeX, dt, rate * 2),
        gazeY: ease(current.gazeY, target.gazeY, dt, rate * 2),
        lean: ease(current.lean, target.lean, dt, rate),
        breath: ease(current.breath, target.breath, dt, rate * 2),
      };
      return { open: mouth.open, round: mouth.round, wide: mouth.wide, blink, ...current };
    },
  };
}

// The face of every coach moves through the same blend shapes (morph targets): the ARKit face shapes and the Oculus visemes
// that each model carries. This file turns the mouth, eyes and brows of the pose into weights for those shapes. It is pure,
// so the tests check every name against the models without a 3D scene.
import type { Mouth } from '../lib/live/analysis';

export interface FacePose {
  /** The shape of the mouth: open, round and wide, each from 0 to 1. */
  mouth: Mouth;
  /** 0 with the eyes open, 1 closed. */
  blink: number;
  /** How high the brows are raised, from 0 to 1. */
  lift: number;
  /** A gentle smile, from 0 to 1. */
  smile: number;
  /** Where the eyes look, from -1 (the viewer's left) to 1 (the viewer's right). */
  gazeX: number;
  /** Where the eyes look, from -1 (down) to 1 (up). */
  gazeY: number;
}

/** The weight of every blend shape the face uses, from 0 to 1. */
export function faceWeights(face: FacePose): Record<string, number> {
  const { open, round, wide } = face.mouth;
  const weights: Record<string, number> = {
    jawOpen: open * 0.8,
    viseme_aa: open * 0.5,
    mouthFunnel: round * 0.7,
    viseme_O: round * 0.6,
    viseme_U: round * 0.3,
    mouthPucker: round * 0.3,
    viseme_E: wide * 0.5,
    viseme_I: wide * 0.25,
    mouthStretchLeft: wide * 0.25,
    mouthStretchRight: wide * 0.25,
    mouthSmileLeft: wide * 0.5 + face.smile * 0.3,
    mouthSmileRight: wide * 0.5 + face.smile * 0.3,
    eyeBlinkLeft: face.blink,
    eyeBlinkRight: face.blink,
    browInnerUp: face.lift * 0.8,
    browOuterUpLeft: face.lift * 0.3,
    browOuterUpRight: face.lift * 0.3,
  };
  // The eyes turn outwards on the side they look to, and inwards on the other eye.
  const toRight = Math.max(0, face.gazeX);
  const toLeft = Math.max(0, -face.gazeX);
  weights.eyeLookOutLeft = toRight * 0.6;
  weights.eyeLookInRight = toRight * 0.6;
  weights.eyeLookOutRight = toLeft * 0.6;
  weights.eyeLookInLeft = toLeft * 0.6;
  const up = Math.max(0, face.gazeY);
  const down = Math.max(0, -face.gazeY);
  weights.eyeLookUpLeft = up * 0.5;
  weights.eyeLookUpRight = up * 0.5;
  weights.eyeLookDownLeft = down * 0.5;
  weights.eyeLookDownRight = down * 0.5;
  return weights;
}

/** Every blend shape name the face uses. Each coach model must carry all of them. */
export const FACE_SHAPES: readonly string[] = Object.keys(
  faceWeights({ mouth: { open: 0, round: 0, wide: 0 }, blink: 0, lift: 0, smile: 0, gazeX: 0, gazeY: 0 }),
);

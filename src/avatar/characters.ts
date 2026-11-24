// The coach of the talk screen. Ana is a real person model that ships with the app (public/characters/ana.glb), made with
// MakeHuman under the CC0 dedication. Her rig and face shapes are the ones TalkingHead needs (the Mixamo bones, and the
// ARKit and Oculus blend shapes), so TalkingHead can move her and lip-sync her (src/avatar/avatarHead.ts). Her credit and
// the license of TalkingHead are in public/characters/CREDITS.md.
// Leo and Mia (Microsoft RocketBox) were removed: their rigs use other bone names and axes, so they need a retargeting
// step before TalkingHead can move them.

export type CoachId = 'ana';

export interface CoachInfo {
  id: CoachId;
  /** The name the coach uses for itself, in the prompt and in the transcript. */
  name: string;
  /** The model file, relative to the app's folder. */
  file: string;
  gender: 'female' | 'male';
  /** The Gemini voice the coach starts with. The learner can choose another one. */
  voice: string;
  /** The license of the model. */
  license: 'CC0';
  /** The words that credit the model, as they are shown on the talk screen. */
  credit: string;
}

export const COACHES: readonly CoachInfo[] = [
  { id: 'ana', name: 'Ana', file: 'characters/ana.glb', gender: 'female', voice: 'Aoede', license: 'CC0', credit: 'MakeHuman' },
];

/** The coach with this id. An unknown or missing id is Ana, the only coach. */
export function coachOf(id: string | null | undefined): CoachInfo {
  return COACHES.find((coach) => coach.id === id) ?? COACHES[0];
}

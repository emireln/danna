// The coaches of the talk screen. Each one is a real person model that ships with the app (public/characters), under a
// license that allows it: Ana is made with MakeHuman (CC0), Leo and Mia are avatars from Microsoft's RocketBox (MIT).
// The credits and the license texts are in public/characters/CREDITS.md.
// All three carry the same ARKit face shapes and Oculus visemes, so one set of shape names moves every face (morphs.ts).

export type CoachId = 'ana' | 'leo' | 'mia';

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
  license: 'CC0' | 'MIT';
  /** The words that credit the model, as they are shown on the talk screen. */
  credit: string;
}

export const COACHES: readonly CoachInfo[] = [
  { id: 'ana', name: 'Ana', file: 'characters/ana.glb', gender: 'female', voice: 'Aoede', license: 'CC0', credit: 'MakeHuman' },
  { id: 'leo', name: 'Leo', file: 'characters/leo.glb', gender: 'male', voice: 'Charon', license: 'MIT', credit: 'Microsoft RocketBox' },
  { id: 'mia', name: 'Mia', file: 'characters/mia.glb', gender: 'female', voice: 'Kore', license: 'MIT', credit: 'Microsoft RocketBox' },
];

/** The coach with this id. An unknown or missing id is Ana, the first coach. */
export function coachOf(id: string | null | undefined): CoachInfo {
  return COACHES.find((coach) => coach.id === id) ?? COACHES[0];
}

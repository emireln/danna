// The pictures of the cards: the 3D picture of each skill (Self study and the skill tiles on Today), the daily goal and
// the level check. Each is a WebP with a transparent background, kept in src/assets/3d/cards.
import goal from '../assets/3d/cards/goal.webp';
import levelCheck from '../assets/3d/cards/level-check.webp';
import listening from '../assets/3d/cards/listening.webp';
import reading from '../assets/3d/cards/reading.webp';
import speaking from '../assets/3d/cards/speaking.webp';
import writing from '../assets/3d/cards/writing.webp';

export const SECTION_ICON: Record<'reading' | 'listening' | 'writing' | 'speaking', string> = {
  reading,
  listening,
  writing,
  speaking,
};

export const GOAL_ICON: string = goal;
export const LEVEL_CHECK_ICON: string = levelCheck;

export const SECTION_BASE: Record<'reading' | 'listening' | 'writing' | 'speaking', string> = {
  reading: 'linear-gradient(135deg, #16237a 0%, #22399c 100%)',
  listening: 'linear-gradient(135deg, #c2410c 0%, #f97316 100%)',
  writing: 'linear-gradient(135deg, #5b21b6 0%, #8b5cf6 100%)',
  speaking: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)',
};

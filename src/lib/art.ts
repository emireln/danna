// The 3D pictures of the app: the picture of each skill (Self study and the skill tiles on Today), the daily goal, the
// level check, and the gem of each league tier. The pictures of the cards are in src/assets/3d/cards and the gems in
// src/assets/3d/league. Each is a WebP with a transparent background, trimmed to the object.
import type { TierId } from './league';
import goal from '../assets/3d/cards/goal.webp';
import levelCheck from '../assets/3d/cards/level-check.webp';
import listening from '../assets/3d/cards/listening.webp';
import reading from '../assets/3d/cards/reading.webp';
import speaking from '../assets/3d/cards/speaking.webp';
import writing from '../assets/3d/cards/writing.webp';
import bronze from '../assets/3d/league/bronze.webp';
import silver from '../assets/3d/league/silver.webp';
import gold from '../assets/3d/league/gold.webp';
import sapphire from '../assets/3d/league/sapphire.webp';
import ruby from '../assets/3d/league/ruby.webp';
import emerald from '../assets/3d/league/emerald.webp';
import diamond from '../assets/3d/league/diamond.webp';

export const SECTION_ICON: Record<'reading' | 'listening' | 'writing' | 'speaking', string> = {
  reading,
  listening,
  writing,
  speaking,
};

export const GOAL_ICON: string = goal;
export const LEVEL_CHECK_ICON: string = levelCheck;

/** The gem of each league tier. */
export const LEAGUE_GEM: Record<TierId, string> = {
  bronze,
  silver,
  gold,
  sapphire,
  ruby,
  emerald,
  diamond,
};

// Each card runs from a deep shade of its colour, under the title, to its bright colour. The Speaking card ends in the
// green of its picture (#7abb6a), so the card and the picture are one colour.
export const SECTION_BASE: Record<'reading' | 'listening' | 'writing' | 'speaking', string> = {
  reading: 'linear-gradient(135deg, #16237a 0%, #22399c 100%)',
  listening: 'linear-gradient(135deg, #c2410c 0%, #f97316 100%)',
  writing: 'linear-gradient(135deg, #5b21b6 0%, #8b5cf6 100%)',
  speaking: 'linear-gradient(135deg, #3f6e3a 0%, #7abb6a 100%)',
};

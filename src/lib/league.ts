// The weekly league (2.0.0): the XP of the last seven days, ranked among the caller and their accepted friends, and
// the tier the caller's XP reaches. Offline there are no friends, so the screen shows the caller's own week.
import { localDate } from './progress';
import type { AttemptRow, LeagueRow } from './types';

export const LEAGUE_DAYS = 7;

/** The tiers, from the lowest. Each starts at its XP for the week. */
export const TIERS = [
  { id: 'bronze', min: 0 },
  { id: 'silver', min: 50 },
  { id: 'gold', min: 120 },
  { id: 'sapphire', min: 220 },
  { id: 'ruby', min: 350 },
  { id: 'emerald', min: 520 },
  { id: 'diamond', min: 750 },
] as const;

export type TierId = (typeof TIERS)[number]['id'];

export interface TierInfo {
  id: TierId;
  /** The tier's place from the bottom: 0 for Bronze. */
  index: number;
  /** The tier above, or null at the top. */
  next: TierId | null;
  /** XP still needed for the next tier, or null at the top. */
  toNext: number | null;
  /** How far the week has got from this tier's floor to the next, 0 to 100. At the top it is 100. */
  progress: number;
}

export function tierOf(weekXp: number): TierInfo {
  const xp = Math.max(0, Math.floor(Number(weekXp) || 0));
  let index = 0;
  TIERS.forEach((tier, position) => {
    if (xp >= tier.min) index = position;
  });
  const current = TIERS[index];
  const above = TIERS[index + 1];
  if (!above) return { id: current.id, index, next: null, toNext: null, progress: 100 };
  const span = above.min - current.min;
  return {
    id: current.id,
    index,
    next: above.id,
    toNext: above.min - xp,
    progress: Math.min(100, Math.max(0, Math.round(((xp - current.min) / span) * 100))),
  };
}

/** The members by their week's XP, most first. Ties keep the order of their names. */
export function ranked(rows: readonly LeagueRow[]): LeagueRow[] {
  return [...rows].sort((a, b) => b.week_xp - a.week_xp || a.display_name.localeCompare(b.display_name));
}

/** The caller's place among the members (1 is first), or null when the caller is not in the list. */
export function placeOf(rows: readonly LeagueRow[], userId: string): { place: number; total: number } | null {
  const order = ranked(rows);
  const index = order.findIndex((row) => row.user_id === userId);
  return index < 0 ? null : { place: index + 1, total: order.length };
}

/** The XP of each local day in the last `days` days, oldest first, for the bars shown without friends. */
export function dailyXp(attempts: readonly AttemptRow[], days = LEAGUE_DAYS, now: Date = new Date()): Array<{ day: string; xp: number }> {
  const out: Array<{ day: string; xp: number }> = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    out.push({ day: localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back)), xp: 0 });
  }
  const position = new Map(out.map((item, index) => [item.day, index]));
  for (const attempt of attempts) {
    const index = position.get(localDate(new Date(attempt.created_at)));
    if (index !== undefined) out[index].xp += Math.max(0, attempt.xp || 0);
  }
  return out;
}

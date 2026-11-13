// Dates, streaks, XP levels and countdowns.
import { getLocale, t } from './i18n';

export function localDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Streak rules: the same day keeps the streak, the next day extends it, a gap restarts it. */
export function nextStreak(lastActive: string | null, streak: number, today = localDate()): number {
  if (lastActive === today) return Math.max(1, streak);
  const yesterday = localDate(new Date(Date.now() - 86_400_000));
  return lastActive === yesterday ? streak + 1 : 1;
}

/** The streak as it stands today: it still counts on the day after the last study day. */
export function activeStreak(profile: { streak: number; last_active: string | null }, today = localDate()): number {
  if (profile.streak <= 0 || !profile.last_active) return 0;
  return profile.last_active === today || profile.last_active === previousDay(today) ? profile.streak : 0;
}

function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return localDate(new Date(y, m - 1, d - 1));
}

export type StreakTier = 'ember' | 'blaze' | 'inferno';

/** The flame grows with the streak: a small one, an animated one from 10 days, and a blue one from 50 days. */
export function streakTier(days: number): StreakTier {
  if (days >= 50) return 'inferno';
  if (days >= 10) return 'blaze';
  return 'ember';
}

export function levelInfo(xp: number): { level: number; into: number; span: number; percent: number } {
  const span = 200;
  const level = Math.floor(xp / span) + 1;
  const into = xp % span;
  return { level, into, span, percent: Math.round((into / span) * 100) };
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

// Dates follow the app's language: "Mar 4" in English, "4 de mar." in Portuguese.
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(getLocale(), { month: 'short', day: 'numeric' }).format(new Date(iso));
}

export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat(getLocale(), { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso));
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return t('just now');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t('{minutes} min ago', { minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('{hours} h ago', { hours });
  const days = Math.round(hours / 24);
  return days === 1 ? t('yesterday') : t('{days} days ago', { days });
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return t('{seconds} s', { seconds });
  return t('{minutes} min', { minutes: Math.round(seconds / 60) });
}

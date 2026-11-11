// Dates, streaks, XP levels and countdowns.

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

// The interface is English, so dates follow the same locale instead of the system language.
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));
}

export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso));
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  return `${Math.round(seconds / 60)} min`;
}

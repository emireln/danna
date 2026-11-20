// Sends the reminders the learner has switched on. It runs while danna is open, and it only sends a reminder while danna
// is in the background (minimised, hidden in the tray, or behind another window), because then a message can help.
import { useEffect } from 'react';
import { useAppData } from '../state/appData';
import { useAuth } from '../state/auth';
import { bridge } from '../lib/bridge';
import { readReminderHistory, readReminderPrefs, writeReminderHistory } from '../lib/preferences';
import { daysUntil, activeStreak, localDate } from '../lib/progress';
import { dayActivity } from '../lib/quests';
import { daysBetween, recordReminder, reminderFor, type Reminder, type ReminderFacts } from '../lib/reminders';
import { playSound } from '../lib/sound';

const CHECK_EVERY_MS = 5 * 60_000;
const CHECK_AFTER_HIDING_MS = 10_000;

function clockOf(now: Date): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function canNotify(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

function show(reminder: Reminder): void {
  try {
    const note = new Notification(reminder.title, { body: reminder.body, tag: `danna-${reminder.id}`, silent: true });
    // Clicking the message brings danna forward on the page it is about, even from the tray.
    note.onclick = () => {
      void bridge?.window?.show?.();
      window.focus();
      window.location.hash = `#${reminder.route}`;
      note.close();
    };
    playSound('reminder');
  } catch (error) {
    console.error('Could not show a reminder', error);
  }
}

export function ReminderSync() {
  const { backend } = useAuth();
  const { profile } = useAppData();

  useEffect(() => {
    if (!backend || !profile) return undefined;
    let busy = false;

    const check = async () => {
      if (busy || !canNotify()) return;
      const prefs = readReminderPrefs();
      if (!prefs.enabled) return;
      // While danna is on screen and in use, the screen already says what matters. A reminder is for when it is not.
      if (document.visibilityState === 'visible' && document.hasFocus()) return;
      busy = true;
      try {
        const now = new Date();
        const today = localDate(now);
        const [attempts, items, cards] = await Promise.all([
          backend.listAttempts(200),
          backend.listReviewItems(),
          backend.listDueCards(now.toISOString(), 100),
        ]);
        const facts: ReminderFacts = {
          today,
          clock: clockOf(now),
          hour: now.getHours(),
          streak: activeStreak(profile),
          studiedToday: profile.last_active === today,
          minutesToday: dayActivity(attempts, today).minutes,
          dailyMinutes: profile.daily_minutes,
          dueCards: items.filter((item) => new Date(item.due_at).getTime() <= now.getTime()).length + cards.length,
          daysSinceStudy: profile.last_active ? daysBetween(profile.last_active, today) : null,
          examDays: daysUntil(profile.exam_date),
        };
        const history = readReminderHistory();
        const reminder = reminderFor(facts, prefs, history);
        if (!reminder) return;
        writeReminderHistory(recordReminder(history, reminder, today));
        show(reminder);
      } catch (error) {
        console.error('Could not check the reminders', error);
      } finally {
        busy = false;
      }
    };

    const timer = window.setInterval(() => void check(), CHECK_EVERY_MS);
    let hiddenTimer: number | undefined;
    // Leaving danna is the moment a reminder can help most, so the check runs soon after the window is hidden.
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      window.clearTimeout(hiddenTimer);
      hiddenTimer = window.setTimeout(() => void check(), CHECK_AFTER_HIDING_MS);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(hiddenTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [backend, profile]);

  return null;
}

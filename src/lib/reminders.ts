// The reminders DANNA can send. Each one is decided from what the learner has done, so a message only comes when it
// helps: a streak about to break, today's goal not yet reached, cards waiting to be reviewed, an exam close by, or a
// longer break. At most one reminder is sent a day, and the same kind is not repeated too soon.
import { t, tn } from './i18n';
import type { ReminderHistory, ReminderId, ReminderPrefs } from './preferences';

export interface ReminderFacts {
  /** The local day, as YYYY-MM-DD. */
  today: string;
  /** The clock time, as HH:MM. */
  clock: string;
  /** The hour of the day, from 0 to 23. */
  hour: number;
  /** The streak as it stands today. */
  streak: number;
  /** Whether something was practised today. */
  studiedToday: boolean;
  /** Whole minutes practised today. */
  minutesToday: number;
  /** The daily goal, in minutes. */
  dailyMinutes: number;
  /** Review items and flashcards that are due now. */
  dueCards: number;
  /** Days since the last study day, or null when there has been none. */
  daysSinceStudy: number | null;
  /** Days until the exam, or null when no exam date is set. */
  examDays: number | null;
}

export interface Reminder {
  id: ReminderId;
  title: string;
  body: string;
  /** The page the notification opens. */
  route: string;
}

/** No reminder starts at or after this hour, so none arrives late at night. */
const LAST_HOUR = 22;
/** Cards due before a review reminder is worth sending. */
const REVIEW_AT_LEAST = 3;
/** An exam this many days away or closer gets a reminder. */
const EXAM_WITHIN_DAYS = 7;
/** A long-break reminder waits at least this many days after the last one. */
const COMEBACK_EVERY_DAYS = 3;

/** The whole days from one YYYY-MM-DD day to another. */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const days = (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000;
  return Number.isFinite(days) ? Math.round(days) : 0;
}

/** The one reminder to send now, or null. The order is the order of importance: an exam, then the streak, the goal, cards, and a long break. */
export function reminderFor(facts: ReminderFacts, prefs: ReminderPrefs, history: ReminderHistory): Reminder | null {
  if (!prefs.enabled) return null;
  if (history.lastDay === facts.today) return null;
  if (facts.clock < prefs.time || facts.hour >= LAST_HOUR) return null;

  const sentToday = (id: ReminderId) => history.lastByKind[id] === facts.today;

  if (prefs.types.exam && !sentToday('exam') && facts.examDays !== null && facts.examDays >= 0 && facts.examDays <= EXAM_WITHIN_DAYS) {
    const days = facts.examDays;
    return {
      id: 'exam',
      title: days === 0 ? t('Your exam is today') : tn('Your exam is in {count} day', 'Your exam is in {count} days', days, { count: days }),
      body: t('Open your plan and practise the skills the exam asks for.'),
      route: '/exam',
    };
  }

  if (prefs.types.streak && !sentToday('streak') && facts.streak >= 2 && !facts.studiedToday) {
    return {
      id: 'streak',
      title: t('Keep your {days}-day streak', { days: facts.streak }),
      body: t('A short lesson today keeps the flame going.'),
      route: '/',
    };
  }

  if (prefs.types.goal && !sentToday('goal') && facts.minutesToday < facts.dailyMinutes) {
    const left = Math.max(1, Math.round(facts.dailyMinutes - facts.minutesToday));
    return {
      id: 'goal',
      title: t('Daily goal'),
      body: tn('{count} minute left to reach today’s goal.', '{count} minutes left to reach today’s goal.', left, { count: left }),
      route: '/',
    };
  }

  if (prefs.types.review && !sentToday('review') && facts.dueCards >= REVIEW_AT_LEAST) {
    return {
      id: 'review',
      title: tn('{count} card is due', '{count} cards are due', facts.dueCards, { count: facts.dueCards }),
      body: t('Review them now, before you forget them.'),
      route: '/review',
    };
  }

  const lastComeback = history.lastByKind.comeback;
  const comebackDue = !lastComeback || daysBetween(lastComeback, facts.today) >= COMEBACK_EVERY_DAYS;
  if (prefs.types.comeback && comebackDue && facts.daysSinceStudy !== null && facts.daysSinceStudy >= COMEBACK_EVERY_DAYS) {
    const days = facts.daysSinceStudy;
    return {
      id: 'comeback',
      title: t('Your roadmap is waiting'),
      body: tn(
        'You have been away for {count} day. One short lesson is enough to start again.',
        'You have been away for {count} days. One short lesson is enough to start again.',
        days,
        { count: days },
      ),
      route: '/',
    };
  }

  return null;
}

/** The history after a reminder is sent: it counts for the day and for its kind. */
export function recordReminder(history: ReminderHistory, reminder: Reminder, today: string): ReminderHistory {
  return { lastDay: today, lastByKind: { ...history.lastByKind, [reminder.id]: today } };
}

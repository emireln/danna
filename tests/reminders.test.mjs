// The reminders decide from what the learner has done. Each test gives a day's facts and checks the one reminder that
// comes back, or none: the switches, the time window, the one-a-day rule, the order of importance, and the sounds' switches.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let reminders;
let preferences;
let sound;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  reminders = await server.ssrLoadModule('/src/lib/reminders.ts');
  preferences = await server.ssrLoadModule('/src/lib/preferences.ts');
  sound = await server.ssrLoadModule('/src/lib/sound.ts');
});

after(async () => {
  await server?.close();
});

const ON = {
  enabled: true,
  time: '19:00',
  types: { streak: true, goal: true, review: true, exam: true, comeback: true },
};
const NOTHING_SENT = { lastDay: null, lastByKind: {} };

/** A day in the evening with nothing done yet: the facts a test changes one at a time. */
function evening(overrides = {}) {
  return {
    today: '2026-11-20',
    clock: '20:00',
    hour: 20,
    streak: 0,
    studiedToday: false,
    minutesToday: 0,
    dailyMinutes: 15,
    dueCards: 0,
    daysSinceStudy: 0,
    examDays: null,
    ...overrides,
  };
}

test('no reminder is sent while the reminders are switched off', () => {
  const facts = evening({ streak: 5, dueCards: 9 });
  assert.equal(reminders.reminderFor(facts, { ...ON, enabled: false }, NOTHING_SENT), null);
});

test('reminders wait for the chosen time, and stop before ten at night', () => {
  const streak = evening({ streak: 4, clock: '18:59', hour: 18 });
  assert.equal(reminders.reminderFor(streak, ON, NOTHING_SENT), null, 'before the time');
  assert.equal(reminders.reminderFor({ ...streak, clock: '19:00', hour: 19 }, ON, NOTHING_SENT)?.id, 'streak', 'at the time');
  assert.equal(reminders.reminderFor({ ...streak, clock: '22:00', hour: 22 }, ON, NOTHING_SENT), null, 'after ten');
});

test('the streak is kept with a reminder only when it is two days or more and nothing was done today', () => {
  const reminder = reminders.reminderFor(evening({ streak: 6 }), ON, NOTHING_SENT);
  assert.equal(reminder?.id, 'streak');
  assert.equal(reminder?.route, '/');
  assert.match(reminder?.title ?? '', /6/);
  assert.equal(reminders.reminderFor(evening({ streak: 6, studiedToday: true }), ON, NOTHING_SENT)?.id, 'goal', 'studied, goal not reached');
  assert.equal(reminders.reminderFor(evening({ streak: 1 }), { ...ON, types: { ...ON.types, goal: false } }, NOTHING_SENT), null, 'a streak of one is not kept');
});

test('at most one reminder is sent a day', () => {
  const sentToday = { lastDay: '2026-11-20', lastByKind: { goal: '2026-11-20' } };
  assert.equal(reminders.reminderFor(evening({ streak: 6, dueCards: 8 }), ON, sentToday), null);
});

test('a kind already sent today is not sent again, and the next kind takes its place', () => {
  const sent = { lastDay: null, lastByKind: { streak: '2026-11-20' } };
  assert.equal(reminders.reminderFor(evening({ streak: 6 }), ON, sent)?.id, 'goal');
});

test('an exam within a week comes first, and says so when it is today', () => {
  const soon = reminders.reminderFor(evening({ streak: 6, examDays: 3 }), ON, NOTHING_SENT);
  assert.equal(soon?.id, 'exam');
  assert.equal(soon?.route, '/exam');
  assert.match(soon?.title ?? '', /3/);
  assert.equal(reminders.reminderFor(evening({ examDays: 0 }), ON, NOTHING_SENT)?.title, 'Your exam is today');
  assert.notEqual(reminders.reminderFor(evening({ examDays: 8 }), ON, NOTHING_SENT)?.id, 'exam', 'more than a week away');
  assert.notEqual(reminders.reminderFor(evening({ examDays: -1 }), ON, NOTHING_SENT)?.id, 'exam', 'the exam has passed');
});

test('the daily goal reminder shows the minutes left, and stops once the goal is reached', () => {
  const left = reminders.reminderFor(evening({ minutesToday: 5, dailyMinutes: 15 }), ON, NOTHING_SENT);
  assert.equal(left?.id, 'goal');
  assert.match(left?.body ?? '', /10/);
  assert.equal(reminders.reminderFor(evening({ minutesToday: 15, dailyMinutes: 15 }), ON, NOTHING_SENT), null);
});

test('cards to review are reported from three due cards', () => {
  assert.equal(reminders.reminderFor(evening({ minutesToday: 99, dueCards: 2 }), ON, NOTHING_SENT), null);
  const due = reminders.reminderFor(evening({ minutesToday: 99, dueCards: 3 }), ON, NOTHING_SENT);
  assert.equal(due?.id, 'review');
  assert.equal(due?.route, '/review');
});

test('a long break is reported at most every three days', () => {
  const away = evening({ minutesToday: 99, daysSinceStudy: 4 });
  assert.equal(reminders.reminderFor(away, ON, NOTHING_SENT)?.id, 'comeback');
  const recently = { lastDay: null, lastByKind: { comeback: '2026-11-18' } };
  assert.equal(reminders.reminderFor(away, ON, recently), null, 'two days after the last one');
  const later = { lastDay: null, lastByKind: { comeback: '2026-11-17' } };
  assert.equal(reminders.reminderFor(away, ON, later)?.id, 'comeback', 'three days after the last one');
  assert.equal(reminders.reminderFor(evening({ minutesToday: 99, daysSinceStudy: 2 }), ON, NOTHING_SENT), null, 'a short break');
});

test('a kind switched off is never sent, and the next most important one is', () => {
  const noExam = { ...ON, types: { ...ON.types, exam: false } };
  assert.equal(reminders.reminderFor(evening({ streak: 6, examDays: 2 }), noExam, NOTHING_SENT)?.id, 'streak');
});

test('days between two days are counted in whole days, across months', () => {
  assert.equal(reminders.daysBetween('2026-11-20', '2026-11-20'), 0);
  assert.equal(reminders.daysBetween('2026-11-17', '2026-11-20'), 3);
  assert.equal(reminders.daysBetween('2026-10-30', '2026-11-02'), 3);
});

test('recording a reminder counts it for the day and for its kind', () => {
  const sent = reminders.recordReminder(NOTHING_SENT, { id: 'review', title: '', body: '', route: '/review' }, '2026-11-20');
  assert.deepEqual(sent, { lastDay: '2026-11-20', lastByKind: { review: '2026-11-20' } });
});

test('reminder settings read a saved time only when it is a clock time, and keep the defaults otherwise', () => {
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
    },
  };
  try {
    assert.deepEqual(preferences.readReminderPrefs(), { enabled: false, time: '19:00', types: ON.types });
    store.set('danna.reminders', JSON.stringify({ enabled: true, time: '25:99', types: { goal: false } }));
    const read = preferences.readReminderPrefs();
    assert.equal(read.enabled, true);
    assert.equal(read.time, '19:00', 'an impossible time falls back to the default');
    assert.equal(read.types.goal, false);
    assert.equal(read.types.streak, true, 'a kind not saved is on');
    store.set('danna.sounds', JSON.stringify({ enabled: false, volume: 250, items: { coach: false } }));
    const sounds = preferences.readSoundPrefs();
    assert.equal(sounds.enabled, false);
    assert.equal(sounds.volume, 100, 'the volume is kept between 0 and 100');
    assert.equal(sounds.items.coach, false);
    assert.equal(sounds.items.correct, true);
  } finally {
    delete globalThis.window;
  }
});

test('a sound plays only with the master switch and its own switch on, and the preview ignores both', () => {
  const started = [];
  const fakeContext = {
    currentTime: 0,
    state: 'running',
    destination: {},
    createOscillator: () => ({ type: 'sine', frequency: { value: 0 }, connect() {}, start: (at) => started.push(at), stop() {}, disconnect() {} }),
    createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }),
  };
  const store = new Map();
  globalThis.window = {
    localStorage: { getItem: (key) => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, String(value)) },
    AudioContext: function AudioContext() {
      return fakeContext;
    },
  };
  try {
    store.set('danna.sounds', JSON.stringify({ enabled: false, volume: 60, items: { correct: true } }));
    sound.playSound('correct');
    assert.equal(started.length, 0, 'the master switch is off');
    store.set('danna.sounds', JSON.stringify({ enabled: true, volume: 60, items: { correct: false } }));
    sound.playSound('correct');
    assert.equal(started.length, 0, 'this sound is switched off');
    store.set('danna.sounds', JSON.stringify({ enabled: true, volume: 60, items: { correct: true } }));
    sound.playSound('correct');
    assert.equal(started.length, 2, 'the correct answer is two notes');
    sound.previewSound('wrong');
    assert.equal(started.length, 4, 'the preview plays whatever the switches say');
  } finally {
    delete globalThis.window;
  }
});

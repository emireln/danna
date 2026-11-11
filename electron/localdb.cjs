// Offline data for danna. One SQLite file in the app's data folder; nothing is sent anywhere.
const { app } = require('electron');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { userError } = require('./errors.cjs');

const SKILLS = ['reading', 'listening', 'speaking', 'writing', 'language'];
const TEST_SKILLS = [...SKILLS, 'mixed'];
const LEVELS = ['A2', 'B1', 'B2', 'C1'];
const ATTEMPT_KINDS = ['diagnostic', 'lesson', 'checkpoint', 'mock', 'practice', 'review'];
// Same limits as the online database, so a copy from this device never fails on a value.
const AVATAR_MAX_BYTES = 300 * 1024;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const PROFILE_FIELDS = new Set([
  'username',
  'display_name',
  'avatar_color',
  'target_score',
  'exam_date',
  'daily_minutes',
  'level',
  'xp',
  'streak',
  'last_active',
  'onboarding_done',
]);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profile (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_color TEXT NOT NULL DEFAULT '#2f6bff',
  target_score INTEGER NOT NULL DEFAULT 100,
  exam_date TEXT,
  daily_minutes INTEGER NOT NULL DEFAULT 15,
  level TEXT NOT NULL DEFAULT 'B1',
  xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_active TEXT,
  onboarding_done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  ref_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  score_pct INTEGER NOT NULL,
  predicted INTEGER,
  skills TEXT NOT NULL DEFAULT '{}',
  answers TEXT NOT NULL DEFAULT '[]',
  duration_s INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_recent ON attempts (created_at);
CREATE TABLE IF NOT EXISTS skill_scores (
  skill TEXT PRIMARY KEY,
  score INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lesson_progress (
  lesson_id TEXT PRIMARY KEY,
  stars INTEGER NOT NULL DEFAULT 0,
  best_pct INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS review_items (
  item_key TEXT PRIMARY KEY,
  skill TEXT NOT NULL,
  payload TEXT NOT NULL,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  due_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  skill TEXT NOT NULL,
  level TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tutor_messages (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS avatar (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data BLOB NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS library_files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  data BLOB NOT NULL,
  extracted_text TEXT NOT NULL DEFAULT '',
  pages INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS library_links (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT 'other',
  category TEXT NOT NULL DEFAULT 'General',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

let connection = null;

function db() {
  if (connection) return connection;
  const folder = app.getPath('userData');
  fs.mkdirSync(folder, { recursive: true });
  connection = new DatabaseSync(path.join(folder, 'danna.db'));
  connection.exec('PRAGMA journal_mode = WAL;');
  connection.exec(SCHEMA);
  // Databases from version 0.2.0 do not have the picture timestamp yet.
  const profileColumns = connection.prepare('PRAGMA table_info(profile)').all().map((column) => column.name);
  if (!profileColumns.includes('avatar_updated_at')) {
    connection.exec('ALTER TABLE profile ADD COLUMN avatar_updated_at TEXT');
  }
  return connection;
}

const now = () => new Date().toISOString();

function parse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

function optionalText(value) {
  return value === undefined || value === null || value === '' ? null : String(value);
}

// Profile -------------------------------------------------------------------

// Keeps a value inside the limits the online database enforces, so copying never fails on it.
function cleanProfileValue(key, value, current) {
  switch (key) {
    case 'username':
      if (!/^[a-z0-9_]{3,20}$/.test(String(value))) {
        throw userError('Usernames use 3 to 20 lowercase letters, numbers or underscores.');
      }
      return String(value);
    case 'display_name':
      return String(value ?? '').slice(0, 40);
    case 'avatar_color':
      return HEX_COLOR.test(String(value)) ? String(value) : current.avatar_color;
    case 'target_score':
      return clamp(value, 60, 120, current.target_score);
    case 'daily_minutes':
      return clamp(value, 5, 180, current.daily_minutes);
    case 'level':
      return LEVELS.includes(value) ? value : current.level;
    case 'xp':
      return Math.max(current.xp, clamp(value, 0, 10000000, current.xp));
    case 'streak':
      return clamp(value, 0, 36500, current.streak);
    case 'exam_date':
    case 'last_active':
      return DATE_PATTERN.test(String(value ?? '')) ? String(value) : null;
    case 'onboarding_done':
      return value ? 1 : 0;
    default:
      return value ?? null;
  }
}

function toProfile(row) {
  return {
    ...row,
    onboarding_done: Boolean(row.onboarding_done),
    avatar_path: null,
    avatar_updated_at: row.avatar_updated_at ?? null,
  };
}

function getProfile() {
  let row = db().prepare('SELECT * FROM profile LIMIT 1').get();
  if (!row) {
    const id = randomUUID();
    db()
      .prepare('INSERT INTO profile (id, username, display_name, created_at) VALUES (?, ?, ?, ?)')
      .run(id, `learner${Math.floor(1000 + Math.random() * 9000)}`, 'Learner', now());
    row = db().prepare('SELECT * FROM profile WHERE id = ?').get(id);
  }
  return toProfile(row);
}

function updateProfile(patch = {}) {
  const current = getProfile();
  const entries = Object.entries(patch || {}).filter(([key]) => PROFILE_FIELDS.has(key));
  if (entries.length > 0) {
    const values = entries.map(([key, value]) => cleanProfileValue(key, value, current));
    const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
    db().prepare(`UPDATE profile SET ${assignments} WHERE id = ?`).run(...values, current.id);
  }
  return getProfile();
}

// Attempts ------------------------------------------------------------------

function toAttempt(row) {
  return { ...row, predicted: row.predicted ?? null, skills: parse(row.skills, {}), answers: parse(row.answers, []) };
}

function listAttempts(limit = 60) {
  return db()
    .prepare('SELECT * FROM attempts ORDER BY created_at DESC LIMIT ?')
    .all(clamp(limit, 1, 500, 60))
    .map(toAttempt);
}

function getAttempt(id) {
  const row = db().prepare('SELECT * FROM attempts WHERE id = ?').get(String(id));
  return row ? toAttempt(row) : null;
}

function insertAttempt(input = {}) {
  const id = typeof input.id === 'string' && input.id ? input.id : randomUUID();
  db()
    .prepare(
      'INSERT OR IGNORE INTO attempts (id, kind, ref_id, title, score_pct, predicted, skills, answers, duration_s, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      ATTEMPT_KINDS.includes(input.kind) ? input.kind : 'practice',
      String(input.ref_id ?? '').slice(0, 120),
      String(input.title ?? 'Practice').slice(0, 200),
      clamp(input.score_pct, 0, 100, 0),
      input.predicted === null || input.predicted === undefined ? null : clamp(input.predicted, 0, 120, 0),
      JSON.stringify(input.skills ?? {}),
      JSON.stringify(input.answers ?? []),
      clamp(input.duration_s, 0, 86400, 0),
      typeof input.created_at === 'string' ? input.created_at : now(),
    );
  return getAttempt(id);
}

// Skill scores, lessons, review ---------------------------------------------

function getSkillScores() {
  const scores = {};
  for (const row of db().prepare('SELECT skill, score FROM skill_scores').all()) scores[row.skill] = row.score;
  return scores;
}

function setSkillScores(scores = {}) {
  const statement = db().prepare(
    'INSERT INTO skill_scores (skill, score, updated_at) VALUES (?, ?, ?) ON CONFLICT(skill) DO UPDATE SET score = excluded.score, updated_at = excluded.updated_at',
  );
  for (const [skill, score] of Object.entries(scores || {})) {
    if (SKILLS.includes(skill)) statement.run(skill, clamp(score, 0, 100, 0), now());
  }
}

function listLessonProgress() {
  return db().prepare('SELECT lesson_id, stars, best_pct, attempts, completed_at FROM lesson_progress').all();
}

function upsertLessonProgress(row) {
  db()
    .prepare(
      'INSERT INTO lesson_progress (lesson_id, stars, best_pct, attempts, completed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(lesson_id) DO UPDATE SET stars = excluded.stars, best_pct = excluded.best_pct, attempts = excluded.attempts, completed_at = excluded.completed_at, updated_at = excluded.updated_at',
    )
    .run(
      String(row.lesson_id),
      clamp(row.stars, 0, 3, 0),
      clamp(row.best_pct, 0, 100, 0),
      clamp(row.attempts, 0, 100000, 0),
      optionalText(row.completed_at),
      now(),
    );
}

function toReview(row) {
  return {
    item_key: row.item_key,
    skill: row.skill,
    payload: parse(row.payload, {}),
    ease: row.ease,
    interval_days: row.interval_days,
    reps: row.reps,
    due_at: row.due_at,
  };
}

function listReviewItems() {
  return db().prepare('SELECT * FROM review_items').all().map(toReview);
}

function upsertReviewItems(rows = []) {
  const statement = db().prepare(
    'INSERT INTO review_items (item_key, skill, payload, ease, interval_days, reps, due_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(item_key) DO UPDATE SET skill = excluded.skill, payload = excluded.payload, ease = excluded.ease, interval_days = excluded.interval_days, reps = excluded.reps, due_at = excluded.due_at, updated_at = excluded.updated_at',
  );
  for (const row of rows || []) {
    statement.run(
      String(row.item_key),
      String(row.skill),
      JSON.stringify(row.payload ?? {}),
      Number(row.ease) || 2.5,
      clamp(row.interval_days, 0, 100000, 0),
      clamp(row.reps, 0, 100000, 0),
      String(row.due_at),
      now(),
    );
  }
}

// Practice sets ----------------------------------------------------------------

function toTest(row) {
  return { ...row, content: parse(row.content, { passages: [], questions: [] }) };
}

function listMyTests() {
  return db().prepare('SELECT * FROM tests ORDER BY created_at DESC').all().map(toTest);
}

function getTest(id) {
  const row = db().prepare('SELECT * FROM tests WHERE id = ?').get(String(id));
  return row ? toTest(row) : null;
}

function insertTest(input = {}) {
  const id = typeof input.id === 'string' && input.id ? input.id : randomUUID();
  db()
    .prepare(
      'INSERT OR IGNORE INTO tests (id, title, description, kind, skill, level, minutes, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      String(input.title ?? 'Practice set').slice(0, 120),
      String(input.description ?? '').slice(0, 300),
      input.kind === 'custom' ? 'custom' : 'ai',
      TEST_SKILLS.includes(input.skill) ? input.skill : 'mixed',
      LEVELS.includes(input.level) ? input.level : 'B1',
      clamp(input.minutes, 1, 240, 10),
      JSON.stringify(input.content ?? { passages: [], questions: [] }),
      typeof input.created_at === 'string' ? input.created_at : now(),
    );
  return getTest(id);
}

// Coach conversation -------------------------------------------------------------

function listTutor(limit = 40) {
  return db()
    .prepare('SELECT id, role, content, created_at FROM tutor_messages ORDER BY created_at DESC LIMIT ?')
    .all(clamp(limit, 1, 200, 40))
    .reverse();
}

function addTutor(role, content, id, createdAt) {
  const row = {
    id: typeof id === 'string' && id ? id : randomUUID(),
    role: role === 'assistant' ? 'assistant' : 'user',
    content: String(content ?? '').slice(0, 8000),
    created_at: typeof createdAt === 'string' && createdAt ? createdAt : now(),
  };
  db()
    .prepare('INSERT OR IGNORE INTO tutor_messages (id, role, content, created_at) VALUES (?, ?, ?, ?)')
    .run(row.id, row.role, row.content, row.created_at);
  return row;
}

function clearTutor() {
  db().prepare('DELETE FROM tutor_messages').run();
}

// Profile picture: one WebP file of at most 300 KB, kept in the database file.
function toBuffer(input) {
  if (input instanceof ArrayBuffer) return Buffer.from(input);
  if (ArrayBuffer.isView(input)) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  return null;
}

function isWebp(bytes) {
  return bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

function getAvatar() {
  const row = db().prepare('SELECT data FROM avatar WHERE id = 1').get();
  return row ? new Uint8Array(row.data) : null;
}

function setAvatar(input) {
  getProfile();
  const bytes = toBuffer(input);
  if (!bytes || bytes.length === 0 || bytes.length > AVATAR_MAX_BYTES) {
    throw userError('That picture is too large. Choose a smaller one.');
  }
  if (!isWebp(bytes)) throw userError('That picture could not be saved. Try another one.');
  const stamp = now();
  db()
    .prepare(
      'INSERT INTO avatar (id, data, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
    )
    .run(bytes, stamp);
  db().prepare('UPDATE profile SET avatar_updated_at = ?').run(stamp);
  return getProfile();
}

function clearAvatar() {
  db().prepare('DELETE FROM avatar').run();
  db().prepare('UPDATE profile SET avatar_updated_at = NULL').run();
  return getProfile();
}

// My library: learning files (PDF, TXT, Markdown) keep their bytes and extracted text; links keep their details.
const LIBRARY_KINDS = ['pdf', 'txt', 'md'];
const LIBRARY_FILE_MAX_BYTES = 20 * 1024 * 1024;
const LIBRARY_TEXT_MAX = 400000;
const LIBRARY_FILE_FIELDS = 'id, name, kind, mime_type, size_bytes, pages, created_at, updated_at';
const LIBRARY_LINK_FIELDS = 'id, url, title, platform, category, note, created_at, updated_at';

function listLibraryFiles() {
  return db().prepare(`SELECT ${LIBRARY_FILE_FIELDS} FROM library_files ORDER BY created_at DESC`).all();
}

function getLibraryFileData(id) {
  const row = db().prepare('SELECT data FROM library_files WHERE id = ?').get(String(id));
  return row ? new Uint8Array(row.data) : null;
}

function getLibraryText(id) {
  const row = db().prepare('SELECT extracted_text AS text FROM library_files WHERE id = ?').get(String(id));
  return row ? row.text : '';
}

function insertLibraryFile(input = {}) {
  if (!LIBRARY_KINDS.includes(input.kind)) throw userError('Only PDF, TXT and Markdown files can be kept in the library.');
  const bytes = toBuffer(input.data);
  if (!bytes || bytes.length === 0 || bytes.length > LIBRARY_FILE_MAX_BYTES) {
    throw userError('That file is too large. Choose one under 20 MB.');
  }
  const id = typeof input.id === 'string' && input.id ? input.id : randomUUID();
  const createdAt = typeof input.created_at === 'string' && input.created_at ? input.created_at : now();
  const pages = input.pages === null || input.pages === undefined ? null : clamp(input.pages, 0, 5000, 0);
  db()
    .prepare(
      'INSERT OR IGNORE INTO library_files (id, name, kind, mime_type, size_bytes, data, extracted_text, pages, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      String(input.name || 'File').slice(0, 200),
      input.kind,
      String(input.mime_type || 'application/octet-stream').slice(0, 100),
      bytes.length,
      bytes,
      String(input.extracted_text || '').slice(0, LIBRARY_TEXT_MAX),
      pages,
      createdAt,
      now(),
    );
  return db().prepare(`SELECT ${LIBRARY_FILE_FIELDS} FROM library_files WHERE id = ?`).get(id);
}

function deleteLibraryFile(id) {
  db().prepare('DELETE FROM library_files WHERE id = ?').run(String(id));
  return true;
}

function listLibraryLinks() {
  return db().prepare(`SELECT ${LIBRARY_LINK_FIELDS} FROM library_links ORDER BY created_at DESC`).all();
}

function cleanLibraryLink(input = {}) {
  const url = String(input.url || '');
  if (!/^https:\/\/[^\s]+$/.test(url) || url.length > 2000) throw userError('Paste a web link that starts with https://.');
  return {
    url,
    title: String(input.title ?? '').slice(0, 200),
    platform: String(input.platform || 'other').slice(0, 40),
    category: String(input.category || 'General').slice(0, 40),
    note: String(input.note ?? '').slice(0, 500),
  };
}

function insertLibraryLink(input = {}) {
  const link = cleanLibraryLink(input);
  const id = typeof input.id === 'string' && input.id ? input.id : randomUUID();
  const createdAt = typeof input.created_at === 'string' && input.created_at ? input.created_at : now();
  db()
    .prepare(
      'INSERT OR IGNORE INTO library_links (id, url, title, platform, category, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(id, link.url, link.title, link.platform, link.category, link.note, createdAt, now());
  return db().prepare(`SELECT ${LIBRARY_LINK_FIELDS} FROM library_links WHERE id = ?`).get(id);
}

function updateLibraryLink(id, patch = {}) {
  const current = db().prepare(`SELECT ${LIBRARY_LINK_FIELDS} FROM library_links WHERE id = ?`).get(String(id));
  if (!current) throw userError('That link is no longer in your library.');
  const title = patch.title === undefined ? current.title : String(patch.title ?? '').slice(0, 200);
  const category = patch.category === undefined ? current.category : String(patch.category || 'General').slice(0, 40);
  const note = patch.note === undefined ? current.note : String(patch.note ?? '').slice(0, 500);
  db().prepare('UPDATE library_links SET title = ?, category = ?, note = ?, updated_at = ? WHERE id = ?').run(title, category, note, now(), current.id);
  return db().prepare(`SELECT ${LIBRARY_LINK_FIELDS} FROM library_links WHERE id = ?`).get(current.id);
}

function deleteLibraryLink(id) {
  db().prepare('DELETE FROM library_links WHERE id = ?').run(String(id));
  return true;
}

// Only these actions can be called from the interface.
const METHODS = {
  getProfile,
  updateProfile,
  listAttempts,
  getAttempt,
  insertAttempt,
  getSkillScores,
  setSkillScores,
  listLessonProgress,
  upsertLessonProgress,
  listReviewItems,
  upsertReviewItems,
  listMyTests,
  getTest,
  insertTest,
  listTutor,
  addTutor,
  clearTutor,
  getAvatar,
  setAvatar,
  clearAvatar,
  listLibraryFiles,
  getLibraryFileData,
  getLibraryText,
  insertLibraryFile,
  deleteLibraryFile,
  listLibraryLinks,
  insertLibraryLink,
  updateLibraryLink,
  deleteLibraryLink,
};

function call(method, args) {
  const handler = METHODS[method];
  if (!handler) throw userError('That action is not available right now.');
  return handler(...(Array.isArray(args) ? args : []));
}

module.exports = { call };

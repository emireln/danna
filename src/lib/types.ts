// Shared domain types. Row shapes mirror supabase/schema.sql (snake_case) so the
// Supabase and offline backends can return the same objects.

export type Skill = 'reading' | 'listening' | 'speaking' | 'writing' | 'language';

export const SKILLS: readonly Skill[] = ['reading', 'listening', 'speaking', 'writing', 'language'];

export const SKILL_LABEL: Record<Skill, string> = {
  reading: 'Reading',
  listening: 'Listening',
  speaking: 'Speaking',
  writing: 'Writing',
  language: 'Language',
};

export type Level = 'A2' | 'B1' | 'B2' | 'C1';
export const LEVELS: readonly Level[] = ['A2', 'B1', 'B2', 'C1'];

export type Accent = 'blue' | 'teal' | 'amber' | 'ink';

interface QuestionBase {
  id: string;
  skill: Skill;
  prompt: string;
  explanation?: string;
  passageId?: string;
  /** Transcript that is read aloud with the browser speech engine. */
  listen?: string;
}

export interface ChoiceQuestion extends QuestionBase {
  type: 'choice';
  options: string[];
  answer: number;
}

/** Text with blanks written as {{word}} or {{word:2}} (the number of letters shown). */
export interface ClozeQuestion extends QuestionBase {
  type: 'cloze';
  text: string;
}

/** Words are shuffled for the learner; `answer` is the correct sentence. */
export interface ReorderQuestion extends QuestionBase {
  type: 'reorder';
  answer: string;
}

export interface WritingQuestion extends QuestionBase {
  type: 'writing';
  minWords: number;
  rubric: string[];
}

export interface SpeakingQuestion extends QuestionBase {
  type: 'speaking';
  seconds: number;
  rubric: string[];
}

export type Question = ChoiceQuestion | ClozeQuestion | ReorderQuestion | WritingQuestion | SpeakingQuestion;
export type QuestionType = Question['type'];

export interface Passage {
  id: string;
  title: string;
  text: string;
}

export interface TestContent {
  passages: Passage[];
  questions: Question[];
}

export type RunKind = 'diagnostic' | 'lesson' | 'checkpoint' | 'mock' | 'practice' | 'review';

/** A test ready to be played, whether bundled, generated or shared. */
export interface TestDef extends TestContent {
  id: string;
  title: string;
  subtitle: string;
  kind: RunKind;
  skill: Skill | 'mixed';
  minutes: number;
}

export interface AnswerRecord {
  id: string;
  skill: Skill;
  /** 0..1 credit for the item. */
  fraction: number;
  response: string | number | string[] | null;
}

export type AttemptKind = 'diagnostic' | 'lesson' | 'checkpoint' | 'mock' | 'practice' | 'review';

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  target_score: number;
  exam_date: string | null;
  daily_minutes: number;
  level: Level;
  xp: number;
  streak: number;
  last_active: string | null;
  onboarding_done: boolean;
  created_at: string;
}

export interface AttemptRow {
  id: string;
  user_id: string;
  kind: AttemptKind;
  ref_id: string;
  title: string;
  score_pct: number;
  predicted: number | null;
  skills: Partial<Record<Skill, number>>;
  answers: AnswerRecord[];
  duration_s: number;
  created_at: string;
}

export interface TestRow {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  kind: 'ai' | 'custom';
  skill: Skill | 'mixed';
  level: Level;
  minutes: number;
  content: TestContent;
  created_at: string;
}

export interface LessonProgressRow {
  lesson_id: string;
  stars: number;
  best_pct: number;
  attempts: number;
  completed_at: string | null;
}

export interface ReviewPayload {
  question: Question;
  passage?: Passage;
}

export interface ReviewRow {
  item_key: string;
  skill: Skill;
  payload: ReviewPayload;
  ease: number;
  interval_days: number;
  reps: number;
  due_at: string;
}

export interface PersonRow {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  xp: number;
  streak: number;
}

export interface FriendRow extends PersonRow {
  friendship_id: string;
  status: 'pending' | 'accepted';
  direction: 'incoming' | 'outgoing';
  created_at: string;
}

export interface ShareRow {
  id: string;
  direction: 'sent' | 'received';
  kind: 'result' | 'test';
  note: string;
  seen: boolean;
  created_at: string;
  other_id: string;
  other_username: string;
  other_display_name: string;
  attempt_id: string | null;
  test_id: string | null;
  item_title: string | null;
  item_score: number | null;
  item_predicted: number | null;
}

export interface AnnouncementRow {
  id: string;
  kind: 'banner' | 'release_note' | 'news';
  title: string;
  body: string;
  version: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  accent: Accent;
  priority: number;
  created_at: string;
}

export interface TutorRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// AI connections (renderer view; keys themselves never reach the renderer).
export type Provider = 'openai' | 'anthropic' | 'gemini' | 'openrouter';

export interface AIModel {
  id: string;
  label: string;
  latest: boolean;
  createdAt: number;
}

export interface AIConnection {
  provider: Provider;
  label: string;
  hint: string;
  masked: string;
  addedAt: string;
}

export interface AISelection {
  provider: Provider;
  model: string;
}

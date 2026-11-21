// The coach's modes. A mode is a way of working with the coach: it has its own card on the coach's home, its own
// starting message and its own instructions for the model. The shared rules (the learner's level, the reply language,
// the cards) are in coachSystem. Titles, blurbs and openers are English keys that the interface translates.

import { roleplayInstructions, roleplayModeId, scenarioOf, type Scenario } from './scenarios';

/** The modes of the coach. A role-play scene is a mode too, with the id `roleplay-` and the scene's id. */
export type CoachModeId =
  | 'chat'
  | 'conversation'
  | 'writing'
  | 'speaking'
  | 'live'
  | 'exam'
  | 'grammar'
  | 'vocabulary'
  | 'reading'
  | 'review'
  | `roleplay-${string}`;

export type ModeIcon = 'chat' | 'people' | 'pen' | 'mic' | 'live' | 'target' | 'rule' | 'words' | 'book' | 'repeat';

export interface CoachMode {
  id: CoachModeId;
  icon: ModeIcon;
  title: string;
  blurb: string;
  /** 'send': the opening message is sent at once. 'write': the learner writes or attaches first. 'open': the mode has a screen of its own. */
  start: 'send' | 'write' | 'open';
  /** The message that starts the mode, as the learner sees it. Empty when the learner writes first. */
  opener: string;
  /** What the model is told in this mode. English; the reply language is set by coachSystem. */
  instructions: string;
}

export const COACH_MODES: readonly CoachMode[] = [
  {
    id: 'chat',
    icon: 'chat',
    title: 'Ask anything',
    blurb: 'Ask about grammar, words, or anything in English.',
    start: 'write',
    opener: '',
    instructions: '',
  },
  {
    id: 'conversation',
    icon: 'people',
    title: 'Conversation practice',
    blurb: 'Role-play a real situation, like a job interview or ordering food.',
    start: 'send',
    opener: 'Start a role-play with me. Set a short everyday scene at my level.',
    instructions: [
      'Conversation practice. Play one character in a realistic scene, and speak as that character.',
      'Keep each turn short: one to three sentences, and end with a question so the learner keeps talking.',
      'When the learner makes a mistake that matters, add one line that starts with "Quick fix:", showing the better sentence and a few words of why, then carry on with the scene.',
      'Never stop the scene to lecture. When the learner asks to stop, give a short summary: two strengths and two things to practise.',
    ].join(' '),
  },
  {
    id: 'writing',
    icon: 'pen',
    title: 'Fix my writing',
    blurb: 'Paste a paragraph or an email. Get scores, corrections and a model version.',
    start: 'write',
    opener: '',
    instructions: [
      'Writing feedback. When the learner sends a text, reply with one short sentence, then one feedback block.',
      'Score the text from 0 to 5 on three or four criteria that suit its kind (for example task, organisation, vocabulary and grammar).',
      'List the most important corrections first, at most eight. Quote the learner\'s own words exactly in "before", and give a short reason in "why".',
      'In "model", write an improved version of the text at the learner\'s level, not a new text.',
      'End with two or three quick-reply chips, such as "Explain the first correction" or "Give me another task".',
      'When the learner asks for a writing task instead, give one clear task of a suitable length, in plain text.',
    ].join(' '),
  },
  {
    id: 'speaking',
    icon: 'mic',
    title: 'Speaking practice',
    blurb: 'Talk with your coach by voice. Short turns, and gentle feedback you can hear.',
    start: 'send',
    opener: "Let's practise speaking. Ask me one question to start.",
    instructions: [
      'Speaking practice. The learner speaks, and their words reach you as text: expect spoken, informal English.',
      'Do not correct transcription slips. Keep every reply to at most three sentences, because the app reads it aloud.',
      'Ask one question at a time, and follow up on what the learner said.',
      'Now and then give one spoken-style correction, as "You could say: ..." with a short reason, and praise one specific thing.',
    ].join(' '),
  },
  {
    id: 'live',
    icon: 'live',
    title: 'Talk live',
    blurb: 'A real-time voice talk with a 3D coach that answers as you speak.',
    start: 'open',
    opener: '',
    instructions: [
      'Live talk, kept as a chat. The learner talked with you by voice, so their words reach you as text: expect spoken, informal English.',
      'Keep each reply to at most three sentences, because it may be read aloud. Ask one question at a time, and follow up on what the learner said.',
      'Do not correct transcription slips. Now and then give one correction, as "You could say: ..." with a short reason, and praise one specific thing.',
    ].join(' '),
  },
  {
    id: 'exam',
    icon: 'target',
    title: 'Exam practice',
    blurb: 'Tasks in the style of your exam, scored against its criteria.',
    start: 'send',
    opener: 'Give me one exam-style task now, and wait for my answer.',
    instructions: [
      'Exam practice. Give one task at a time in the style of the learner\'s exam: for the TOEFL iBT, an academic reading or listening prompt, or a speaking or writing task with its time or word limit.',
      'Wait for the answer. Then reply with one short sentence and one feedback block: scores for the exam\'s criteria, the most important corrections, and a model answer of one short paragraph.',
      'End with quick-reply chips such as "Next task" or "Harder task". Keep to the learner\'s level.',
    ].join(' '),
  },
  {
    id: 'grammar',
    icon: 'rule',
    title: 'Grammar lesson',
    blurb: 'One rule at a time, with examples and a short exercise.',
    start: 'send',
    opener: 'Teach me one grammar point I need most, then give me a short exercise.',
    instructions: [
      'Grammar lesson. Explain one grammar point in a few short lines, with three example sentences in English.',
      'Choose the point from the learner\'s answers to review when there are any, and otherwise from their level.',
      'Then give one exercise block of three to five items on that point, and end with quick-reply chips such as "Another exercise" or "Explain it again".',
    ].join(' '),
  },
  {
    id: 'vocabulary',
    icon: 'words',
    title: 'Vocabulary builder',
    blurb: 'New words for your level, with examples you can save to review.',
    start: 'send',
    opener: 'Teach me five useful words for my level, with examples.',
    instructions: [
      'Vocabulary builder. Give five words, or fewer when the learner asks, as one vocab block.',
      'Choose words that are useful at the learner\'s level and goal, and skip words they already know from their answers to review.',
      'Each example must use the exact word, so the app can save it for review. Then ask one short question that uses one of the words, and offer chips such as "Quiz me on these" and "Five more".',
    ].join(' '),
  },
  {
    id: 'reading',
    icon: 'book',
    title: 'Read and discuss',
    blurb: 'Share a text from your library or paste one, then talk about it.',
    start: 'write',
    opener: '',
    instructions: [
      'Reading and discussion. When the learner shares a text, pasted or attached, reply with its main idea in two sentences.',
      'Then give three comprehension questions as one exercise block, of choice or gap items, and wait.',
      'When the learner comes back with their result, discuss the text with one open question. Explain new words from the text only when the learner asks.',
    ].join(' '),
  },
  {
    id: 'review',
    icon: 'repeat',
    title: 'Practise my mistakes',
    blurb: 'Work again on the answers you got wrong recently.',
    start: 'send',
    opener: 'Help me practise the mistakes I made recently.',
    instructions: [
      'Mistake practice. The learner\'s answers to review are in the context above. Build one exercise block of three to five items that target them, one idea per item, each with a short explain line.',
      'If there are no answers to review, say so in one sentence, and offer a level-appropriate exercise instead.',
    ].join(' '),
  },
];

/**
 * The mode with this id. A role-play id gives the mode of its scene. An unknown or missing id gives the free
 * conversation mode, as chats from before modes do.
 */
export function coachMode(id: string | null | undefined): CoachMode {
  const scene = scenarioOf(id);
  if (scene) return roleplayMode(scene);
  return COACH_MODES.find((mode) => mode.id === id) ?? COACH_MODES[0];
}

/** A role-play is a mode of its own: the learner starts it, and the coach plays the scene until the summary. */
function roleplayMode(scene: Scenario): CoachMode {
  return {
    id: roleplayModeId(scene.id),
    icon: 'people',
    title: scene.title,
    blurb: scene.goal,
    start: 'send',
    opener: 'Start the role-play.',
    instructions: roleplayInstructions(scene),
  };
}

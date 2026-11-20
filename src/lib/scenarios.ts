// The role-play scenarios of the coach (2.0.0). A scenario is a chat in the mode `roleplay-<id>`: the coach plays a
// character, the learner has one goal, and the summary at the end is a feedback block whose first score is the fluency.
// The titles, characters and goals are English; the interface translates them, and the catalogue test checks each one.
import type { CoachPart } from './coachReply';

export const ROLEPLAY_PREFIX = 'roleplay-';
/** The XP for a finished role-play summary. It counts once, when the summary arrives. */
export const ROLEPLAY_XP = 10;

export interface Scenario {
  id: string;
  /** What the scene is called, in English. */
  title: string;
  /** Who the coach plays, in English, as a short noun phrase. */
  character: string;
  /** The one goal the learner has in the scene, in English. */
  goal: string;
}

export const SCENARIOS: readonly Scenario[] = [
  { id: 'cafe-order', title: 'Order at a café', character: 'a friendly barista at a busy café', goal: 'Order a drink and a snack, then ask for the bill.' },
  { id: 'job-interview', title: 'A job interview', character: 'a hiring manager who asks about your experience', goal: 'Introduce yourself and answer two questions about your work.' },
  { id: 'airport-check-in', title: 'Airport check-in', character: 'an airline agent at the check-in desk', goal: 'Check in a suitcase and ask for a window seat.' },
  { id: 'doctor-visit', title: "A doctor's visit", character: 'a doctor at a clinic', goal: 'Describe your symptoms for three days and ask what to do.' },
  { id: 'directions', title: 'Asking for directions', character: 'a local resident on a busy city street', goal: 'Find the nearest train station and ask how long the walk takes.' },
  { id: 'shop-complaint', title: 'A complaint at a shop', character: 'a shop assistant behind the counter', goal: 'Explain that an item is broken and ask for a refund or an exchange.' },
  { id: 'hotel-check-in', title: 'Hotel check-in', character: 'a receptionist at a hotel', goal: 'Check in, ask about breakfast, and ask for a quiet room.' },
  { id: 'book-table', title: 'Booking a table', character: 'a host who takes restaurant bookings by phone', goal: 'Book a table for four at eight o’clock and ask about vegetarian dishes.' },
  { id: 'meet-someone', title: 'Meeting someone new', character: 'a classmate at a language course', goal: 'Introduce yourself, ask two questions about their routine, and suggest meeting again.' },
  { id: 'customer-call', title: 'A call to a company', character: 'a customer service agent', goal: 'Ask about a late order and agree on what happens next.' },
  { id: 'rent-flat', title: 'Renting a flat', character: 'a landlord showing a flat', goal: 'Ask about the rent, the bills, and when you can move in.' },
  { id: 'party-small-talk', title: 'Small talk at a party', character: 'a guest at a party', goal: 'Keep the conversation going with at least two questions.' },
];

/** The mode id of a scenario: `roleplay-` and the scenario's id. It matches the coach's mode pattern, lower-case letters and dashes. */
export function roleplayModeId(id: string): `roleplay-${string}` {
  return `${ROLEPLAY_PREFIX}${id}`;
}

/** The scenario a chat mode starts, or null when the mode is not a role-play. */
export function scenarioOf(modeId: string | null | undefined): Scenario | null {
  if (!modeId || !modeId.startsWith(ROLEPLAY_PREFIX)) return null;
  const id = modeId.slice(ROLEPLAY_PREFIX.length);
  return SCENARIOS.find((scenario) => scenario.id === id) ?? null;
}

export function isRoleplayMode(modeId: string | null | undefined): boolean {
  return scenarioOf(modeId) !== null;
}

/** What the model is told in a role-play: the character, the goal, how to play, and the summary it gives at the end. */
export function roleplayInstructions(scenario: Scenario): string {
  return [
    `Role-play: ${scenario.title}. You play ${scenario.character}. The learner has one goal: ${scenario.goal}`,
    'Stay in character and speak only as that character, in English at the learner\'s level. Keep each turn to one to three sentences, and end with a question or a prompt, so the learner keeps talking.',
    'Do not correct during the scene. If the learner is stuck, give one short hint on its own line, starting with "Hint:", and carry on in character.',
    'When the learner asks to end the role-play, or the goal is reached, stop the scene and give the summary as two blocks. First a feedback block: its scores are, in this order, "Fluency" (how smoothly and quickly the learner spoke), "Vocabulary", "Grammar" and "Goal reached", each from 0 to 5; its summary is two or three sentences; its corrections are the most important mistakes, quoting the learner\'s words in "before". Then a vocab block of up to five new words the learner needed or could use next time.',
    'The fluency score is always the first score, because the app reads it. End the summary with two chips, such as "Try again" and "Another scene".',
  ].join(' ');
}

/**
 * The fluency of a role-play summary, from 0 to 100: the first score of its feedback block, which is the fluency.
 * Null when the reply has no feedback block with a score.
 */
export function fluencyOf(parts: readonly CoachPart[]): number | null {
  const feedback = parts.find((part): part is Extract<CoachPart, { kind: 'feedback' }> => part.kind === 'feedback');
  const first = feedback?.feedback.scores[0];
  if (!first || !Number.isFinite(first.score)) return null;
  return Math.round((Math.min(5, Math.max(0, first.score)) / 5) * 100);
}

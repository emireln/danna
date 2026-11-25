// The Brazilian Portuguese translations. Each key is the English text exactly as the code or the content has it.
import { APP_PT } from './app';
import { CONTENT_PT } from './content';
import { MESSAGES_PT } from './messages';
import { MOCKS_PT } from './mocks';
import { PRACTICE_PT_A } from './practice-a';
import { PRACTICE_PT_B } from './practice-b';
import { PRACTICE_PT_C } from './practice-c';
import { ONBOARDING_PT } from './onboarding';
import { ALERTS_PT } from './alerts';
import { RELEASE_NOTES_PT } from './release-notes';
import { VOICES_PT } from './voices';
import { LIVE_PT } from './live';

// The talk's words come first, so the skill names that share a key with them (Listening, Speaking) keep their app value.
export const PT: Record<string, string> = {
  ...LIVE_PT,
  ...CONTENT_PT,
  ...PRACTICE_PT_A,
  ...PRACTICE_PT_B,
  ...PRACTICE_PT_C,
  ...MOCKS_PT,
  ...APP_PT,
  ...MESSAGES_PT,
  ...ONBOARDING_PT,
  ...ALERTS_PT,
  ...RELEASE_NOTES_PT,
  ...VOICES_PT,
};

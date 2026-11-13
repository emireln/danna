// The Brazilian Portuguese translations. Each key is the English text exactly as the code or the content has it.
import { APP_PT } from './app';
import { CONTENT_PT } from './content';
import { MESSAGES_PT } from './messages';
import { MOCKS_PT } from './mocks';
import { PRACTICE_PT_A } from './practice-a';
import { PRACTICE_PT_B } from './practice-b';
import { PRACTICE_PT_C } from './practice-c';

export const PT: Record<string, string> = {
  ...CONTENT_PT,
  ...PRACTICE_PT_A,
  ...PRACTICE_PT_B,
  ...PRACTICE_PT_C,
  ...MOCKS_PT,
  ...APP_PT,
  ...MESSAGES_PT,
};

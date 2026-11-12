// The Brazilian Portuguese translations. Each key is the English text exactly as the code or the content has it.
import { APP_PT } from './app';
import { CONTENT_PT } from './content';
import { MESSAGES_PT } from './messages';

export const PT: Record<string, string> = { ...CONTENT_PT, ...APP_PT, ...MESSAGES_PT };

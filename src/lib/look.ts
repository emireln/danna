// The look a profile uses. A profile without a look, or with one the app does not know, keeps the Classic look.
import { LOOKS, type LookId } from './types';

export const DEFAULT_LOOK: LookId = 'classic';

export function lookOf(profile: { ui_style?: unknown } | null | undefined): LookId {
  const value = profile?.ui_style;
  return (LOOKS as readonly unknown[]).includes(value) ? (value as LookId) : DEFAULT_LOOK;
}

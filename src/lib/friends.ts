// The friends' helpers that do not touch the screen: which shares a friend sent to you.
import type { ShareRow } from './types';

/** The shares a friend sent to you, in the order the list gives (newest first). */
export function sharesFrom(shares: readonly ShareRow[], friendId: string): ShareRow[] {
  return shares.filter((share) => share.direction === 'received' && share.other_id === friendId);
}

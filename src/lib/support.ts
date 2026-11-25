// The support page: a coffee for the developer. It opens in the browser, outside DANNA.
import { bridge } from './bridge';

export const SUPPORT_URL = 'https://buymeacoffee.com/emireln';

/** Opens the support page. The desktop app opens it in the system browser; the browser preview opens a new tab. */
export function openSupport(): void {
  if (bridge) void bridge.openExternal(SUPPORT_URL);
  else window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer');
}

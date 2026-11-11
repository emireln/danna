// The logo of a learning platform. Logos are WebP files built by `npm run logos`. A platform
// without a logo shows its initial, and a plain link shows a link icon.
import { Link as LinkIcon } from 'lucide-react';
import type { Platform } from '../lib/platforms';

const LOGOS = import.meta.glob('../assets/platforms/*.webp', { eager: true, import: 'default' }) as Record<string, string>;

export function platformLogoUrl(id: string): string | null {
  return LOGOS[`../assets/platforms/${id}.webp`] ?? null;
}

export function PlatformLogo({ platform, size = 40 }: { platform: Platform; size?: number }) {
  const src = platformLogoUrl(platform.id);
  return (
    <span className="platform-logo" style={{ width: size, height: size }} aria-hidden="true">
      {src ? (
        <img src={src} alt="" draggable={false} decoding="async" />
      ) : platform.id === 'other' ? (
        <LinkIcon style={{ width: size * 0.45, height: size * 0.45 }} />
      ) : (
        <span className="platform-logo__initial" style={{ fontSize: size * 0.42 }}>
          {platform.name.charAt(0)}
        </span>
      )}
    </span>
  );
}

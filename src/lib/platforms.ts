// The platforms that learning links come from. The host of a link decides its platform.
// Logos are built by `npm run logos` (see scripts/make-platform-logos.mjs). A platform without
// a logo shows a monogram until its official logo is added to brand/platforms/.

export interface Platform {
  id: string;
  name: string;
  hosts: readonly string[];
}

export const PLATFORMS: readonly Platform[] = [
  { id: 'youtube', name: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  { id: 'alura', name: 'Alura', hosts: ['alura.com.br'] },
  { id: 'coursera', name: 'Coursera', hosts: ['coursera.org'] },
  { id: 'udemy', name: 'Udemy', hosts: ['udemy.com'] },
  { id: 'khanacademy', name: 'Khan Academy', hosts: ['khanacademy.org'] },
  { id: 'edx', name: 'edX', hosts: ['edx.org'] },
  { id: 'duolingo', name: 'Duolingo', hosts: ['duolingo.com'] },
  { id: 'ted', name: 'TED', hosts: ['ted.com'] },
  { id: 'bbc', name: 'BBC Learning English', hosts: ['bbc.co.uk', 'bbc.com'] },
  { id: 'britishcouncil', name: 'British Council', hosts: ['britishcouncil.org'] },
  { id: 'cambridge', name: 'Cambridge English', hosts: ['cambridgeenglish.org'] },
  { id: 'ets', name: 'ETS TOEFL', hosts: ['ets.org'] },
  { id: 'quizlet', name: 'Quizlet', hosts: ['quizlet.com'] },
  { id: 'anki', name: 'Anki', hosts: ['ankiweb.net'] },
  { id: 'babbel', name: 'Babbel', hosts: ['babbel.com'] },
  { id: 'busuu', name: 'Busuu', hosts: ['busuu.com'] },
  { id: 'memrise', name: 'Memrise', hosts: ['memrise.com'] },
  { id: 'googletranslate', name: 'Google Translate', hosts: ['translate.google.com'] },
  { id: 'spotify', name: 'Spotify', hosts: ['spotify.com'] },
  { id: 'applepodcasts', name: 'Apple Podcasts', hosts: ['podcasts.apple.com'] },
  { id: 'soundcloud', name: 'SoundCloud', hosts: ['soundcloud.com'] },
  { id: 'vimeo', name: 'Vimeo', hosts: ['vimeo.com'] },
];

export const OTHER_PLATFORM: Platform = { id: 'other', name: 'Web link', hosts: [] };

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** The platform a link belongs to, judged by its host (subdomains included). */
export function platformForUrl(url: string): Platform {
  const host = hostOf(url);
  if (!host) return OTHER_PLATFORM;
  return PLATFORMS.find((platform) => platform.hosts.some((known) => host === known || host.endsWith(`.${known}`))) ?? OTHER_PLATFORM;
}

/**
 * A link as it should be saved: spaces trimmed, https added when it is missing, and only
 * https links kept (the app opens links only over https). Returns null when it is not a link.
 */
export function normalizeLinkUrl(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname) return null;
    return url.href;
  } catch {
    return null;
  }
}

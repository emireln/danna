import type { AnnouncementRow } from '../lib/types';

// Shown on this device. Online accounts read the same kinds of notes from the cloud.
export const LOCAL_ANNOUNCEMENTS: AnnouncementRow[] = [
  {
    id: 'local-banner',
    kind: 'banner',
    title: 'Plan your TOEFL score one lesson at a time',
    body: 'Take the diagnostic, follow the roadmap and check your progress every day.',
    version: null,
    image_url: null,
    cta_label: 'Start the diagnostic',
    cta_url: '/play/diagnostic',
    accent: 'blue',
    priority: 10,
    created_at: '2026-11-01T09:00:00Z',
  },
  {
    id: 'local-release-020',
    kind: 'release_note',
    title: 'danna 0.2.0',
    body: [
      '- Keep everything on this device, or sign in to sync across devices',
      '- A new window bar and a tray icon, so practice stays one click away',
      '- A short welcome to choose how you want to learn',
      '- Friendlier messages and a new logo',
    ].join('\n'),
    version: '0.2.0',
    image_url: null,
    cta_label: null,
    cta_url: null,
    accent: 'blue',
    priority: 0,
    created_at: '2026-11-11T09:00:00Z',
  },
  {
    id: 'local-release-010',
    kind: 'release_note',
    title: 'danna 0.1.0',
    body: [
      '- A roadmap with six units, unit checks and stars',
      '- A diagnostic with an estimated TOEFL score and a skill report',
      '- Self study by section, mini mock tests and quick practice',
      '- Add your own AI key for generated sets and coach feedback',
    ].join('\n'),
    version: '0.1.0',
    image_url: null,
    cta_label: null,
    cta_url: null,
    accent: 'blue',
    priority: 0,
    created_at: '2026-11-10T09:00:00Z',
  },
];

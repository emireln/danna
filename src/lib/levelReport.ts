// The level report on Today can be removed for good, so the screen stays uncluttered. The choice is kept on this device,
// for each account. Storage can be blocked: then the report simply shows again next time.
const KEY = 'danna.levelReportRemoved';

export function isLevelReportRemoved(profileId: string): boolean {
  try {
    return window.localStorage.getItem(`${KEY}:${profileId}`) === '1';
  } catch {
    return false;
  }
}

export function rememberLevelReportRemoved(profileId: string): void {
  try {
    window.localStorage.setItem(`${KEY}:${profileId}`, '1');
  } catch {
    // The report comes back on the next launch.
  }
}

// The guided tour after the setup. 'offer' means Today will offer the tour once; 'seen' means the offer was answered
// (the tour was started, or closed). It is kept on this device, like the welcome. Settings starts the tour without it.
const TOUR_KEY = 'danna.tour';

export type TourStatus = 'offer' | 'seen';

export function readTourStatus(): TourStatus {
  try {
    return window.localStorage.getItem(TOUR_KEY) === 'offer' ? 'offer' : 'seen';
  } catch {
    return 'seen';
  }
}

export function setTourStatus(status: TourStatus): void {
  try {
    window.localStorage.setItem(TOUR_KEY, status);
  } catch {
    // Not critical: the offer may show once more.
  }
}

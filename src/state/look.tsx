// Puts the look of the profile on the page. The root element carries data-look, and the Playful styles
// (src/styles/playful.css) apply only under data-look="playful". Before the profile loads, the page is Classic.
import { useEffect } from 'react';
import { lookOf } from '../lib/look';
import { useAppData } from './appData';

export function LookSync() {
  const { profile } = useAppData();
  const look = lookOf(profile);
  useEffect(() => {
    document.documentElement.dataset.look = look;
  }, [look]);
  return null;
}

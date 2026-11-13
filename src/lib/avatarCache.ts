// Each picture is downloaded once per version and shown from memory after that.
// The key holds the version (a timestamp), so a new picture is always fetched.
// A picture that could not be loaded is not remembered: it is asked for again.
import { useEffect, useRef, useState } from 'react';

const urls = new Map<string, Promise<string | null>>();

// A picture can be missing for now: a friend who has not accepted yet, or a dropped connection.
// The screen asks again after these waits, then stops until the picture is shown again.
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 120_000];

export function pictureUrl(key: string, load: () => Promise<Blob | null>): Promise<string | null> {
  const cached = urls.get(key);
  if (cached) return cached;
  const pending = load()
    .then((blob) => {
      if (blob) return URL.createObjectURL(blob);
      urls.delete(key);
      return null;
    })
    .catch(() => {
      urls.delete(key);
      return null;
    });
  urls.set(key, pending);
  return pending;
}

/** The object URL for a picture, or null while it loads or when there is none. */
export function usePictureUrl(key: string | null, load: () => Promise<Blob | null>): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const loader = useRef(load);

  useEffect(() => {
    loader.current = load;
  });

  useEffect(() => {
    if (!key) {
      setUrl(null);
      return undefined;
    }
    let active = true;
    let tries = 0;
    let timer: number | undefined;
    const fetchPicture = () => {
      void pictureUrl(key, () => loader.current()).then((next) => {
        if (!active) return;
        setUrl(next);
        if (next || tries >= RETRY_DELAYS_MS.length) return;
        timer = window.setTimeout(() => {
          tries += 1;
          fetchPicture();
        }, RETRY_DELAYS_MS[tries]);
      });
    };
    fetchPicture();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [key]);

  return url;
}

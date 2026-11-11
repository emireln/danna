// Each picture is downloaded once per version and shown from memory after that.
// The key holds the version (a timestamp), so a new picture is always fetched.
import { useEffect, useRef, useState } from 'react';

const urls = new Map<string, Promise<string | null>>();

export function pictureUrl(key: string, load: () => Promise<Blob | null>): Promise<string | null> {
  const cached = urls.get(key);
  if (cached) return cached;
  const pending = load()
    .then((blob) => (blob ? URL.createObjectURL(blob) : null))
    .catch(() => {
      // A failed download is tried again the next time the picture is shown.
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
    void pictureUrl(key, () => loader.current()).then((next) => {
      if (active) setUrl(next);
    });
    return () => {
      active = false;
    };
  }, [key]);

  return url;
}

// The storage gateway (worker/storage in the Danna repository). It keeps the apps' pictures, banners and library files in
// Supabase Storage, or in Cloudflare R2 once Supabase Storage is nearly full, so the app never needs to know where a file
// is. Every request carries the person's sign-in, and the gateway checks it. Without an address at build time
// (VITE_STORAGE_WORKER_URL), the app keeps using Supabase Storage directly.

export type StorageGateway = {
  upload(bucket: string, path: string, blob: Blob, contentType: string, token: string): Promise<void>;
  download(bucket: string, path: string, token: string): Promise<Blob | null>;
  remove(bucket: string, path: string, token: string): Promise<void>;
};

// The address of one file: the slashes between the parts of its path stay, and each part is encoded.
function fileAddress(base: string, bucket: string, path: string): string {
  return `${base}/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

// A failure comes back as JSON with a short message, which is what the person sees.
async function failure(response: Response): Promise<Error> {
  let message = 'The file could not be saved. Try again in a moment.';
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error) message = body.error;
  } catch {
    // The answer was not JSON, so the general message is used.
  }
  return new Error(message);
}

export function makeStorageGateway(base: string): StorageGateway {
  const origin = base.replace(/\/+$/, '');
  return {
    async upload(bucket, path, blob, contentType, token) {
      const response = await fetch(fileAddress(origin, bucket, path), {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}`, 'content-type': contentType },
        body: blob,
      });
      if (!response.ok) throw await failure(response);
    },
    async download(bucket, path, token) {
      const response = await fetch(fileAddress(origin, bucket, path), {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (response.status === 404) return null;
      if (!response.ok) throw await failure(response);
      return response.blob();
    },
    async remove(bucket, path, token) {
      const response = await fetch(fileAddress(origin, bucket, path), {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw await failure(response);
    },
  };
}

// The gateway's address for this build, or '' when it is not set.
export const STORAGE_GATEWAY_URL: string = (
  (import.meta.env.VITE_STORAGE_WORKER_URL as string | undefined) ?? ''
).trim();

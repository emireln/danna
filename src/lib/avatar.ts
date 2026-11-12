// Turns any picture into a small square WebP for a profile. Used for offline and online
// accounts, so pictures stay light in the database and load quickly.
export const AVATAR_SIZE = 256;
const MAX_BYTES = 300 * 1024;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
// Quality is lowered step by step until the picture fits the size limit.
const QUALITY_STEPS = [0.88, 0.8, 0.72, 0.62];

/** A problem with the chosen picture. The message is written for the person. */
export class PictureError extends Error {}

export async function prepareAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    throw new PictureError('Choose a photo or image file, such as JPG, PNG or WebP.');
  }
  if (file.size > MAX_INPUT_BYTES) throw new PictureError('That picture is too large. Choose one under 15 MB.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PictureError('We could not read that picture. Try another one.');
  }

  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new PictureError('This picture could not be prepared. Try again.');
    context.imageSmoothingQuality = 'high';
    // Crop to the center square, then scale it down.
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    for (const quality of QUALITY_STEPS) {
      const blob = await toWebp(canvas, quality);
      if (blob.size <= MAX_BYTES) return blob;
    }
    throw new PictureError('That picture is too detailed to save. Try a simpler one.');
  } finally {
    bitmap.close();
  }
}

function toWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // Some systems cannot encode WebP and quietly return PNG; that is refused here.
        if (blob && blob.type === 'image/webp') resolve(blob);
        else reject(new PictureError('This device cannot save pictures yet.'));
      },
      'image/webp',
      quality,
    );
  });
}

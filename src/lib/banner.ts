// Turns a picture into a wide WebP strip for the profile banner. The middle of the picture is kept in the banner's
// shape, and the strip is made small enough to save and to load quickly. Used for offline and online accounts.
import { PictureError, toWebp } from './avatar';

export const BANNER_WIDTH = 1200;
export const BANNER_HEIGHT = 360;
const MAX_BYTES = 480 * 1024;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
// Quality is lowered step by step until the banner fits the size limit.
const QUALITY_STEPS = [0.88, 0.8, 0.72, 0.62];

export async function prepareBanner(file: File): Promise<Blob> {
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
    // The part of the picture with the banner's shape, taken from the middle.
    const wanted = BANNER_WIDTH / BANNER_HEIGHT;
    let cropWidth = bitmap.width;
    let cropHeight = bitmap.height;
    if (bitmap.width / bitmap.height > wanted) cropWidth = bitmap.height * wanted;
    else cropHeight = bitmap.width / wanted;
    const canvas = document.createElement('canvas');
    canvas.width = BANNER_WIDTH;
    canvas.height = BANNER_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new PictureError('This picture could not be prepared. Try again.');
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      bitmap,
      (bitmap.width - cropWidth) / 2,
      (bitmap.height - cropHeight) / 2,
      cropWidth,
      cropHeight,
      0,
      0,
      BANNER_WIDTH,
      BANNER_HEIGHT,
    );

    for (const quality of QUALITY_STEPS) {
      const blob = await toWebp(canvas, quality);
      if (blob.size <= MAX_BYTES) return blob;
    }
    throw new PictureError('That picture is too detailed to save as a banner. Try a simpler one.');
  } finally {
    bitmap.close();
  }
}

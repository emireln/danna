// Reads a file the learner sends to the coach. Pictures are made smaller and sent as JPEG, and PDF and
// text files are read to plain text. The kinds and limits are in coach.ts.
import { userError } from './bridge';
import { ATTACHMENT_MAX_BYTES, DOCUMENT_TEXT_LIMIT, IMAGE_MAX_SIDE, fileKind, type PendingFile, type PendingPicture } from './coach';
import { readPdf } from './pdf';

const PICTURE_UNREADABLE = 'This picture could not be read. Try another one.';

async function pictureOf(file: File, key: string): Promise<PendingPicture> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw userError(PICTURE_UNREADABLE);
  }
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw userError(PICTURE_UNREADABLE);
  }
  // Transparent parts become white, so the JPEG keeps the colours the learner sees.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL('image/jpeg', 0.85);
  return {
    key,
    kind: 'image',
    name: file.name,
    size: file.size,
    image: { mime: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) },
    preview: url,
  };
}

/** The file as the coach can send it, or a message the learner can act on. */
export async function readAttachment(file: File): Promise<PendingFile> {
  const kind = fileKind(file);
  if (!kind) throw userError('Only pictures, PDF, TXT and Markdown files can be sent.');
  if (file.size > ATTACHMENT_MAX_BYTES) throw userError('This file is larger than 20 MB.');
  const key = crypto.randomUUID();
  if (kind === 'image') return pictureOf(file, key);
  if (kind === 'pdf') {
    const { text } = await readPdf(await file.arrayBuffer());
    if (!text.trim()) throw userError('This PDF has no readable text yet. A scanned PDF needs its text first.');
    return { key, kind: 'document', name: file.name, size: file.size, text: text.slice(0, DOCUMENT_TEXT_LIMIT) };
  }
  const text = (await file.text()).slice(0, DOCUMENT_TEXT_LIMIT);
  if (!text.trim()) throw userError('This file has no text in it.');
  return { key, kind: 'document', name: file.name, size: file.size, text };
}

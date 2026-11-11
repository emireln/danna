// PDF support for the library: the text the tutor reads, and the pages drawn in the viewer.
// pdf.js is loaded the first time a PDF is used, so the rest of the app stays light.
import { LIBRARY_TEXT_LIMIT } from './library';

type PdfJs = typeof import('pdfjs-dist');
let loader: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  if (!loader) {
    loader = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
      return pdfjs;
    });
  }
  return loader;
}

/** Opens a PDF. close() releases it when the caller is done. */
async function openPdf(bytes: ArrayBuffer) {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes) });
  const pdf = await task.promise;
  return { pdf, close: () => task.destroy() };
}

/** The text of a PDF, page by page, and its page count. Scanned pages have no text to read. */
export async function readPdf(bytes: ArrayBuffer): Promise<{ text: string; pages: number }> {
  const { pdf, close } = await openPdf(bytes);
  try {
    const parts: string[] = [];
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const line = content.items
        .map((item) => ('str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : ''))
        .join('')
        .replace(/[ \t]+/g, ' ')
        .trim();
      if (line) parts.push(line);
      page.cleanup();
    }
    return { text: parts.join('\n\n').slice(0, LIBRARY_TEXT_LIMIT), pages: pdf.numPages };
  } finally {
    await close();
  }
}

/**
 * Draws the pages of a PDF into the host element, scaled to its width. A very long document
 * shows its first pages. Stops early when isCancelled() becomes true.
 */
export async function drawPdf(bytes: ArrayBuffer, host: HTMLElement, isCancelled: () => boolean, maxPages = 60): Promise<number> {
  const { pdf, close } = await openPdf(bytes);
  try {
    const count = Math.min(pdf.numPages, maxPages);
    const width = Math.min(Math.max(host.clientWidth, 320), 820);
    for (let number = 1; number <= count && !isCancelled(); number += 1) {
      const page = await pdf.getPage(number);
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / natural.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) break;
      host.appendChild(canvas);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      page.cleanup();
    }
    return pdf.numPages;
  } finally {
    await close();
  }
}

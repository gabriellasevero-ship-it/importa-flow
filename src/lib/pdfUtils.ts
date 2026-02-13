import * as pdfjsLib from 'pdfjs-dist';
// Worker para processamento em background (evita travar a UI)
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

if (typeof pdfjsWorker === 'string') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

/**
 * Extrai o texto de cada página do PDF (preserva quebra de linha por página).
 */
export async function extractTextByPage(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const pageTexts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const parts: string[] = [];
    for (const item of textContent.items) {
      if ('str' in item && typeof (item as { str: string; hasEOL?: boolean }).str === 'string') {
        const textItem = item as { str: string; hasEOL?: boolean };
        parts.push(textItem.str);
        if (textItem.hasEOL) parts.push('\n');
      }
    }
    pageTexts.push(parts.join(''));
  }

  return pageTexts;
}

/**
 * Extrai todo o texto do PDF em uma única string (todas as páginas unidas).
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const pages = await extractTextByPage(file);
  return pages.join('\n');
}

const PAGE_IMAGE_SCALE = 1.5;
const PAGE_IMAGE_JPEG_QUALITY = 0.85;

/**
 * Gera uma imagem (JPEG) por página do PDF, renderizando cada página em um canvas.
 * Retorna um Blob por página, na ordem.
 */
export async function extractPageImagesAsBlobs(file: File): Promise<Blob[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const blobs: Blob[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: PAGE_IMAGE_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    await page.render({
      canvasContext: ctx,
      viewport,
      intent: 'display',
    }).promise;
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', PAGE_IMAGE_JPEG_QUALITY);
    });
    if (blob) blobs.push(blob);
  }

  return blobs;
}

/**
 * Extrai texto e imagens (uma por página) em uma única leitura do PDF.
 * Mais rápido que chamar extractTextByPage e extractPageImagesAsBlobs separadamente.
 */
export async function extractTextAndPageImages(
  file: File
): Promise<{ pageTexts: string[]; pageBlobs: Blob[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const pageTexts: string[] = [];
  const pageBlobs: Blob[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const parts: string[] = [];
    for (const item of textContent.items) {
      if ('str' in item && typeof (item as { str: string; hasEOL?: boolean }).str === 'string') {
        const textItem = item as { str: string; hasEOL?: boolean };
        parts.push(textItem.str);
        if (textItem.hasEOL) parts.push('\n');
      }
    }
    pageTexts.push(parts.join(''));

    const viewport = page.getViewport({ scale: PAGE_IMAGE_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      await page.render({
        canvasContext: ctx,
        viewport,
        intent: 'display',
      }).promise;
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', PAGE_IMAGE_JPEG_QUALITY);
      });
      if (blob) pageBlobs.push(blob);
    }
  }

  return { pageTexts, pageBlobs };
}

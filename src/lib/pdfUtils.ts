import * as pdfjsLib from 'pdfjs-dist';
// Worker para processamento em background (evita travar a UI)
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { findOrderedUniqueSkuMatches } from '@/lib/catalogParser';

if (typeof pdfjsWorker === 'string') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

const PAGE_IMAGE_SCALE = 1.5;
const PAGE_IMAGE_JPEG_QUALITY = 0.85;
const OCR_TIMEOUT_MS = 20_000;

type PdfTextItem = { str: string; hasEOL?: boolean; transform: number[]; width?: number };

function isPdfTextItem(item: unknown): item is PdfTextItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'str' in item &&
    'transform' in item &&
    typeof (item as { str: unknown }).str === 'string' &&
    Array.isArray((item as { transform: unknown }).transform) &&
    (item as { transform: number[] }).transform.length >= 6
  );
}

/**
 * Reconstrói o texto na ordem de leitura (topo → base, esquerda → direita).
 * O pdf.js devolve itens na ordem do stream do PDF, o que em catálogos vira lixo para o parser.
 */
export function buildPageTextFromPdfItems(items: readonly unknown[]): string {
  const positioned: { str: string; x: number; y: number; w: number; hasEOL?: boolean }[] = [];
  for (const item of items) {
    if (!isPdfTextItem(item)) continue;
    const s = item.str;
    if (!s || !s.trim()) continue;
    const t = item.transform;
    const w = typeof item.width === 'number' && item.width > 0 ? item.width : s.length * 4.5;
    positioned.push({ str: s, x: t[4], y: t[5], w, hasEOL: item.hasEOL });
  }
  if (positioned.length === 0) return '';

  const sortedByY = [...positioned].sort((a, b) => b.y - a.y);
  const yTolerance = 6;
  const lines: typeof positioned[] = [];
  for (const p of sortedByY) {
    const lastLine = lines[lines.length - 1];
    if (lastLine && Math.abs(lastLine[0].y - p.y) < yTolerance) {
      lastLine.push(p);
    } else {
      lines.push([p]);
    }
  }
  const lineStrings: string[] = [];
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);
    let acc = '';
    for (let i = 0; i < line.length; i++) {
      const cur = line[i];
      const prev = line[i - 1];
      const gap = prev ? cur.x - (prev.x + prev.w) : 0;
      if (prev && gap > 2) acc += ' ';
      acc += cur.str;
      if (cur.hasEOL) acc += '\n';
    }
    lineStrings.push(acc.trimEnd());
  }
  return lineStrings.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

type ViewportLike = { transform: number[]; width: number; height: number };

type PositionedRun = {
  str: string;
  x: number;
  y: number;
  w: number;
  y0: number;
  y1: number;
  hasEOL?: boolean;
};

function yMidRun(p: PositionedRun): number {
  return (p.y0 + p.y1) / 2;
}

function collapseNewlineRuns(chars: string[], ys: number[]): { chars: string[]; ys: number[] } {
  const outC: string[] = [];
  const outY: number[] = [];
  let i = 0;
  while (i < chars.length) {
    if (chars[i] === '\n') {
      const start = i;
      while (i < chars.length && chars[i] === '\n') i++;
      const yVals = ys.slice(start, i);
      const count = i - start;
      const toEmit = count >= 3 ? 2 : count;
      for (let k = 0; k < toEmit; k++) {
        outC.push('\n');
        outY.push(yVals[Math.min(k, yVals.length - 1)] ?? 0);
      }
    } else {
      outC.push(chars[i]);
      outY.push(ys[i]);
      i++;
    }
  }
  return { chars: outC, ys: outY };
}

function trimCharsAndYs(chars: string[], ys: number[]): { text: string; yMid: (normIndex: number) => number } {
  let start = 0;
  while (start < chars.length && /\s/.test(chars[start])) start++;
  let end = chars.length;
  while (end > start && /\s/.test(chars[end - 1])) end--;
  const tc = chars.slice(start, end);
  const ty = ys.slice(start, end);
  const text = tc.join('');
  return {
    text,
    yMid: (normIndex: number) => {
      if (ty.length === 0) return 0;
      const j = Math.max(0, Math.min(normIndex, ty.length - 1));
      return ty[j];
    },
  };
}

/**
 * Mesmo texto que buildPageTextFromPdfItems + posição Y (viewport) por caractere, para recorte por SKU.
 */
function buildNormalizedPageTextWithYMidLookup(
  viewport: ViewportLike,
  items: readonly unknown[]
): { text: string; yMid: (i: number) => number } | null {
  const positioned: PositionedRun[] = [];
  for (const item of items) {
    if (!isPdfTextItem(item)) continue;
    const s = item.str;
    if (!s || !s.trim()) continue;
    const t = item.transform;
    const w = typeof item.width === 'number' && item.width > 0 ? item.width : s.length * 4.5;
    const tx = pdfjsLib.Util.transform(viewport.transform, t);
    const scale = Math.hypot(tx[0], tx[1]) || 1;
    const th = typeof item.height === 'number' && item.height > 0 ? item.height * scale : scale * 10;
    const yBase = tx[5];
    const yTop = yBase - th * 0.75;
    const yBot = yBase + th * 0.35;
    positioned.push({
      str: s,
      x: t[4],
      y: t[5],
      w,
      y0: yTop,
      y1: yBot,
      hasEOL: item.hasEOL,
    });
  }
  if (positioned.length === 0) {
    return { text: '', yMid: () => 0 };
  }

  const sortedByY = [...positioned].sort((a, b) => b.y - a.y);
  const yTolerance = 6;
  const lines: PositionedRun[][] = [];
  for (const p of sortedByY) {
    const lastLine = lines[lines.length - 1];
    if (lastLine && Math.abs(lastLine[0].y - p.y) < yTolerance) {
      lastLine.push(p);
    } else {
      lines.push([p]);
    }
  }

  const linesChars: string[][] = [];
  const linesYs: number[][] = [];
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);
    const lc: string[] = [];
    const ly: number[] = [];
    for (let i = 0; i < line.length; i++) {
      const cur = line[i];
      const prev = line[i - 1];
      const gap = prev ? cur.x - (prev.x + prev.w) : 0;
      if (prev && gap > 2) {
        lc.push(' ');
        ly.push((yMidRun(prev) + yMidRun(cur)) / 2);
      }
      for (const ch of cur.str) {
        lc.push(ch);
        ly.push(yMidRun(cur));
      }
      if (cur.hasEOL) {
        lc.push('\n');
        ly.push(yMidRun(cur));
      }
    }
    while (lc.length > 0 && /\s/.test(lc[lc.length - 1])) {
      lc.pop();
      ly.pop();
    }
    linesChars.push(lc);
    linesYs.push(ly);
  }

  const chars: string[] = [];
  const ys: number[] = [];
  for (let li = 0; li < linesChars.length; li++) {
    if (li > 0) {
      const yPrev =
        linesYs[li - 1].length > 0 ? linesYs[li - 1][linesYs[li - 1].length - 1] : viewport.height / 2;
      const yNext = linesYs[li].length > 0 ? linesYs[li][0] : viewport.height / 2;
      chars.push('\n');
      ys.push((yPrev + yNext) / 2);
    }
    chars.push(...linesChars[li]);
    ys.push(...linesYs[li]);
  }

  const collapsed = collapseNewlineRuns(chars, ys);
  const { text, yMid } = trimCharsAndYs(collapsed.chars, collapsed.ys);

  const ref = buildPageTextFromPdfItems(items).replace(/\r/g, '').trim();
  const built = text.replace(/\r/g, '').trim();
  if (built !== ref) return null;

  return { text: built, yMid };
}

export type SkuVerticalBand = { sku: string; topFrac: number; bottomFrac: number };

export function computePageSkuVerticalBands(
  viewport: ViewportLike,
  items: readonly unknown[],
  pageHeightPx: number
): SkuVerticalBand[] {
  const geo = buildNormalizedPageTextWithYMidLookup(viewport, items);
  if (!geo || !geo.text.trim()) return [];

  const matches = findOrderedUniqueSkuMatches(geo.text);
  if (matches.length < 2) return [];

  const H = Math.max(1, pageHeightPx);
  const centers = matches.map(({ sku, index, length }) => {
    let sum = 0;
    let n = 0;
    for (let k = 0; k < length; k++) {
      sum += geo.yMid(index + k);
      n++;
    }
    const yc = n > 0 ? sum / n : H / 2;
    return { sku, yCenter: yc };
  });

  centers.sort((a, b) => a.yCenter - b.yCenter);
  const yVals = centers.map((c) => c.yCenter);
  const out: SkuVerticalBand[] = [];
  for (let i = 0; i < centers.length; i++) {
    const topY = i === 0 ? 0 : (yVals[i - 1] + yVals[i]) / 2;
    const botY = i + 1 < centers.length ? (yVals[i] + yVals[i + 1]) / 2 : H;
    out.push({
      sku: centers[i].sku,
      topFrac: Math.max(0, Math.min(1, topY / H)),
      bottomFrac: Math.max(0, Math.min(1, botY / H)),
    });
  }
  return out;
}

/** Faixas iguais quando não há geometria de texto no PDF (ex.: só OCR). */
export function equalVerticalCropFracs(count: number): { topFrac: number; bottomFrac: number }[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => ({
    topFrac: i / count,
    bottomFrac: (i + 1) / count,
  }));
}

export async function cropImageBlobVertical(
  blob: Blob,
  topFrac: number,
  bottomFrac: number,
  quality = PAGE_IMAGE_JPEG_QUALITY
): Promise<Blob | null> {
  const top = Math.max(0, Math.min(1, topFrac));
  const bottom = Math.max(top, Math.min(1, bottomFrac));
  try {
    const bmp = await createImageBitmap(blob);
    const sy = Math.floor(top * bmp.height);
    const sh = Math.max(1, Math.ceil(bottom * bmp.height) - sy);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, sy, bmp.width, sh, 0, 0, bmp.width, sh);
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
  } catch {
    return null;
  }
}

function pageTextLooksInsufficient(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 60) return true;
  const hasPrice = /R\$\s*[\d.,]+/i.test(t);
  const hasSku = /\b[A-Za-z]{2,}\s*[-_]\s*[A-Za-z0-9]{2,}\b/.test(t);
  if (!hasPrice && !hasSku && t.length < 280) return true;
  return false;
}

async function maybeEnrichTextWithOcr(
  canvas: HTMLCanvasElement,
  nativeText: string,
  onBeforeOcr?: () => void
): Promise<{ text: string; ranOcr: boolean }> {
  if (!pageTextLooksInsufficient(nativeText)) {
    return { text: nativeText, ranOcr: false };
  }
  onBeforeOcr?.();
  try {
    const { default: Tesseract } = await import('tesseract.js');
    const ocrPromise = Tesseract.recognize(canvas, 'por+eng', {
      logger: () => {},
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('OCR_TIMEOUT')), OCR_TIMEOUT_MS);
    });
    const result = await Promise.race([ocrPromise, timeoutPromise]);
    const ocr = (result.data.text || '').trim();
    const text = ocr.length > nativeText.trim().length ? ocr : nativeText;
    return { text, ranOcr: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'OCR_TIMEOUT') {
      console.warn('OCR excedeu o tempo limite da página; usando texto nativo do PDF.');
    }
    return { text: nativeText, ranOcr: true };
  }
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
    pageTexts.push(buildPageTextFromPdfItems(textContent.items));
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

export type ExtractTextAndPageImagesOptions = {
  /** Disparado uma vez, imediatamente antes do primeiro OCR (para avisar que pode demorar). */
  onOcrStarting?: () => void;
  /** Disparado ao concluir o processamento de cada página do PDF. */
  onPageProcessed?: (progress: { currentPage: number; totalPages: number }) => void;
};

/**
 * Extrai texto e imagens (uma por página) em uma única leitura do PDF.
 * Mais rápido que chamar extractTextByPage e extractPageImagesAsBlobs separadamente.
 */
export async function extractTextAndPageImages(
  file: File,
  options?: ExtractTextAndPageImagesOptions
): Promise<{
  pageTexts: string[];
  pageBlobs: Blob[];
  ocrPageCount: number;
  pageSkuVerticalBands: SkuVerticalBand[][];
}> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const pageTexts: string[] = [];
  const pageBlobs: Blob[] = [];
  const pageSkuVerticalBands: SkuVerticalBand[][] = [];
  let ocrPageCount = 0;
  let ocrStartNotified = false;
  const notifyOcrStartingOnce = () => {
    if (ocrStartNotified) return;
    ocrStartNotified = true;
    options?.onOcrStarting?.();
  };

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    let pageText = buildPageTextFromPdfItems(textContent.items);

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
      pageSkuVerticalBands.push(
        computePageSkuVerticalBands(viewport, textContent.items, canvas.height)
      );
      const { text, ranOcr } = await maybeEnrichTextWithOcr(canvas, pageText, notifyOcrStartingOnce);
      pageText = text;
      if (ranOcr) ocrPageCount += 1;
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', PAGE_IMAGE_JPEG_QUALITY);
      });
      if (blob) pageBlobs.push(blob);
    } else {
      pageSkuVerticalBands.push([]);
    }

    pageTexts.push(pageText);
    options?.onPageProcessed?.({ currentPage: i, totalPages: numPages });
  }

  return { pageTexts, pageBlobs, ocrPageCount, pageSkuVerticalBands };
}

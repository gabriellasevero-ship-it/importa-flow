/** Maior lado da imagem enviada ao OCR — fotos de celular costumam ser 4K+ e estouram memória. */
export const MAX_OCR_DIMENSION = 1280;

const OCR_TIMEOUT_MS = 45_000;

export function computeOcrCanvasSize(
  width: number,
  height: number,
  maxDimension = MAX_OCR_DIMENSION
): { width: number; height: number; scale: number } {
  if (width <= 0 || height <= 0) {
    return { width: 1, height: 1, scale: 1 };
  }

  const longest = Math.max(width, height);
  if (longest <= maxDimension) {
    return { width, height, scale: 1 };
  }

  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

export function extractSearchTermFromOcrText(text: string, maxWords = 6): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, maxWords)
    .join(' ')
    .trim();
}

export function isOcrMemoryError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();
  return (
    normalized.includes('memory') ||
    normalized.includes('memoria') ||
    normalized.includes('memória') ||
    normalized.includes('out of memory') ||
    normalized.includes('cannot enlarge memory') ||
    normalized.includes('insuficien')
  );
}

async function loadImageSource(
  file: File
): Promise<{ source: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Falha ao carregar a imagem para OCR.'));
      image.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      cleanup: () => {},
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Redimensiona a imagem para um tamanho seguro antes do OCR no navegador.
 * Retorna um canvas pronto para o Tesseract (sem manter o arquivo original em bitmap).
 */
export async function prepareImageForOcr(file: File): Promise<HTMLCanvasElement> {
  const loaded = await loadImageSource(file);
  try {
    const size = computeOcrCanvasSize(loaded.width, loaded.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Canvas não disponível neste navegador.');
    }
    // Fundo branco evita artefatos de transparência em PNG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(loaded.source, 0, 0, size.width, size.height);
    return canvas;
  } finally {
    loaded.cleanup();
  }
}

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * Extrai texto de uma imagem com Tesseract.js, com resize prévio e liberação do worker.
 */
export async function recognizeTextFromImage(file: File): Promise<string> {
  const canvas = await prepareImageForOcr(file);
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('por+eng', 1, {
    logger: () => {},
  });

  try {
    const recognizePromise = worker.recognize(canvas);
    const timeoutPromise = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('OCR_TIMEOUT')), OCR_TIMEOUT_MS);
    });
    const result = await Promise.race([recognizePromise, timeoutPromise]);
    return (result.data.text || '').trim().replace(/\s+/g, ' ');
  } finally {
    try {
      await worker.terminate();
    } catch {
      // ignorar falha ao encerrar worker
    }
    releaseCanvas(canvas);
  }
}

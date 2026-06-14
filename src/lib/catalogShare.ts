import logoSvg from '@/assets/importa-flow-logo.svg?raw';

const SHARE_IMAGE_WIDTH = 640;
const SHARE_IMAGE_HEIGHT = 144;
const SHARE_IMAGE_FILENAME = 'importa-flow.png';

export type CatalogShareResult = 'shared' | 'cancelled' | 'copied' | 'failed';

/**
 * Monta a mensagem de apresentação que acompanha o link do catálogo.
 * Mantém a saudação coerente mesmo quando o nome da representante não existe.
 */
export function buildCatalogShareMessage(
  representativeName: string,
  catalogLink: string
): string {
  const name = representativeName.trim();
  const greeting = name
    ? `Olá, sou sua representante ${name}!`
    : 'Olá, sou sua representante!';

  return `${greeting} Segue o link do meu catálogo para você conferir as novidades e enviar o seu pedido. Boas Compras!\n\n${catalogLink}`;
}

/**
 * Compartilha o catálogo com imagem do Importa Flow + mensagem usando a Web Share API.
 * Faz fallback para copiar a mensagem na área de transferência quando o
 * compartilhamento nativo (ou com arquivos) não está disponível.
 */
export async function shareCatalog(message: string): Promise<CatalogShareResult> {
  const canShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  if (canShare) {
    try {
      const image = await createImportaFlowShareImage();
      if (image && navigator.canShare?.({ files: [image] })) {
        await navigator.share({ files: [image], text: message });
        return 'shared';
      }

      await navigator.share({ text: message });
      return 'shared';
    } catch (error) {
      if (isShareAbort(error)) return 'cancelled';
      // Demais erros caem no fallback de cópia abaixo.
    }
  }

  return (await copyToClipboard(message)) ? 'copied' : 'failed';
}

function isShareAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function createImportaFlowShareImage(): Promise<File | null> {
  if (typeof document === 'undefined') return null;

  // O SVG só possui viewBox; definimos largura/altura para garantir
  // dimensões corretas ao desenhar no canvas em qualquer navegador.
  const sizedSvg = logoSvg.replace(
    '<svg',
    `<svg width="${SHARE_IMAGE_WIDTH}" height="${SHARE_IMAGE_HEIGHT}"`
  );
  const svgUrl = URL.createObjectURL(
    new Blob([sizedSvg], { type: 'image/svg+xml' })
  );

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement('canvas');
    canvas.width = SHARE_IMAGE_WIDTH;
    canvas.height = SHARE_IMAGE_HEIGHT;

    const context = canvas.getContext('2d');
    if (!context) return null;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToBlob(canvas);
    if (!blob) return null;

    return new File([blob], SHARE_IMAGE_FILENAME, { type: 'image/png' });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Falha ao carregar a imagem do catálogo.'));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyWithFallback(text);
  }
}

function copyWithFallback(text: string): boolean {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  document.body.removeChild(textArea);
  return copied;
}

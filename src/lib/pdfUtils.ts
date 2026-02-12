import * as pdfjsLib from 'pdfjs-dist';
// Worker para processamento em background (evita travar a UI)
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

if (typeof pdfjsWorker === 'string') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

/**
 * Extrai todo o texto de um arquivo PDF (todas as páginas).
 * Útil para processar catálogos em PDF e depois parsear com parseCatalogText.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const pageTexts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const strings = textContent.items
      .filter((item): item is { str: string } => 'str' in item && typeof (item as { str: string }).str === 'string')
      .map((item) => item.str);
    pageTexts.push(strings.join(' '));
  }

  return pageTexts.join('\n');
}

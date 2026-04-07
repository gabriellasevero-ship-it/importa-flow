import { supabase } from '@/lib/supabase';

const CATALOG_IMAGES_PREFIX = 'catalog';

/**
 * Faz upload de uma imagem de página de catálogo (JPEG) para o bucket product-images
 * e retorna a URL pública. Use o mesmo batchId para todas as páginas do mesmo importe.
 */
export async function uploadCatalogPageImage(
  importadoraId: string,
  pageIndex: number,
  blob: Blob,
  batchId?: string,
  /** Vários produtos na mesma página: índice 0, 1, … para nome de arquivo único. */
  productSlot?: number
): Promise<string> {
  const ext = blob.type === 'image/png' ? 'png' : 'jpg';
  const id = batchId ?? Date.now();
  const slotSuffix = typeof productSlot === 'number' ? `-slot${productSlot + 1}` : '';
  const path = `${CATALOG_IMAGES_PREFIX}/${importadoraId}/${id}-page-${pageIndex + 1}${slotSuffix}.${ext}`;
  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(path, blob, { contentType: blob.type, upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(data.path);
  return urlData.publicUrl;
}

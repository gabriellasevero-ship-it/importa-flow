import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/** Box da foto do produto em frações 0–1 da página (pronta para cropImageBlobRect). */
export type CatalogPhotoBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/** Produto extraído pela IA a partir de uma página do catálogo. */
export type ExtractedCatalogProduct = {
  code: string;
  name: string;
  description: string;
  price: number;
  minOrder: number;
  dimensions: string;
  material: string;
  category: string;
  box: CatalogPhotoBox | null;
};

export type ExtractCatalogPageInput = {
  imageBase64: string;
  mimeType: string;
  nativeText: string;
  categoryNames: readonly string[];
  /** Texto da capa/divisórias do catálogo (onde costuma estar a categoria/tema). */
  catalogContext?: string;
};

/** Erro lançado quando a extração por IA não está disponível (ex.: sem chave/sessão). */
export class CatalogExtractionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogExtractionUnavailableError';
  }
}

/** Erro de limite de uso (HTTP 429) da IA: aguardar e tentar de novo, sem cair no método antigo. */
export class CatalogExtractionRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogExtractionRateLimitError';
  }
}

/** Same-origin (/api): o navegador não chama *.supabase.co direto (CORS / bloqueadores). */
function getExtractCatalogPageRequestUrl(): string {
  if (typeof window === 'undefined') {
    throw new Error('A extração de catálogo só pode ser feita pelo navegador.');
  }
  return `${window.location.origin}/api/extract-catalog-page`;
}

let cachedAccessToken: string | null = null;
let cachedExpiresAtMs = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedExpiresAtMs > now + 60_000) {
    return cachedAccessToken;
  }

  const { data: refreshData } = await supabase.auth.refreshSession();
  const session = refreshData.session ?? (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) {
    throw new CatalogExtractionUnavailableError(
      'Sessão expirada. Faça login novamente para processar o catálogo.'
    );
  }
  cachedAccessToken = session.access_token;
  cachedExpiresAtMs = session.expires_at ? session.expires_at * 1000 : now + 3_600_000;
  return cachedAccessToken;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CLIENT_RATE_LIMIT_MAX_ATTEMPTS = 6;
const CLIENT_RATE_LIMIT_BASE_MS = 15_000;

/** Erros de configuração/sessão: não adianta pular página nem repetir. */
export function isFatalCatalogExtractionError(err: unknown): boolean {
  if (!(err instanceof CatalogExtractionUnavailableError)) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes('sessão') ||
    m.includes('supabase não configurado') ||
    m.includes('não autorizado') ||
    m.includes('gemini_api_key') ||
    m.includes('apenas administradores')
  );
}

/**
 * Chama a IA por página com novas tentativas em 429 (limite do Gemini).
 * Catálogos grandes (40+ páginas) costumam estourar cota no meio do processo.
 */
export async function extractCatalogPageWithRetry(
  input: ExtractCatalogPageInput
): Promise<ExtractedCatalogProduct[]> {
  let lastRateLimit: CatalogExtractionRateLimitError | null = null;
  for (let attempt = 1; attempt <= CLIENT_RATE_LIMIT_MAX_ATTEMPTS; attempt++) {
    try {
      return await extractCatalogPage(input);
    } catch (err) {
      if (err instanceof CatalogExtractionRateLimitError) {
        lastRateLimit = err;
        if (attempt >= CLIENT_RATE_LIMIT_MAX_ATTEMPTS) break;
        await sleep(CLIENT_RATE_LIMIT_BASE_MS * attempt);
        continue;
      }
      throw err;
    }
  }
  throw lastRateLimit ?? new CatalogExtractionRateLimitError('Limite de uso da IA atingido.');
}

/**
 * Envia uma página do catálogo (imagem + texto nativo) para a Edge Function e
 * retorna os produtos extraídos pela IA, com a posição da foto de cada produto.
 */
export async function extractCatalogPage(
  input: ExtractCatalogPageInput
): Promise<ExtractedCatalogProduct[]> {
  if (!isSupabaseConfigured()) {
    throw new CatalogExtractionUnavailableError(
      'Supabase não configurado: a extração por IA está indisponível.'
    );
  }

  const accessToken = await getAccessToken();
  const requestUrl = getExtractCatalogPageRequestUrl();

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        imageBase64: input.imageBase64,
        mimeType: input.mimeType,
        nativeText: input.nativeText,
        categoryNames: input.categoryNames,
        catalogContext: input.catalogContext ?? '',
      }),
    });
  } catch (err) {
    const inner = err instanceof Error ? err.message.trim() : 'Failed to fetch';
    throw new CatalogExtractionUnavailableError(
      `Não foi possível contactar o serviço de extração (${inner}).`
    );
  }

  const text = await response.text();
  let payload:
    | { products?: ExtractedCatalogProduct[]; error?: string; rateLimited?: boolean }
    | null = null;
  if (text.trim().startsWith('{')) {
    try {
      payload = JSON.parse(text) as {
        products?: ExtractedCatalogProduct[];
        error?: string;
        rateLimited?: boolean;
      };
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message = payload?.error?.trim() || `Erro HTTP ${response.status} ao processar o catálogo.`;
    if (response.status === 429 || payload?.rateLimited) {
      throw new CatalogExtractionRateLimitError(message);
    }
    throw new CatalogExtractionUnavailableError(message);
  }

  return Array.isArray(payload?.products) ? payload.products : [];
}

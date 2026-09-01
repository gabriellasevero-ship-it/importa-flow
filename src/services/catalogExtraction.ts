import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  CATALOG_AI_RETRY,
  parseRetryAfterMs,
  waitMsForAttempt,
} from '@/services/catalogExtractionRetry';

export { parseRetryAfterMs, waitMsForAttempt, CATALOG_AI_RETRY };

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
  readonly retryAfterMs: number | null;

  constructor(message: string, retryAfterMs: number | null = null) {
    super(message);
    this.name = 'CatalogExtractionRateLimitError';
    this.retryAfterMs = retryAfterMs;
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

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Intervalo entre páginas na IA. Free tier do Gemini Flash costuma ser ~10–15 RPM;
 * ~5s entre chamadas reduz 429 sem tornar o catálogo inviável.
 */
export const AI_PAGE_GAP_MS = CATALOG_AI_RETRY.pageGapMs;

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

export type ExtractCatalogPageRetryOptions = {
  maxAttempts?: number;
  /** Notifica a UI enquanto aguarda cota (429). */
  onWaiting?: (info: { attempt: number; maxAttempts: number; waitMs: number }) => void;
};

/**
 * Chama a IA por página com novas tentativas em 429 (limite do Gemini).
 * Catálogos grandes: espera a cota em vez de abortar o PDF inteiro.
 */
export async function extractCatalogPageWithRetry(
  input: ExtractCatalogPageInput,
  options?: ExtractCatalogPageRetryOptions
): Promise<ExtractedCatalogProduct[]> {
  const maxAttempts = options?.maxAttempts ?? CATALOG_AI_RETRY.maxAttempts;
  let lastRateLimit: CatalogExtractionRateLimitError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await extractCatalogPage(input);
    } catch (err) {
      if (err instanceof CatalogExtractionRateLimitError) {
        lastRateLimit = err;
        if (attempt >= maxAttempts) break;
        const waitMs = waitMsForAttempt(attempt, err.retryAfterMs);
        options?.onWaiting?.({ attempt, maxAttempts, waitMs });
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }

  throw (
    lastRateLimit ??
    new CatalogExtractionRateLimitError('Limite de uso da IA atingido.')
  );
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
  let payload: {
    products?: ExtractedCatalogProduct[];
    error?: string;
    rateLimited?: boolean;
    retryAfterMs?: number;
  } | null = null;
  if (text.trim().startsWith('{')) {
    try {
      payload = JSON.parse(text) as {
        products?: ExtractedCatalogProduct[];
        error?: string;
        rateLimited?: boolean;
        retryAfterMs?: number;
      };
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      payload?.error?.trim() || `Erro HTTP ${response.status} ao processar o catálogo.`;
    if (response.status === 429 || payload?.rateLimited) {
      const retryAfterMs =
        parseRetryAfterMs(payload?.retryAfterMs) ??
        parseRetryAfterMs(payload?.error) ??
        parseRetryAfterMs(text) ??
        parseRetryAfterMs(response.headers.get('retry-after'));
      throw new CatalogExtractionRateLimitError(message, retryAfterMs);
    }
    throw new CatalogExtractionUnavailableError(message);
  }

  return Array.isArray(payload?.products) ? payload.products : [];
}

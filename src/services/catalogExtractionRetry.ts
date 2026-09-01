const CLIENT_RATE_LIMIT_BASE_MS = 15_000;
const CLIENT_RATE_LIMIT_MAX_MS = 90_000;

/** Extrai wait sugerido de mensagens no formato Gemini (`"retryDelay": "27s"`) ou campo numérico. */
export function parseRetryAfterMs(source: unknown): number | null {
  if (typeof source === 'number' && Number.isFinite(source) && source > 0) {
    return Math.min(Math.ceil(source), CLIENT_RATE_LIMIT_MAX_MS);
  }
  if (typeof source !== 'string') return null;
  const gemini = source.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
  if (gemini) {
    const secs = Number(gemini[1]);
    if (Number.isFinite(secs) && secs > 0) {
      return Math.min(Math.ceil(secs * 1000), CLIENT_RATE_LIMIT_MAX_MS);
    }
  }
  const headerSecs = source.match(/retry-after[^0-9]*(\d+)/i);
  if (headerSecs) {
    const secs = Number(headerSecs[1]);
    if (Number.isFinite(secs) && secs > 0) {
      return Math.min(secs * 1000, CLIENT_RATE_LIMIT_MAX_MS);
    }
  }
  return null;
}

export function waitMsForAttempt(attempt: number, hintMs: number | null): number {
  const exponential = Math.min(CLIENT_RATE_LIMIT_BASE_MS * attempt, CLIENT_RATE_LIMIT_MAX_MS);
  if (hintMs != null && hintMs > 0) {
    return Math.min(Math.max(hintMs, CLIENT_RATE_LIMIT_BASE_MS), CLIENT_RATE_LIMIT_MAX_MS);
  }
  return exponential;
}

export const CATALOG_AI_RETRY = {
  maxAttempts: 10,
  baseMs: CLIENT_RATE_LIMIT_BASE_MS,
  maxMs: CLIENT_RATE_LIMIT_MAX_MS,
  /** Intervalo entre páginas para caber em ~10–15 RPM do free tier. */
  pageGapMs: 5_000,
} as const;

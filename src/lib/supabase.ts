import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Em modo desenvolvimento/demo, o projeto pode ser usado sem Supabase configurado.
// Antes, chamávamos createClient com strings vazias, o que fazia a app quebrar
// logo ao carregar (tela em branco). Aqui garantimos sempre uma URL "válida"
// para evitar esse crash, mas continuamos marcando a configuração como ausente.
const FALLBACK_SUPABASE_URL = 'https://example.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'public-anon-key';

const memoryStorage = new Map<string, string>();

function getSafeStorage() {
  const isBrowser = typeof window !== 'undefined';
  if (!isBrowser) return undefined;

  try {
    const testKey = '__supabase_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    // Safari (especialmente em navegação privada ou com políticas rígidas)
    // pode bloquear localStorage e quebrar a persistência da sessão.
    console.warn('Supabase: localStorage indisponível. Usando storage em memória para sessão.');
    return {
      getItem: (key: string) => memoryStorage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memoryStorage.set(key, value);
      },
      removeItem: (key: string) => {
        memoryStorage.delete(key);
      },
    };
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase: URL ou Chave anônima não configurados. Crie um arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para usar o backend real.'
  );
}

export const supabase = createClient(
  supabaseUrl || FALLBACK_SUPABASE_URL,
  supabaseAnonKey || FALLBACK_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: getSafeStorage(),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  }
);

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

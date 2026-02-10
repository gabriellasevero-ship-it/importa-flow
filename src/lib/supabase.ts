import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Em modo desenvolvimento/demo, o projeto pode ser usado sem Supabase configurado.
// Antes, chamávamos createClient com strings vazias, o que fazia a app quebrar
// logo ao carregar (tela em branco). Aqui garantimos sempre uma URL "válida"
// para evitar esse crash, mas continuamos marcando a configuração como ausente.
const FALLBACK_SUPABASE_URL = 'https://example.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'public-anon-key';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase: URL ou Chave anônima não configurados. Crie um arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para usar o backend real.'
  );
}

export const supabase = createClient(
  supabaseUrl || FALLBACK_SUPABASE_URL,
  supabaseAnonKey || FALLBACK_SUPABASE_ANON_KEY
);

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

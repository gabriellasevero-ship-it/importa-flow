import { supabase } from '@/lib/supabase';

export type AuthLinkResult =
  | { ok: true }
  | { ok: false; message: string; hint?: string };

export type PendingAuthLinkParams = {
  tokenHash: string | null;
  otpType: string | null;
  code: string | null;
  hasHashTokens: boolean;
};

function cleanAuthParamsFromUrl(): void {
  const path = window.location.pathname.replace(/\/+$/, '') || '/definir-senha';
  window.history.replaceState({}, '', path);
}

/** Lê parâmetros de auth na query e no hash (#). */
export function readPendingAuthLinkParams(): PendingAuthLinkParams {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  const tokenHash = search.get('token_hash') ?? hash.get('token_hash');
  const otpType = search.get('type') ?? hash.get('type');
  const code = search.get('code') ?? hash.get('code');

  const hasHashTokens =
    !!window.location.hash &&
    (window.location.hash.includes('access_token') ||
      window.location.hash.includes('type=recovery') ||
      window.location.hash.includes('type=invite'));

  return { tokenHash, otpType, code, hasHashTokens };
}

export function hasPendingAuthLinkParams(): boolean {
  const p = readPendingAuthLinkParams();
  return !!(p.tokenHash && p.otpType === 'recovery') || !!p.code || p.hasHashTokens;
}

function readUrlAuthError(): string | null {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const error =
    search.get('error_description') ??
    search.get('error') ??
    hash.get('error_description') ??
    hash.get('error');
  return error ? decodeURIComponent(error.replace(/\+/g, ' ')) : null;
}

async function waitForAuthSession(maxMs = 8000): Promise<boolean> {
  const deadline = Date.now() + maxMs;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      subscription.unsubscribe();
      resolve(value);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session &&
        (event === 'PASSWORD_RECOVERY' ||
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'INITIAL_SESSION')
      ) {
        finish(true);
      }
    });

    const poll = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        finish(true);
        return;
      }
      if (Date.now() >= deadline) {
        finish(false);
        return;
      }
      window.setTimeout(() => void poll(), 120);
    };

    void poll();
  });
}

/**
 * Valida o link de convite ou recuperação (chamar após clique do usuário, não no mount).
 */
export async function establishSessionFromAuthLink(): Promise<AuthLinkResult> {
  const urlError = readUrlAuthError();
  if (urlError) {
    return {
      ok: false,
      message: urlError,
      hint: 'Solicite um novo e-mail de recuperação na tela de login.',
    };
  }

  const { tokenHash, otpType, code, hasHashTokens } = readPendingAuthLinkParams();

  if (tokenHash && otpType === 'recovery') {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    });
    if (error) {
      return {
        ok: false,
        message: error.message,
        hint: 'Peça um novo e-mail em "Esqueci minha senha". Se usa Outlook corporativo, desative "links seguros" para este remetente ou abra no celular.',
      };
    }
    cleanAuthParamsFromUrl();
    return { ok: true };
  }

  if (code) {
    // Primeiro deixa o cliente processar a URL (detectSessionInUrl), sem trocar o code duas vezes.
    const autoSession = await waitForAuthSession(3000);
    if (autoSession) {
      cleanAuthParamsFromUrl();
      return { ok: true };
    }

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      cleanAuthParamsFromUrl();
      return { ok: true };
    }

    const lower = error.message.toLowerCase();
    const missingVerifier =
      lower.includes('code verifier') || lower.includes('non-empty');
    const expired =
      lower.includes('expired') ||
      lower.includes('invalid') ||
      lower.includes('already been used');

    return {
      ok: false,
      message: expired
        ? 'Este link já foi usado ou expirou (às vezes o app de e-mail abre o link antes de você).'
        : missingVerifier
          ? 'Abra o link no mesmo navegador em que clicou em "Esqueci minha senha".'
          : error.message,
      hint:
        'Solicite um novo e-mail. No Supabase, use o template em supabase/email_templates/recovery_password.html (token no #, não só ?code=).',
    };
  }

  if (hasHashTokens) {
    const hasSession = await waitForAuthSession();
    if (hasSession) {
      cleanAuthParamsFromUrl();
      return { ok: true };
    }
    return {
      ok: false,
      message: 'Não foi possível validar o link de acesso.',
      hint: 'Solicite um novo e-mail e abra o link assim que chegar.',
    };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    cleanAuthParamsFromUrl();
    return { ok: true };
  }

  return {
    ok: false,
    message: 'Link inválido ou expirado.',
    hint: 'Na tela de login, use "Esqueci minha senha" e abra o novo link em até alguns minutos.',
  };
}

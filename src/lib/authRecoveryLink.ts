import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type AuthLinkResult =
  | { ok: true }
  | { ok: false; message: string; hint?: string };

export type PendingAuthLinkParams = {
  tokenHash: string | null;
  otpType: string | null;
  code: string | null;
  hasHashAccessTokens: boolean;
  hasRecoveryHashWithoutTokens: boolean;
};

function cleanAuthParamsFromUrl(): void {
  const path = window.location.pathname.replace(/\/+$/, '') || '/definir-senha';
  window.history.replaceState({}, '', path);
}

function getHashParams(): URLSearchParams {
  return new URLSearchParams(window.location.hash.replace(/^#/, ''));
}

/** Lê parâmetros de auth na query e no hash (#). */
export function readPendingAuthLinkParams(): PendingAuthLinkParams {
  const search = new URLSearchParams(window.location.search);
  const hash = getHashParams();

  const tokenHash = search.get('token_hash') ?? hash.get('token_hash');
  const otpType = search.get('type') ?? hash.get('type');
  const code = search.get('code') ?? hash.get('code');

  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  const hasHashAccessTokens = !!(accessToken && refreshToken);

  const hasRecoveryHashWithoutTokens =
    !!window.location.hash &&
    !hasHashAccessTokens &&
    !tokenHash &&
    !code &&
    (hash.get('type') === 'recovery' || hash.get('type') === 'invite');

  return {
    tokenHash,
    otpType,
    code,
    hasHashAccessTokens,
    hasRecoveryHashWithoutTokens,
  };
}

export function hasPendingAuthLinkParams(): boolean {
  const p = readPendingAuthLinkParams();
  return (
    !!(p.tokenHash && (p.otpType === 'recovery' || p.otpType === 'invite')) ||
    !!p.code ||
    p.hasHashAccessTokens ||
    p.hasRecoveryHashWithoutTokens
  );
}

function readUrlAuthError(): string | null {
  const search = new URLSearchParams(window.location.search);
  const hash = getHashParams();
  const error =
    search.get('error_description') ??
    search.get('error') ??
    hash.get('error_description') ??
    hash.get('error');
  return error ? decodeURIComponent(error.replace(/\+/g, ' ')) : null;
}

async function setSessionFromHashTokens(): Promise<AuthLinkResult> {
  const hash = getHashParams();
  const access_token = hash.get('access_token');
  const refresh_token = hash.get('refresh_token');

  if (!access_token || !refresh_token) {
    return {
      ok: false,
      message: 'Link incompleto ou já utilizado.',
      hint: 'Solicite um novo e-mail em "Esqueci minha senha" e abra o link assim que chegar.',
    };
  }

  const { error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  if (error) {
    return {
      ok: false,
      message: error.message,
      hint: 'Peça um novo e-mail de recuperação. Links expiram em poucos minutos.',
    };
  }

  cleanAuthParamsFromUrl();
  return { ok: true };
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

  const { tokenHash, otpType, code, hasHashAccessTokens, hasRecoveryHashWithoutTokens } =
    readPendingAuthLinkParams();

  if (tokenHash && (otpType === 'recovery' || otpType === 'invite')) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as EmailOtpType,
    });
    if (error) {
      return {
        ok: false,
        message: error.message,
        hint: 'Peça um novo e-mail em "Esqueci minha senha". Se usa Outlook corporativo, abra o link no navegador (não só no painel do e-mail).',
      };
    }
    cleanAuthParamsFromUrl();
    return { ok: true };
  }

  if (hasHashAccessTokens) {
    return setSessionFromHashTokens();
  }

  if (code) {
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
          ? 'Abra o link no mesmo navegador em que clicou em "Esqueci minha senha", ou atualize o template de e-mail no Supabase (recovery_password.html).'
          : error.message,
      hint: 'Solicite um novo e-mail após salvar o template recovery_password.html no painel do Supabase.',
    };
  }

  if (hasRecoveryHashWithoutTokens) {
    return {
      ok: false,
      message: 'Este link já foi consumido antes de você confirmar.',
      hint: 'Peça um novo e-mail. No Supabase, use o template supabase/email_templates/recovery_password.html.',
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

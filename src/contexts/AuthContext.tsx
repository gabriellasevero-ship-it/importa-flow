import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';
import { getProfile, ensureProfile } from '@/services/profile';
import { getConfiguredSupabaseHost, isSupabaseConfigured } from '@/lib/supabase';
import {
  createRepresentative,
  fetchRepresentativeByUserId,
  linkRepresentanteByEmailIfUnlinked,
} from '@/services/representantes';

export const PENDING_REP_SELF_REGISTER = 'importaflow_pending_rep_self_register';

export type PendingRepSelfRegister = {
  mode: 'self_register';
  name: string;
  email?: string;
  phone?: string;
};

type AuthSessionUser = { id: string; email?: string | null };

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  /** Login sem senha: envia link mágico por e-mail (`shouldCreateUser` conforme modo). */
  signInWithMagicLink: (
    email: string,
    mode: 'login' | 'register',
    registerExtra?: { name: string; phone?: string }
  ) => Promise<void>;
  signInWithOAuthProvider: (
    provider: 'google' | 'facebook' | 'apple',
    pending?: PendingRepSelfRegister | null
  ) => Promise<void>;
  registerRepresentative: (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

/** Traduz mensagens comuns do Supabase Auth para o usuário */
function normalizeAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('esgotado ao entrar')) {
    return (
      'O login passou do tempo limite sem resposta do Supabase. Tente de novo; se repetir, confira no painel do Supabase se o projeto está ativo (não pausado), teste outra rede ou 4G e, na hospedagem (ex.: Vercel), se VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY existiam no momento do build — alterar variáveis exige um novo deploy.'
    );
  }

  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return 'E-mail ou senha incorretos. Tente novamente.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  }
  if (lower.includes('signups not allowed') || lower.includes('signup_disabled')) {
    return 'Novos cadastros por este método estão desativados no projeto Supabase.';
  }
  if (lower.includes('redirect') && lower.includes('url')) {
    return (
      'URL de retorno não permitida. No Supabase (Authentication → URL Configuration), adicione a URL exata do site em Redirect URLs.'
    );
  }
  if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('load failed') ||
    lower.includes('tempo de conexão') ||
    lower.includes('timeout')
  ) {
    const isSafari =
      typeof navigator !== 'undefined' &&
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isSafari) {
      return 'Não foi possível conectar ao Supabase pelo Safari. Desative bloqueadores/Private Relay para este site, teste em uma janela normal e tente novamente.';
    }

    return (
      'Não foi possível alcançar o Supabase (rede ou bloqueio no navegador). Confira sua internet e extensões; no painel da hospedagem confirme VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no build e faça redeploy se tiver alterado as variáveis. No Supabase (Authentication → URL Configuration), inclua a URL exata do site em Redirect URLs.'
    );
  }
  return message;
}

/** Evita spinner infinito se a API do Supabase não responder (rede, URL errada no deploy, etc.) */
const LOGIN_TIMEOUT_MS = 22000;
const PROFILE_TIMEOUT_MS = 8000;

function rejectAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

async function completePendingRepresentativeSignupIfNeeded(
  userId: string,
  sessionEmail: string
): Promise<void> {
  if (typeof window === 'undefined') return;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PENDING_REP_SELF_REGISTER);
  } catch {
    return;
  }
  if (!raw) return;

  let pending: PendingRepSelfRegister;
  try {
    pending = JSON.parse(raw) as PendingRepSelfRegister;
  } catch {
    try {
      localStorage.removeItem(PENDING_REP_SELF_REGISTER);
    } catch {
      /* ignore */
    }
    return;
  }

  if (pending.mode !== 'self_register' || !pending.name?.trim()) {
    return;
  }

  const sessionNorm = sessionEmail.trim().toLowerCase();
  const pendingEmail = (pending.email ?? '').trim().toLowerCase();
  if (pendingEmail && pendingEmail !== sessionNorm) {
    return;
  }

  const email = sessionNorm || pendingEmail;
  if (!email) return;

  const existing = await fetchRepresentativeByUserId(userId);
  if (existing) {
    try {
      localStorage.removeItem(PENDING_REP_SELF_REGISTER);
    } catch {
      /* ignore */
    }
    return;
  }

  await ensureProfile(userId, pending.name.trim(), email);
  await createRepresentative({
    userId,
    name: pending.name.trim(),
    email,
    phone: pending.phone?.trim() ?? '',
  });

  try {
    localStorage.removeItem(PENDING_REP_SELF_REGISTER);
  } catch {
    /* ignore */
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (authUser: AuthSessionUser) => {
    const userId = authUser.id;
    const sessionEmail = authUser.email ?? '';

    const profile = await Promise.race([
      getProfile(userId),
      rejectAfter(
        PROFILE_TIMEOUT_MS,
        'Perfil demorou para responder. Verifique no Supabase (Table Editor → profiles) se existe uma linha com o id do seu usuário.'
      ),
    ]);

    if (!profile) {
      throw new Error(
        'Perfil não encontrado. Verifique se seu usuário existe na tabela profiles do Supabase.'
      );
    }

    if (profile.role === 'representante' && profile.email) {
      await linkRepresentanteByEmailIfUnlinked(userId, profile.email);
    }

    await completePendingRepresentativeSignupIfNeeded(userId, sessionEmail);

    const finalProfile = await getProfile(userId);
    if (!finalProfile) {
      throw new Error(
        'Perfil não encontrado. Verifique se seu usuário existe na tabela profiles do Supabase.'
      );
    }
    setUser(finalProfile);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        return;
      }
      window.setTimeout(() => {
        void (async () => {
          try {
            if (session?.user) {
              await loadUser(session.user);
            } else if (event === 'SIGNED_OUT') {
              setUser(null);
            }
          } catch (err) {
            console.error('Erro ao sincronizar sessão:', err);
          }
        })();
      }, 0);
    });
    const stopLoading = () => setLoading(false);
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          loadUser(session.user).finally(stopLoading);
        } else {
          stopLoading();
        }
      })
      .catch((err) => {
        console.error('Erro ao obter sessão:', err);
        stopLoading();
      });
    const timeout = window.setTimeout(stopLoading, 10000);
    return () => {
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [loadUser]);

  const login = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      setUser({
        id: 'demo',
        name: 'Admin Demo',
        email: email || 'admin@demo.local',
        role: 'admin',
      });
      return;
    }
    let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data'];
    let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['error'];
    try {
      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        rejectAfter(LOGIN_TIMEOUT_MS, 'Tempo de conexão esgotado ao entrar.'),
      ]);
      data = result.data;
      error = result.error;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao conectar ao servidor de autenticação.';
      console.error('Erro de conexão no login Supabase:', e, {
        supabaseHost: getConfiguredSupabaseHost(),
        production: import.meta.env.PROD,
      });
      throw new Error(normalizeAuthError(msg));
    }
    if (error) {
      throw new Error(normalizeAuthError(error.message));
    }
    if (!data.user) return;

    const profileTimeout = rejectAfter(
      PROFILE_TIMEOUT_MS,
      'Perfil demorou para responder. Verifique no Supabase (Table Editor → profiles) se existe uma linha com o id do seu usuário.'
    );

    try {
      await Promise.race([loadUser(data.user), profileTimeout]);
    } catch (profileErr) {
      await supabase.auth.signOut();
      const msg =
        profileErr instanceof Error
          ? profileErr.message
          : 'Não foi possível carregar seu perfil.';
      throw new Error(
        msg.includes('Perfil não encontrado') || msg.includes('demorou')
          ? msg
          : 'Seu usuário não possui perfil no sistema. Entre em contato com o administrador ou confira a documentação em docs/DEBUG_PROFILES.md.'
      );
    }
  };

  const signInWithMagicLink = async (
    email: string,
    mode: 'login' | 'register',
    registerExtra?: { name: string; phone?: string }
  ) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Login com link só está disponível quando o Supabase estiver configurado.');
    }
    const trimmed = email.trim();
    if (!trimmed) {
      throw new Error('Informe um e-mail válido.');
    }
    if (mode === 'register') {
      if (!registerExtra?.name?.trim()) {
        throw new Error('Informe seu nome para concluir o cadastro.');
      }
      try {
        const payload: PendingRepSelfRegister = {
          mode: 'self_register',
          name: registerExtra.name.trim(),
          email: trimmed,
          phone: registerExtra.phone?.trim(),
        };
        localStorage.setItem(PENDING_REP_SELF_REGISTER, JSON.stringify(payload));
      } catch {
        throw new Error('Não foi possível salvar os dados do cadastro. Verifique o armazenamento do navegador.');
      }
    } else {
      try {
        localStorage.removeItem(PENDING_REP_SELF_REGISTER);
      } catch {
        /* ignore */
      }
    }

    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        shouldCreateUser: mode === 'register',
        emailRedirectTo: redirectTo,
      },
    });
    if (error) {
      if (mode === 'register') {
        try {
          localStorage.removeItem(PENDING_REP_SELF_REGISTER);
        } catch {
          /* ignore */
        }
      }
      throw new Error(normalizeAuthError(error.message));
    }
  };

  const signInWithOAuthProvider = async (
    provider: 'google' | 'facebook' | 'apple',
    pending?: PendingRepSelfRegister | null
  ) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Login social só está disponível quando o Supabase estiver configurado.');
    }
    try {
      if (pending) {
        localStorage.setItem(PENDING_REP_SELF_REGISTER, JSON.stringify(pending));
      } else {
        localStorage.removeItem(PENDING_REP_SELF_REGISTER);
      }
    } catch {
      throw new Error('Não foi possível preparar o cadastro. Verifique o armazenamento do navegador.');
    }

    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectTo ?? undefined,
        skipBrowserRedirect: false,
      },
    });
    if (error) {
      try {
        localStorage.removeItem(PENDING_REP_SELF_REGISTER);
      } catch {
        /* ignore */
      }
      throw new Error(normalizeAuthError(error.message));
    }
  };

  const REGISTER_FULL_TIMEOUT_MS = 22000;

  const registerRepresentative = async (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Cadastro de representante só está disponível quando o Supabase estiver configurado.'
      );
    }

    const run = async () => {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
      });
      if (error) throw error;
      if (!data.user) return;

      if (!data.session) {
        throw new Error(
          'Cadastro criado. Confirme seu e-mail pelo link enviado e depois faça login.'
        );
      }

      await ensureProfile(data.user.id, input.name, input.email);

      await createRepresentative({
        userId: data.user.id,
        name: input.name,
        email: input.email,
        phone: input.phone ?? '',
      });
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              'A requisição demorou muito. Verifique sua conexão, tente de novo ou use outro e-mail. Se a conta foi criada, tente fazer login.'
            )
          ),
        REGISTER_FULL_TIMEOUT_MS
      );
    });

    await Promise.race([run(), timeoutPromise]);
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Recuperação de senha só está disponível quando o Supabase estiver configurado.'
      );
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  };

  const logout = async () => {
    if (!isSupabaseConfigured()) {
      setUser(null);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signInWithMagicLink,
        signInWithOAuthProvider,
        registerRepresentative,
        resetPassword,
        logout,
        isAuthenticated: !!user,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';
import { getProfile } from '@/services/profile';
import { isSupabaseConfigured } from '@/lib/supabase';
import { createRepresentative } from '@/services/representantes';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
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

  const loadUser = useCallback(async (authUserId: string) => {
    const profile = await getProfile(authUserId);
    setUser(profile);
    if (!profile) {
      throw new Error('Perfil não encontrado. Verifique se seu usuário existe na tabela profiles do Supabase.');
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await loadUser(session.user.id);
      } else {
        setUser(null);
      }
    });
    const stopLoading = () => setLoading(false);
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          loadUser(session.user.id).finally(stopLoading);
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

  const LOGIN_TIMEOUT_MS = 15000;
  const PROFILE_TIMEOUT_MS = 8000;

  const login = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      setUser({
        id: 'demo',
        name: 'Usuário Demo',
        email,
        role: 'representante',
      });
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) return;

    const profileTimeout = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              'Perfil demorou para responder. Verifique no Supabase (Table Editor → profiles) se existe uma linha com o id do seu usuário.'
            )
          ),
        PROFILE_TIMEOUT_MS
      );
    });
    await Promise.race([loadUser(data.user.id), profileTimeout]);
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

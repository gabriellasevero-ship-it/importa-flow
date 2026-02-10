import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';
import { getProfile } from '@/services/profile';
import { isSupabaseConfigured } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
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
    try {
      const profile = await getProfile(authUserId);
      setUser(profile);
    } catch (e) {
      console.error('Erro ao carregar perfil:', e);
      setUser(null);
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
    if (data.user) await loadUser(data.user.id);
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
        logout,
        isAuthenticated: !!user,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

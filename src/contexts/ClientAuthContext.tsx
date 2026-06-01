import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Cliente } from '@/types';
import { isSupabaseConfigured } from '@/lib/supabase';
import { CATALOG_PATH_UUID_RE } from '@/lib/catalogPublicPath';
import { loginClienteCatalogo, registerClienteViaCatalogo } from '@/services/clientes';
import { onlyDigits } from '@/lib/cnpj';

interface ClientAuthContextType {
  client: Cliente | null;
  register: (data: ClientRegisterData, representanteId?: string) => Promise<{ isNew: boolean }>;
  login: (email: string, cnpj: string, representanteId?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

interface ClientRegisterData {
  name: string;
  businessName?: string;
  email: string;
  phone: string;
  cnpj?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export const useClientAuth = () => {
  const context = useContext(ClientAuthContext);
  if (!context) {
    throw new Error('useClientAuth must be used within ClientAuthProvider');
  }
  return context;
};

interface ClientAuthProviderProps {
  children: ReactNode;
  onClientRegistered?: (client: Cliente) => void;
}

export const ClientAuthProvider: React.FC<ClientAuthProviderProps> = ({ children, onClientRegistered }) => {
  const [client, setClient] = useState<Cliente | null>(() => {
    // Recuperar cliente do localStorage se existir
    const saved = localStorage.getItem('clientAuth');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const register = async (data: ClientRegisterData, representanteId = 'rep-1'): Promise<{ isNew: boolean }> => {
    if (isSupabaseConfigured() && CATALOG_PATH_UUID_RE.test(representanteId)) {
      try {
        const { cliente: saved, isNew } = await registerClienteViaCatalogo(representanteId, {
          name: data.name,
          phone: data.phone,
          email: data.email,
          businessName: data.businessName,
          cnpj: data.cnpj,
          cep: data.cep,
          street: data.street,
          number: data.number,
          complement: data.complement,
          neighborhood: data.neighborhood,
          city: data.city,
          state: data.state,
        });
        setClient(saved);
        localStorage.setItem('clientAuth', JSON.stringify(saved));
        onClientRegistered?.(saved);
        return { isNew };
      } catch (e: unknown) {
        const err = e as { message?: string; details?: string; hint?: string; code?: string };
        const msg = [err.message, err.details].filter(Boolean).join(' ');
        if (msg.includes('representante_invalid_or_unlinked')) {
          throw new Error(
            'Link do catálogo inválido ou representante sem conta vinculada (user_id em representantes). Gere um novo link no catálogo logado como representante ou peça ao admin para vincular seu usuário.'
          );
        }
        if (msg.includes('name_and_phone_required')) {
          throw new Error('Nome e telefone são obrigatórios.');
        }
        if (err.code === 'PGRST202' || msg.includes('Could not find the function')) {
          throw new Error(
            'Função register_cliente_catalogo não encontrada no PostgREST. Rode as migrations do catálogo (010+) no Supabase (SQL Editor) e aguarde ~1 minuto.'
          );
        }
        if (err.message || err.details) {
          throw new Error(err.details || err.message || 'Não foi possível concluir o cadastro.');
        }
        throw e instanceof Error ? e : new Error('Não foi possível concluir o cadastro.');
      }
    }

    await new Promise(resolve => setTimeout(resolve, 300));

    const newClient: Cliente = {
      id: `client-${Date.now()}`,
      representanteId,
      name: data.name,
      businessName: data.businessName,
      email: data.email,
      phone: data.phone,
      cnpj: data.cnpj,
      cep: data.cep,
      street: data.street,
      number: data.number,
      complement: data.complement,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
      createdAt: new Date(),
    };

    setClient(newClient);
    localStorage.setItem('clientAuth', JSON.stringify(newClient));
    onClientRegistered?.(newClient);
    return { isNew: true };
  };

  const login = async (email: string, cnpj: string, representanteId = 'rep-1') => {
    if (isSupabaseConfigured() && CATALOG_PATH_UUID_RE.test(representanteId)) {
      try {
        const found = await loginClienteCatalogo(representanteId, email, cnpj);
        setClient(found);
        localStorage.setItem('clientAuth', JSON.stringify(found));
        return;
      } catch (e: unknown) {
        const err = e as { message?: string; details?: string; hint?: string; code?: string };
        const msg = [err.message, err.details, err.hint].filter(Boolean).join(' ');
        if (msg.includes('representante_invalid_or_unlinked')) {
          throw new Error(
            'Link do catálogo inválido ou representante sem conta vinculada (user_id em representantes). Gere um novo link no catálogo logado como representante ou peça ao admin para vincular seu usuário.'
          );
        }
        if (msg.includes('email_and_cnpj_required')) {
          throw new Error('Informe e-mail e CNPJ válidos (14 dígitos) para entrar.');
        }
        if (msg.includes('cliente_not_found')) {
          throw new Error(
            'Não encontramos cadastro com este e-mail e CNPJ para esta representante. Verifique os dados ou cadastre-se.'
          );
        }
        if (err.code === 'PGRST202' || msg.includes('Could not find the function')) {
          throw new Error(
            'Função login_cliente_catalogo desatualizada no PostgREST. Rode a migration 015 no Supabase (SQL Editor) e aguarde ~1 minuto.'
          );
        }
        if (err.message || err.details) {
          throw new Error(err.details || err.message || 'Não foi possível entrar.');
        }
        throw e instanceof Error ? e : new Error('Não foi possível entrar.');
      }
    }

    await new Promise(resolve => setTimeout(resolve, 300));

    const saved = localStorage.getItem('clientAuth');
    if (saved) {
      const savedClient = JSON.parse(saved) as Cliente & { email?: string; cnpj?: string };
      const emailTrim = email.trim();
      const cnpjDigits = onlyDigits(cnpj);
      const matchEmail =
        emailTrim.length > 0 &&
        savedClient.email &&
        savedClient.email.toLowerCase() === emailTrim.toLowerCase();
      const matchCnpj =
        cnpjDigits.length >= 14 &&
        onlyDigits(savedClient.cnpj ?? '').slice(0, 14) === cnpjDigits.slice(0, 14);
      if (matchEmail && matchCnpj) {
        setClient(savedClient as Cliente);
        return;
      }
    }

    throw new Error('Cliente não encontrado. Verifique e-mail e CNPJ ou faça o cadastro.');
  };

  const logout = () => {
    setClient(null);
    localStorage.removeItem('clientAuth');
  };

  return (
    <ClientAuthContext.Provider
      value={{
        client,
        register,
        login,
        logout,
        isAuthenticated: !!client,
      }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
};

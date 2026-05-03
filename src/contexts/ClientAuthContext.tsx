import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Cliente } from '@/types';
import { isSupabaseConfigured } from '@/lib/supabase';
import { CATALOG_PATH_UUID_RE } from '@/lib/catalogPublicPath';
import { registerClienteViaCatalogo } from '@/services/clientes';

interface ClientAuthContextType {
  client: Cliente | null;
  register: (data: ClientRegisterData, representanteId?: string) => Promise<void>;
  login: (email: string, phone: string) => Promise<void>;
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

  const register = async (data: ClientRegisterData, representanteId = 'rep-1') => {
    if (isSupabaseConfigured() && CATALOG_PATH_UUID_RE.test(representanteId)) {
      try {
        const saved = await registerClienteViaCatalogo(representanteId, {
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
        return;
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
            'Função register_cliente_catalogo não encontrada no PostgREST. Rode o SQL da migration 010 no Supabase (SQL Editor) e aguarde ~1 minuto.'
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
  };

  const login = async (email: string, phone: string) => {
    // Simulação de login - em produção, faria busca no backend
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Por enquanto, apenas valida se os dados estão corretos
    // Em produção, faria uma chamada ao backend
    const saved = localStorage.getItem('clientAuth');
    if (saved) {
      const savedClient = JSON.parse(saved);
      if (savedClient.email === email || savedClient.phone === phone) {
        setClient(savedClient);
        return;
      }
    }
    
    throw new Error('Cliente não encontrado. Por favor, faça o cadastro primeiro.');
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

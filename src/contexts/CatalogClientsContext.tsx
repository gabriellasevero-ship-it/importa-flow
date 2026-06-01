import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Cliente } from '@/types';

interface CatalogClientsContextType {
  catalogClients: Cliente[];
  addCliente: (client: Cliente) => void;
}

const CatalogClientsContext = createContext<CatalogClientsContextType | undefined>(undefined);

export const useCatalogClients = () => {
  const context = useContext(CatalogClientsContext);
  if (!context) {
    throw new Error('useCatalogClients must be used within CatalogClientsProvider');
  }
  return context;
};

interface CatalogClientsProviderProps {
  children: ReactNode;
}

export const CatalogClientsProvider: React.FC<CatalogClientsProviderProps> = ({ children }) => {
  const [catalogClients, setCatalogClients] = useState<Cliente[]>([]);

  const addCliente = (client: Cliente) => {
    setCatalogClients(prev => {
      if (prev.some(c => c.id === client.id)) return prev;
      return [...prev, client];
    });
  };

  return (
    <CatalogClientsContext.Provider value={{ catalogClients, addCliente }}>
      {children}
    </CatalogClientsContext.Provider>
  );
};

import React from 'react';
import { Package } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-xl mb-4 animate-pulse">
          <Package className="w-10 h-10 text-primary-foreground" />
        </div>
        <h2 className="mb-2" style={{ color: '#1B5B6B' }}>Importa Flow</h2>
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
};

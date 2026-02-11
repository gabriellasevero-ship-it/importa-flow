import React, { useState } from 'react';
import { Toaster } from '@/app/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useData';
import { ClientAuthProvider } from '@/contexts/ClientAuthContext';
import { CatalogClientsProvider, useCatalogClients } from '@/contexts/CatalogClientsContext';
import { OrdersProvider } from '@/contexts/OrdersContext';
import { CartProvider } from '@/contexts/CartContext';
import { Login } from '@/app/components/Login';
import { Header } from '@/app/components/Header';
import { BottomNav } from '@/app/components/BottomNav';
import { Dashboard } from '@/app/components/Dashboard';
import { Catalog } from '@/app/components/Catalog';
import { ProductDetail } from '@/app/components/ProductDetail';
import { Clients } from '@/app/components/Clients';
import { Orders } from '@/app/components/Orders';
import { Commissions } from '@/app/components/Commissions';
import { ClientOrderView } from '@/app/components/ClientOrderView';
import { ClientCatalogView } from '@/app/components/ClientCatalogView';
import { Notifications } from '@/app/components/Notifications';
import { Importers } from '@/app/components/Importers';
import { Representatives } from '@/app/components/Representatives';
import { Transportadoras } from '@/app/components/Transportadoras';
import { Product } from '@/types';
import { Sidebar } from '@/app/components/Sidebar';

function ClientCatalogEntry({ linkId, representanteId }: { linkId: string; representanteId: string }) {
  const { addCliente } = useCatalogClients();
  return (
    <ClientAuthProvider onClientRegistered={addCliente}>
      <ClientCatalogView linkId={linkId} representanteId={representanteId} />
      <Toaster position="top-center" />
    </ClientAuthProvider>
  );
}

const VIEW_MODE_KEY = 'importaflow_view_mode';

function AppContent() {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const { unreadCount } = useNotifications();
  const [activeTab, setActiveTab] = useState('home');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [viewMode, setViewMode] = useState<'admin' | 'representante'>(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      return saved === 'representante' || saved === 'admin' ? saved : 'admin';
    } catch {
      return 'admin';
    }
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'backoffice';
  const displayAsAdmin = isAdmin && viewMode === 'admin';

  const handleViewModeChange = (mode: 'admin' | 'representante') => {
    setViewMode(mode);
    setActiveTab('home');
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  // Check if accessing via client catalog link
  const isClientCatalogView = window.location.pathname.startsWith('/catalogo/');
  const catalogLinkId = isClientCatalogView ? window.location.pathname.split('/catalogo/')[1] : null;

  // Check if accessing via client order link
  const isClientOrderView = window.location.pathname.startsWith('/pedido/');
  const orderLinkId = isClientOrderView ? window.location.pathname.split('/pedido/')[1] : null;

  if (isClientCatalogView && catalogLinkId) {
    return <ClientCatalogEntry linkId={catalogLinkId} representanteId="rep-1" />;
  }

  if (isClientOrderView && orderLinkId) {
    return (
      <>
        <ClientOrderView linkId={orderLinkId} />
        <Toaster position="top-center" />
      </>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Login />;
  }

  const renderContent = () => {
    if (displayAsAdmin) {
      switch (activeTab) {
        case 'home':
          return <Dashboard onNavigate={setActiveTab} mode="admin" />;
        case 'importers':
          return <Importers />;
        case 'representatives':
          return <Representatives />;
        default:
          return <Dashboard onNavigate={setActiveTab} mode="admin" />;
      }
    }

    switch (activeTab) {
      case 'home':
        return <Dashboard onNavigate={setActiveTab} mode="representante" />;
      case 'catalog':
        return <Catalog onProductSelect={setSelectedProduct} />;
      case 'clients':
        return <Clients />;
      case 'orders':
        return <Orders />;
      case 'commissions':
        return <Commissions />;
      case 'transportadoras':
        return <Transportadoras />;
      default:
        return <Dashboard onNavigate={setActiveTab} mode="representante" />;
    }
  };

  const getPageTitle = () => {
    if (displayAsAdmin) {
      switch (activeTab) {
        case 'home':
          return 'Dashboard';
        case 'importers':
          return 'Importadoras';
        case 'representatives':
          return 'Representantes';
        default:
          return 'Dashboard';
      }
    }
    switch (activeTab) {
      case 'home':
        return 'Dashboard';
      case 'catalog':
        return 'Catálogo';
      case 'clients':
        return 'Clientes';
      case 'orders':
        return 'Pedidos';
      case 'commissions':
        return 'Comissões';
      case 'transportadoras':
        return 'Transportadoras';
      default:
        return 'Dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        title={getPageTitle()}
        onNotificationsClick={() => setShowNotifications(true)}
        unreadNotifications={unreadCount}
        showNotificationsButton={!displayAsAdmin}
        viewMode={isAdmin ? viewMode : undefined}
        onViewModeChange={isAdmin ? handleViewModeChange : undefined}
      />

      <div className="flex">
        {user && (
          <Sidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            userRole={displayAsAdmin ? 'admin' : 'representante'}
          />
        )}

        <main className="flex-1 max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-6 w-full">
          {renderContent()}
        </main>
      </div>

      {user && (
        <BottomNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          userRole={displayAsAdmin ? 'admin' : 'representante'}
        />
      )}

      <ProductDetail
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      <Notifications
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      <Toaster position="top-center" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <OrdersProvider>
        <CatalogClientsProvider>
          <CartProvider>
            <AppContent />
          </CartProvider>
        </CatalogClientsProvider>
      </OrdersProvider>
    </AuthProvider>
  );
}
import React from 'react';
import { Home, Package, ShoppingCart, Users, FileText, TrendingUp, Settings, Building2, Truck } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { useCart } from '@/contexts/CartContext';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userRole: 'representante' | 'admin';
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, userRole }) => {
  const { getItemCount } = useCart();
  const cartCount = getItemCount();

  const representanteItems = [
    { id: 'home', icon: Home, label: 'Início' },
    { id: 'catalog', icon: Package, label: 'Catálogo' },
    { id: 'clients', icon: Users, label: 'Clientes' },
    { id: 'orders', icon: FileText, label: 'Pedidos' },
    { id: 'transportadoras', icon: Truck, label: 'Transportadoras' },
  ];

  const menuItems = [
    { id: 'home', icon: Home, label: 'Dashboard' },
    { id: 'importers', icon: Building2, label: 'Importadoras' },
    { id: 'representatives', icon: Users, label: 'Representantes' },
  ];

  const items = userRole === 'admin' ? menuItems : representanteItems;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border shadow-lg z-50">
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <Button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              variant="ghost"
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-none relative ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.badge && item.badge > 0 && (
                  <Badge className="absolute -top-2 -right-3 h-5 w-5 p-0 flex items-center justify-center text-xs bg-secondary">
                    {item.badge}
                  </Badge>
                )}
              </div>
              <span className="text-xs">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
};
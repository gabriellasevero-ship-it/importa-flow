import React, { useState } from 'react';
import { Home, Package, ShoppingCart, Users, TrendingUp, Settings, Building2, ChevronLeft, ChevronRight, FileText, Truck } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { useCart } from '@/contexts/CartContext';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userRole: 'representante' | 'admin';
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, userRole }) => {
  const { getItemCount } = useCart();
  const cartCount = getItemCount();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const representanteItems = [
    { id: 'home', icon: Home, label: 'Dashboard' },
    { id: 'catalog', icon: Package, label: 'Catálogo' },
    { id: 'clients', icon: Users, label: 'Clientes' },
    { id: 'orders', icon: FileText, label: 'Pedidos' },
    { id: 'commissions', icon: TrendingUp, label: 'Comissões' },
    { id: 'transportadoras', icon: Truck, label: 'Transportadoras' },
  ];

  const adminItems = [
    { id: 'home', icon: Home, label: 'Dashboard' },
    { id: 'importers', icon: Building2, label: 'Importadoras' },
    { id: 'representatives', icon: Users, label: 'Representantes' },
    { id: 'settings', icon: Settings, label: 'Configurações' },
  ];

  const items = userRole === 'admin' ? adminItems : representanteItems;

  const isExpanded = !isCollapsed;

  return (
    <aside
      className={`hidden md:flex flex-col ${isExpanded ? 'w-64' : 'w-16'} bg-primary text-primary-foreground h-[calc(100vh-73px)] sticky top-[73px] border-r border-primary-foreground/10 transition-all duration-300`}
      onMouseEnter={() => setIsCollapsed(false)}
      onMouseLeave={() => setIsCollapsed(true)}
    >
      <nav className="flex-1 p-2 space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <Button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              variant="ghost"
              className={`w-full ${isExpanded ? 'justify-start gap-3' : 'justify-center px-0'} h-12 ${
                isActive
                  ? 'bg-white/10 text-white hover:bg-white/15'
                  : 'text-primary-foreground/80 hover:bg-white/5 hover:text-white'
              }`}
              title={isExpanded ? undefined : item.label}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {isExpanded && <span>{item.label}</span>}
              {isExpanded && item.badge && (
                <Badge className="ml-auto bg-secondary text-secondary-foreground">
                  {item.badge}
                </Badge>
              )}
            </Button>
          );
        })}
      </nav>
      
      <div className="p-2 border-t border-primary-foreground/10">
        <Button
          onClick={() => setIsCollapsed(!isCollapsed)}
          variant="ghost"
          className={`w-full ${isExpanded ? 'justify-start gap-3' : 'justify-center px-0'} h-10 text-primary-foreground/80 hover:bg-white/5 hover:text-white`}
        >
          {isExpanded ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Minimizar</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
};
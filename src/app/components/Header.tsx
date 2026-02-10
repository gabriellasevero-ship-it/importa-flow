import React from 'react';
import { Package, LogOut, User, Bell } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  title?: string;
  onNotificationsClick?: () => void;
  unreadNotifications?: number;
}

export const Header: React.FC<HeaderProps> = ({ title, onNotificationsClick, unreadNotifications = 0 }) => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-primary text-primary-foreground shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-white/10 rounded-lg">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl">Importa Flow</h1>
              {title && <p className="text-sm text-primary-foreground/80">{title}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user && user.role === 'representante' && onNotificationsClick && (
              <Button
                onClick={onNotificationsClick}
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:bg-white/10 relative"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifications > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-secondary">
                    {unreadNotifications}
                  </Badge>
                )}
              </Button>
            )}
            {user && (
              <>
                <div className="hidden md:flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg">
                  <User className="w-4 h-4" />
                  <span className="text-sm">{user.name}</span>
                </div>
                <Button
                  onClick={logout}
                  variant="ghost"
                  size="sm"
                  className="text-primary-foreground hover:bg-white/10"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  <span className="hidden md:inline">Sair</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
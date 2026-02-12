import React from 'react';
import { Package, LogOut, User, Bell, LayoutDashboard, UserCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  title?: string;
  onNotificationsClick?: () => void;
  unreadNotifications?: number;
  showNotificationsButton?: boolean;
  viewMode?: 'admin' | 'representante';
  onViewModeChange?: (mode: 'admin' | 'representante') => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onNotificationsClick,
  unreadNotifications = 0,
  showNotificationsButton = false,
  viewMode,
  onViewModeChange,
}) => {
  const { user, logout } = useAuth();

  const profileSelector = viewMode !== undefined && onViewModeChange && (
    <div className="flex rounded-lg overflow-hidden border border-white/20 bg-white/5">
      <Button
        onClick={() => onViewModeChange('representante')}
        variant="ghost"
        size="sm"
        className={`flex-1 min-w-0 rounded-none text-primary-foreground hover:bg-white/10 ${
          viewMode === 'representante' ? 'bg-white/15' : ''
        }`}
        title="Ambiente do representante"
      >
        <UserCircle className="w-4 h-4 mr-1.5 hidden sm:inline" />
        <span className="text-sm">Representante</span>
      </Button>
      <Button
        onClick={() => onViewModeChange('admin')}
        variant="ghost"
        size="sm"
        className={`flex-1 min-w-0 rounded-none text-primary-foreground hover:bg-white/10 ${
          viewMode === 'admin' ? 'bg-white/15' : ''
        }`}
        title="Backoffice"
      >
        <LayoutDashboard className="w-4 h-4 mr-1.5 hidden sm:inline" />
        <span className="text-sm">Backoffice</span>
      </Button>
    </div>
  );

  return (
    <header className="bg-primary text-primary-foreground shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-col gap-3">
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
              {profileSelector && <div className="hidden md:block">{profileSelector}</div>}
              {user && showNotificationsButton && onNotificationsClick && (
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
                  <div className="hidden md:flex items-center gap-2 text-primary-foreground/70 px-2 py-1.5">
                    <User className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-normal">{user.name}</span>
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

          {profileSelector && (
            <div className="w-full md:hidden">{profileSelector}</div>
          )}
        </div>
      </div>
    </header>
  );
};
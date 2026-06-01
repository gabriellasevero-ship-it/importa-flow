import React from 'react';
import { Bell, Package, ShoppingBag, TrendingUp, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useData';
import { markNotificationRead } from '@/services/notifications';

interface Notification {
  id: string;
  type: 'catalog' | 'order' | 'sale';
  title: string;
  message: string;
  date: Date;
  read: boolean;
}

interface NotificationsProps {
  open: boolean;
  onClose: () => void;
}

export const Notifications: React.FC<NotificationsProps> = ({ open, onClose }) => {
  const { notifications: apiList, refetch } = useNotifications();
  const mockNotifications: Notification[] = apiList.map(n => ({
    id: n.id,
    type: 'order' as const,
    title: n.title,
    message: n.body ?? '',
    date: new Date(n.created_at),
    read: n.read,
  }));
  const unreadCount = mockNotifications.filter(n => !n.read).length;

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'catalog':
        return <Package className="w-5 h-5 text-primary" />;
      case 'order':
        return <ShoppingBag className="w-5 h-5 text-yellow-600" />;
      case 'sale':
        return <TrendingUp className="w-5 h-5 text-secondary" />;
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} min atrás`;
    } else if (diffHours < 24) {
      return `${diffHours}h atrás`;
    } else if (diffDays === 1) {
      return 'Ontem';
    } else {
      return `${diffDays} dias atrás`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              <span>Notificações</span>
              {unreadCount > 0 && (
                <Badge className="bg-secondary">{unreadCount}</Badge>
              )}
            </div>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Você tem {unreadCount} notificações não lidas.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {mockNotifications.map(notification => (
              <Card
                key={notification.id}
                className={`cursor-pointer transition-colors ${
                  !notification.read ? 'bg-primary/5 border-primary/20' : ''
                }`}
                onClick={() => {
                  if (!notification.read) {
                    markNotificationRead(notification.id).then(() => refetch());
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-medium">{notification.title}</h4>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-secondary flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(notification.date)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        {mockNotifications.length === 0 && (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma notificação</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
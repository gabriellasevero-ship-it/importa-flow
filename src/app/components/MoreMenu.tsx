import React from 'react';
import { Button } from '@/app/components/ui/button';

interface MoreMenuItem {
  id: string;
  label: string;
}

interface MoreMenuProps {
  items: MoreMenuItem[];
  onSelect: (id: string) => void;
}

export const MoreMenu: React.FC<MoreMenuProps> = ({ items, onSelect }) => {
  return (
    <div className="px-4 py-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Mais opções</h2>
        <p className="text-sm text-muted-foreground">
          Escolha uma das opções abaixo para navegar.
        </p>
      </div>

      <div className="grid gap-3">
        {items.map((item) => (
          <Button
            key={item.id}
            variant="outline"
            className="justify-start"
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  );
};


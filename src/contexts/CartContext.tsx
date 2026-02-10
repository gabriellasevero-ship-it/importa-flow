import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CartItem, Product } from '@/types';

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity: number, observations?: string) => void;
  updateItem: (productId: string, quantity: number, observations?: string) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (product: Product, quantity: number, observations?: string) => {
    setItems(prevItems => {
      const existingItem = prevItems.find(item => item.productId === product.id);
      
      if (existingItem) {
        return prevItems.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity, observations }
            : item
        );
      }
      
      return [...prevItems, { productId: product.id, product, quantity, observations }];
    });
  };

  const updateItem = (productId: string, quantity: number, observations?: string) => {
    setItems(prevItems =>
      prevItems.map(item =>
        item.productId === productId
          ? { ...item, quantity, observations }
          : item
      )
    );
  };

  const removeItem = (productId: string) => {
    setItems(prevItems => prevItems.filter(item => item.productId !== productId));
  };

  const clearCart = () => {
    setItems([]);
  };

  const getTotal = () => {
    return items.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  };

  const getItemCount = () => {
    return items.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateItem,
        removeItem,
        clearCart,
        getTotal,
        getItemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

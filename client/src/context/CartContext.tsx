import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cartApi } from '@/services/api';
import type { Book, Cart } from '@/types';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const EMPTY_CART: Cart = { items: [], itemCount: 0, subtotal: 0 };

interface CartContextValue {
  cart: Cart;
  itemCount: number;
  loading: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (book: Pick<Book, 'id' | 'title'>, quantity?: number) => Promise<boolean>;
  updateQuantity: (bookId: string, quantity: number) => Promise<void>;
  removeItem: (bookId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Ignores responses that were requested for a previous identity.
  const requestSeq = useRef(0);

  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) {
      setCart(EMPTY_CART);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const next = await cartApi.get();
      if (seq === requestSeq.current) setCart(next);
    } catch {
      if (seq === requestSeq.current) setCart(EMPTY_CART);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [userId]);

  // Reload whenever the identity changes (login, logout, demo switch, guest start).
  useEffect(() => {
    if (authLoading) return;
    setDrawerOpen(false);
    void refresh();
  }, [authLoading, refresh]);

  const applyMutation = useCallback(async (run: () => Promise<Cart>): Promise<boolean> => {
    try {
      const next = await run();
      requestSeq.current++;
      setCart(next);
      return true;
    } catch {
      // The Axios interceptor already showed an error toast.
      return false;
    }
  }, []);

  const addItem = useCallback<CartContextValue['addItem']>(
    async (book, quantity = 1) => {
      const ok = await applyMutation(() => cartApi.add(book.id, quantity));
      if (ok) toast.success(`Added "${book.title}" to your cart`);
      return ok;
    },
    [applyMutation, toast],
  );

  const updateQuantity = useCallback<CartContextValue['updateQuantity']>(
    async (bookId, quantity) => {
      await applyMutation(() => (quantity <= 0 ? cartApi.remove(bookId) : cartApi.setQuantity(bookId, quantity)));
    },
    [applyMutation],
  );

  const removeItem = useCallback<CartContextValue['removeItem']>(
    async (bookId) => {
      await applyMutation(() => cartApi.remove(bookId));
    },
    [applyMutation],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount: cart.itemCount,
      loading,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      addItem,
      updateQuantity,
      removeItem,
      refresh,
    }),
    [cart, loading, drawerOpen, addItem, updateQuantity, removeItem, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

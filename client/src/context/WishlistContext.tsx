import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Book } from '@/types';
import { useToast } from './ToastContext';

const STORAGE_KEY = 'bookworm.wishlist';

interface WishlistContextValue {
  items: Book[];
  count: number;
  has: (bookId: string) => boolean;
  /** Adds or removes the book; returns true when it is now wishlisted. */
  toggle: (book: Book) => boolean;
  remove: (bookId: string) => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

function load(): Book[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Book[]) : [];
  } catch {
    return [];
  }
}

/** Wishlist persisted in the browser (the API has no wishlist resource). */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [items, setItems] = useState<Book[]>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const has = useCallback((bookId: string) => items.some((b) => b.id === bookId), [items]);

  const toggle = useCallback(
    (book: Book) => {
      const exists = items.some((b) => b.id === book.id);
      setItems(exists ? items.filter((b) => b.id !== book.id) : [book, ...items]);
      if (exists) toast.info(`Removed "${book.title}" from your wishlist`);
      else toast.success(`Saved "${book.title}" to your wishlist`);
      return !exists;
    },
    [items, toast],
  );

  const remove = useCallback((bookId: string) => {
    setItems((prev) => prev.filter((b) => b.id !== bookId));
  }, []);

  const value = useMemo<WishlistContextValue>(
    () => ({ items, count: items.length, has, toggle, remove }),
    [items, has, toggle, remove],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}

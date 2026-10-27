import { Heart, Home, LogIn, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Drawer } from '@/components/ui/Overlay';
import { useAuth } from '@/context/AuthContext';
import { useWishlist } from '@/context/WishlistContext';
import type { Category } from '@/types';
import { SearchBar } from './SearchBar';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  onSignIn: () => void;
}

export function MobileNav({ open, onClose, categories, onSignIn }: MobileNavProps) {
  const { isGuest } = useAuth();
  const wishlist = useWishlist();
  const row = 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-paper-100';

  return (
    <Drawer open={open} onClose={onClose} title="Menu" side="left">
      <div className="space-y-4 p-4">
        <SearchBar onNavigate={onClose} />

        <nav aria-label="Main" className="space-y-1">
          <Link to="/" onClick={onClose} className={row}><Home className="h-4 w-4" /> Home</Link>
          <Link to="/wishlist" onClick={onClose} className={row}>
            <Heart className="h-4 w-4" /> Wishlist
            {wishlist.count > 0 && <span className="badge ml-auto bg-brand-100 text-brand-800">{wishlist.count}</span>}
          </Link>
          <Link to="/orders" onClick={onClose} className={row}><Package className="h-4 w-4" /> My orders</Link>
          {isGuest && (
            <button type="button" onClick={() => { onClose(); onSignIn(); }} className={`${row} w-full text-brand-800`}>
              <LogIn className="h-4 w-4" /> Sign in or register
            </button>
          )}
        </nav>

        <div>
          <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Categories</p>
          <Link to="/books" onClick={onClose} className={row}>All books</Link>
          {categories.map((c) => (
            <Link key={c.id} to={`/books?category=${c.slug}`} onClick={onClose} className={row}>
              <span className="flex-1">{c.name}</span>
              <span className="text-xs text-stone-400">{c.bookCount}</span>
            </Link>
          ))}
        </div>
      </div>
    </Drawer>
  );
}

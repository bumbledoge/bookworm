import { useState } from 'react';
import { BookOpen, Heart, Menu, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { AccountMenu } from './AccountMenu';
import { AuthModal } from './AuthModal';
import { CartDrawer } from './CartDrawer';
import { CategoryMenu, useCategories } from './CategoryMenu';
import { MobileNav } from './MobileNav';
import { SearchBar } from './SearchBar';

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-ink-700 px-1 text-[11px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function Navbar() {
  const categories = useCategories();
  const { itemCount, openDrawer } = useCart();
  const wishlist = useWishlist();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-paper-300 bg-paper-50/95 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-2 sm:gap-4">
        <button type="button" className="btn-ghost p-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu className="h-6 w-6" />
        </button>

        <Link to="/" className="flex items-center gap-2" aria-label="Book Worm home">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-white">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="font-serif text-xl font-bold text-stone-900">
            Book<span className="text-brand-700">Worm</span>
          </span>
        </Link>

        <div className="hidden lg:block">
          <CategoryMenu categories={categories} />
        </div>

        <SearchBar className="mx-2 hidden flex-1 lg:block" />
        <div className="flex-1 lg:hidden" />

        <nav aria-label="Account and cart" className="flex items-center gap-1">
          <Link to="/wishlist" className="btn-ghost relative p-2" aria-label={`Wishlist, ${wishlist.count} items`}>
            <Heart className="h-5 w-5" />
            <Badge count={wishlist.count} />
          </Link>
          <button type="button" onClick={openDrawer} className="btn-ghost relative p-2" aria-label={`Open cart, ${itemCount} items`}>
            <ShoppingCart className="h-5 w-5" />
            <Badge count={itemCount} />
          </button>
          <AccountMenu onSignIn={() => setAuthOpen(true)} />
        </nav>
      </div>

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} categories={categories} onSignIn={() => setAuthOpen(true)} />
      <CartDrawer />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </header>
  );
}

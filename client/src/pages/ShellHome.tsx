import { Link } from 'react-router-dom';
import { Package, Star, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/lib/format';

/** Shell landing page; the full home page ships in Sub-Task 4. */
export function ShellHome() {
  const { user, isGuest, pointsBalance } = useAuth();

  return (
    <div className="container-page py-12">
      <section className="card bg-gradient-to-br from-brand-50 to-ink-50 p-8 sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-800">Welcome to Book Worm</p>
        <h1 className="mt-2 max-w-2xl text-4xl sm:text-5xl">Find your next favourite story.</h1>
        <p className="mt-4 max-w-xl text-stone-600">
          {isGuest
            ? 'You are browsing as a guest. Sign in or use the demo account switcher to see points, orders and more.'
            : `Signed in as ${user?.name}.`}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/books" className="btn-primary">Browse books</Link>
          <Link to="/cart" className="btn-outline">View cart</Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><Star className="h-5 w-5 text-brand-700" /><p className="mt-2 text-2xl font-bold">{pointsBalance.toLocaleString()}</p><p className="text-sm text-stone-500">Gift points</p></div>
        <div className="card p-5"><Wallet className="h-5 w-5 text-ink-700" /><p className="mt-2 text-2xl font-bold">{formatPrice(user?.walletBalance ?? 0)}</p><p className="text-sm text-stone-500">Wallet balance</p></div>
        <div className="card p-5"><Package className="h-5 w-5 text-brand-700" /><p className="mt-2 text-2xl font-bold capitalize">{(user?.role ?? 'guest').toLowerCase()}</p><p className="text-sm text-stone-500">Account type</p></div>
      </section>
    </div>
  );
}

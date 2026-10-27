import { useState, type FormEvent } from 'react';
import { BookOpen, Headphones, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/context/ToastContext';

const GUARANTEES = [
  { icon: RotateCcw, title: '48h Free Cancellation', text: 'Change your mind within 48 hours.' },
  { icon: ShieldCheck, title: 'Secure Payments', text: 'Cards, UPI and wallet, fully protected.' },
  { icon: Truck, title: 'Fast Delivery', text: 'Quick shipping on every in-stock title.' },
  { icon: Headphones, title: '24/7 Support', text: 'Real people, any time you need us.' },
];

const LINK_GROUPS = [
  { title: 'Shop', links: [{ to: '/books', label: 'Browse' }, { to: '/books?sort=newest', label: 'New launches' }, { to: '/wishlist', label: 'Wishlist' }] },
  { title: 'Categories', links: [{ to: '/books', label: 'All categories' }, { to: '/books?sort=rating', label: 'Top rated' }] },
  { title: 'Account', links: [{ to: '/account', label: 'My account' }, { to: '/orders', label: 'Orders' }, { to: '/cart', label: 'Cart' }] },
];

export function Footer() {
  const toast = useToast();
  const [email, setEmail] = useState('');

  const subscribe = (e: FormEvent) => {
    e.preventDefault();
    toast.success(`Thanks! ${email.trim()} is subscribed to our newsletter.`);
    setEmail('');
  };

  return (
    <footer className="mt-16 border-t border-paper-300 bg-paper-100">
      <div className="container-page grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
        {GUARANTEES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-stone-900">{title}</p>
              <p className="text-xs text-stone-600">{text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-paper-300">
        <div className="container-page grid gap-8 py-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link to="/" className="inline-flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-white"><BookOpen className="h-5 w-5" /></span>
              <span className="font-serif text-xl font-bold">Book<span className="text-brand-700">Worm</span></span>
            </Link>
            <p className="mt-3 max-w-sm text-sm text-stone-600">
              Your friendly neighbourhood bookstore, online. Bestsellers, hidden gems and everything in between.
            </p>
            <form onSubmit={subscribe} className="mt-4 flex max-w-sm gap-2">
              <label htmlFor="newsletter-email" className="sr-only">Email address</label>
              <input id="newsletter-email" type="email" required className="input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="submit" className="btn-secondary shrink-0">Subscribe</button>
            </form>
          </div>

          {LINK_GROUPS.map((g) => (
            <nav key={g.title} aria-label={g.title}>
              <p className="mb-3 text-sm font-semibold text-stone-900">{g.title}</p>
              <ul className="space-y-2">
                {g.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-sm text-stone-600 hover:text-brand-800">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t border-paper-300 py-4 text-center text-xs text-stone-500">
        &copy; {new Date().getFullYear()} Book Worm. All rights reserved.
      </div>
    </footer>
  );
}

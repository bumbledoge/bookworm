import { useState } from 'react';
import { X } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { Footer } from './Footer';
import { Navbar } from './Navbar';

function PromoBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div className="relative bg-ink-800 px-10 py-2 text-center text-xs text-white sm:text-sm">
      Use code <strong className="rounded bg-white/15 px-1.5 py-0.5">WELCOME10</strong> for 10% off your first order.
      Free cancellation within 48 hours.
      <button type="button" onClick={() => setVisible(false)} aria-label="Dismiss promotion" className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <PromoBanner />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ToastContainer />
    </div>
  );
}

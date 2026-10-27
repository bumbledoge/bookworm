import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LogIn, LogOut, Package, Shield, Star, User as UserIcon, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth, type DemoAccount } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { cn } from '@/lib/cn';

const DEMOS: { id: DemoAccount; label: string; hint: string; icon: typeof UserIcon }[] = [
  { id: 'customer', label: 'Demo Customer', hint: 'demo@bookworm.com', icon: UserRound },
  { id: 'admin', label: 'Demo Admin', hint: 'admin@bookworm.com', icon: Shield },
  { id: 'guest', label: 'Guest', hint: 'Browse without an account', icon: UserIcon },
];

function activeDemo(email: string | null, isGuest: boolean, isAdmin: boolean): DemoAccount | null {
  if (isGuest) return 'guest';
  if (isAdmin) return 'admin';
  return email === 'demo@bookworm.com' ? 'customer' : null;
}

export function AccountMenu({ onSignIn }: { onSignIn: () => void }) {
  const { user, isGuest, isAdmin, pointsBalance, switchDemoAccount, logout } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = activeDemo(user?.email ?? null, isGuest, isAdmin);

  const switchTo = async (id: DemoAccount) => {
    setBusy(true);
    try {
      await switchDemoAccount(id);
      toast.success(id === 'guest' ? 'Switched to guest mode' : `Signed in as ${DEMOS.find((d) => d.id === id)?.label}`);
      setOpen(false);
    } catch {
      toast.info('Could not switch account. Is the demo data seeded?');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost gap-1.5 px-2 sm:px-3"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <UserIcon className="h-5 w-5" />
        <span className="hidden max-w-[7rem] truncate text-sm lg:inline">{isGuest ? 'Guest' : user?.name}</span>
        <ChevronDown className="hidden h-4 w-4 lg:block" />
      </button>

      {open && (
        <div role="menu" className="card absolute right-0 top-full z-40 mt-2 w-72 animate-fade-in p-2">
          <div className="border-b border-paper-200 px-3 pb-2 pt-1">
            <p className="truncate text-sm font-semibold text-stone-900">{isGuest ? 'Browsing as guest' : user?.name}</p>
            {!isGuest && <p className="truncate text-xs text-stone-500">{user?.email}</p>}
            {!isGuest && (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
                <Star className="h-3 w-3" /> {pointsBalance.toLocaleString()} gift points
              </p>
            )}
          </div>

          {isGuest ? (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onSignIn(); }} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50">
              <LogIn className="h-4 w-4" /> Sign in or register
            </button>
          ) : (
            <>
              <Link role="menuitem" to="/orders" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-paper-100">
                <Package className="h-4 w-4" /> My orders
              </Link>
              <Link role="menuitem" to="/account" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-paper-100">
                <UserRound className="h-4 w-4" /> My account
              </Link>
            </>
          )}

          <p className="mt-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Demo account switcher</p>
          {DEMOS.map(({ id, label, hint, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => switchTo(id)}
              className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-paper-100 disabled:opacity-50', current === id && 'bg-ink-50')}
            >
              <Icon className="h-4 w-4 text-ink-600" />
              <span className="flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-stone-500">{hint}</span>
              </span>
              {current === id && <Check className="h-4 w-4 text-ink-600" />}
            </button>
          ))}

          {!isGuest && (
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={async () => { await logout(); toast.info('Signed out'); setOpen(false); }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-paper-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BadgeCheck, Loader2, Minus, Plus, ShoppingBag, Tag, Trash2, Truck, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { FormatBadge } from '@/components/checkout/FormatBadge';
import { OrderTotals } from '@/components/checkout/OrderTotals';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { useCheckoutSummary } from '@/hooks/useCheckoutSummary';
import { cn } from '@/lib/cn';
import { couponStore } from '@/lib/couponStore';
import { formatPrice } from '@/lib/format';
import { cartApi, couponApi, getErrorMessage } from '@/services/api';
import type { Coupon } from '@/types';

const FREE_SHIPPING_THRESHOLD = 35;
const MAX_QUANTITY = 20;
const QUICK_CODES = ['WELCOME10', 'BOOKWORM20', 'FREESHIP'];

interface AppliedCoupon {
  coupon: Coupon;
  discount: number;
}

function discountTag(c: Coupon): string {
  return c.discountType === 'PERCENT' ? `${c.discountValue}% OFF` : `${formatPrice(c.discountValue)} OFF`;
}

export function CartPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { loading: authLoading } = useAuth();
  const { cart, loading, updateQuantity, removeItem, refresh } = useCart();

  const [applied, setApplied] = useState<AppliedCoupon | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [available, setAvailable] = useState<Coupon[] | null>(null);
  const [clearing, setClearing] = useState(false);

  const hasItems = cart.items.length > 0;
  // Re-fetch the summary whenever any line or quantity changes.
  const cartKey = cart.items.map((i) => `${i.bookId}:${i.quantity}`).join(',');
  const { summary, loading: summaryLoading } = useCheckoutSummary(
    { couponCode: applied?.coupon.code },
    cartKey,
    hasItems,
  );

  useEffect(() => {
    couponApi.list().then(setAvailable).catch(() => setAvailable(null));
  }, []);

  /** Validates `code` against the current cart; returns true when it was applied. */
  const applyCode = useCallback(async (code: string, opts: { quiet?: boolean } = {}): Promise<boolean> => {
    const clean = code.trim().toUpperCase();
    if (!clean) return false;
    setApplying(true);
    setCouponError(null);
    try {
      const res = await couponApi.validate(clean);
      setApplied({ coupon: res.coupon, discount: res.discount });
      couponStore.set(res.coupon.code);
      setCodeInput('');
      return true;
    } catch (err) {
      setApplied(null);
      couponStore.clear();
      if (!opts.quiet) setCouponError(getErrorMessage(err));
      return false;
    } finally {
      setApplying(false);
    }
  }, []);

  // Restore (and re-validate) a previously applied coupon whenever the cart changes.
  useEffect(() => {
    const stored = couponStore.get();
    if (!stored || !hasItems) return;
    void applyCode(stored, { quiet: true }).then((ok) => {
      if (!ok) toast.info(`Coupon ${stored} no longer applies to your cart`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey]);

  const removeCoupon = () => {
    setApplied(null);
    setCouponError(null);
    couponStore.clear();
  };

  const onSubmitCode = (e: FormEvent) => {
    e.preventDefault();
    void applyCode(codeInput).then((ok) => {
      if (ok) toast.success('Coupon applied');
    });
  };

  const onClear = async () => {
    setClearing(true);
    try {
      await cartApi.clear();
      removeCoupon();
      await refresh();
    } catch {
      // Error toast shown by the Axios interceptor.
    } finally {
      setClearing(false);
    }
  };

  if (authLoading || (loading && !hasItems)) {
    return (
      <div className="container-page flex justify-center py-24" role="status" aria-label="Loading cart">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!hasItems) {
    return (
      <div className="container-page flex flex-col items-center gap-3 py-24 text-center">
        <ShoppingBag className="h-14 w-14 text-paper-300" />
        <h1 className="text-3xl">Your cart is empty</h1>
        <p className="text-stone-600">Find your next great read.</p>
        <Link to="/books" className="btn-primary mt-2">Browse books</Link>
      </div>
    );
  }

  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - cart.subtotal);
  const progress = Math.min(100, (cart.subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  const quickCodes = available ? QUICK_CODES.filter((c) => available.some((a) => a.code === c)) : QUICK_CODES;

  return (
    <div className="container-page py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl">Shopping cart</h1>
        <button type="button" className="btn-ghost text-red-600 hover:bg-red-50" onClick={onClear} disabled={clearing}>
          <Trash2 className="h-4 w-4" /> Clear cart
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section aria-label="Cart items" className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-stone-800">
              <Truck className="h-4 w-4 text-brand-700" />
              {remaining > 0 ? (
                <span>
                  Add <strong>{formatPrice(remaining)}</strong> more for <strong>free shipping</strong>
                </span>
              ) : (
                <span className="text-emerald-700">You've unlocked free shipping!</span>
              )}
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-paper-200"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={FREE_SHIPPING_THRESHOLD}
              aria-valuenow={Math.min(cart.subtotal, FREE_SHIPPING_THRESHOLD)}
              aria-label="Progress towards free shipping"
            >
              <div
                className={cn('h-full rounded-full transition-all', remaining > 0 ? 'bg-brand-600' : 'bg-emerald-500')}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <ul className="card divide-y divide-paper-200">
            {cart.items.map((line) => (
              <li key={line.id} className="flex gap-4 p-4">
                <Link to={`/books/${line.bookId}`} className="shrink-0">
                  {line.book.coverUrl ? (
                    <img src={line.book.coverUrl} alt="" className="h-28 w-20 rounded object-cover shadow-card" />
                  ) : (
                    <div className="h-28 w-20 rounded bg-paper-200" />
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <FormatBadge format={line.book.format} />
                      <Link
                        to={`/books/${line.bookId}`}
                        className="mt-1 block font-semibold text-stone-900 hover:text-brand-800"
                      >
                        {line.book.title}
                      </Link>
                      <p className="text-sm text-stone-500">by {line.book.author.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-brand-800">{formatPrice(line.lineTotal)}</p>
                      {line.quantity > 1 && (
                        <p className="text-xs text-stone-500">{formatPrice(line.book.price)} each</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto flex items-center gap-3 pt-3">
                    <div className="inline-flex items-center rounded-lg border border-stone-300 bg-white">
                      <button
                        type="button"
                        className="p-2 hover:bg-paper-100 disabled:opacity-40"
                        aria-label={`Decrease quantity of ${line.book.title}`}
                        disabled={line.quantity <= 1}
                        onClick={() => updateQuantity(line.bookId, line.quantity - 1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-[2rem] text-center text-sm font-medium" aria-live="polite">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        className="p-2 hover:bg-paper-100 disabled:opacity-40"
                        aria-label={`Increase quantity of ${line.book.title}`}
                        disabled={line.quantity >= MAX_QUANTITY}
                        onClick={() => updateQuantity(line.bookId, line.quantity + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {line.quantity >= MAX_QUANTITY && (
                      <span className="text-xs text-stone-500">Max {MAX_QUANTITY} per order</span>
                    )}
                    <button
                      type="button"
                      className="ml-auto inline-flex items-center gap-1 text-sm text-stone-500 hover:text-red-600"
                      aria-label={`Remove ${line.book.title}`}
                      onClick={() => removeItem(line.bookId)}
                    >
                      <Trash2 className="h-4 w-4" /> Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg">
              <Tag className="h-4 w-4 text-brand-700" /> Promo code
            </h2>

            {applied ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                      {applied.coupon.code}
                      <span className="badge bg-emerald-600 text-white">{discountTag(applied.coupon)}</span>
                    </p>
                    {applied.coupon.description && (
                      <p className="truncate text-xs text-emerald-700">{applied.coupon.description}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="p-1 text-emerald-700 hover:text-red-600"
                  aria-label={`Remove coupon ${applied.coupon.code}`}
                  onClick={removeCoupon}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={onSubmitCode} className="flex gap-2">
                  <input
                    className="input uppercase"
                    placeholder="Enter code"
                    value={codeInput}
                    onChange={(e) => {
                      setCodeInput(e.target.value);
                      setCouponError(null);
                    }}
                    aria-label="Promo code"
                    aria-invalid={couponError ? true : undefined}
                    maxLength={40}
                  />
                  <button type="submit" className="btn-secondary" disabled={applying || !codeInput.trim()}>
                    {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </button>
                </form>
                {couponError && (
                  <p className="mt-2 text-sm text-red-600" role="alert">{couponError}</p>
                )}
                {quickCodes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {quickCodes.map((code) => (
                      <button
                        key={code}
                        type="button"
                        title={available?.find((a) => a.code === code)?.description ?? undefined}
                        className="badge border border-dashed border-brand-400 bg-brand-50 px-3 py-1 text-brand-800 hover:bg-brand-100 disabled:opacity-50"
                        disabled={applying}
                        onClick={() => void applyCode(code).then((ok) => ok && toast.success(`${code} applied`))}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-lg">Order summary</h2>
            {summary ? (
              <div className={cn(summaryLoading && 'opacity-60 transition-opacity')}>
                <OrderTotals totals={summary} />
              </div>
            ) : (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-brand-600" /></div>
            )}
            <button
              type="button"
              className="btn-primary mt-4 w-full py-3"
              disabled={!summary}
              onClick={() => navigate('/checkout')}
            >
              Proceed to checkout
            </button>
            <Link to="/books" className="btn-ghost mt-2 w-full">Continue shopping</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

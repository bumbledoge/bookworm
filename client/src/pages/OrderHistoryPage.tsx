import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatPrice } from '@/lib/format';
import { orderApi, type OrderStatusTab } from '@/services/api';
import type { Order, OrderItem } from '@/types';

// ------------------------------------------------------------------ constants

const TABS: { key: OrderStatusTab; label: string }[] = [
  { key: 'ALL', label: 'All Orders' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

const TRACKING_STEPS = ['PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
const TRACKING_LABELS: Record<string, string> = {
  PLACED: 'Placed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
};

const STATUS_STYLES: Record<string, string> = {
  PLACED: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-amber-100 text-amber-700',
  SHIPPED: 'bg-indigo-100 text-indigo-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const CANCEL_REASONS = [
  'Changed my mind',
  'Found a better price elsewhere',
  'Ordered by mistake',
  'Delivery time too long',
  'Other',
];

// ------------------------------------------------------------------ countdown

function useCountdown(targetIso: string | null) {
  const calc = () => {
    if (!targetIso) return 0;
    return Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000));
  };
  const [secs, setSecs] = useState(calc);
  useEffect(() => {
    if (!targetIso) return;
    const id = setInterval(() => setSecs(calc()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIso]);
  return secs;
}

function formatCountdown(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ------------------------------------------------------------------ tracking bar

function TrackingBar({ tracking }: { tracking: Order['tracking'] }) {
  const statusMap = new Map(tracking.map((t) => [t.status, t]));
  const currentIdx = TRACKING_STEPS.map((s) => statusMap.get(s)?.completed ?? false).lastIndexOf(true);

  return (
    <div className="mt-3 flex items-center gap-0">
      {TRACKING_STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors',
                  done
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-stone-300 bg-white text-stone-400',
                  active && 'ring-2 ring-brand-200',
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-[10px] font-bold">{idx + 1}</span>}
              </div>
              <span
                className={cn(
                  'mt-1 text-center text-[10px] font-semibold leading-tight',
                  done ? 'text-brand-700' : 'text-stone-400',
                )}
              >
                {TRACKING_LABELS[step]}
              </span>
              {statusMap.get(step)?.timestamp && (
                <span className="text-[9px] text-stone-400 mt-0.5">
                  {new Date(statusMap.get(step)!.timestamp!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
            {idx < TRACKING_STEPS.length - 1 && (
              <div
                className={cn(
                  'mb-5 h-0.5 flex-1 transition-colors',
                  idx < currentIdx ? 'bg-brand-600' : 'bg-stone-200',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ cancel modal

function CancelModal({
  order,
  onClose,
  onCancelled,
}: {
  order: Order;
  onClose: () => void;
  onCancelled: (updated: Order) => void;
}) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [busy, setBusy] = useState(false);
  const secsLeft = useCountdown(order.cancellableUntil);
  const toast = useToast();

  const handleCancel = async () => {
    const finalReason = reason === 'Other' ? customReason.trim() || 'Other' : reason;
    setBusy(true);
    try {
      const updated = await orderApi.cancel(order.id, finalReason);
      toast.success('Order cancelled. Your refund will be processed within 3–5 business days.');
      onCancelled(updated);
    } catch {
      // error toast from interceptor
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-paper-200 px-5 py-4">
          <h2 id="cancel-modal-title" className="text-lg font-semibold text-stone-900">
            Cancel Order {order.orderNumber}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* countdown */}
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <Clock className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Cancellation window closes in</p>
              <p className="text-xl font-mono font-bold text-amber-700">{formatCountdown(secsLeft)}</p>
            </div>
          </div>

          {/* refund notice */}
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <p className="font-semibold">Full refund of {formatPrice(order.total)}</p>
            <p className="text-xs mt-0.5">Refunds are processed within 3–5 business days to your original payment method.</p>
          </div>

          {/* reason */}
          <div>
            <label className="label">Reason for cancellation</label>
            <div className="space-y-1.5">
              {CANCEL_REASONS.map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="cancel-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-brand-700"
                  />
                  {r}
                </label>
              ))}
            </div>
            {reason === 'Other' && (
              <textarea
                className="input mt-2 resize-none"
                rows={2}
                placeholder="Please describe your reason…"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="flex gap-3 border-t border-paper-200 px-5 py-4">
          <button type="button" onClick={onClose} className="btn-outline flex-1">
            Keep Order
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={!reason || busy || secsLeft === 0}
            className="btn flex-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            {busy ? 'Cancelling…' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ order card

function OrderCard({ order, onUpdate }: { order: Order; onUpdate: (updated: Order) => void }) {
  const { refresh: refreshCart, openDrawer } = useCart();
  const toast = useToast();
  const [showTracking, setShowTracking] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
  const secsLeft = useCountdown(order.canCancel ? order.cancellableUntil : null);

  const handleReorder = async () => {
    setReordering(true);
    try {
      await orderApi.reorder(order.id);
      await refreshCart();
      openDrawer();
      toast.success(`${order.items.length} item${order.items.length !== 1 ? 's' : ''} added back to your cart!`);
    } catch {
      // error toast from interceptor
    } finally {
      setReordering(false);
    }
  };

  const isCancelled = order.status === 'CANCELLED';

  return (
    <>
      <article className="card p-5 space-y-4">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-stone-900">{order.orderNumber}</span>
              <span className={cn('badge', STATUS_STYLES[order.status] ?? 'bg-paper-200 text-stone-600')}>
                {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
              </span>
              {order.canCancel && secsLeft > 0 && (
                <span className="badge bg-amber-100 text-amber-700 gap-1">
                  <Clock className="h-3 w-3" />
                  {formatCountdown(secsLeft)} left to cancel
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-stone-500">
              Placed {formatDateTime(order.placedAt)} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-brand-800">{formatPrice(order.total)}</p>
            <p className="text-xs text-stone-500">Est. delivery {formatDate(order.estimatedDelivery)}</p>
          </div>
        </div>

        {/* item list */}
        <ul className="divide-y divide-paper-200">
          {order.items.map((item: OrderItem) => (
            <li key={item.id} className="flex gap-3 py-2.5">
              {item.coverUrl ? (
                <img src={item.coverUrl} alt="" className="h-16 w-11 shrink-0 rounded object-cover shadow-card" loading="lazy" />
              ) : (
                <div className="h-16 w-11 shrink-0 rounded bg-paper-200" />
              )}
              <div className="min-w-0 flex-1">
                <Link to={`/books/${item.bookId}`} className="text-sm font-semibold text-stone-900 hover:text-brand-800 line-clamp-2 leading-snug">
                  {item.title}
                </Link>
                <p className="mt-0.5 text-xs text-stone-500">
                  {item.quantity} × {formatPrice(item.unitPrice)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold">{formatPrice(item.lineTotal)}</span>
            </li>
          ))}
        </ul>

        {/* tracking bar */}
        {!isCancelled && order.tracking.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowTracking((v) => !v)}
              className="text-xs font-semibold text-brand-700 hover:underline flex items-center gap-1"
            >
              <Truck className="h-3.5 w-3.5" />
              {showTracking ? 'Hide tracking' : 'Show tracking'}
            </button>
            {showTracking && <TrackingBar tracking={order.tracking} />}
          </div>
        )}

        {/* actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          {/* Buy It Again */}
          <button
            type="button"
            onClick={handleReorder}
            disabled={reordering}
            className="btn-primary gap-2 text-sm"
            aria-label="Buy It Again — add all items to cart"
          >
            {reordering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {reordering ? 'Adding…' : 'Buy It Again'}
          </button>

          {/* Cancel */}
          {order.canCancel && secsLeft > 0 && (
            <button
              type="button"
              onClick={() => setCancelModalOpen(true)}
              className="btn-outline gap-2 text-sm text-red-600 border-red-200 hover:border-red-500 hover:text-red-700"
            >
              <XCircle className="h-4 w-4" />
              Cancel Order
            </button>
          )}

          <Link to={`/order-confirmation/${order.id}`} className="btn-ghost gap-1 text-sm">
            <PackageCheck className="h-4 w-4" />
            View details
          </Link>
        </div>
      </article>

      {cancelModalOpen && (
        <CancelModal
          order={order}
          onClose={() => setCancelModalOpen(false)}
          onCancelled={(updated) => {
            onUpdate(updated);
            setCancelModalOpen(false);
          }}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ page

export function OrderHistoryPage() {
  const [tab, setTab] = useState<OrderStatusTab>('ALL');
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (status: OrderStatusTab) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const result = await orderApi.list({ status: status === 'ALL' ? undefined : status, pageSize: 50 });
      setOrders(result.items);
      setTotal(result.total);
    } catch {
      // error toast from interceptor; leave previous list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  const updateOrder = (updated: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  return (
    <main className="container-page max-w-4xl py-8 pb-16">
      <div className="mb-6 flex items-center gap-3">
        <Package className="h-6 w-6 text-brand-700" />
        <h1 className="text-3xl">Your Orders</h1>
        {!loading && <span className="badge bg-paper-200 text-stone-600 text-sm">{total}</span>}
      </div>

      {/* tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-paper-100 p-1 border border-paper-300 w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors',
              tab === key
                ? 'bg-white text-brand-700 shadow-sm border border-paper-200'
                : 'text-stone-500 hover:text-stone-800',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-24" role="status" aria-label="Loading orders">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyOrders tab={tab} />
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} onUpdate={updateOrder} />
          ))}
        </div>
      )}
    </main>
  );
}

function EmptyOrders({ tab }: { tab: OrderStatusTab }) {
  const labels: Record<OrderStatusTab, string> = {
    ALL: "You haven't placed any orders yet.",
    ACTIVE: 'No active orders right now.',
    DELIVERED: 'No delivered orders to show.',
    CANCELLED: 'No cancelled orders.',
  };
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <ShoppingCart className="h-16 w-16 text-paper-300" />
      <h2 className="text-xl text-stone-700">{labels[tab]}</h2>
      <Link to="/books" className="btn-primary mt-2">Browse books</Link>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, CreditCard, Loader2, MapPin, ShieldCheck, Truck } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { OrderTotals } from '@/components/checkout/OrderTotals';
import { formatDate, formatDateTime, formatPrice } from '@/lib/format';
import { orderApi } from '@/services/api';
import type { Order, PaymentMethod } from '@/types';

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  UPI: 'UPI',
  WALLET: 'Digital Wallet',
  GIFT_POINTS: 'Gift Points',
};

export function OrderConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  // Right after checkout the order arrives via router state; a refresh falls back to the API.
  const stateOrder = (location.state as { order?: Order } | null)?.order;
  const initial = stateOrder && stateOrder.id === orderId ? stateOrder : null;
  const [order, setOrder] = useState<Order | null>(initial);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    orderApi
      .detail(orderId)
      .then((o) => !cancelled && setOrder(o))
      // Guests can't read orders back; the copy from checkout is all they have.
      .catch(() => !cancelled && !initial && setNotFound(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (notFound) {
    return (
      <div className="container-page flex flex-col items-center gap-3 py-24 text-center">
        <h1 className="text-3xl">Order not found</h1>
        <p className="text-stone-600">We couldn't find that order on your account.</p>
        <Link to="/books" className="btn-primary mt-2">Continue shopping</Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container-page flex justify-center py-24" role="status" aria-label="Loading order">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const a = order.shippingAddress;
  const cancelled = order.status === 'CANCELLED';

  return (
    <div className="container-page max-w-4xl py-8">
      <header className="card flex flex-col items-center gap-2 p-8 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-600" />
        <h1 className="text-3xl">{cancelled ? 'Order cancelled' : 'Thank you! Your order is confirmed'}</h1>
        <p className="text-stone-600">
          Order number <strong className="text-stone-900">{order.orderNumber}</strong> · placed {formatDateTime(order.placedAt)}
        </p>
        <p className="text-sm text-stone-500">Payment reference {order.paymentReference ?? '—'}</p>
      </header>

      {!cancelled && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">48-Hour Free Cancellation guarantee</p>
            <p className="text-sm">
              You can cancel this order for a full refund until{' '}
              <strong>
                <time dateTime={order.cancellableUntil}>{formatDateTime(order.cancellableUntil)}</time>
              </strong>
              .
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
        <section className="card p-5" aria-label="Items purchased">
          <h2 className="mb-3 text-lg">Items purchased</h2>
          <ul className="divide-y divide-paper-200">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-3 py-3">
                {item.coverUrl ? (
                  <img src={item.coverUrl} alt="" className="h-20 w-14 shrink-0 rounded object-cover shadow-card" />
                ) : (
                  <div className="h-20 w-14 shrink-0 rounded bg-paper-200" />
                )}
                <div className="min-w-0 flex-1">
                  <Link to={`/books/${item.bookId}`} className="font-semibold text-stone-900 hover:text-brand-800">
                    {item.title}
                  </Link>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {item.quantity} × {formatPrice(item.unitPrice)}
                  </p>
                </div>
                <span className="font-semibold">{formatPrice(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-4">
          <section className="card p-5" aria-label="Order total">
            <h2 className="mb-3 text-lg">Payment summary</h2>
            <OrderTotals
              totals={{
                subtotal: order.subtotal,
                tax: order.tax,
                shipping: order.shipping,
                total: order.total,
                couponCode: order.couponCode,
                couponDiscount: Math.max(0, Math.round((order.discount - order.pointsRedeemed * 0.01) * 100) / 100),
                pointsDiscount: Math.round(order.pointsRedeemed * 0.01 * 100) / 100,
              }}
            />
          </section>

          <section className="card space-y-4 p-5 text-sm" aria-label="Delivery and payment details">
            <div>
              <h3 className="mb-1 flex items-center gap-2 font-sans text-sm font-semibold"><MapPin className="h-4 w-4 text-brand-700" /> Delivery address</h3>
              <p className="text-stone-600">
                {a.fullName}<br />
                {a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />
                {a.city}, {a.state} {a.postalCode}<br />
                {a.country} · {a.phone}
              </p>
            </div>
            <div>
              <h3 className="mb-1 flex items-center gap-2 font-sans text-sm font-semibold"><Truck className="h-4 w-4 text-brand-700" /> Shipping method</h3>
              <p className="text-stone-600">
                {order.shipping > 4.99 ? 'Express' : 'Standard'} delivery
                {order.shipping === 0 ? ' (free)' : ` (${formatPrice(order.shipping)})`}
              </p>
              <p className="mt-1 flex items-center gap-1 text-stone-600">
                <CalendarClock className="h-4 w-4" /> Estimated arrival {formatDate(order.estimatedDelivery)}
              </p>
            </div>
            <div>
              <h3 className="mb-1 flex items-center gap-2 font-sans text-sm font-semibold"><CreditCard className="h-4 w-4 text-brand-700" /> Payment method</h3>
              <p className="text-stone-600">
                {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod} · {order.paymentStatus.toLowerCase()}
              </p>
            </div>
          </section>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/orders" className="btn-primary">View in Order History</Link>
        <Link to="/books" className="btn-outline">Continue Shopping</Link>
      </div>
    </div>
  );
}

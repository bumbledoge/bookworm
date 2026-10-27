import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import type { CheckoutSummary } from '@/types';

type Totals = Pick<CheckoutSummary, 'subtotal' | 'tax' | 'shipping' | 'total'> & {
  couponCode?: string | null;
  couponDiscount?: number;
  pointsDiscount?: number;
};

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between text-sm', className)}>
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/** Financial breakdown shared by the cart, checkout sidebar and confirmation receipt. */
export function OrderTotals({ totals }: { totals: Totals }) {
  const { subtotal, tax, shipping, total, couponCode, couponDiscount = 0, pointsDiscount = 0 } = totals;
  return (
    <div className="space-y-2 text-stone-600">
      <Row label="Subtotal" value={formatPrice(subtotal)} />
      {couponDiscount > 0 && (
        <Row
          label={couponCode ? `Coupon (${couponCode})` : 'Coupon discount'}
          value={`-${formatPrice(couponDiscount)}`}
          className="text-emerald-700"
        />
      )}
      {pointsDiscount > 0 && (
        <Row label="Gift points" value={`-${formatPrice(pointsDiscount)}`} className="text-emerald-700" />
      )}
      <Row label="Tax (8%)" value={formatPrice(tax)} />
      <Row label="Shipping" value={shipping === 0 ? 'Free' : formatPrice(shipping)} />
      <div className="flex items-center justify-between border-t border-paper-200 pt-3 text-base font-bold text-stone-900">
        <span>Total</span>
        <span>{formatPrice(total)}</span>
      </div>
    </div>
  );
}

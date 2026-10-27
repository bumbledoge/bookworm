import { ShieldCheck } from 'lucide-react';

/** The store's 48-hour free-cancellation guarantee, shown during checkout. */
export function CancellationNotice() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      <div>
        <p className="font-semibold">48-Hour Order Cancellation guarantee</p>
        <p className="text-xs text-emerald-800">
          Changed your mind? Cancel any time within 48 hours of placing your order for a full refund.
        </p>
      </div>
    </div>
  );
}

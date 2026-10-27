import type { ReactNode } from 'react';
import { CreditCard, Gift, Info, Smartphone, Wallet } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import type { PaymentDetails } from '@/types';
import {
  pointsForAmount,
  POINT_VALUE,
  TEST_CARD,
  type PaymentErrors,
  type PaymentFormState,
  type PaymentTab,
} from './paymentState';

interface PaymentSectionProps {
  value: PaymentFormState;
  onChange: (next: PaymentFormState) => void;
  errors: PaymentErrors;
  /** Show validation messages (after the user tried to submit). */
  showErrors: boolean;
  total: number;
  walletBalance: number;
  giftPoints: number;
  /** Most points that may be redeemed against this order. */
  maxRedeemablePoints: number;
  isGuest: boolean;
}

const TABS: { id: PaymentTab; label: string; icon: typeof CreditCard; accountOnly?: boolean }[] = [
  { id: 'CARD', label: 'Credit / Debit Card', icon: CreditCard },
  { id: 'UPI', label: 'UPI', icon: Smartphone },
  { id: 'WALLET', label: 'Digital Wallet', icon: Wallet, accountOnly: true },
  { id: 'GIFT_POINTS', label: 'Gift Points', icon: Gift, accountOnly: true },
];

function formatCardNumber(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600" role="alert">{error}</span>}
    </label>
  );
}

export function PaymentSection({
  value,
  onChange,
  errors,
  showErrors,
  total,
  walletBalance,
  giftPoints,
  maxRedeemablePoints,
  isGuest,
}: PaymentSectionProps) {
  const setDetails = (patch: Partial<PaymentDetails>) =>
    onChange({ ...value, details: { ...value.details, ...patch } });
  const err = (key: keyof PaymentErrors) => (showErrors ? errors[key] : undefined);

  const redeemable = Math.min(giftPoints, maxRedeemablePoints);
  const redeeming = value.pointsToRedeem > 0;
  const pointsCost = pointsForAmount(total);

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Payment method" className="grid gap-2 sm:grid-cols-2">
        {TABS.map(({ id, label, icon: Icon, accountOnly }) => {
          const disabled = Boolean(accountOnly && isGuest);
          const selected = value.tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              title={disabled ? 'Sign in to use this payment method' : undefined}
              onClick={() => onChange({ ...value, tab: id })}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors',
                selected ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-stone-300 bg-white text-stone-700 hover:border-brand-400',
                disabled && 'cursor-not-allowed opacity-50 hover:border-stone-300',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {disabled && <span className="text-[10px] uppercase text-stone-500">Sign in</span>}
            </button>
          );
        })}
      </div>

      {value.tab === 'CARD' && (
        <div className="space-y-4" role="tabpanel">
          <div className="flex gap-4 text-sm">
            {(['CREDIT_CARD', 'DEBIT_CARD'] as const).map((type) => (
              <label key={type} className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="cardType"
                  checked={value.cardType === type}
                  onChange={() => onChange({ ...value, cardType: type })}
                  className="accent-brand-700"
                />
                {type === 'CREDIT_CARD' ? 'Credit card' : 'Debit card'}
              </label>
            ))}
          </div>

          <Field label="Card number" error={err('cardNumber')}>
            <input
              className="input"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="1234 5678 9012 3456"
              value={value.details.cardNumber ?? ''}
              onChange={(e) => setDetails({ cardNumber: formatCardNumber(e.target.value) })}
            />
          </Field>
          <Field label="Name on card" error={err('cardHolder')}>
            <input
              className="input"
              autoComplete="cc-name"
              value={value.details.cardHolder ?? ''}
              onChange={(e) => setDetails({ cardHolder: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Expiry (MM/YY)" error={err('expiry')}>
              <input
                className="input"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                value={value.details.expiry ?? ''}
                onChange={(e) => setDetails({ expiry: formatExpiry(e.target.value) })}
              />
            </Field>
            <Field label="CVV" error={err('cvv')}>
              <input
                className="input"
                inputMode="numeric"
                autoComplete="cc-csc"
                type="password"
                maxLength={4}
                value={value.details.cvv ?? ''}
                onChange={(e) => setDetails({ cvv: e.target.value.replace(/\D/g, '') })}
              />
            </Field>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-paper-100 p-3 text-xs text-stone-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
            <div>
              <p>
                This is a simulated payment. Use test card <strong>{TEST_CARD.cardNumber}</strong> with any future
                expiry and 3-digit CVV. A card number ending in <strong>0002</strong> is always declined.
              </p>
              <button
                type="button"
                className="mt-1 font-semibold text-brand-700 hover:underline"
                onClick={() => setDetails({ ...TEST_CARD })}
              >
                Fill test card details
              </button>
            </div>
          </div>
        </div>
      )}

      {value.tab === 'UPI' && (
        <div role="tabpanel">
          <Field label="UPI ID" error={err('upiId')}>
            <input
              className="input"
              placeholder="name@bank"
              autoCapitalize="none"
              value={value.details.upiId ?? ''}
              onChange={(e) => setDetails({ upiId: e.target.value.trim() })}
            />
          </Field>
          <p className="mt-2 text-xs text-stone-500">Example: reader@okbank</p>
        </div>
      )}

      {value.tab === 'WALLET' && (
        <div role="tabpanel" className="rounded-lg border border-paper-300 bg-paper-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-600">Wallet balance</span>
            <span className="font-bold text-stone-900">{formatPrice(walletBalance)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-stone-600">Amount to pay</span>
            <span className="font-semibold">{formatPrice(total)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-paper-200 pt-2 text-sm">
            <span className="text-stone-600">Balance after order</span>
            <span className={cn('font-semibold', walletBalance < total ? 'text-red-600' : 'text-emerald-700')}>
              {formatPrice(walletBalance - total)}
            </span>
          </div>
          {err('balance') && <p className="mt-2 text-xs text-red-600" role="alert">{err('balance')}</p>}
        </div>
      )}

      {value.tab === 'GIFT_POINTS' && (
        <div role="tabpanel" className="rounded-lg border border-paper-300 bg-paper-50 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-stone-600">Available points</span>
            <span className="font-bold text-stone-900">{(giftPoints - value.pointsToRedeem).toLocaleString()}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-stone-600">Points needed (100 pts = {formatPrice(100 * POINT_VALUE)})</span>
            <span className="font-semibold">{pointsCost.toLocaleString()}</span>
          </div>
          {err('balance') && <p className="mt-2 text-xs text-red-600" role="alert">{err('balance')}</p>}
        </div>
      )}

      {!isGuest && (
        <div className="rounded-lg border border-paper-300 p-4">
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-stone-800">
              <input
                type="checkbox"
                className="accent-brand-700"
                checked={redeeming}
                disabled={redeemable === 0}
                onChange={(e) => onChange({ ...value, pointsToRedeem: e.target.checked ? Math.min(redeemable, 100) : 0 })}
              />
              <Gift className="h-4 w-4 text-brand-700" /> Redeem gift points
            </label>
            <span className="text-xs text-stone-500">{giftPoints.toLocaleString()} pts available</span>
          </div>

          {redeeming && (
            <div className="mt-3">
              <input
                type="range"
                min={0}
                max={redeemable}
                step={10}
                value={value.pointsToRedeem}
                onChange={(e) => onChange({ ...value, pointsToRedeem: Number(e.target.value) })}
                className="w-full accent-brand-700"
                aria-label="Gift points to redeem"
              />
              <div className="flex items-center justify-between text-sm">
                <span>{value.pointsToRedeem.toLocaleString()} pts</span>
                <span className="font-semibold text-emerald-700">
                  -{formatPrice(value.pointsToRedeem * POINT_VALUE)}
                </span>
              </div>
              <button
                type="button"
                className="mt-1 text-xs font-semibold text-brand-700 hover:underline"
                onClick={() => onChange({ ...value, pointsToRedeem: redeemable })}
              >
                Use maximum
              </button>
            </div>
          )}
          {redeemable === 0 && giftPoints > 0 && (
            <p className="mt-2 text-xs text-stone-500">Points can't be applied to this order total.</p>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Loader2, Lock, MapPin, Plus, Truck, Wallet } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { CancellationNotice } from '@/components/checkout/CancellationNotice';
import { FormatBadge } from '@/components/checkout/FormatBadge';
import { OrderTotals } from '@/components/checkout/OrderTotals';
import { PaymentSection } from '@/components/checkout/PaymentSection';
import {
  detailsFor,
  INITIAL_PAYMENT,
  paymentMethodOf,
  POINT_VALUE,
  validatePayment,
  type PaymentFormState,
} from '@/components/checkout/paymentState';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { useCheckoutSummary } from '@/hooks/useCheckoutSummary';
import { cn } from '@/lib/cn';
import { couponStore } from '@/lib/couponStore';
import { formatDate, formatPrice } from '@/lib/format';
import { addressApi, getErrorMessage, orderApi, paymentApi } from '@/services/api';
import type { Address, AddressInput, DeliverySpeed } from '@/types';

const FREE_SHIPPING_THRESHOLD = 35;
const STANDARD_SHIPPING = 4.99;
const EXPRESS_SURCHARGE = 9.99;
const NEW_ADDRESS = 'new';

const EMPTY_ADDRESS: AddressInput = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateAddress(a: AddressInput): Partial<Record<keyof AddressInput, string>> {
  const errors: Partial<Record<keyof AddressInput, string>> = {};
  (['fullName', 'phone', 'line1', 'city', 'state', 'postalCode'] as const).forEach((key) => {
    if (!a[key]?.trim()) errors[key] = 'Required';
  });
  return errors;
}

function StepCard({
  step,
  title,
  current,
  done,
  summary,
  onEdit,
  children,
}: {
  step: number;
  title: string;
  current: boolean;
  done: boolean;
  summary?: ReactNode;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="card p-5" aria-labelledby={`step-${step}`}>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold',
            done ? 'bg-emerald-600 text-white' : current ? 'bg-brand-700 text-white' : 'bg-paper-200 text-stone-500',
          )}
        >
          {done ? <Check className="h-4 w-4" /> : step}
        </span>
        <h2 id={`step-${step}`} className="flex-1 text-lg">{title}</h2>
        {done && !current && (
          <button type="button" className="text-sm font-semibold text-brand-700 hover:underline" onClick={onEdit}>
            Edit
          </button>
        )}
      </div>
      {current ? <div className="mt-4">{children}</div> : done && summary ? <div className="mt-2 pl-10 text-sm text-stone-600">{summary}</div> : null}
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  error,
  className,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <label className={cn('block', className)}>
      <span className="label">{label}</span>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} {...rest} />
      {error && <span className="mt-1 block text-xs text-red-600" role="alert">{error}</span>}
    </label>
  );
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isGuest, loading: authLoading, refreshUser } = useAuth();
  const { cart, loading: cartLoading, refresh: refreshCart } = useCart();

  const [step, setStep] = useState(1);
  const [doneSteps, setDoneSteps] = useState<number[]>([]);

  // Step 1: address
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [addressChoice, setAddressChoice] = useState<string>(NEW_ADDRESS);
  const [newAddress, setNewAddress] = useState<AddressInput>(EMPTY_ADDRESS);
  const [saveAddress, setSaveAddress] = useState(true);
  const [guestEmail, setGuestEmail] = useState('');
  const [showAddressErrors, setShowAddressErrors] = useState(false);

  // Step 2 & 3
  const [deliverySpeed, setDeliverySpeed] = useState<DeliverySpeed>('STANDARD');
  const [payment, setPayment] = useState<PaymentFormState>(INITIAL_PAYMENT);
  const [showPaymentErrors, setShowPaymentErrors] = useState(false);
  const [placing, setPlacing] = useState(false);
  const placed = useRef(false);

  const userId = user?.id;
  const hasItems = cart.items.length > 0;
  const [couponCode, setCouponCode] = useState<string | undefined>(() => couponStore.get() ?? undefined);
  const cartKey = cart.items.map((i) => `${i.bookId}:${i.quantity}`).join(',');

  const { summary, error: summaryError, loading: summaryLoading } = useCheckoutSummary(
    { couponCode, pointsToRedeem: payment.pointsToRedeem, deliverySpeed },
    cartKey,
    hasItems,
  );

  // Load saved addresses for registered users.
  useEffect(() => {
    if (authLoading || !userId) return;
    if (isGuest) {
      setAddresses([]);
      setAddressChoice(NEW_ADDRESS);
      setAddressesLoaded(true);
      return;
    }
    let cancelled = false;
    addressApi
      .list()
      .then((list) => {
        if (cancelled) return;
        setAddresses(list);
        setAddressChoice((list.find((a) => a.isDefault) ?? list[0])?.id ?? NEW_ADDRESS);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setAddressesLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, isGuest]);

  // Prefill the manual form from the profile.
  useEffect(() => {
    if (user && !user.isGuest) {
      setNewAddress((a) => ({ ...a, fullName: a.fullName || user.name, phone: a.phone || user.phone || '' }));
      setGuestEmail((e) => e || user.email || '');
    }
  }, [user]);

  const allDigital = cart.items.length > 0 && cart.items.every((i) => i.book.format === 'EBOOK');
  const standardCost = allDigital ? 0 : cart.subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING;
  const expressCost = allDigital ? 0 : standardCost + EXPRESS_SURCHARGE;

  const usingNewAddress = addressChoice === NEW_ADDRESS;
  const selectedAddress = addresses.find((a) => a.id === addressChoice);
  const addressErrors = useMemo(() => (usingNewAddress ? validateAddress(newAddress) : {}), [usingNewAddress, newAddress]);
  const emailError = isGuest && !EMAIL_RE.test(guestEmail) ? 'Enter a valid email for your receipt' : undefined;
  const addressValid = Object.keys(addressErrors).length === 0 && !emailError;

  const total = summary?.total ?? 0;
  const paymentErrors = validatePayment(payment, {
    total,
    walletBalance: user?.walletBalance ?? 0,
    giftPoints: user?.giftPoints ?? 0,
  });
  const paymentValid = Object.keys(paymentErrors).length === 0;

  const maxRedeemablePoints = summary
    ? Math.max(0, Math.floor(Math.round((summary.subtotal - summary.couponDiscount) * 100) / (POINT_VALUE * 100)))
    : 0;

  const completeStep = (n: number) => {
    setDoneSteps((d) => (d.includes(n) ? d : [...d, n]));
    setStep(n + 1);
  };

  const onContinueAddress = () => {
    if (!addressValid) {
      setShowAddressErrors(true);
      return;
    }
    completeStep(1);
  };

  const removeCoupon = () => {
    couponStore.clear();
    setCouponCode(undefined);
  };

  const onPlaceOrder = async () => {
    if (!summary || summaryError) return;
    if (!paymentValid) {
      setShowPaymentErrors(true);
      return;
    }
    setPlacing(true);
    try {
      let addressId: string | undefined = selectedAddress?.id;
      let shippingAddress: AddressInput | undefined;
      if (usingNewAddress) {
        const clean: AddressInput = { ...newAddress, line2: newAddress.line2?.trim() || undefined };
        if (!isGuest && saveAddress) {
          addressId = (await addressApi.create(clean)).id;
        } else {
          shippingAddress = clean;
        }
      }

      const method = paymentMethodOf(payment);
      // Simulated gateway authorisation, then place the order.
      await paymentApi.process(method, summary.total, detailsFor(payment));
      const order = await orderApi.create({
        addressId,
        shippingAddress,
        guestEmail: isGuest ? guestEmail.trim() : undefined,
        couponCode: summary.couponCode ?? undefined,
        pointsToRedeem: payment.pointsToRedeem || undefined,
        deliverySpeed,
        paymentMethod: method,
        paymentDetails: detailsFor(payment),
      });

      placed.current = true;
      couponStore.clear();
      await Promise.all([refreshCart(), refreshUser()]);
      navigate(`/order-confirmation/${order.id}`, { replace: true, state: { order } });
    } catch (err) {
      // The Axios interceptor already toasts API errors; surface anything else.
      if (!(err && typeof err === 'object' && 'isAxiosError' in err)) toast.error(getErrorMessage(err));
    } finally {
      setPlacing(false);
    }
  };

  if (authLoading || !addressesLoaded || (cartLoading && !hasItems)) {
    return (
      <div className="container-page flex justify-center py-24" role="status" aria-label="Loading checkout">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!hasItems && !placed.current) {
    return (
      <div className="container-page flex flex-col items-center gap-3 py-24 text-center">
        <h1 className="text-3xl">Nothing to check out</h1>
        <p className="text-stone-600">Your cart is empty.</p>
        <Link to="/books" className="btn-primary mt-2">Browse books</Link>
      </div>
    );
  }

  const set = (patch: Partial<AddressInput>) => setNewAddress((a) => ({ ...a, ...patch }));
  const addrErr = (k: keyof AddressInput) => (showAddressErrors ? addressErrors[k] : undefined);

  return (
    <div className="container-page py-8">
      <h1 className="mb-6 text-3xl">Checkout</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {/* ---------------------------------------------------- step 1 */}
          <StepCard
            step={1}
            title="Shipping address"
            current={step === 1}
            done={doneSteps.includes(1)}
            onEdit={() => setStep(1)}
            summary={
              <>
                <p className="font-medium text-stone-800">{(selectedAddress ?? newAddress).fullName}</p>
                <p>
                  {(selectedAddress ?? newAddress).line1}, {(selectedAddress ?? newAddress).city},{' '}
                  {(selectedAddress ?? newAddress).state} {(selectedAddress ?? newAddress).postalCode}
                </p>
                {isGuest && <p>Receipt to {guestEmail}</p>}
              </>
            }
          >
            <div className="space-y-4">
              {addresses.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Saved addresses">
                  {addresses.map((a) => (
                    <label
                      key={a.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm',
                        addressChoice === a.id ? 'border-brand-600 bg-brand-50' : 'border-stone-300 hover:border-brand-400',
                      )}
                    >
                      <input
                        type="radio"
                        name="address"
                        className="mt-1 accent-brand-700"
                        checked={addressChoice === a.id}
                        onChange={() => setAddressChoice(a.id)}
                      />
                      <span>
                        <span className="flex items-center gap-2 font-semibold text-stone-900">
                          <MapPin className="h-3.5 w-3.5" /> {a.label || a.fullName}
                          {a.isDefault && <span className="badge bg-paper-200 text-stone-600">Default</span>}
                        </span>
                        <span className="block text-stone-600">{a.fullName} · {a.phone}</span>
                        <span className="block text-stone-600">
                          {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.postalCode}
                        </span>
                      </span>
                    </label>
                  ))}
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-3 text-sm font-semibold',
                      usingNewAddress ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-stone-300 text-stone-700 hover:border-brand-400',
                    )}
                  >
                    <input
                      type="radio"
                      name="address"
                      className="accent-brand-700"
                      checked={usingNewAddress}
                      onChange={() => setAddressChoice(NEW_ADDRESS)}
                    />
                    <Plus className="h-4 w-4" /> Use a new address
                  </label>
                </div>
              )}

              {usingNewAddress && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Full name" value={newAddress.fullName} onChange={(v) => set({ fullName: v })} error={addrErr('fullName')} autoComplete="name" />
                  <Input label="Phone" value={newAddress.phone} onChange={(v) => set({ phone: v })} error={addrErr('phone')} autoComplete="tel" />
                  <Input label="Address line 1" className="sm:col-span-2" value={newAddress.line1} onChange={(v) => set({ line1: v })} error={addrErr('line1')} autoComplete="address-line1" />
                  <Input label="Address line 2 (optional)" className="sm:col-span-2" value={newAddress.line2 ?? ''} onChange={(v) => set({ line2: v })} autoComplete="address-line2" />
                  <Input label="City" value={newAddress.city} onChange={(v) => set({ city: v })} error={addrErr('city')} autoComplete="address-level2" />
                  <Input label="State" value={newAddress.state} onChange={(v) => set({ state: v })} error={addrErr('state')} autoComplete="address-level1" />
                  <Input label="Postal code" value={newAddress.postalCode} onChange={(v) => set({ postalCode: v })} error={addrErr('postalCode')} autoComplete="postal-code" />
                  <Input label="Country" value={newAddress.country ?? ''} onChange={(v) => set({ country: v })} autoComplete="country" />
                  {!isGuest && (
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <input type="checkbox" className="accent-brand-700" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                      Save this address to my address book
                    </label>
                  )}
                </div>
              )}

              {isGuest && (
                <Input
                  label="Email for order receipt"
                  type="email"
                  value={guestEmail}
                  onChange={setGuestEmail}
                  error={showAddressErrors ? emailError : undefined}
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              )}

              <button type="button" className="btn-primary" onClick={onContinueAddress}>
                Continue to delivery
              </button>
            </div>
          </StepCard>

          {/* ---------------------------------------------------- step 2 */}
          <StepCard
            step={2}
            title="Delivery option"
            current={step === 2}
            done={doneSteps.includes(2)}
            onEdit={() => setStep(2)}
            summary={
              <p>
                {deliverySpeed === 'EXPRESS' ? 'Express' : 'Standard'} delivery
                {summary ? ` · arrives by ${formatDate(summary.estimatedDelivery)}` : ''}
              </p>
            }
          >
            <div className="space-y-3" role="radiogroup" aria-label="Delivery speed">
              {([
                { id: 'STANDARD', label: 'Standard delivery', cost: standardCost, note: standardCost === 0 && !allDigital ? 'Free on orders over $35' : 'Arrives in the usual delivery window' },
                { id: 'EXPRESS', label: 'Express delivery', cost: expressCost, note: 'Arrives about 2 days sooner' },
              ] as const).map((opt) => (
                <label
                  key={opt.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-4 text-sm',
                    deliverySpeed === opt.id ? 'border-brand-600 bg-brand-50' : 'border-stone-300 hover:border-brand-400',
                  )}
                >
                  <input
                    type="radio"
                    name="delivery"
                    className="accent-brand-700"
                    checked={deliverySpeed === opt.id}
                    onChange={() => setDeliverySpeed(opt.id)}
                  />
                  <Truck className="h-5 w-5 text-brand-700" />
                  <span className="flex-1">
                    <span className="block font-semibold text-stone-900">{opt.label}</span>
                    <span className="block text-xs text-stone-500">{opt.note}</span>
                  </span>
                  <span className="font-semibold">{opt.cost === 0 ? 'Free' : formatPrice(opt.cost)}</span>
                </label>
              ))}
              {allDigital && (
                <p className="text-xs text-stone-500">Your order is all e-books, so no shipping is charged.</p>
              )}
              {summary && (
                <p className="text-sm text-stone-600">
                  Estimated delivery: <strong>{formatDate(summary.estimatedDelivery)}</strong>
                </p>
              )}
              <button type="button" className="btn-primary" onClick={() => completeStep(2)}>
                Continue to payment
              </button>
            </div>
          </StepCard>

          {/* ---------------------------------------------------- step 3 */}
          <StepCard step={3} title="Payment method" current={step === 3} done={false} onEdit={() => setStep(3)}>
            <div className="space-y-5">
              <PaymentSection
                value={payment}
                onChange={setPayment}
                errors={paymentErrors}
                showErrors={showPaymentErrors}
                total={total}
                walletBalance={user?.walletBalance ?? 0}
                giftPoints={user?.giftPoints ?? 0}
                maxRedeemablePoints={maxRedeemablePoints}
                isGuest={isGuest}
              />

              {summaryError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                  {summaryError}
                  {couponCode && (
                    <button type="button" className="ml-2 font-semibold underline" onClick={removeCoupon}>
                      Remove coupon {couponCode}
                    </button>
                  )}
                </div>
              )}

              <button
                type="button"
                className="btn-primary w-full py-3"
                disabled={placing || !summary || summaryLoading || Boolean(summaryError)}
                onClick={onPlaceOrder}
              >
                {placing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processing payment…</>
                ) : (
                  <><Lock className="h-4 w-4" /> Place order · {formatPrice(total)}</>
                )}
              </button>
              <p className="flex items-center justify-center gap-1 text-xs text-stone-500">
                <Wallet className="h-3.5 w-3.5" /> Simulated payment. No real charges are made.
              </p>
            </div>
          </StepCard>
        </div>

        {/* ---------------------------------------------------- sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg">Order overview</h2>
              <Link to="/cart" className="text-sm font-semibold text-brand-700 hover:underline">Edit cart</Link>
            </div>
            <ul className="mb-4 max-h-64 divide-y divide-paper-200 overflow-y-auto">
              {cart.items.map((line) => (
                <li key={line.id} className="flex gap-3 py-2">
                  {line.book.coverUrl ? (
                    <img src={line.book.coverUrl} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="h-14 w-10 shrink-0 rounded bg-paper-200" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-stone-900">{line.book.title}</p>
                    <p className="flex items-center gap-2 text-xs text-stone-500">
                      <FormatBadge format={line.book.format} /> Qty {line.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{formatPrice(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
            {summary ? (
              <div className={cn(summaryLoading && 'opacity-60 transition-opacity')}>
                <OrderTotals totals={summary} />
              </div>
            ) : (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-brand-600" /></div>
            )}
          </div>
          <CancellationNotice />
        </aside>
      </div>
    </div>
  );
}

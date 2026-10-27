import type { PaymentDetails, PaymentMethod } from '@/types';

export const POINT_VALUE = 0.01;

export type PaymentTab = 'CARD' | 'UPI' | 'WALLET' | 'GIFT_POINTS';

export interface PaymentFormState {
  tab: PaymentTab;
  /** Only used by the CARD tab. */
  cardType: 'CREDIT_CARD' | 'DEBIT_CARD';
  details: PaymentDetails;
  /** Gift points redeemed as a discount (any payment method). */
  pointsToRedeem: number;
}

export const INITIAL_PAYMENT: PaymentFormState = {
  tab: 'CARD',
  cardType: 'CREDIT_CARD',
  details: {},
  pointsToRedeem: 0,
};

/** Test card that the simulated gateway always approves. */
export const TEST_CARD = { cardNumber: '4242 4242 4242 4242', cardHolder: 'Demo Reader', expiry: '12/30', cvv: '123' };

export const UPI_RE = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9]{1,}$/;

export function paymentMethodOf(state: PaymentFormState): PaymentMethod {
  if (state.tab === 'CARD') return state.cardType;
  return state.tab;
}

/** Details relevant to the selected method only (so stray card data is never sent with a UPI payment). */
export function detailsFor(state: PaymentFormState): PaymentDetails {
  const d = state.details;
  if (state.tab === 'CARD') {
    return { cardNumber: d.cardNumber, cardHolder: d.cardHolder, expiry: d.expiry, cvv: d.cvv };
  }
  if (state.tab === 'UPI') return { upiId: d.upiId };
  return {};
}

export const pointsForAmount = (amount: number) => Math.round(amount / POINT_VALUE);

export type PaymentErrors = Partial<Record<keyof PaymentDetails | 'balance', string>>;

/** Client-side mirror of the server's payment checks so users get instant feedback. */
export function validatePayment(
  state: PaymentFormState,
  ctx: { total: number; walletBalance: number; giftPoints: number },
): PaymentErrors {
  const errors: PaymentErrors = {};
  const d = state.details;

  if (state.tab === 'CARD') {
    if (!/^\d{16}$/.test((d.cardNumber ?? '').replace(/[\s-]/g, ''))) errors.cardNumber = 'Enter a 16-digit card number';
    if (!d.cardHolder?.trim()) errors.cardHolder = 'Enter the name on the card';
    const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(d.expiry ?? '');
    if (!m) errors.expiry = 'Use MM/YY';
    else if (new Date(2000 + Number(m[2]), Number(m[1]), 1).getTime() <= Date.now()) errors.expiry = 'This card has expired';
    if (!/^\d{3,4}$/.test(d.cvv ?? '')) errors.cvv = '3 or 4 digits';
  } else if (state.tab === 'UPI') {
    if (!UPI_RE.test(d.upiId ?? '')) errors.upiId = 'Use the format name@bank';
  } else if (state.tab === 'WALLET') {
    if (ctx.walletBalance < ctx.total) errors.balance = 'Your wallet balance does not cover this order';
  } else if (state.tab === 'GIFT_POINTS') {
    if (ctx.giftPoints - state.pointsToRedeem < pointsForAmount(ctx.total)) {
      errors.balance = 'You do not have enough gift points to pay for this order';
    }
  }
  return errors;
}

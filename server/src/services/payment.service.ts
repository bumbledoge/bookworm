import { randomBytes } from 'node:crypto';
import { badRequest, forbidden, paymentRequired } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { AuthContext } from '../middleware/auth';
import { POINT_VALUE } from './pricing.service';

export const PAYMENT_METHODS = ['CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'WALLET', 'GIFT_POINTS'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const LABELS: Record<PaymentMethod, string> = {
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  UPI: 'UPI',
  WALLET: 'Wallet',
  GIFT_POINTS: 'Gift Points',
};

/** Methods that draw on a registered account's balances. */
const ACCOUNT_METHODS: readonly PaymentMethod[] = ['WALLET', 'GIFT_POINTS'];

/** Card number ending in this is always declined (documented test hook). */
const DECLINED_CARD_SUFFIX = '0002';
const UPI_RE = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9]{1,}$/;

export interface PaymentDetails {
  cardNumber?: string;
  cardHolder?: string;
  expiry?: string;
  cvv?: string;
  upiId?: string;
}

export interface Payer {
  isGuest: boolean;
  walletBalance: number;
  giftPoints: number;
}

export interface PaymentResult {
  status: 'AUTHORISED';
  reference: string;
  method: PaymentMethod;
  amount: number;
  processedAt: Date;
}

export async function loadPayer(auth: AuthContext | undefined): Promise<Payer> {
  if (!auth?.userId) return { isGuest: true, walletBalance: 0, giftPoints: 0 };
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { walletBalance: true, giftPoints: true },
  });
  return { isGuest: false, walletBalance: user?.walletBalance ?? 0, giftPoints: user?.giftPoints ?? 0 };
}

export function listPaymentMethods(payer: Payer) {
  return PAYMENT_METHODS.map((id) => ({
    id,
    label: LABELS[id],
    enabled: !(payer.isGuest && ACCOUNT_METHODS.includes(id)),
  }));
}

/** Gift points needed to cover `amount` (1 point = $0.01). */
export const pointsForAmount = (amount: number) => Math.round(amount / POINT_VALUE);

function validateDetails(method: PaymentMethod, d: PaymentDetails): string[] {
  const errors: string[] = [];
  if (method === 'CREDIT_CARD' || method === 'DEBIT_CARD') {
    const digits = (d.cardNumber ?? '').replace(/[\s-]/g, '');
    if (!/^\d{16}$/.test(digits)) errors.push('cardNumber must be 16 digits');
    if (!d.cardHolder?.trim()) errors.push('cardHolder is required');
    const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(d.expiry ?? '');
    if (!m) {
      errors.push('expiry must be in MM/YY format');
    } else {
      // A card is valid through the last day of its expiry month.
      const endOfMonth = new Date(2000 + Number(m[2]), Number(m[1]), 1);
      if (endOfMonth.getTime() <= Date.now()) errors.push('card has expired');
    }
    if (!/^\d{3,4}$/.test(d.cvv ?? '')) errors.push('cvv must be 3 or 4 digits');
  } else if (method === 'UPI') {
    if (!UPI_RE.test(d.upiId ?? '')) errors.push('upiId must look like name@bank');
  }
  return errors;
}

/**
 * Simulated gateway. Nothing is charged here; the caller is responsible for
 * actually debiting wallet / points when an order is placed.
 *
 * `payer.giftPoints` must already exclude points reserved for a redemption discount.
 */
export function authorisePayment(
  method: PaymentMethod,
  amount: number,
  details: PaymentDetails,
  payer: Payer
): PaymentResult {
  if (payer.isGuest && ACCOUNT_METHODS.includes(method)) {
    throw forbidden(`${LABELS[method]} is only available to registered users`);
  }

  const errors = validateDetails(method, details);
  if (errors.length > 0) throw badRequest('Invalid payment details', errors);

  if (method === 'CREDIT_CARD' || method === 'DEBIT_CARD') {
    if ((details.cardNumber ?? '').replace(/[\s-]/g, '').endsWith(DECLINED_CARD_SUFFIX)) {
      throw paymentRequired('Payment declined by the card issuer');
    }
  } else if (method === 'WALLET') {
    if (payer.walletBalance < amount) throw paymentRequired('Insufficient wallet balance');
  } else if (method === 'GIFT_POINTS') {
    if (payer.giftPoints < pointsForAmount(amount)) throw paymentRequired('Insufficient gift points');
  }

  return {
    status: 'AUTHORISED',
    reference: `SIM-${randomBytes(4).toString('hex').toUpperCase()}`,
    method,
    amount,
    processedAt: new Date(),
  };
}

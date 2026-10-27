import { Coupon } from '@prisma/client';
import { badRequest } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { round2 } from '../lib/validation';

// Pricing rules (documented in openapi.yaml):
//   total = subtotal - couponDiscount - pointsDiscount + tax + shipping
export const TAX_RATE = 0.08;
export const FREE_SHIPPING_THRESHOLD = 35;
export const STANDARD_SHIPPING = 4.99;
export const EXPRESS_SURCHARGE = 9.99;
export const POINT_VALUE = 0.01;

export type DeliverySpeed = 'STANDARD' | 'EXPRESS';
export const DELIVERY_SPEEDS: readonly DeliverySpeed[] = ['STANDARD', 'EXPRESS'];

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PricedLine {
  unitPrice: number;
  quantity: number;
  format: string;
  deliveryDays: number;
}

export interface SummaryInput {
  lines: PricedLine[];
  couponCode?: string;
  pointsToRedeem?: number;
  deliverySpeed?: DeliverySpeed;
  /** Gift points the caller owns. Pass 0 for guests. */
  availablePoints: number;
}

export interface Summary {
  subtotal: number;
  couponCode: string | null;
  couponDiscount: number;
  pointsRedeemed: number;
  pointsDiscount: number;
  tax: number;
  shipping: number;
  total: number;
  estimatedDelivery: Date;
}

export function serializeCoupon(c: Coupon) {
  return {
    code: c.code,
    description: c.description,
    discountType: c.discountType,
    discountValue: c.discountValue,
    minOrderAmount: c.minOrderAmount,
    maxDiscount: c.maxDiscount,
    expiresAt: c.expiresAt,
  };
}

export const normaliseCouponCode = (code: string) => code.trim().toUpperCase();

/** Discount a coupon gives on a subtotal (never more than the subtotal). */
export function couponDiscountFor(coupon: Coupon, subtotal: number): number {
  let discount = coupon.discountType === 'PERCENT' ? (subtotal * coupon.discountValue) / 100 : coupon.discountValue;
  if (coupon.maxDiscount !== null) discount = Math.min(discount, coupon.maxDiscount);
  return round2(Math.min(discount, subtotal));
}

/** Loads a coupon and verifies it can be used on `subtotal`; throws a 400 explaining why not. */
export async function evaluateCoupon(code: string, subtotal: number): Promise<{ coupon: Coupon; discount: number }> {
  const coupon = await prisma.coupon.findUnique({ where: { code: normaliseCouponCode(code) } });
  if (!coupon || !coupon.isActive) throw badRequest('Invalid coupon code');
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= Date.now()) throw badRequest('This coupon has expired');
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw badRequest('This coupon has reached its usage limit');
  }
  if (subtotal < coupon.minOrderAmount) {
    throw badRequest(`Add $${round2(coupon.minOrderAmount - subtotal).toFixed(2)} more to use this coupon (minimum order $${coupon.minOrderAmount.toFixed(2)})`);
  }
  return { coupon, discount: couponDiscountFor(coupon, subtotal) };
}

export function shippingFor(lines: PricedLine[], subtotal: number, speed: DeliverySpeed): number {
  // Nothing ships if the whole order is digital.
  if (lines.every((l) => l.format === 'EBOOK')) return 0;
  const base = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING;
  return round2(base + (speed === 'EXPRESS' ? EXPRESS_SURCHARGE : 0));
}

export function estimateDelivery(lines: PricedLine[], speed: DeliverySpeed, from = new Date()): Date {
  const slowest = Math.max(0, ...lines.map((l) => l.deliveryDays));
  const days = speed === 'EXPRESS' && slowest > 0 ? Math.max(1, slowest - 2) : slowest;
  return new Date(from.getTime() + days * DAY_MS);
}

/** Computes every figure shown in the order summary. Throws 400 for an empty cart or bad coupon / points. */
export async function calculateSummary(input: SummaryInput): Promise<Summary> {
  if (input.lines.length === 0) throw badRequest('Your cart is empty');
  const speed = input.deliverySpeed ?? 'STANDARD';
  const subtotal = round2(input.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0));

  let couponCode: string | null = null;
  let couponDiscount = 0;
  if (input.couponCode) {
    const result = await evaluateCoupon(input.couponCode, subtotal);
    couponCode = result.coupon.code;
    couponDiscount = result.discount;
  }

  const points = input.pointsToRedeem ?? 0;
  if (points > input.availablePoints) {
    throw badRequest(`You only have ${input.availablePoints} gift points available`);
  }
  const pointsDiscount = round2(points * POINT_VALUE);
  if (pointsDiscount > round2(subtotal - couponDiscount)) {
    throw badRequest('Gift points to redeem exceed the order value');
  }

  const discounted = round2(subtotal - couponDiscount - pointsDiscount);
  const tax = round2(discounted * TAX_RATE);
  const shipping = shippingFor(input.lines, subtotal, speed);
  return {
    subtotal,
    couponCode,
    couponDiscount,
    pointsRedeemed: points,
    pointsDiscount,
    tax,
    shipping,
    total: round2(discounted + tax + shipping),
    estimatedDelivery: estimateDelivery(input.lines, speed),
  };
}

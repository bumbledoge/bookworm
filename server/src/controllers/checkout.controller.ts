import { Request, Response } from 'express';
import { badRequest } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { getAuth } from '../middleware/auth';
import { loadCartItems, ownerFromAuth } from '../services/cart.service';
import {
  calculateSummary,
  DeliverySpeed,
  evaluateCoupon,
  serializeCoupon,
} from '../services/pricing.service';

export interface SummaryBody {
  couponCode?: string;
  pointsToRedeem?: number;
  deliverySpeed?: DeliverySpeed;
}
export interface CouponCodeBody {
  code: string;
}

/** Gift points the caller can spend. Guests have none. */
export async function availablePointsFor(userId: string | undefined): Promise<number> {
  if (!userId) return 0;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { giftPoints: true } });
  return user?.giftPoints ?? 0;
}

export async function listCoupons(_req: Request, res: Response) {
  const now = new Date();
  const coupons = await prisma.coupon.findMany({
    where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: { code: 'asc' },
  });
  // Hide coupons that have used up their limit.
  res.json(coupons.filter((c) => c.usageLimit === null || c.usedCount < c.usageLimit).map(serializeCoupon));
}

export async function validateCoupon(req: Request, res: Response) {
  const items = await loadCartItems(ownerFromAuth(getAuth(req)));
  if (items.length === 0) throw badRequest('Your cart is empty');
  const subtotal = items.reduce((s, i) => s + i.book.price * i.quantity, 0);

  const { coupon, discount } = await evaluateCoupon((req.body as CouponCodeBody).code, subtotal);
  res.json({ valid: true, coupon: serializeCoupon(coupon), discount });
}

export async function getCheckoutSummary(req: Request, res: Response) {
  const auth = getAuth(req);
  const body = req.body as SummaryBody;
  const items = await loadCartItems(ownerFromAuth(auth));

  const summary = await calculateSummary({
    lines: items.map((i) => ({
      unitPrice: i.book.price,
      quantity: i.quantity,
      format: i.book.format,
      deliveryDays: i.book.deliveryDays,
    })),
    couponCode: body.couponCode,
    pointsToRedeem: body.pointsToRedeem,
    deliverySpeed: body.deliverySpeed,
    availablePoints: await availablePointsFor(auth.userId),
  });
  res.json(summary);
}

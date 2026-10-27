import { Router } from 'express';
import {
  CouponCodeBody,
  getCheckoutSummary,
  listCoupons,
  SummaryBody,
  validateCoupon,
} from '../controllers/checkout.controller';
import { oneOf, optInt, optString, reqString } from '../lib/validation';
import { authenticateJwt } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { validateBody } from '../middleware/validate';
import { DELIVERY_SPEEDS } from '../services/pricing.service';

/** Shared by checkout summary and order placement. */
export function parsePricingOptions(b: Record<string, unknown>, e: string[]): SummaryBody {
  return {
    couponCode: optString(b, 'couponCode', e, { max: 40 }),
    pointsToRedeem: optInt(b, 'pointsToRedeem', e, { min: 0 }),
    deliverySpeed: oneOf(b, 'deliverySpeed', DELIVERY_SPEEDS, e),
  };
}

const parseSummary = validateBody<SummaryBody>(parsePricingOptions);
const parseCouponCode = validateBody<CouponCodeBody>((b, e) => ({ code: reqString(b, 'code', e, { max: 40 }) }));

export const checkoutRouter = Router();
checkoutRouter.post('/summary', authenticateJwt, parseSummary, asyncHandler(getCheckoutSummary));

export const couponRouter = Router();
couponRouter.get('/', asyncHandler(listCoupons));
couponRouter.post('/validate', authenticateJwt, parseCouponCode, asyncHandler(validateCoupon));

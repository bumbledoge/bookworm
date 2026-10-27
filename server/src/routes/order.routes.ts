import { Router } from 'express';
import {
  cancelOrder,
  CancelOrderBody,
  getOrder,
  getPaymentMethods,
  listOrders,
  placeOrder,
  processPayment,
  ProcessPaymentBody,
  reorder,
} from '../controllers/order.controller';
import { asObject, oneOf, optString, reqNumber, reqEmail } from '../lib/validation';
import { authenticateJwt, optionalAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { validateBody } from '../middleware/validate';
import { PaymentDetails, PAYMENT_METHODS } from '../services/payment.service';
import { PlaceOrderInput } from '../services/order.service';
import { parseAddressFields } from './auth.routes';
import { parsePricingOptions } from './checkout.routes';

function parsePaymentDetails(raw: unknown, errors: string[]): PaymentDetails {
  const d = asObject(raw);
  const str = (key: string) => optString(d, key, errors, { max: 64 });
  return { cardNumber: str('cardNumber'), cardHolder: str('cardHolder'), expiry: str('expiry'), cvv: str('cvv'), upiId: str('upiId') };
}

const parseProcessPayment = validateBody<ProcessPaymentBody>((b, e) => ({
  method: oneOf(b, 'method', PAYMENT_METHODS, e, { required: true }) as ProcessPaymentBody['method'],
  amount: reqNumber(b, 'amount', e, { min: 0.01 }),
  details: parsePaymentDetails(b.details, e),
}));

const parsePlaceOrder = validateBody<PlaceOrderInput>((b, e) => {
  const pricing = parsePricingOptions(b, e);
  const shippingAddress = b.shippingAddress === undefined ? undefined : parseAddressFields(asObject(b.shippingAddress), e);
  return {
    ...pricing,
    addressId: optString(b, 'addressId', e),
    shippingAddress,
    guestEmail: b.guestEmail === undefined ? undefined : reqEmail(b, 'guestEmail', e),
    paymentMethod: oneOf(b, 'paymentMethod', PAYMENT_METHODS, e, { required: true }) as PlaceOrderInput['paymentMethod'],
    paymentDetails: parsePaymentDetails(b.paymentDetails, e),
  };
});

const parseCancel = validateBody<CancelOrderBody>((b, e) => ({ reason: optString(b, 'reason', e, { max: 500 }) }));

export const paymentRouter = Router();
paymentRouter.get('/methods', optionalAuth, asyncHandler(getPaymentMethods));
paymentRouter.post('/process', authenticateJwt, parseProcessPayment, asyncHandler(processPayment));

export const orderRouter = Router();
orderRouter.use(authenticateJwt);
orderRouter.get('/', asyncHandler(listOrders));
orderRouter.post('/', parsePlaceOrder, asyncHandler(placeOrder));
orderRouter.get('/:orderId', asyncHandler(getOrder));
orderRouter.post('/:orderId/cancel', parseCancel, asyncHandler(cancelOrder));
orderRouter.post('/:orderId/reorder', asyncHandler(reorder));

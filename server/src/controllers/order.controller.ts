import { Request, Response } from 'express';
import { badRequest } from '../lib/errors';
import { parsePagination, queryString } from '../lib/validation';
import { getAuth } from '../middleware/auth';
import * as orders from '../services/order.service';
import { authorisePayment, listPaymentMethods, loadPayer, PaymentDetails, PaymentMethod } from '../services/payment.service';

export interface ProcessPaymentBody {
  method: PaymentMethod;
  amount: number;
  details: PaymentDetails;
}
export interface CancelOrderBody {
  reason?: string;
}

const ORDER_TABS = ['ALL', 'ACTIVE', 'DELIVERED', 'CANCELLED'];

// ------------------------------------------------------------------- payments

export async function getPaymentMethods(req: Request, res: Response) {
  const payer = await loadPayer(req.auth);
  res.json({ methods: listPaymentMethods(payer), walletBalance: payer.walletBalance, giftPoints: payer.giftPoints });
}

/** Standalone gateway simulation; does not touch balances or create an order. */
export async function processPayment(req: Request, res: Response) {
  const body = req.body as ProcessPaymentBody;
  const payer = await loadPayer(req.auth);
  res.json(authorisePayment(body.method, body.amount, body.details, payer));
}

// --------------------------------------------------------------------- orders

export async function placeOrder(req: Request, res: Response) {
  res.status(201).json(await orders.placeOrder(getAuth(req), req.body as orders.PlaceOrderInput));
}

export async function listOrders(req: Request, res: Response) {
  const status = queryString(req.query.status)?.toUpperCase();
  if (status && !ORDER_TABS.includes(status)) {
    throw badRequest('Invalid query parameters', [`status must be one of: ${ORDER_TABS.join(', ')}`]);
  }
  const { page, pageSize, skip } = parsePagination(req.query);
  const { total, items } = await orders.listOrders(getAuth(req), { status, skip, take: pageSize });
  res.json({ items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}

export async function getOrder(req: Request, res: Response) {
  res.json(await orders.getOrder(getAuth(req), req.params.orderId));
}

export async function cancelOrder(req: Request, res: Response) {
  res.json(await orders.cancelOrder(getAuth(req), req.params.orderId, (req.body as CancelOrderBody).reason));
}

export async function reorder(req: Request, res: Response) {
  res.json(await orders.reorder(getAuth(req), req.params.orderId));
}

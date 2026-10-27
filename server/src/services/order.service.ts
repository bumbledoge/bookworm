import { Prisma } from '@prisma/client';
import { AuthContext } from '../middleware/auth';
import { badRequest, conflict, forbidden, notFound, paymentRequired } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { round2 } from '../lib/validation';
import { MAX_LINE_QUANTITY, ownerFromAuth, loadCartItems, serializeCart } from './cart.service';
import { authorisePayment, loadPayer, PaymentDetails, PaymentMethod, pointsForAmount } from './payment.service';
import { calculateSummary, DeliverySpeed } from './pricing.service';

export const CANCELLATION_WINDOW_HOURS = 48;
const HOUR_MS = 60 * 60 * 1000;

/** Statuses from which a customer may still cancel (provided the window is open). */
const CANCELLABLE_STATUSES = ['PLACED', 'PROCESSING'];
const ACTIVE_STATUSES = ['PLACED', 'PROCESSING', 'SHIPPED'];
const TRACKING_FLOW = [
  { status: 'PLACED', label: 'Order placed' },
  { status: 'PROCESSING', label: 'Processing' },
  { status: 'SHIPPED', label: 'Shipped' },
  { status: 'DELIVERED', label: 'Delivered' },
];

export interface ShippingAddressInput {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}

export interface PlaceOrderInput {
  addressId?: string;
  shippingAddress?: ShippingAddressInput;
  guestEmail?: string;
  couponCode?: string;
  pointsToRedeem?: number;
  deliverySpeed?: DeliverySpeed;
  paymentMethod: PaymentMethod;
  paymentDetails?: PaymentDetails;
}

const orderInclude = {
  items: { include: { book: { select: { coverUrl: true } } } },
} satisfies Prisma.OrderInclude;
type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

// ------------------------------------------------------------------ helpers

export function canCancel(order: { status: string; cancellableUntil: Date }, now = new Date()): boolean {
  return CANCELLABLE_STATUSES.includes(order.status) && now.getTime() < order.cancellableUntil.getTime();
}

function buildTracking(order: OrderRow) {
  if (order.status === 'CANCELLED') {
    return [
      { status: 'PLACED', label: 'Order placed', completed: true, timestamp: order.placedAt },
      { status: 'CANCELLED', label: 'Cancelled', completed: true, timestamp: order.cancelledAt },
    ];
  }
  const reached = TRACKING_FLOW.findIndex((s) => s.status === order.status);
  return TRACKING_FLOW.map((step, i) => ({
    ...step,
    completed: i <= reached,
    timestamp: i === 0 ? order.placedAt : null,
  }));
}

export function serializeOrder(o: OrderRow) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    items: o.items.map((i) => ({
      id: i.id,
      bookId: i.bookId,
      title: i.title,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: round2(i.unitPrice * i.quantity),
      coverUrl: i.book.coverUrl,
    })),
    subtotal: o.subtotal,
    discount: o.discount,
    couponCode: o.couponCode,
    pointsRedeemed: o.pointsRedeemed,
    tax: o.tax,
    shipping: o.shipping,
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    paymentReference: o.paymentReference,
    shippingAddress: {
      fullName: o.shipFullName,
      phone: o.shipPhone,
      line1: o.shipLine1,
      line2: o.shipLine2,
      city: o.shipCity,
      state: o.shipState,
      postalCode: o.shipPostalCode,
      country: o.shipCountry,
    },
    estimatedDelivery: o.estimatedDelivery,
    placedAt: o.placedAt,
    cancellableUntil: o.cancellableUntil,
    canCancel: canCancel(o),
    cancelledAt: o.cancelledAt,
    cancelReason: o.cancelReason,
    tracking: buildTracking(o),
  };
}

/** Looks an order up by id or order number, scoped to its owner. Other users' orders are reported as 404. */
async function findOwnedOrder(userId: string, idOrNumber: string) {
  const order = await prisma.order.findFirst({
    where: { userId, OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }] },
    include: orderInclude,
  });
  if (!order) throw notFound('Order not found');
  return order;
}

function requireUser(auth: AuthContext): string {
  if (!auth.userId) throw forbidden('Order history is only available to registered users');
  return auth.userId;
}

async function resolveShipping(auth: AuthContext, input: PlaceOrderInput): Promise<ShippingAddressInput> {
  if (input.addressId) {
    if (!auth.userId) throw badRequest('Guests must provide a shippingAddress');
    const saved = await prisma.address.findFirst({ where: { id: input.addressId, userId: auth.userId } });
    if (!saved) throw notFound('Address not found');
    return saved;
  }
  if (!input.shippingAddress) throw badRequest('Provide addressId or shippingAddress');
  return input.shippingAddress;
}

/** Sequential, human-friendly order numbers: BW-100001, BW-100002, ... */
async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const last = await tx.order.findFirst({ orderBy: { orderNumber: 'desc' }, select: { orderNumber: true } });
  const lastSeq = last ? Number(last.orderNumber.replace('BW-', '')) : 100000;
  return `BW-${(Number.isFinite(lastSeq) ? lastSeq : 100000) + 1}`;
}

// ---------------------------------------------------------------- place order

export async function placeOrder(auth: AuthContext, input: PlaceOrderInput) {
  if (!auth.userId && !input.guestEmail) throw badRequest('guestEmail is required for guest checkout');

  const items = await loadCartItems(ownerFromAuth(auth));
  const address = await resolveShipping(auth, input);
  const payer = await loadPayer(auth);

  const summary = await calculateSummary({
    lines: items.map((i) => ({
      unitPrice: i.book.price,
      quantity: i.quantity,
      format: i.book.format,
      deliveryDays: i.book.deliveryDays,
    })),
    couponCode: input.couponCode,
    pointsToRedeem: input.pointsToRedeem,
    deliverySpeed: input.deliverySpeed,
    availablePoints: payer.giftPoints,
  });

  // Points redeemed as a discount are spent first; only the rest can pay for the order.
  const payment = authorisePayment(
    input.paymentMethod,
    summary.total,
    input.paymentDetails ?? {},
    { ...payer, giftPoints: payer.giftPoints - summary.pointsRedeemed }
  );

  const pointsSpent = summary.pointsRedeemed + (input.paymentMethod === 'GIFT_POINTS' ? pointsForAmount(summary.total) : 0);
  const walletSpent = input.paymentMethod === 'WALLET' ? summary.total : 0;
  const placedAt = new Date();

  const order = await prisma.$transaction(async (tx) => {
    // Conditional decrements make stock checks race-safe: they fail if another order got there first.
    for (const item of items) {
      const { count } = await tx.book.updateMany({
        where: { id: item.bookId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity }, totalSales: { increment: item.quantity } },
      });
      if (count === 0) throw conflict(`"${item.book.title}" no longer has enough stock`);
    }

    if (auth.userId && (pointsSpent > 0 || walletSpent > 0)) {
      const { count } = await tx.user.updateMany({
        where: { id: auth.userId, giftPoints: { gte: pointsSpent }, walletBalance: { gte: walletSpent } },
        data: { giftPoints: { decrement: pointsSpent }, walletBalance: { decrement: walletSpent } },
      });
      if (count === 0) throw paymentRequired('Insufficient wallet balance or gift points');
    }

    if (summary.couponCode) {
      await tx.coupon.update({ where: { code: summary.couponCode }, data: { usedCount: { increment: 1 } } });
    }

    const created = await tx.order.create({
      data: {
        orderNumber: await nextOrderNumber(tx),
        userId: auth.userId,
        guestEmail: auth.userId ? null : input.guestEmail,
        status: 'PLACED',
        subtotal: summary.subtotal,
        tax: summary.tax,
        shipping: summary.shipping,
        discount: round2(summary.couponDiscount + summary.pointsDiscount),
        total: summary.total,
        couponCode: summary.couponCode,
        pointsRedeemed: summary.pointsRedeemed,
        paymentMethod: input.paymentMethod,
        paymentStatus: 'PAID',
        paymentReference: payment.reference,
        shipFullName: address.fullName,
        shipPhone: address.phone,
        shipLine1: address.line1,
        shipLine2: address.line2 ?? null,
        shipCity: address.city,
        shipState: address.state,
        shipPostalCode: address.postalCode,
        shipCountry: address.country ?? 'US',
        estimatedDelivery: summary.estimatedDelivery,
        placedAt,
        cancellableUntil: new Date(placedAt.getTime() + CANCELLATION_WINDOW_HOURS * HOUR_MS),
        items: {
          create: items.map((i) => ({
            bookId: i.bookId,
            title: i.book.title,
            unitPrice: i.book.price,
            quantity: i.quantity,
          })),
        },
      },
      include: orderInclude,
    });

    await tx.cartItem.deleteMany({ where: ownerFromAuth(auth) });
    return created;
  });

  return serializeOrder(order);
}

// ------------------------------------------------------------- history / view

export async function listOrders(auth: AuthContext, opts: { status?: string; skip: number; take: number }) {
  const userId = requireUser(auth);
  const status = opts.status?.toUpperCase();
  const where: Prisma.OrderWhereInput = { userId };
  if (status === 'ACTIVE') where.status = { in: ACTIVE_STATUSES };
  else if (status === 'DELIVERED' || status === 'CANCELLED') where.status = status;

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: [{ placedAt: 'desc' }, { id: 'asc' }],
      skip: opts.skip,
      take: opts.take,
    }),
  ]);
  return { total, items: orders.map(serializeOrder) };
}

export async function getOrder(auth: AuthContext, idOrNumber: string) {
  return serializeOrder(await findOwnedOrder(requireUser(auth), idOrNumber));
}

// --------------------------------------------------------------------- cancel

/**
 * Cancels an order inside its 48-hour window: marks it CANCELLED, simulates the
 * refund (payment -> REFUNDED, wallet / gift points credited back), restocks
 * the books and releases the coupon use.
 */
export async function cancelOrder(auth: AuthContext, idOrNumber: string, reason?: string) {
  const userId = requireUser(auth);
  const order = await findOwnedOrder(userId, idOrNumber);

  if (order.status === 'CANCELLED') throw conflict('This order has already been cancelled');
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw conflict(`An order that is ${order.status.toLowerCase()} can no longer be cancelled`);
  }
  if (!canCancel(order)) {
    throw conflict('The 48-hour cancellation window for this order has expired');
  }

  const refundPoints = order.pointsRedeemed + (order.paymentMethod === 'GIFT_POINTS' ? pointsForAmount(order.total) : 0);
  const refundWallet = order.paymentMethod === 'WALLET' ? order.total : 0;

  await prisma.$transaction(async (tx) => {
    // Guards against two concurrent cancellations both refunding.
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: { in: CANCELLABLE_STATUSES } },
      data: { status: 'CANCELLED', paymentStatus: 'REFUNDED', cancelledAt: new Date(), cancelReason: reason ?? null },
    });
    if (count === 0) throw conflict('This order can no longer be cancelled');

    for (const item of order.items) {
      await tx.book.update({
        where: { id: item.bookId },
        data: { stock: { increment: item.quantity }, totalSales: { decrement: item.quantity } },
      });
    }
    if (refundPoints > 0 || refundWallet > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { giftPoints: { increment: refundPoints }, walletBalance: { increment: refundWallet } },
      });
    }
    if (order.couponCode) {
      await tx.coupon.updateMany({ where: { code: order.couponCode, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
    }
  });

  return serializeOrder(await findOwnedOrder(userId, order.id));
}

// ------------------------------------------------------------- Buy It Again

/**
 * Copies a previous order's items into the user's current cart. Titles that are
 * out of stock are skipped (and reported); quantities are capped at stock and
 * the per-title limit.
 */
export async function reorder(auth: AuthContext, idOrNumber: string) {
  const userId = requireUser(auth);
  const order = await findOwnedOrder(userId, idOrNumber);
  const skipped: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      const book = await tx.book.findUnique({ where: { id: item.bookId } });
      if (!book || book.stock <= 0) {
        skipped.push(item.title);
        continue;
      }
      const existing = await tx.cartItem.findUnique({ where: { userId_bookId: { userId, bookId: item.bookId } } });
      const quantity = Math.min((existing?.quantity ?? 0) + item.quantity, MAX_LINE_QUANTITY, book.stock);
      if (existing) {
        await tx.cartItem.update({ where: { id: existing.id }, data: { quantity } });
      } else {
        await tx.cartItem.create({ data: { userId, bookId: item.bookId, quantity } });
      }
    }
  });

  return { cart: serializeCart(await loadCartItems({ userId })), skipped };
}

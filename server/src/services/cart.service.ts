import { Prisma } from '@prisma/client';
import { AuthContext } from '../middleware/auth';
import { badRequest, conflict, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { round2 } from '../lib/validation';
import { bookInclude, serializeBook } from './book.serializer';

export const MAX_LINE_QUANTITY = 20;

/** A cart belongs to exactly one registered user or one guest session. */
export type CartOwner = { userId: string; guestId?: undefined } | { guestId: string; userId?: undefined };

export function ownerFromAuth(auth: AuthContext): CartOwner {
  if (auth.userId) return { userId: auth.userId };
  if (auth.guestId) return { guestId: auth.guestId };
  throw badRequest('Unable to determine cart owner');
}

const cartItemInclude = { book: { include: bookInclude } } satisfies Prisma.CartItemInclude;
export type CartItemRow = Prisma.CartItemGetPayload<{ include: typeof cartItemInclude }>;

export function cartItemKey(owner: CartOwner, bookId: string): Prisma.CartItemWhereUniqueInput {
  return owner.userId !== undefined
    ? { userId_bookId: { userId: owner.userId, bookId } }
    : { guestId_bookId: { guestId: owner.guestId, bookId } };
}

export function loadCartItems(owner: CartOwner): Promise<CartItemRow[]> {
  return prisma.cartItem.findMany({ where: owner, include: cartItemInclude, orderBy: { createdAt: 'asc' } });
}

export function serializeCart(items: CartItemRow[]) {
  const lines = items.map((i) => ({
    id: i.id,
    bookId: i.bookId,
    quantity: i.quantity,
    lineTotal: round2(i.book.price * i.quantity),
    book: serializeBook(i.book),
  }));
  return {
    items: lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: round2(lines.reduce((s, l) => s + l.lineTotal, 0)),
  };
}

export async function getCart(owner: CartOwner) {
  return serializeCart(await loadCartItems(owner));
}

function assertQuantity(book: { stock: number; title: string }, quantity: number) {
  if (quantity > MAX_LINE_QUANTITY) {
    throw conflict(`You can order at most ${MAX_LINE_QUANTITY} copies of a title`);
  }
  if (quantity > book.stock) {
    throw conflict(book.stock > 0 ? `Only ${book.stock} copies of "${book.title}" are available` : `"${book.title}" is out of stock`);
  }
}

/** Adds to an existing line's quantity, or creates the line. */
export async function addToCart(owner: CartOwner, bookId: string, quantity: number) {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) throw notFound('Book not found');

  const existing = await prisma.cartItem.findUnique({ where: cartItemKey(owner, bookId) });
  const next = (existing?.quantity ?? 0) + quantity;
  assertQuantity(book, next);

  if (existing) {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: next } });
  } else {
    await prisma.cartItem.create({ data: { ...owner, bookId, quantity } });
  }
}

/** Sets an absolute quantity; 0 removes the line. */
export async function setCartQuantity(owner: CartOwner, bookId: string, quantity: number) {
  const existing = await prisma.cartItem.findUnique({ where: cartItemKey(owner, bookId), include: { book: true } });
  if (!existing) throw notFound('Item not in cart');

  if (quantity === 0) {
    await prisma.cartItem.delete({ where: { id: existing.id } });
    return;
  }
  assertQuantity(existing.book, quantity);
  await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity } });
}

export async function removeFromCart(owner: CartOwner, bookId: string) {
  const existing = await prisma.cartItem.findUnique({ where: cartItemKey(owner, bookId) });
  if (!existing) throw notFound('Item not in cart');
  await prisma.cartItem.delete({ where: { id: existing.id } });
}

export async function clearCart(owner: CartOwner) {
  await prisma.cartItem.deleteMany({ where: owner });
}

/**
 * Moves a guest's cart rows into a registered user's cart.
 * Quantities are summed and capped by `MAX_LINE_QUANTITY` and available stock.
 */
export async function mergeGuestCart(guestId: string, userId: string): Promise<void> {
  const guestItems = await prisma.cartItem.findMany({ where: { guestId }, include: { book: true } });
  if (guestItems.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const item of guestItems) {
      const existing = await tx.cartItem.findUnique({ where: { userId_bookId: { userId, bookId: item.bookId } } });
      const wanted = (existing?.quantity ?? 0) + item.quantity;
      const quantity = Math.min(wanted, MAX_LINE_QUANTITY, Math.max(item.book.stock, 1));
      if (existing) {
        await tx.cartItem.update({ where: { id: existing.id }, data: { quantity } });
      } else {
        await tx.cartItem.create({ data: { userId, bookId: item.bookId, quantity } });
      }
    }
    await tx.cartItem.deleteMany({ where: { guestId } });
  });
}

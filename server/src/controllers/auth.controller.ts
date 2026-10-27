import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { conflict, notFound, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/token';
import { getAuth, getUserId } from '../middleware/auth';
import { mergeGuestCart } from '../services/cart.service';
import { serializeAddress, serializeGuest, serializeUser } from '../services/serializers';

export interface RegisterBody {
  email: string;
  password: string;
  name: string;
  phone?: string;
}
export interface LoginBody {
  email: string;
  password: string;
}
export interface ProfileBody {
  name?: string;
  phone?: string;
}
export interface AddressBody {
  label?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
}

export function createGuestSession(_req: Request, res: Response) {
  const guestId = `guest_${randomUUID()}`;
  const token = signToken({ sub: guestId, role: 'GUEST', guest: true });
  res.status(201).json({ token, user: serializeGuest(guestId) });
}

export async function register(req: Request, res: Response) {
  const body = req.body as RegisterBody;
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw conflict('An account with this email already exists');

  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash: await bcrypt.hash(body.password, 10),
      name: body.name,
      phone: body.phone,
      role: 'CUSTOMER',
    },
  });
  // A guest who signs up keeps the items they already added.
  if (req.auth?.guestId) await mergeGuestCart(req.auth.guestId, user.id);

  res.status(201).json({ token: signToken({ sub: user.id, role: 'CUSTOMER' }), user: serializeUser(user) });
}

export async function login(req: Request, res: Response) {
  const body = req.body as LoginBody;
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  // Same message for unknown email and wrong password to avoid account enumeration.
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    throw unauthorized('Invalid email or password');
  }
  if (req.auth?.guestId) await mergeGuestCart(req.auth.guestId, user.id);

  res.json({ token: signToken({ sub: user.id, role: user.role as 'CUSTOMER' | 'ADMIN' }), user: serializeUser(user) });
}

export async function getProfile(req: Request, res: Response) {
  const auth = getAuth(req);
  if (auth.guestId) {
    res.json(serializeGuest(auth.guestId));
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: getUserId(req) } });
  if (!user) throw unauthorized('Account no longer exists');
  res.json(serializeUser(user));
}

export async function updateProfile(req: Request, res: Response) {
  const body = req.body as ProfileBody;
  const user = await prisma.user.update({
    where: { id: getUserId(req) },
    data: { name: body.name, phone: body.phone },
  });
  res.json(serializeUser(user));
}

// ------------------------------------------------------------------ addresses

export async function listAddresses(req: Request, res: Response) {
  const addresses = await prisma.address.findMany({
    where: { userId: getUserId(req) },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  res.json(addresses.map(serializeAddress));
}

export async function createAddress(req: Request, res: Response) {
  const userId = getUserId(req);
  const body = req.body as AddressBody;

  const address = await prisma.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });
    // The first address is always the default.
    const isDefault = count === 0 || body.isDefault === true;
    if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.address.create({ data: { ...body, userId, isDefault } });
  });
  res.status(201).json(serializeAddress(address));
}

export async function updateAddress(req: Request, res: Response) {
  const userId = getUserId(req);
  const body = req.body as AddressBody;

  const existing = await prisma.address.findFirst({ where: { id: req.params.addressId, userId } });
  if (!existing) throw notFound('Address not found');

  const address = await prisma.$transaction(async (tx) => {
    // A default address can't be un-defaulted directly (that would leave none);
    // make another address the default instead.
    const isDefault = existing.isDefault || body.isDefault === true;
    if (isDefault) await tx.address.updateMany({ where: { userId, NOT: { id: existing.id } }, data: { isDefault: false } });
    return tx.address.update({
      where: { id: existing.id },
      data: { ...body, line2: body.line2 ?? null, isDefault },
    });
  });
  res.json(serializeAddress(address));
}

export async function deleteAddress(req: Request, res: Response) {
  const userId = getUserId(req);
  const existing = await prisma.address.findFirst({ where: { id: req.params.addressId, userId } });
  if (!existing) throw notFound('Address not found');

  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { id: existing.id } });
    if (existing.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  res.status(204).end();
}

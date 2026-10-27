import { Address, User } from '@prisma/client';
import { Role } from '../lib/token';

export function serializeUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role as Role,
    giftPoints: u.giftPoints,
    walletBalance: u.walletBalance,
    isGuest: false,
  };
}

export function serializeGuest(guestId: string) {
  return {
    id: guestId,
    email: null,
    name: 'Guest',
    phone: null,
    role: 'GUEST' as Role,
    giftPoints: 0,
    walletBalance: 0,
    isGuest: true,
  };
}

export function serializeAddress(a: Address) {
  return {
    id: a.id,
    label: a.label,
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    country: a.country,
    isDefault: a.isDefault,
  };
}

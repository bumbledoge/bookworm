import { Router } from 'express';
import {
  AddressBody,
  createAddress,
  createGuestSession,
  deleteAddress,
  getProfile,
  listAddresses,
  login,
  LoginBody,
  ProfileBody,
  register,
  RegisterBody,
  updateAddress,
  updateProfile,
} from '../controllers/auth.controller';
import { authenticateJwt, optionalAuth, requireRegistered } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { validateBody } from '../middleware/validate';
import { optBool, optString, reqEmail, reqString } from '../lib/validation';

const parseRegister = validateBody<RegisterBody>((b, e) => ({
  email: reqEmail(b, 'email', e),
  password: reqString(b, 'password', e, { min: 8, max: 128 }),
  name: reqString(b, 'name', e, { max: 100 }),
  phone: optString(b, 'phone', e, { max: 30 }),
}));

const parseLogin = validateBody<LoginBody>((b, e) => ({
  email: reqEmail(b, 'email', e),
  // Not trimmed/length-checked beyond presence: passwords may legitimately contain spaces.
  password: typeof b.password === 'string' && b.password !== '' ? b.password : (e.push('password is required'), ''),
}));

const parseProfile = validateBody<ProfileBody>((b, e) => {
  const name = optString(b, 'name', e, { max: 100 });
  const phone = optString(b, 'phone', e, { max: 30 });
  if (name === undefined && phone === undefined) e.push('Provide at least one of: name, phone');
  return { name, phone };
});

/** Shared with order placement, which validates a nested `shippingAddress`. */
export function parseAddressFields(b: Record<string, unknown>, e: string[]): AddressBody {
  return {
    label: optString(b, 'label', e, { max: 40 }),
    fullName: reqString(b, 'fullName', e, { max: 100 }),
    phone: reqString(b, 'phone', e, { max: 30 }),
    line1: reqString(b, 'line1', e, { max: 150 }),
    line2: optString(b, 'line2', e, { max: 150 }),
    city: reqString(b, 'city', e, { max: 80 }),
    state: reqString(b, 'state', e, { max: 80 }),
    postalCode: reqString(b, 'postalCode', e, { max: 20 }),
    country: optString(b, 'country', e, { max: 60 }),
    isDefault: optBool(b, 'isDefault', e),
  };
}

export const parseAddress = validateBody<AddressBody>(parseAddressFields);

export const authRouter = Router();

authRouter.post('/guest', createGuestSession);
authRouter.post('/register', optionalAuth, parseRegister, asyncHandler(register));
authRouter.post('/login', optionalAuth, parseLogin, asyncHandler(login));

authRouter.get('/me', authenticateJwt, asyncHandler(getProfile));
authRouter.put('/me', authenticateJwt, requireRegistered, parseProfile, asyncHandler(updateProfile));

authRouter.get('/addresses', authenticateJwt, requireRegistered, asyncHandler(listAddresses));
authRouter.post('/addresses', authenticateJwt, requireRegistered, parseAddress, asyncHandler(createAddress));
authRouter.put('/addresses/:addressId', authenticateJwt, requireRegistered, parseAddress, asyncHandler(updateAddress));
authRouter.delete('/addresses/:addressId', authenticateJwt, requireRegistered, asyncHandler(deleteAddress));

import { Router } from 'express';
import {
  addCartItem,
  AddCartItemBody,
  emptyCart,
  removeCartItem,
  updateCartItem,
  UpdateCartItemBody,
  viewCart,
} from '../controllers/cart.controller';
import { reqInt, reqString } from '../lib/validation';
import { authenticateJwt } from '../middleware/auth';
import { MAX_LINE_QUANTITY } from '../services/cart.service';
import { asyncHandler } from '../middleware/error';
import { validateBody } from '../middleware/validate';

const parseAdd = validateBody<AddCartItemBody>((b, e) => ({
  bookId: reqString(b, 'bookId', e),
  quantity: b.quantity === undefined ? 1 : reqInt(b, 'quantity', e, { min: 1, max: MAX_LINE_QUANTITY }),
}));

const parseUpdate = validateBody<UpdateCartItemBody>((b, e) => ({
  quantity: reqInt(b, 'quantity', e, { min: 0, max: MAX_LINE_QUANTITY }),
}));

// Guests and registered users both use the cart.
export const cartRouter = Router();
cartRouter.use(authenticateJwt);
cartRouter.get('/', asyncHandler(viewCart));
cartRouter.delete('/', asyncHandler(emptyCart));
cartRouter.post('/items', parseAdd, asyncHandler(addCartItem));
cartRouter.put('/items/:bookId', parseUpdate, asyncHandler(updateCartItem));
cartRouter.delete('/items/:bookId', asyncHandler(removeCartItem));

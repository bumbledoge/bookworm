import { Request, Response } from 'express';
import { getAuth } from '../middleware/auth';
import {
  addToCart,
  clearCart,
  getCart,
  ownerFromAuth,
  removeFromCart,
  setCartQuantity,
} from '../services/cart.service';

export interface AddCartItemBody {
  bookId: string;
  quantity: number;
}
export interface UpdateCartItemBody {
  quantity: number;
}

const ownerOf = (req: Request) => ownerFromAuth(getAuth(req));

export async function viewCart(req: Request, res: Response) {
  res.json(await getCart(ownerOf(req)));
}

export async function addCartItem(req: Request, res: Response) {
  const owner = ownerOf(req);
  const { bookId, quantity } = req.body as AddCartItemBody;
  await addToCart(owner, bookId, quantity);
  res.json(await getCart(owner));
}

export async function updateCartItem(req: Request, res: Response) {
  const owner = ownerOf(req);
  await setCartQuantity(owner, req.params.bookId, (req.body as UpdateCartItemBody).quantity);
  res.json(await getCart(owner));
}

export async function removeCartItem(req: Request, res: Response) {
  const owner = ownerOf(req);
  await removeFromCart(owner, req.params.bookId);
  res.json(await getCart(owner));
}

export async function emptyCart(req: Request, res: Response) {
  await clearCart(ownerOf(req));
  res.status(204).end();
}

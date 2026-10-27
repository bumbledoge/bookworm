const KEY = 'bookworm.coupon';

/** Keeps the applied promo code between the cart and checkout pages. */
export const couponStore = {
  get(): string | null {
    return sessionStorage.getItem(KEY);
  },
  set(code: string) {
    sessionStorage.setItem(KEY, code);
  },
  clear() {
    sessionStorage.removeItem(KEY);
  },
};

import axios, { AxiosError } from 'axios';
import { toastBus } from '@/lib/toastBus';
import type {
  Address,
  AddressInput,
  ApiErrorBody,
  AuthorProfile,
  AuthResponse,
  Book,
  BookDetail,
  BookSearchResult,
  Cart,
  Category,
  CheckoutSummary,
  CheckoutSummaryInput,
  Coupon,
  CouponValidation,
  Order,
  OrderList,
  PaymentDetails,
  PaymentMethod,
  PaymentMethodsResponse,
  PaymentResult,
  PlaceOrderInput,
  Review,
  ReviewInput,
  ReviewList,
  User,
} from '@/types';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Skip the automatic error toast (caller handles the error itself). */
    silent?: boolean;
  }
}

// ------------------------------------------------------------ token storage

const TOKEN_KEY = 'bookworm.token';
const GUEST_KEY = 'bookworm.isGuest';

/** Fired on `window` when the server rejects the stored token (expired/invalid). */
export const AUTH_EXPIRED_EVENT = 'bookworm:auth-expired';

export const tokenStore = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  isGuest(): boolean {
    return localStorage.getItem(GUEST_KEY) === 'true';
  },
  set(token: string, isGuest: boolean) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(GUEST_KEY, String(isGuest));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(GUEST_KEY);
  },
};

// ------------------------------------------------------------- axios client

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

/** Pulls the most useful human-readable message out of an Axios error. */
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    if (body?.error) {
      const details = Array.isArray(body.details) ? body.details.filter((d) => typeof d === 'string') : [];
      return details.length ? `${body.error}: ${details.join('; ')}` : body.error;
    }
    if (err.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
    if (!err.response) return 'Cannot reach the server. Please check your connection.';
    return `Request failed (${err.response.status})`;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const status = err.response?.status;
    const hadToken = tokenStore.get() !== null;

    // A rejected token (not a failed login attempt) means the session is gone.
    if (status === 401 && hadToken && !err.config?.url?.startsWith('/auth/login')) {
      tokenStore.clear();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      return Promise.reject(err);
    }

    if (!err.config?.silent) {
      toastBus.emit({ type: 'error', message: getErrorMessage(err) });
    }
    return Promise.reject(err);
  },
);

// -------------------------------------------------------------- endpoint API

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
}

export const authApi = {
  guest: () => api.post<AuthResponse>('/auth/guest', undefined, { silent: true }).then((r) => r.data),
  register: (input: RegisterInput) => api.post<AuthResponse>('/auth/register', input).then((r) => r.data),
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get<User>('/auth/me', { silent: true }).then((r) => r.data),
  updateProfile: (input: UpdateProfileInput) => api.put<User>('/auth/me', input).then((r) => r.data),
};

export const addressApi = {
  list: () => api.get<Address[]>('/auth/addresses', { silent: true }).then((r) => r.data),
  create: (input: AddressInput) => api.post<Address>('/auth/addresses', input).then((r) => r.data),
  update: (addressId: string, input: AddressInput) =>
    api.put<Address>(`/auth/addresses/${addressId}`, input).then((r) => r.data),
  delete: (addressId: string) => api.delete(`/auth/addresses/${addressId}`).then(() => undefined),
  setDefault: (addressId: string, current: AddressInput) =>
    api.put<Address>(`/auth/addresses/${addressId}`, { ...current, isDefault: true }).then((r) => r.data),
};

export const catalogueApi = {
  categories: () => api.get<Category[]>('/categories').then((r) => r.data),
  search: (params: Record<string, string | number | undefined>, silent = false) =>
    api.get<BookSearchResult>('/books', { params, silent }).then((r) => r.data),
  bestsellers: (limit = 8) => api.get<Book[]>('/books/bestsellers', { params: { limit } }).then((r) => r.data),
  recommended: (limit = 8) => api.get<Book[]>('/books/recommended', { params: { limit }, silent: true }).then((r) => r.data),
  newLaunches: (limit = 8) => api.get<Book[]>('/books/new-launches', { params: { limit }, silent: true }).then((r) => r.data),
  detail: (bookId: string, silent = false) => api.get<BookDetail>(`/books/${bookId}`, { silent }).then((r) => r.data),
  related: (bookId: string, limit = 8) =>
    api.get<Book[]>(`/books/${bookId}/related`, { params: { limit }, silent: true }).then((r) => r.data),
};

export const authorApi = {
  get: (authorId: string) => api.get<AuthorProfile>(`/authors/${authorId}`, { silent: true }).then((r) => r.data),
};

export type ReviewSort = 'newest' | 'helpful' | 'rating_desc' | 'rating_asc';

export const reviewApi = {
  list: (bookId: string, params: { sort?: ReviewSort; page?: number; pageSize?: number } = {}) =>
    api.get<ReviewList>(`/books/${bookId}/reviews`, { params, silent: true }).then((r) => r.data),
  create: (bookId: string, input: ReviewInput) =>
    api.post<Review>(`/books/${bookId}/reviews`, input).then((r) => r.data),
  helpful: (reviewId: string) => api.post<Review>(`/reviews/${reviewId}/helpful`).then((r) => r.data),
};

export const cartApi = {
  get: () => api.get<Cart>('/cart', { silent: true }).then((r) => r.data),
  add: (bookId: string, quantity = 1) => api.post<Cart>('/cart/items', { bookId, quantity }).then((r) => r.data),
  setQuantity: (bookId: string, quantity: number) =>
    api.put<Cart>(`/cart/items/${bookId}`, { quantity }).then((r) => r.data),
  remove: (bookId: string) => api.delete<Cart>(`/cart/items/${bookId}`).then((r) => r.data),
  clear: () => api.delete('/cart').then(() => undefined),
};

export const checkoutApi = {
  /** Subtotal, tax, delivery, discounts and grand total for the current cart. */
  summary: (input: CheckoutSummaryInput = {}, silent = false) =>
    api.post<CheckoutSummary>('/checkout/summary', input, { silent }).then((r) => r.data),
};

export const couponApi = {
  list: () => api.get<Coupon[]>('/coupons', { silent: true }).then((r) => r.data),
  /** Rejects with a 400 explaining why when the code can't be used on the current cart. */
  validate: (code: string, silent = true) =>
    api.post<CouponValidation>('/coupons/validate', { code }, { silent }).then((r) => r.data),
};

export const paymentApi = {
  methods: () => api.get<PaymentMethodsResponse>('/payments/methods', { silent: true }).then((r) => r.data),
  /** Simulated gateway authorisation; does not move balances or create an order. */
  process: (method: PaymentMethod, amount: number, details: PaymentDetails = {}) =>
    api.post<PaymentResult>('/payments/process', { method, amount, details }).then((r) => r.data),
};

export type OrderStatusTab = 'ALL' | 'ACTIVE' | 'DELIVERED' | 'CANCELLED';

export const orderApi = {
  create: (input: PlaceOrderInput) => api.post<Order>('/orders', input).then((r) => r.data),
  detail: (orderId: string, silent = true) => api.get<Order>(`/orders/${orderId}`, { silent }).then((r) => r.data),
  list: (params: { status?: OrderStatusTab; page?: number; pageSize?: number } = {}) =>
    api.get<OrderList>('/orders', { params, silent: true }).then((r) => r.data),
  cancel: (orderId: string, reason?: string) =>
    api.post<Order>(`/orders/${orderId}/cancel`, { reason }).then((r) => r.data),
  reorder: (orderId: string) => api.post<Cart>(`/orders/${orderId}/reorder`).then((r) => r.data),
};

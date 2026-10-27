export type Role = 'GUEST' | 'CUSTOMER' | 'ADMIN';
export type BookFormat = 'PAPERBACK' | 'HARDCOVER' | 'EBOOK' | string;

export interface User {
  id: string;
  email: string | null;
  name: string;
  phone: string | null;
  role: Role;
  giftPoints: number;
  walletBalance: number;
  isGuest: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  bookCount: number;
}

export interface Book {
  id: string;
  title: string;
  subtitle: string | null;
  author: { id: string; name: string };
  category: { id: string; name: string; slug: string };
  language: string;
  format: BookFormat;
  price: number;
  originalPrice: number | null;
  coverUrl: string | null;
  avgRating: number;
  ratingCount: number;
  inStock: boolean;
  isRecommended: boolean;
  isBestseller: boolean;
  isNewLaunch: boolean;
}

export interface BookDetail extends Book {
  description: string | null;
  isbn: string | null;
  publisher: string | null;
  pages: number | null;
  publicationDate: string | null;
  stock: number;
  totalSales: number;
  deliveryDays: number;
  estimatedDelivery: string;
}

export interface AuthorProfile {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  nationality: string | null;
  birthYear: number | null;
  books: Book[];
}

export type RatingBreakdown = Record<'1' | '2' | '3' | '4' | '5', number>;

export interface Review {
  id: string;
  bookId: string;
  rating: number;
  title: string | null;
  comment: string;
  helpful: number;
  createdAt: string;
  user: { id: string; name: string };
}

export interface ReviewList {
  items: Review[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  avgRating: number;
  ratingCount: number;
  breakdown: RatingBreakdown;
}

export interface ReviewInput {
  rating: number;
  title?: string;
  comment: string;
}

export interface BookSearchResult {
  items: Book[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CartLine {
  id: string;
  bookId: string;
  quantity: number;
  lineTotal: number;
  book: Book;
}

export interface Cart {
  items: CartLine[];
  itemCount: number;
  subtotal: number;
}

export type DeliverySpeed = 'STANDARD' | 'EXPRESS';
export type PaymentMethod = 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'WALLET' | 'GIFT_POINTS';

export interface Address {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export type AddressInput = Omit<Address, 'id' | 'label' | 'line2' | 'isDefault' | 'country'> & {
  label?: string;
  line2?: string;
  country?: string;
  isDefault?: boolean;
};

export interface Coupon {
  code: string;
  description: string | null;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount: number | null;
  expiresAt: string | null;
}

export interface CouponValidation {
  valid: boolean;
  coupon: Coupon;
  discount: number;
}

export interface CheckoutSummaryInput {
  couponCode?: string;
  pointsToRedeem?: number;
  deliverySpeed?: DeliverySpeed;
}

export interface CheckoutSummary {
  subtotal: number;
  couponCode: string | null;
  couponDiscount: number;
  pointsRedeemed: number;
  pointsDiscount: number;
  tax: number;
  shipping: number;
  total: number;
  estimatedDelivery: string;
}

export interface PaymentMethodOption {
  id: PaymentMethod;
  label: string;
  enabled: boolean;
}

export interface PaymentMethodsResponse {
  methods: PaymentMethodOption[];
  walletBalance: number;
  giftPoints: number;
}

export interface PaymentDetails {
  cardNumber?: string;
  cardHolder?: string;
  expiry?: string;
  cvv?: string;
  upiId?: string;
}

export interface PaymentResult {
  status: 'AUTHORISED';
  reference: string;
  method: PaymentMethod;
  amount: number;
  processedAt: string;
}

export interface PlaceOrderInput extends CheckoutSummaryInput {
  addressId?: string;
  shippingAddress?: AddressInput;
  guestEmail?: string;
  paymentMethod: PaymentMethod;
  paymentDetails?: PaymentDetails;
}

export interface OrderItem {
  id: string;
  bookId: string;
  title: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  coverUrl: string | null;
}

export interface TrackingStep {
  status: string;
  label: string;
  completed: boolean;
  timestamp: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  pointsRedeemed: number;
  tax: number;
  shipping: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  paymentReference: string | null;
  shippingAddress: Omit<Address, 'id' | 'label' | 'isDefault'>;
  estimatedDelivery: string;
  placedAt: string;
  cancellableUntil: string;
  canCancel: boolean;
  cancelledAt: string | null;
  cancelReason: string | null;
  tracking: TrackingStep[];
}

export interface OrderList {
  items: Order[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorBody {
  error?: string;
  details?: unknown;
}

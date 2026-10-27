import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { ToastProvider } from '@/context/ToastContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { BookDetailPage } from '@/pages/BookDetailPage';
import { CataloguePage } from '@/pages/CataloguePage';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { ComingSoon } from '@/pages/ComingSoon';
import { HomePage } from '@/pages/HomePage';
import { OrderConfirmationPage } from '@/pages/OrderConfirmationPage';
import { OrderHistoryPage } from '@/pages/OrderHistoryPage';
import { UserProfilePage } from '@/pages/UserProfilePage';
import { WishlistPage } from '@/pages/WishlistPage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<HomePage />} />
                  <Route path="books" element={<CataloguePage />} />
                  <Route path="books/:bookId" element={<BookDetailPage />} />
                  <Route path="cart" element={<CartPage />} />
                  <Route path="checkout" element={<CheckoutPage />} />
                  <Route path="order-confirmation/:orderId" element={<OrderConfirmationPage />} />
                  <Route path="wishlist" element={<WishlistPage />} />
                  <Route path="orders" element={<OrderHistoryPage />} />
                  <Route path="account" element={<UserProfilePage />} />
                  <Route path="*" element={<ComingSoon title="Page not found" />} />
                </Route>
              </Routes>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

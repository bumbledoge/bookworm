import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Drawer } from '@/components/ui/Overlay';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/lib/format';

export function CartDrawer() {
  const { cart, drawerOpen, closeDrawer, updateQuantity, removeItem } = useCart();

  return (
    <Drawer
      open={drawerOpen}
      onClose={closeDrawer}
      title={`Your cart (${cart.itemCount})`}
      footer={
        cart.items.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-600">Subtotal</span>
              <span className="text-lg font-bold text-stone-900">{formatPrice(cart.subtotal)}</span>
            </div>
            <p className="text-xs text-stone-500">Taxes, delivery and coupons are calculated at checkout.</p>
            <Link to="/cart" onClick={closeDrawer} className="btn-outline w-full">View cart</Link>
            <Link to="/checkout" onClick={closeDrawer} className="btn-primary w-full">Checkout</Link>
          </div>
        )
      }
    >
      {cart.items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <ShoppingBag className="h-12 w-12 text-paper-300" />
          <p className="font-serif text-lg text-stone-900">Your cart is empty</p>
          <p className="text-sm text-stone-500">Find your next great read.</p>
          <Link to="/books" onClick={closeDrawer} className="btn-primary">Browse books</Link>
        </div>
      ) : (
        <ul className="divide-y divide-paper-200">
          {cart.items.map((line) => (
            <li key={line.id} className="flex gap-3 p-4">
              {line.book.coverUrl ? (
                <img src={line.book.coverUrl} alt="" className="h-24 w-16 shrink-0 rounded object-cover shadow-card" />
              ) : (
                <div className="h-24 w-16 shrink-0 rounded bg-paper-200" />
              )}
              <div className="min-w-0 flex-1">
                <Link to={`/books/${line.bookId}`} onClick={closeDrawer} className="line-clamp-2 text-sm font-semibold text-stone-900 hover:text-brand-800">
                  {line.book.title}
                </Link>
                <p className="truncate text-xs text-stone-500">{line.book.author.name}</p>
                <p className="mt-1 text-sm font-semibold text-brand-800">{formatPrice(line.lineTotal)}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="inline-flex items-center rounded-lg border border-stone-300 bg-white">
                    <button type="button" className="p-1.5 hover:bg-paper-100" aria-label={`Decrease quantity of ${line.book.title}`} onClick={() => updateQuantity(line.bookId, line.quantity - 1)}>
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-[1.75rem] text-center text-sm" aria-live="polite">{line.quantity}</span>
                    <button type="button" className="p-1.5 hover:bg-paper-100" aria-label={`Increase quantity of ${line.book.title}`} onClick={() => updateQuantity(line.bookId, line.quantity + 1)}>
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button type="button" className="p-1.5 text-stone-400 hover:text-red-600" aria-label={`Remove ${line.book.title}`} onClick={() => removeItem(line.bookId)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}

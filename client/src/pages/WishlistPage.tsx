import { useState } from 'react';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RatingStars } from '@/components/books/RatingStars';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import type { Book } from '@/types';

const FORMAT_LABEL: Record<string, string> = {
  PAPERBACK: 'Paperback',
  HARDCOVER: 'Hardcover',
  EBOOK: 'E-Book',
};

function WishlistItem({ book, onRemove }: { book: Book; onRemove: (id: string) => void }) {
  const { addItem, openDrawer } = useCart();
  const [moving, setMoving] = useState(false);

  const handleMoveToCart = async () => {
    setMoving(true);
    const ok = await addItem({ id: book.id, title: book.title });
    if (ok) {
      onRemove(book.id);
      openDrawer();
    }
    setMoving(false);
  };

  return (
    <li className="card-hover flex gap-4 p-4">
      {/* Cover */}
      <Link to={`/books/${book.id}`} className="shrink-0" aria-label={book.title} tabIndex={-1}>
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={`Cover of ${book.title}`}
            className="h-36 w-24 rounded object-cover shadow-card"
            loading="lazy"
          />
        ) : (
          <div className="flex h-36 w-24 items-end justify-center rounded bg-gradient-to-b from-brand-100 to-brand-200 p-1.5">
            <span className="text-center text-[10px] font-semibold text-brand-800 line-clamp-3">{book.title}</span>
          </div>
        )}
      </Link>

      {/* Details */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={`/books/${book.id}`}
              className="font-serif font-semibold text-stone-900 hover:text-brand-800 line-clamp-2 leading-snug"
            >
              {book.title}
            </Link>
            <p className="mt-0.5 text-sm text-stone-500">{book.author.name}</p>
          </div>
          {/* Remove */}
          <button
            type="button"
            onClick={() => onRemove(book.id)}
            aria-label={`Remove "${book.title}" from wishlist`}
            className="shrink-0 rounded-full p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Rating */}
        <RatingStars rating={book.avgRating} count={book.ratingCount} size={13} />

        {/* Format + stock */}
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          <span className="badge bg-paper-200 text-stone-600 text-[10px]">
            {FORMAT_LABEL[book.format] ?? book.format}
          </span>
          {book.inStock ? (
            <span className="badge bg-green-100 text-green-700 text-[10px]">In stock</span>
          ) : (
            <span className="badge bg-red-100 text-red-700 text-[10px]">Out of stock</span>
          )}
        </div>

        {/* Price + actions */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-brand-800">{formatPrice(book.price)}</span>
            {book.originalPrice && book.originalPrice > book.price && (
              <span className="text-xs text-stone-400 line-through">{formatPrice(book.originalPrice)}</span>
            )}
          </div>
          <button
            type="button"
            disabled={moving || !book.inStock}
            onClick={handleMoveToCart}
            className={cn(
              'btn-primary gap-2 text-sm disabled:opacity-60',
              !book.inStock && 'cursor-not-allowed',
            )}
          >
            {moving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            {moving ? 'Moving…' : 'Move to Cart'}
          </button>
        </div>
      </div>
    </li>
  );
}

export function WishlistPage() {
  const { items, remove } = useWishlist();

  return (
    <main className="container-page py-8 pb-16">
      <div className="mb-8 flex items-center gap-3">
        <Heart className="h-6 w-6 text-red-500" />
        <h1 className="text-3xl">Your Wishlist</h1>
        {items.length > 0 && (
          <span className="badge bg-paper-200 text-stone-600 text-sm">{items.length}</span>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyWishlist />
      ) : (
        <ul className="space-y-3">
          {items.map((book) => (
            <WishlistItem key={book.id} book={book} onRemove={remove} />
          ))}
        </ul>
      )}
    </main>
  );
}

function EmptyWishlist() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <Heart className="h-16 w-16 text-paper-300" />
      <h2 className="text-xl font-serif text-stone-900">Your wishlist is empty</h2>
      <p className="max-w-sm text-stone-500">
        Save books you'd like to read later by tapping the heart icon on any book card.
      </p>
      <Link to="/books" className="btn-primary mt-2">
        Browse books
      </Link>
    </div>
  );
}

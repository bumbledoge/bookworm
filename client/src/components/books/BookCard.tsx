import { useState } from 'react';
import { Heart, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import type { Book } from '@/types';
import { RatingStars } from './RatingStars';

const FORMAT_LABEL: Record<string, string> = {
  PAPERBACK: 'Paperback',
  HARDCOVER: 'Hardcover',
  EBOOK: 'E-Book',
};

const FORMAT_COLORS: Record<string, string> = {
  PAPERBACK: 'bg-brand-100 text-brand-800',
  HARDCOVER: 'bg-ink-100 text-ink-800',
  EBOOK: 'bg-emerald-100 text-emerald-800',
};

interface BookCardProps {
  book: Book;
  /** 'grid' (default) or 'list' layout variant. */
  layout?: 'grid' | 'list';
}

export function BookCard({ book, layout = 'grid' }: BookCardProps) {
  const { addItem } = useCart();
  const { has, toggle } = useWishlist();
  const [adding, setAdding] = useState(false);
  const wishlisted = has(book.id);

  const handleAddToCart = async () => {
    setAdding(true);
    await addItem({ id: book.id, title: book.title });
    setAdding(false);
  };

  const discount =
    book.originalPrice && book.originalPrice > book.price
      ? Math.round(((book.originalPrice - book.price) / book.originalPrice) * 100)
      : null;

  if (layout === 'list') {
    return (
      <div className="card-hover flex gap-4 p-4">
        <BookCover book={book} className="h-36 w-24 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CategoryBadge name={book.category.name} />
              <Link
                to={`/books/${book.id}`}
                className="mt-1 block font-serif font-semibold text-stone-900 hover:text-brand-800 line-clamp-2"
              >
                {book.title}
              </Link>
              <p className="mt-0.5 text-sm text-stone-500">{book.author.name}</p>
            </div>
            <WishlistBtn wishlisted={wishlisted} onToggle={() => toggle(book)} />
          </div>
          <RatingStars rating={book.avgRating} count={book.ratingCount} className="mt-1" />
          <div className="mt-auto flex items-center gap-3">
            <FormatPill format={book.format} />
            {!book.inStock && <span className="badge bg-red-100 text-red-700">Out of stock</span>}
          </div>
          <div className="flex items-center justify-between">
            <PriceBlock price={book.price} originalPrice={book.originalPrice} discount={discount} />
            <AddToCartBtn adding={adding} inStock={book.inStock} onClick={handleAddToCart} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-hover group relative flex flex-col overflow-hidden">
      {/* Cover */}
      <div className="relative">
        <Link to={`/books/${book.id}`} tabIndex={-1} aria-hidden="true">
          <BookCover book={book} className="h-52 w-full" />
        </Link>
        {discount && (
          <span className="absolute left-2 top-2 badge bg-red-600 text-white">-{discount}%</span>
        )}
        <WishlistBtn
          wishlisted={wishlisted}
          onToggle={() => toggle(book)}
          className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <CategoryBadge name={book.category.name} />
        <Link
          to={`/books/${book.id}`}
          className="font-serif text-sm font-semibold text-stone-900 hover:text-brand-800 line-clamp-2 leading-snug"
        >
          {book.title}
        </Link>
        <p className="text-xs text-stone-500 truncate">{book.author.name}</p>
        <RatingStars rating={book.avgRating} count={book.ratingCount} size={13} />
        <div className="flex items-center gap-1.5 mt-0.5">
          <FormatPill format={book.format} />
          {!book.inStock && <span className="badge bg-red-100 text-red-700 text-[10px]">Out of stock</span>}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 pb-3 mt-auto">
        <PriceBlock price={book.price} originalPrice={book.originalPrice} discount={null} />
        <AddToCartBtn adding={adding} inStock={book.inStock} onClick={handleAddToCart} compact />
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function BookCover({ book, className }: { book: Book; className?: string }) {
  return book.coverUrl ? (
    <img
      src={book.coverUrl}
      alt={`Cover of ${book.title}`}
      className={cn('object-cover', className)}
      loading="lazy"
    />
  ) : (
    <div
      className={cn(
        'flex items-end justify-center bg-gradient-to-b from-brand-100 to-brand-200 p-2',
        className,
      )}
    >
      <span className="text-center text-xs font-semibold text-brand-800 line-clamp-3">{book.title}</span>
    </div>
  );
}

function CategoryBadge({ name }: { name: string }) {
  return (
    <span className="badge bg-paper-200 text-stone-600 text-[10px] leading-tight">{name}</span>
  );
}

function FormatPill({ format }: { format: string }) {
  const label = FORMAT_LABEL[format] ?? format;
  const color = FORMAT_COLORS[format] ?? 'bg-stone-100 text-stone-600';
  return <span className={cn('badge text-[10px]', color)}>{label}</span>;
}

function PriceBlock({
  price,
  originalPrice,
  discount,
}: {
  price: number;
  originalPrice: number | null;
  discount: number | null;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-bold text-brand-800">{formatPrice(price)}</span>
      {originalPrice && originalPrice > price && (
        <span className="text-xs text-stone-400 line-through">{formatPrice(originalPrice)}</span>
      )}
      {discount && (
        <span className="text-[10px] font-semibold text-red-600">-{discount}%</span>
      )}
    </div>
  );
}

function WishlistBtn({
  wishlisted,
  onToggle,
  className,
}: {
  wishlisted: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow transition-colors hover:bg-white',
        className,
      )}
    >
      <Heart
        className={cn('h-4 w-4 transition-colors', wishlisted ? 'fill-red-500 text-red-500' : 'text-stone-400')}
      />
    </button>
  );
}

function AddToCartBtn({
  adding,
  inStock,
  onClick,
  compact = false,
}: {
  adding: boolean;
  inStock: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  if (!inStock) return null;
  return (
    <button
      type="button"
      disabled={adding}
      onClick={onClick}
      aria-label="Add to cart"
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-lg bg-brand-700 text-white transition-colors hover:bg-brand-800 disabled:opacity-60',
        compact ? 'h-8 w-8' : 'px-3 py-1.5 text-sm font-semibold',
      )}
    >
      {adding ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : (
        <>
          <ShoppingCart className="h-4 w-4 shrink-0" />
          {!compact && 'Add to cart'}
        </>
      )}
    </button>
  );
}

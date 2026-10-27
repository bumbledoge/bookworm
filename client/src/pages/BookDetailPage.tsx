import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Heart, Minus, Plus, RotateCcw, ShieldCheck, ShoppingCart, Truck, Zap } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthorProfileSection } from '@/components/author/AuthorProfileSection';
import { RatingStars } from '@/components/books/RatingStars';
import { RelatedReadsSection } from '@/components/books/RelatedReadsSection';
import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { catalogueApi } from '@/services/api';
import type { BookDetail } from '@/types';

const FORMAT_LABEL: Record<string, string> = {
  PAPERBACK: 'Paperback',
  HARDCOVER: 'Hardcover',
  EBOOK: 'E-Book',
};

const MAX_QUANTITY = 10;

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function formatLongDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function BookDetailPage() {
  const { bookId = '' } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { addItem, openDrawer } = useCart();
  const { has, toggle } = useWishlist();

  const [book, setBook] = useState<BookDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'notFound' | 'error'>('loading');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState<'cart' | 'buy' | null>(null);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);

  const fetchBook = useCallback(
    async (silent: boolean) => {
      try {
        const detail = await catalogueApi.detail(bookId, true);
        setBook(detail);
        setStatus('ready');
      } catch (err) {
        if (silent) return; // keep showing the current book if only a background refresh failed
        const httpStatus = (err as { response?: { status?: number } }).response?.status;
        setStatus(httpStatus === 404 ? 'notFound' : 'error');
      }
    },
    [bookId],
  );

  useEffect(() => {
    setStatus('loading');
    setQuantity(1);
    window.scrollTo({ top: 0 });
    void fetchBook(false);
  }, [fetchBook]);

  if (status === 'loading') return <DetailSkeleton />;

  if (status !== 'ready' || !book) {
    return (
      <div className="container-page flex flex-col items-center gap-3 py-24 text-center">
        <h1 className="text-3xl">{status === 'notFound' ? 'Book not found' : 'Something went wrong'}</h1>
        <p className="max-w-md text-stone-600">
          {status === 'notFound'
            ? "We couldn't find the book you're looking for."
            : 'The book details could not be loaded. Please try again.'}
        </p>
        <div className="mt-2 flex gap-2">
          {status === 'error' && (
            <button type="button" className="btn-outline" onClick={() => void fetchBook(false)}>
              Retry
            </button>
          )}
          <Link to="/books" className="btn-primary">
            Browse books
          </Link>
        </div>
      </div>
    );
  }

  const discount =
    book.originalPrice && book.originalPrice > book.price
      ? Math.round(((book.originalPrice - book.price) / book.originalPrice) * 100)
      : null;
  const maxQty = Math.max(1, Math.min(MAX_QUANTITY, book.stock));
  const wishlisted = has(book.id);
  const lowStock = book.inStock && book.stock <= 5;

  const handleAddToCart = async () => {
    setBusy('cart');
    const ok = await addItem({ id: book.id, title: book.title }, quantity);
    setBusy(null);
    if (ok) openDrawer();
  };

  const handleBuyNow = async () => {
    setBusy('buy');
    const ok = await addItem({ id: book.id, title: book.title }, quantity);
    setBusy(null);
    if (ok) navigate('/checkout');
  };

  const specs: [string, string][] = [
    ['Publisher', book.publisher ?? '—'],
    ['ISBN', book.isbn ?? '—'],
    ['Pages', book.pages ? String(book.pages) : '—'],
    ['Language', book.language],
    ['Format', FORMAT_LABEL[book.format] ?? book.format],
    ['Publication year', book.publicationDate ? String(new Date(book.publicationDate).getFullYear()) : '—'],
    ['Delivery', `${book.deliveryDays} day${book.deliveryDays === 1 ? '' : 's'}`],
    ['Copies sold', book.totalSales.toLocaleString()],
  ];

  return (
    <main className="container-page py-6 pb-16">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1 text-sm text-stone-500">
        <Link to="/" className="hover:text-brand-700">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link to={`/books?category=${encodeURIComponent(book.category.slug)}`} className="hover:text-brand-700">
          {book.category.name}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="line-clamp-1 font-medium text-stone-800" aria-current="page">
          {book.title}
        </span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        {/* Left: cover + badges */}
        <div>
          <div
            className="card relative overflow-hidden"
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
            }}
            onMouseLeave={() => setZoom(null)}
          >
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={`Cover of ${book.title}`}
                className="aspect-[2/3] w-full object-cover transition-transform duration-150"
                style={zoom ? { transform: 'scale(1.8)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
              />
            ) : (
              <div className="flex aspect-[2/3] w-full items-end justify-center bg-gradient-to-b from-brand-100 to-brand-200 p-4">
                <span className="text-center font-serif text-lg font-semibold text-brand-800">{book.title}</span>
              </div>
            )}
            <span className="badge absolute left-2 top-2 bg-ink-800 text-white">
              {FORMAT_LABEL[book.format] ?? book.format}
            </span>
            {discount && <span className="badge absolute right-2 top-2 bg-red-600 text-white">-{discount}%</span>}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {book.isBestseller && <span className="badge bg-amber-100 text-amber-800">Bestseller</span>}
            {book.isNewLaunch && <span className="badge bg-emerald-100 text-emerald-800">New Launch</span>}
            {book.isRecommended && <span className="badge bg-brand-100 text-brand-800">Recommended</span>}
          </div>

          <ul className="mt-4 space-y-2 text-sm text-stone-600">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" /> 100% authentic books
            </li>
            <li className="flex items-center gap-2">
              <Truck className="h-4 w-4 shrink-0 text-emerald-600" /> Secure packaging &amp; tracked delivery
            </li>
            <li className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 shrink-0 text-emerald-600" /> Free cancellation within 48 hours
            </li>
          </ul>
        </div>

        {/* Center: title, meta, description */}
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight">{book.title}</h1>
          {book.subtitle && <p className="mt-1 text-lg text-stone-600">{book.subtitle}</p>}
          <p className="mt-2 text-sm text-stone-600">
            by{' '}
            <button
              type="button"
              onClick={() => scrollToSection('about-the-writer')}
              className="font-semibold text-brand-700 hover:text-brand-800 hover:underline"
            >
              {book.author.name}
            </button>
          </p>

          <button
            type="button"
            onClick={() => scrollToSection('reviews')}
            className="mt-3 flex items-center gap-2 hover:opacity-80"
            aria-label="Jump to customer reviews"
          >
            <span className="font-semibold text-stone-900">{book.avgRating.toFixed(1)}</span>
            <RatingStars rating={book.avgRating} size={18} />
            <span className="text-sm text-brand-700 hover:underline">
              {book.ratingCount.toLocaleString()} rating{book.ratingCount === 1 ? '' : 's'}
            </span>
          </button>

          <div className="mt-4 flex items-baseline gap-3 border-t border-paper-300 pt-4">
            <span className="text-3xl font-bold text-brand-800">{formatPrice(book.price)}</span>
            {book.originalPrice && book.originalPrice > book.price && (
              <>
                <span className="text-lg text-stone-400 line-through">{formatPrice(book.originalPrice)}</span>
                <span className="text-sm font-semibold text-red-600">Save {discount}%</span>
              </>
            )}
          </div>

          <nav aria-label="Page sections" className="mt-6 flex gap-4 border-b border-paper-300 text-sm font-semibold">
            {[
              ['description', 'Description'],
              ['about-the-writer', 'About the Writer'],
              ['reviews', 'Reviews'],
              ['related-reads', 'Related Reads'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToSection(id)}
                className="-mb-px border-b-2 border-transparent pb-2 text-stone-600 hover:border-brand-600 hover:text-brand-800"
              >
                {label}
              </button>
            ))}
          </nav>

          <section id="description" className="scroll-mt-24 pt-5" aria-labelledby="description-heading">
            <h2 id="description-heading" className="mb-2 text-xl">
              Description
            </h2>
            <p className="whitespace-pre-line leading-relaxed text-stone-700">
              {book.description ?? 'No description available for this title.'}
            </p>

            <h3 className="mb-2 mt-6 text-base">Product details</h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
              {specs.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-paper-200 py-1.5 text-sm">
                  <dt className="text-stone-500">{label}</dt>
                  <dd className="text-right font-medium text-stone-900">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        {/* Right: buy box */}
        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Purchase options">
          <div className="card space-y-4 p-5">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-brand-800">{formatPrice(book.price)}</span>
              {book.originalPrice && book.originalPrice > book.price && (
                <span className="text-sm text-stone-400 line-through">{formatPrice(book.originalPrice)}</span>
              )}
            </div>

            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <Truck className="mr-1.5 inline h-4 w-4 align-text-bottom" />
              Estimated delivery by <strong>{formatLongDate(book.estimatedDelivery)}</strong>
            </div>

            {book.inStock ? (
              <p className={cn('text-sm font-semibold', lowStock ? 'text-amber-700' : 'text-emerald-700')}>
                {lowStock ? `Only ${book.stock} left in stock` : 'In stock'}
              </p>
            ) : (
              <p className="text-sm font-semibold text-red-700">Currently out of stock</p>
            )}

            {book.inStock && (
              <div className="flex items-center justify-between">
                <span className="label mb-0">Quantity</span>
                <div className="flex items-center rounded-lg border border-stone-300">
                  <button
                    type="button"
                    className="p-2 text-stone-600 hover:bg-paper-200 disabled:opacity-40"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    className="p-2 text-stone-600 hover:bg-paper-200 disabled:opacity-40"
                    onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                    disabled={quantity >= maxQty}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <button
                type="button"
                className="btn-primary w-full py-2.5"
                disabled={!book.inStock || busy !== null}
                onClick={() => void handleAddToCart()}
              >
                <ShoppingCart className="h-4 w-4" />
                {busy === 'cart' ? 'Adding…' : 'Add to Cart'}
              </button>
              <button
                type="button"
                className="btn-secondary w-full py-2.5"
                disabled={!book.inStock || busy !== null}
                onClick={() => void handleBuyNow()}
              >
                <Zap className="h-4 w-4" />
                {busy === 'buy' ? 'Processing…' : 'Buy Now'}
              </button>
              <button type="button" className="btn-outline w-full" onClick={() => toggle(book)} aria-pressed={wishlisted}>
                <Heart className={cn('h-4 w-4', wishlisted && 'fill-red-500 text-red-500')} />
                {wishlisted ? 'In your wishlist' : 'Add to Wishlist'}
              </button>
            </div>

            <div className="flex gap-2 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                <strong>48-Hour Order Cancellation.</strong> Changed your mind? Cancel your order within 48 hours of
                placing it for a full refund.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-12 space-y-12">
        <AuthorProfileSection authorId={book.author.id} currentBookId={book.id} />
        <ReviewsSection bookId={book.id} bookTitle={book.title} onReviewPosted={() => void fetchBook(true)} />
        <RelatedReadsSection bookId={book.id} />
      </div>
    </main>
  );
}

function DetailSkeleton() {
  return (
    <div className="container-page py-6" aria-busy="true" aria-label="Loading book details">
      <div className="mb-5 h-4 w-64 animate-pulse rounded bg-paper-200" />
      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        <div className="aspect-[2/3] animate-pulse rounded-xl bg-paper-200" />
        <div className="space-y-3">
          <div className="h-9 w-3/4 animate-pulse rounded bg-paper-200" />
          <div className="h-5 w-1/3 animate-pulse rounded bg-paper-200" />
          <div className="h-40 animate-pulse rounded bg-paper-200" />
        </div>
        <div className="h-80 animate-pulse rounded-xl bg-paper-200" />
      </div>
    </div>
  );
}

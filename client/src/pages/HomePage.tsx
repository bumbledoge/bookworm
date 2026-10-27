import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Package, RefreshCw, Star, Truck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { BookCard } from '@/components/books/BookCard';
import { RatingStars } from '@/components/books/RatingStars';
import { cn } from '@/lib/cn';
import { catalogueApi } from '@/services/api';
import type { Book, Category } from '@/types';

// ─── Skeleton helpers ────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-paper-200', className)} />;
}

function BookCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <Skeleton className="h-52 w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
        <div className="flex justify-between pt-1">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ─── Book shelf (horizontal scrolling row) ───────────────────────────────────

function BookShelf({ books, loading }: { books: Book[]; loading: boolean }) {
  const listRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    listRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => scroll('left')}
        aria-label="Scroll left"
        className="absolute -left-4 top-1/2 z-10 -translate-y-1/2 hidden h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-white shadow-card hover:bg-paper-100 lg:flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div
        ref={listRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {loading
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="w-44 shrink-0" style={{ scrollSnapAlign: 'start' }}>
                <BookCardSkeleton />
              </div>
            ))
          : books.map((book) => (
              <div key={book.id} className="w-44 shrink-0" style={{ scrollSnapAlign: 'start' }}>
                <BookCard book={book} />
              </div>
            ))}
      </div>
      <button
        type="button"
        onClick={() => scroll('right')}
        aria-label="Scroll right"
        className="absolute -right-4 top-1/2 z-10 -translate-y-1/2 hidden h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-white shadow-card hover:bg-paper-100 lg:flex"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, linkTo, linkLabel }: { title: string; subtitle?: string; linkTo: string; linkLabel: string }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <h2 className="text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      <Link to={linkTo} className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline whitespace-nowrap">
        {linkLabel} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

// ─── Hero carousel ───────────────────────────────────────────────────────────

const SLIDES = [
  {
    title: 'Explore Our Bestsellers',
    subtitle: 'The most-read titles this month — handpicked for you.',
    cta: 'Browse Bestsellers',
    href: '/books?sort=rating',
    bg: 'from-brand-800 to-brand-600',
  },
  {
    title: 'Fresh New Arrivals',
    subtitle: 'Just added to the shelves — be the first to read them.',
    cta: 'Browse New Arrivals',
    href: '/books?sort=newest',
    bg: 'from-ink-800 to-ink-600',
  },
  {
    title: 'Curated for You',
    subtitle: "Books our editors think you'll love, based on your taste.",
    cta: 'See Recommendations',
    href: '/books?recommended=true',
    bg: 'from-stone-800 to-stone-600',
  },
];

function HeroCarousel() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();

  // Auto-advance every 5 s
  useEffect(() => {
    const id = setInterval(() => setActive((i) => (i + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  const slide = SLIDES[active];

  return (
    <section className={cn('relative overflow-hidden rounded-2xl bg-gradient-to-r text-white py-16 px-8 sm:py-24 sm:px-16', slide.bg)} aria-label="Featured promotions">
      <div className="relative z-10 max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Book Worm Picks</p>
        <h1 className="mt-3 text-3xl sm:text-5xl font-serif leading-tight">{slide.title}</h1>
        <p className="mt-4 text-base text-white/80 leading-relaxed">{slide.subtitle}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate(slide.href)}
            className="btn bg-white text-stone-900 hover:bg-paper-50 font-semibold"
          >
            {slide.cta}
          </button>
          <Link to="/books" className="btn border border-white/50 text-white hover:bg-white/10">
            View all books
          </Link>
        </div>
      </div>

      {/* Decorative floating book icon */}
      <div className="pointer-events-none absolute right-8 top-8 opacity-10 sm:opacity-20">
        <BookOpen className="h-48 w-48 sm:h-64 sm:w-64" />
      </div>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setActive(i)}
            className={cn('h-2 rounded-full transition-all', i === active ? 'w-6 bg-white' : 'w-2 bg-white/50')}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Value propositions ──────────────────────────────────────────────────────

const VALUE_PROPS = [
  { icon: RefreshCw, title: '48-Hour Cancellation', desc: 'Change your mind? Cancel within 48 hours.' },
  { icon: Truck, title: 'Free Delivery over $35', desc: 'No extra charge on qualifying orders.' },
  { icon: Star, title: '100% Genuine Books', desc: 'Authentic editions, every time.' },
  { icon: Package, title: 'Easy Returns', desc: 'Hassle-free returns on all orders.' },
];

function ValuePropositions() {
  return (
    <section className="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Store benefits">
      {VALUE_PROPS.map(({ icon: Icon, title, desc }) => (
        <div key={title} className="card flex flex-col items-center gap-2 p-4 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100">
            <Icon className="h-5 w-5 text-brand-700" />
          </span>
          <p className="text-sm font-semibold text-stone-900">{title}</p>
          <p className="text-xs text-stone-500">{desc}</p>
        </div>
      ))}
    </section>
  );
}

// ─── Category showcase ───────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  fiction: '📚',
  'non-fiction': '📖',
  biography: '👤',
  science: '🔬',
  history: '🏛️',
  technology: '💻',
  business: '💼',
  children: '🌟',
  romance: '💕',
  mystery: '🔍',
  fantasy: '🧙',
  philosophy: '🤔',
  self_help: '💡',
  travel: '✈️',
  cooking: '🍳',
};

function CategoryShowcase({ categories }: { categories: Category[]; loading: boolean }) {
  const display = categories.slice(0, 8);

  return (
    <section aria-labelledby="categories-heading">
      <SectionHeader
        title="Browse by Category"
        subtitle="Discover books across every genre"
        linkTo="/books"
        linkLabel="See all"
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {display.map((cat) => (
          <Link
            key={cat.id}
            to={`/books?category=${cat.slug}`}
            className="card-hover flex flex-col items-center gap-2 p-3 text-center transition-colors hover:border-brand-300"
          >
            <span className="text-3xl" aria-hidden="true">
              {CATEGORY_ICONS[cat.slug] ?? '📘'}
            </span>
            <span className="text-xs font-semibold text-stone-800 leading-tight line-clamp-2">{cat.name}</span>
            <span className="text-[10px] text-stone-400">{cat.bookCount}</span>
          </Link>
        ))}
        {display.length === 0 &&
          Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
      </div>
    </section>
  );
}

// ─── Newsletter banner ───────────────────────────────────────────────────────

function NewsletterBanner() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="rounded-2xl bg-gradient-to-r from-ink-700 to-ink-900 p-8 text-center text-white sm:p-12">
      <h2 className="text-2xl font-serif">Get the best book deals in your inbox</h2>
      <p className="mt-2 text-sm text-white/70">Weekly picks, author spotlights, and exclusive discount codes.</p>
      {submitted ? (
        <p className="mt-6 font-semibold text-brand-300">🎉 You're on the list! Watch your inbox.</p>
      ) : (
        <form
          className="mx-auto mt-6 flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (email) setSubmitted(true);
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            className="input flex-1 bg-white/10 text-white placeholder:text-white/50 border-white/20 focus:border-white"
          />
          <button type="submit" className="btn bg-brand-500 text-white hover:bg-brand-400 whitespace-nowrap">
            Subscribe
          </button>
        </form>
      )}
    </section>
  );
}

// ─── Featured book (single large card) ──────────────────────────────────────

function FeaturedBook({ book }: { book: Book }) {
  return (
    <div className="card-hover flex flex-col gap-6 overflow-hidden p-0 sm:flex-row">
      {book.coverUrl ? (
        <img src={book.coverUrl} alt={`Cover of ${book.title}`} className="h-64 w-full object-cover sm:h-auto sm:w-40 shrink-0" />
      ) : (
        <div className="flex h-64 w-full items-center justify-center bg-gradient-to-b from-brand-100 to-brand-200 sm:h-auto sm:w-40 shrink-0">
          <BookOpen className="h-12 w-12 text-brand-400" />
        </div>
      )}
      <div className="flex flex-col justify-center gap-3 p-6 sm:pl-0">
        <span className="badge bg-brand-100 text-brand-800 w-fit">Featured Pick</span>
        <h3 className="text-2xl font-serif">{book.title}</h3>
        <p className="text-stone-500">{book.author.name}</p>
        <RatingStars rating={book.avgRating} count={book.ratingCount} size={18} />
        <Link to={`/books/${book.id}`} className="btn-primary w-fit mt-2">
          View book
        </Link>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [bestsellers, setBestsellers] = useState<Book[]>([]);
  const [recommended, setRecommended] = useState<Book[]>([]);
  const [newLaunches, setNewLaunches] = useState<Book[]>([]);

  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingBest, setLoadingBest] = useState(true);
  const [loadingRec, setLoadingRec] = useState(true);
  const [loadingNew, setLoadingNew] = useState(true);

  const fetchAll = useCallback(() => {
    catalogueApi
      .categories()
      .then(setCategories)
      .catch(() => undefined)
      .finally(() => setLoadingCats(false));

    catalogueApi
      .bestsellers(12)
      .then(setBestsellers)
      .catch(() => undefined)
      .finally(() => setLoadingBest(false));

    catalogueApi
      .recommended(12)
      .then(setRecommended)
      .catch(() => undefined)
      .finally(() => setLoadingRec(false));

    catalogueApi
      .newLaunches(12)
      .then(setNewLaunches)
      .catch(() => undefined)
      .finally(() => setLoadingNew(false));
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <main className="container-page space-y-14 py-8 pb-16">
      {/* Hero */}
      <HeroCarousel />

      {/* Value propositions */}
      <ValuePropositions />

      {/* Category showcase */}
      <CategoryShowcase categories={categories} loading={loadingCats} />

      {/* Recommended for You */}
      <section aria-labelledby="recommended-heading">
        <SectionHeader
          title="Recommended for You"
          subtitle="Curated picks based on popular taste"
          linkTo="/books?recommended=true"
          linkLabel="See all"
        />
        <BookShelf books={recommended} loading={loadingRec} />
      </section>

      {/* Bestsellers this Month */}
      <section aria-labelledby="bestsellers-heading">
        <SectionHeader
          title="Bestsellers this Month"
          subtitle="The titles everyone's reading right now"
          linkTo="/books?sort=rating"
          linkLabel="See all"
        />
        <BookShelf books={bestsellers} loading={loadingBest} />
      </section>

      {/* New Launches */}
      <section aria-labelledby="new-heading">
        <SectionHeader
          title="New Launches"
          subtitle="Fresh off the press — just added this week"
          linkTo="/books?sort=newest"
          linkLabel="See all"
        />
        <BookShelf books={newLaunches} loading={loadingNew} />
      </section>

      {/* Featured single book from bestsellers */}
      {bestsellers.length > 0 && !loadingBest && (
        <section aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="text-2xl mb-6">Editor's Choice</h2>
          <FeaturedBook book={bestsellers[0]} />
        </section>
      )}

      {/* Newsletter */}
      <NewsletterBanner />
    </main>
  );
}

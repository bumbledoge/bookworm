import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Filter, Search, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookCard } from '@/components/books/BookCard';
import { DEFAULT_FILTERS, FilterSidebar, type FilterState } from '@/components/books/FilterSidebar';
import { SortBar, type SortOption, type ViewLayout } from '@/components/books/SortBar';
import { Drawer } from '@/components/ui/Overlay';
import { cn } from '@/lib/cn';
import { catalogueApi } from '@/services/api';
import type { Book, BookSearchResult, Category } from '@/types';

// ─── Skeleton loaders ────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-paper-200', className)} />;
}

function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card overflow-hidden">
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
      ))}
    </>
  );
}

// ─── URL <-> Filter sync helpers ─────────────────────────────────────────────

const SORT_MAP: Record<SortOption, string> = {
  relevance: '',
  price_asc: 'price_asc',
  price_desc: 'price_desc',
  rating: 'rating',
  newest: 'newest',
};

function filtersFromParams(params: URLSearchParams): FilterState {
  return {
    category: params.get('category') ?? DEFAULT_FILTERS.category,
    language: params.get('language') ?? DEFAULT_FILTERS.language,
    format: params.get('format') ?? DEFAULT_FILTERS.format,
    minPrice: Number(params.get('minPrice') ?? DEFAULT_FILTERS.minPrice),
    maxPrice: Number(params.get('maxPrice') ?? DEFAULT_FILTERS.maxPrice),
    minRating: Number(params.get('minRating') ?? DEFAULT_FILTERS.minRating),
    inStockOnly: params.get('inStockOnly') === 'true',
  };
}

function sortFromParams(params: URLSearchParams): SortOption {
  const s = params.get('sort') ?? '';
  return (Object.keys(SORT_MAP) as SortOption[]).find((k) => SORT_MAP[k] === s) ?? 'relevance';
}

function buildParams(
  q: string,
  filters: FilterState,
  sort: SortOption,
  page: number,
): URLSearchParams {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (filters.category) p.set('category', filters.category);
  if (filters.language) p.set('language', filters.language);
  if (filters.format) p.set('format', filters.format);
  if (filters.minPrice !== DEFAULT_FILTERS.minPrice) p.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice !== DEFAULT_FILTERS.maxPrice) p.set('maxPrice', String(filters.maxPrice));
  if (filters.minRating) p.set('minRating', String(filters.minRating));
  if (filters.inStockOnly) p.set('inStockOnly', 'true');
  if (SORT_MAP[sort]) p.set('sort', SORT_MAP[sort]);
  if (page > 1) p.set('page', String(page));
  return p;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1 pt-8">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="btn-outline px-3 py-1.5 text-sm disabled:opacity-40"
      >
        Previous
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-stone-400">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p as number)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'h-9 min-w-[2.25rem] rounded-lg px-2 text-sm font-semibold transition-colors',
              p === page ? 'bg-brand-700 text-white' : 'border border-stone-300 bg-white text-stone-700 hover:bg-paper-100',
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="btn-outline px-3 py-1.5 text-sm disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <Search className="h-16 w-16 text-paper-300" />
      <h2 className="text-xl font-serif">No books found</h2>
      {query ? (
        <p className="text-stone-500 max-w-sm">
          We couldn't find any books matching{' '}
          <span className="font-semibold text-stone-900">"{query}"</span>.
          Try a different search term or clear the filters.
        </p>
      ) : (
        <p className="text-stone-500">Try adjusting or clearing your filters.</p>
      )}
      <div className="flex flex-wrap gap-2 justify-center mt-2">
        {query && (
          <span className="badge bg-paper-200 text-stone-600 text-sm px-3 py-1">Try: Fiction</span>
        )}
        <span className="badge bg-paper-200 text-stone-600 text-sm px-3 py-1">Try: Science</span>
        <span className="badge bg-paper-200 text-stone-600 text-sm px-3 py-1">Try: Biography</span>
      </div>
      <button type="button" onClick={onClear} className="btn-outline mt-2">
        <X className="h-4 w-4" /> Clear all filters
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 24;

export function CataloguePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Derive controlled state from URL
  const query = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page') ?? 1);
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const sort = useMemo(() => sortFromParams(searchParams), [searchParams]);

  // Results
  const [result, setResult] = useState<BookSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Layout preference (not URL-synced, just local)
  const [layout, setLayout] = useState<ViewLayout>('grid');

  // Abort previous fetch on param change
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    catalogueApi
      .categories()
      .then(setCategories)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    const params: Record<string, string | number | undefined> = {
      q: query || undefined,
      category: filters.category || undefined,
      language: filters.language || undefined,
      format: filters.format || undefined,
      minPrice: filters.minPrice !== DEFAULT_FILTERS.minPrice ? filters.minPrice : undefined,
      maxPrice: filters.maxPrice !== DEFAULT_FILTERS.maxPrice ? filters.maxPrice : undefined,
      minRating: filters.minRating || undefined,
      inStock: filters.inStockOnly ? 'true' : undefined,
      sort: SORT_MAP[sort] || undefined,
      page,
      pageSize: PAGE_SIZE,
    };

    catalogueApi
      .search(params, true)
      .then((data) => {
        if (!ctrl.signal.aborted) setResult(data);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setResult({ items: [], page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [query, filters, sort, page]);

  // ─── URL updaters ──────────────────────────────────────────────────────────

  const applyFilters = useCallback(
    (next: FilterState) => {
      setSearchParams(buildParams(query, next, sort, 1), { replace: true });
    },
    [query, sort, setSearchParams],
  );

  const applySort = useCallback(
    (next: SortOption) => {
      setSearchParams(buildParams(query, filters, next, 1), { replace: true });
    },
    [query, filters, setSearchParams],
  );

  const applyPage = useCallback(
    (next: number) => {
      setSearchParams(buildParams(query, filters, sort, next));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [query, filters, sort, setSearchParams],
  );

  const removeFilter = useCallback(
    (key: keyof FilterState) => {
      applyFilters({ ...filters, [key]: DEFAULT_FILTERS[key] });
    },
    [filters, applyFilters],
  );

  const clearAll = useCallback(() => {
    navigate('/books', { replace: true });
  }, [navigate]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const books: Book[] = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 0;

  return (
    <div className="container-page py-6 pb-16">
      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-3xl">
          {query ? `Results for "${query}"` : 'Browse Books'}
        </h1>
        {filters.category && (
          <p className="mt-1 text-sm text-stone-500 capitalize">in {filters.category.replace(/-/g, ' ')}</p>
        )}
      </div>

      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <div className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20">
            <FilterSidebar
              categories={categories}
              filters={filters}
              onChange={applyFilters}
            />
          </div>
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Mobile filter button */}
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="btn-outline gap-2"
            >
              <Filter className="h-4 w-4" /> Filters
            </button>
          </div>

          {/* Sort bar */}
          <div className="mb-5">
            <SortBar
              total={total}
              sort={sort}
              layout={layout}
              filters={filters}
              onSortChange={applySort}
              onLayoutChange={setLayout}
              onRemoveFilter={removeFilter}
            />
          </div>

          {/* Results grid / list */}
          {loading ? (
            <div
              className={cn(
                'grid gap-4',
                layout === 'grid'
                  ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6'
                  : 'grid-cols-1',
              )}
            >
              <GridSkeleton count={layout === 'grid' ? 12 : 6} />
            </div>
          ) : books.length === 0 ? (
            <EmptyState query={query} onClear={clearAll} />
          ) : (
            <div
              className={cn(
                'grid gap-4',
                layout === 'grid'
                  ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6'
                  : 'grid-cols-1',
              )}
            >
              {books.map((book) => (
                <BookCard key={book.id} book={book} layout={layout} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onChange={applyPage} />
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      <Drawer
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        title="Filters"
        side="left"
      >
        <div className="p-4">
          <FilterSidebar
            categories={categories}
            filters={filters}
            onChange={(next) => {
              applyFilters(next);
              setMobileFiltersOpen(false);
            }}
            onClose={() => setMobileFiltersOpen(false)}
          />
        </div>
      </Drawer>
    </div>
  );
}

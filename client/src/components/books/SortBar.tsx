/**
 * SortBar — shows items count, active filter chips, view toggle, and sort dropdown.
 */
import { LayoutGrid, LayoutList, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import type { FilterState } from './FilterSidebar';
import { DEFAULT_FILTERS } from './FilterSidebar';

export type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
export type ViewLayout = 'grid' | 'list';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'newest', label: 'Newest' },
];

interface SortBarProps {
  total: number;
  sort: SortOption;
  layout: ViewLayout;
  filters: FilterState;
  onSortChange: (s: SortOption) => void;
  onLayoutChange: (l: ViewLayout) => void;
  onRemoveFilter: (key: keyof FilterState) => void;
}

export function SortBar({
  total,
  sort,
  layout,
  filters,
  onSortChange,
  onLayoutChange,
  onRemoveFilter,
}: SortBarProps) {
  const chips = buildChips(filters);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Count */}
        <p className="text-sm text-stone-600">
          <span className="font-semibold text-stone-900">{total.toLocaleString()}</span>{' '}
          {total === 1 ? 'result' : 'results'}
        </p>

        <div className="flex items-center gap-2">
          {/* Layout toggle */}
          <div className="inline-flex rounded-lg border border-stone-300 bg-white overflow-hidden">
            <LayoutButton active={layout === 'grid'} label="Grid view" onClick={() => onLayoutChange('grid')}>
              <LayoutGrid className="h-4 w-4" />
            </LayoutButton>
            <LayoutButton active={layout === 'list'} label="List view" onClick={() => onLayoutChange('list')}>
              <LayoutList className="h-4 w-4" />
            </LayoutButton>
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="sort-select" className="text-sm text-stone-600 hidden sm:block">
              Sort by
            </label>
            <select
              id="sort-select"
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="input py-1.5 pr-8 text-sm"
              style={{ width: 'auto' }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Active filters">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full border border-brand-300 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => onRemoveFilter(chip.key as keyof FilterState)}
                aria-label={`Remove ${chip.label} filter`}
                className="ml-0.5 rounded-full p-0.5 hover:bg-brand-200"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function LayoutButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn('px-2.5 py-1.5 transition-colors', active ? 'bg-brand-700 text-white' : 'text-stone-500 hover:bg-paper-100')}
    >
      {children}
    </button>
  );
}

interface Chip { key: string; label: string }

function buildChips(filters: FilterState): Chip[] {
  const chips: Chip[] = [];
  if (filters.category) chips.push({ key: 'category', label: `Category: ${filters.category}` });
  if (filters.language) chips.push({ key: 'language', label: filters.language });
  if (filters.format) chips.push({ key: 'format', label: filters.format === 'EBOOK' ? 'E-Book' : filters.format.charAt(0) + filters.format.slice(1).toLowerCase() });
  if (filters.minPrice !== DEFAULT_FILTERS.minPrice || filters.maxPrice !== DEFAULT_FILTERS.maxPrice) {
    chips.push({ key: 'price', label: `${formatPrice(filters.minPrice)} – ${formatPrice(filters.maxPrice)}` });
  }
  if (filters.minRating > 0) chips.push({ key: 'minRating', label: `${filters.minRating}★ & up` });
  if (filters.inStockOnly) chips.push({ key: 'inStockOnly', label: 'In stock' });
  return chips;
}

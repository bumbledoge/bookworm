/**
 * FilterSidebar — multi-faceted filter panel.
 *
 * All state is controlled: the parent (CataloguePage) owns the filter values
 * and passes them in via `filters`, applying changes via `onChange`.
 */
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import type { Category } from '@/types';

export interface FilterState {
  category: string;         // category slug or ''
  language: string;         // '' = any
  format: string;           // '' = any
  minPrice: number;
  maxPrice: number;
  minRating: number;        // 0, 3, or 4
  inStockOnly: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  category: '',
  language: '',
  format: '',
  minPrice: 0,
  maxPrice: 200,
  minRating: 0,
  inStockOnly: false,
};

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Japanese'];
const FORMATS = [
  { value: 'PAPERBACK', label: 'Paperback' },
  { value: 'HARDCOVER', label: 'Hardcover' },
  { value: 'EBOOK', label: 'E-Book' },
];
const RATINGS = [
  { value: 4, label: '4★ & up' },
  { value: 3, label: '3★ & up' },
];
const MAX_PRICE_LIMIT = 200;

interface FilterSidebarProps {
  categories: Category[];
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onClose?: () => void;   // only used in the mobile sheet variant
  className?: string;
}

export function FilterSidebar({ categories, filters, onChange, onClose, className }: FilterSidebarProps) {
  const update = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onChange({ ...filters, [key]: value });

  const hasActiveFilters =
    filters.category !== '' ||
    filters.language !== '' ||
    filters.format !== '' ||
    filters.minPrice !== DEFAULT_FILTERS.minPrice ||
    filters.maxPrice !== DEFAULT_FILTERS.maxPrice ||
    filters.minRating !== 0 ||
    filters.inStockOnly;

  return (
    <aside className={cn('flex flex-col gap-5', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-stone-900">Filters</h2>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_FILTERS })}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              Clear all
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} className="btn-ghost p-1.5" aria-label="Close filters">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Category */}
      <FilterSection title="Category">
        <RadioGroup
          value={filters.category}
          options={[{ value: '', label: 'All categories' }, ...categories.map((c) => ({ value: c.slug, label: `${c.name} (${c.bookCount})` }))]}
          onChange={(v) => update('category', v)}
        />
      </FilterSection>

      {/* Language */}
      <FilterSection title="Language">
        <RadioGroup
          value={filters.language}
          options={[{ value: '', label: 'Any language' }, ...LANGUAGES.map((l) => ({ value: l, label: l }))]}
          onChange={(v) => update('language', v)}
        />
      </FilterSection>

      {/* Format */}
      <FilterSection title="Format">
        <RadioGroup
          value={filters.format}
          options={[{ value: '', label: 'Any format' }, ...FORMATS]}
          onChange={(v) => update('format', v)}
        />
      </FilterSection>

      {/* Price range */}
      <FilterSection title="Price Range">
        <div className="space-y-3">
          <div className="flex justify-between text-xs text-stone-500">
            <span>{formatPrice(filters.minPrice)}</span>
            <span>{filters.maxPrice >= MAX_PRICE_LIMIT ? `${formatPrice(MAX_PRICE_LIMIT)}+` : formatPrice(filters.maxPrice)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={MAX_PRICE_LIMIT}
            step={5}
            value={filters.minPrice}
            aria-label="Minimum price"
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v <= filters.maxPrice) update('minPrice', v);
            }}
            className="slider w-full accent-brand-600"
          />
          <input
            type="range"
            min={0}
            max={MAX_PRICE_LIMIT}
            step={5}
            value={filters.maxPrice}
            aria-label="Maximum price"
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= filters.minPrice) update('maxPrice', v);
            }}
            className="slider w-full accent-brand-600"
          />
        </div>
      </FilterSection>

      {/* Min Rating */}
      <FilterSection title="Minimum Rating">
        <RadioGroup
          value={String(filters.minRating)}
          options={[{ value: '0', label: 'Any rating' }, ...RATINGS.map((r) => ({ value: String(r.value), label: r.label }))]}
          onChange={(v) => update('minRating', Number(v))}
        />
      </FilterSection>

      {/* In Stock */}
      <FilterSection title="Availability">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={filters.inStockOnly}
            onChange={(e) => update('inStockOnly', e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 accent-brand-600"
          />
          In stock only
        </label>
      </FilterSection>
    </aside>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label mb-2">{title}</p>
      {children}
    </div>
  );
}

function RadioGroup({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <ul className="space-y-1">
      {options.map((o) => (
        <li key={o.value}>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700 hover:text-stone-900">
            <input
              type="radio"
              name={o.label}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="accent-brand-600"
            />
            <span className="truncate">{o.label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

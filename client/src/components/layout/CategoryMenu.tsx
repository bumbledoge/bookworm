import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router-dom';
import { catalogueApi } from '@/services/api';
import type { Category } from '@/types';

/** Loads categories once and shares them between desktop and mobile navigation. */
export function useCategories(): Category[] {
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    let cancelled = false;
    catalogueApi
      .categories()
      .then((c) => !cancelled && setCategories(c))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return categories;
}

export function CategoryMenu({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn-ghost gap-1.5" aria-haspopup="menu" aria-expanded={open}>
        <LayoutGrid className="h-4 w-4" /> Browse
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="card absolute left-0 top-full z-40 mt-2 grid w-[28rem] animate-fade-in grid-cols-2 gap-1 p-2">
          <Link role="menuitem" to="/books" onClick={() => setOpen(false)} className="col-span-2 rounded-lg px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50">
            All books
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              role="menuitem"
              to={`/books?category=${c.slug}`}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-paper-100"
            >
              <span className="truncate">{c.name}</span>
              <span className="ml-2 text-xs text-stone-400">{c.bookCount}</span>
            </Link>
          ))}
          {categories.length === 0 && <p className="col-span-2 px-3 py-2 text-sm text-stone-500">Loading categories...</p>}
        </div>
      )}
    </div>
  );
}

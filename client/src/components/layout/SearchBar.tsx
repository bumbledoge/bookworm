import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Loader2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { catalogueApi } from '@/services/api';
import type { Book } from '@/types';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

export function SearchBar({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Debounced instant suggestions; stale responses are ignored.
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      catalogueApi
        .search({ q, pageSize: 6 }, true)
        .then((res) => {
          if (cancelled) return;
          setSuggestions(res.items);
          setActive(-1);
        })
        .catch(() => !cancelled && setSuggestions([]))
        .finally(() => !cancelled && setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    setQuery('');
    onNavigate?.();
    navigate(path);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (active >= 0 && suggestions[active]) go(`/books/${suggestions[active].id}`);
    else if (q) go(`/books?q=${encodeURIComponent(q)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showPanel = open && query.trim().length >= MIN_CHARS;

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <form onSubmit={onSubmit} role="search">
        <label htmlFor="site-search" className="sr-only">
          Search books, authors or ISBN
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          id="site-search"
          type="search"
          autoComplete="off"
          value={query}
          placeholder="Search books, authors, ISBN..."
          className="input rounded-full bg-paper-50 pl-9 pr-9"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-stone-400" />}
      </form>

      {showPanel && (
        <ul
          id="search-suggestions"
          role="listbox"
          className="card absolute left-0 right-0 top-full z-40 mt-2 max-h-96 overflow-y-auto py-1"
        >
          {suggestions.map((b, i) => (
            <li key={b.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(`/books/${b.id}`)}
                className={cn('flex w-full items-center gap-3 px-3 py-2 text-left', i === active && 'bg-brand-50')}
              >
                {b.coverUrl ? (
                  <img src={b.coverUrl} alt="" className="h-12 w-9 shrink-0 rounded object-cover" />
                ) : (
                  <span className="h-12 w-9 shrink-0 rounded bg-paper-200" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-stone-900">{b.title}</span>
                  <span className="block truncate text-xs text-stone-500">{b.author.name}</span>
                </span>
                <span className="text-sm font-semibold text-brand-800">{formatPrice(b.price)}</span>
              </button>
            </li>
          ))}
          {!loading && suggestions.length === 0 && (
            <li className="px-3 py-3 text-sm text-stone-500">No matches for "{query.trim()}"</li>
          )}
          <li className="border-t border-paper-200">
            <button
              type="button"
              onClick={() => go(`/books?q=${encodeURIComponent(query.trim())}`)}
              className="w-full px-3 py-2 text-left text-sm font-semibold text-ink-700 hover:bg-ink-50"
            >
              See all results for "{query.trim()}"
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

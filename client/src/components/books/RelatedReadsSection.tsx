import { useEffect, useState } from 'react';
import { BookCard } from '@/components/books/BookCard';
import { catalogueApi } from '@/services/api';
import type { Book } from '@/types';

/** Related books (same author first, then same category) with quick add-to-cart on each card. */
export function RelatedReadsSection({ bookId }: { bookId: string }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    catalogueApi
      .related(bookId, 8)
      .then((items) => {
        if (!cancelled) setBooks(items);
      })
      .catch(() => {
        if (!cancelled) setBooks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  if (!loading && books.length === 0) return null;

  return (
    <section id="related-reads" className="scroll-mt-24" aria-labelledby="related-reads-heading">
      <h2 id="related-reads-heading" className="mb-4 text-2xl">
        Related Reads
      </h2>
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="card h-80 animate-pulse bg-paper-100" />
          ))}
        </div>
      ) : (
        <ul className="flex snap-x gap-4 overflow-x-auto pb-3">
          {books.map((b) => (
            <li key={b.id} className="w-44 shrink-0 snap-start sm:w-48">
              <BookCard book={b} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

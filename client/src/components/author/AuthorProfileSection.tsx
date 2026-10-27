import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { authorApi } from '@/services/api';
import type { AuthorProfile } from '@/types';
import { RatingStars } from '@/components/books/RatingStars';
import { formatPrice } from '@/lib/format';

interface AuthorProfileSectionProps {
  authorId: string;
  /** The book being viewed; excluded from the "other books" shelf. */
  currentBookId: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function AuthorProfileSection({ authorId, currentBookId }: AuthorProfileSectionProps) {
  const [author, setAuthor] = useState<AuthorProfile | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setExpanded(false);
    authorApi
      .get(authorId)
      .then((a) => {
        if (cancelled) return;
        setAuthor(a);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [authorId]);

  const genres = useMemo(
    () => (author ? [...new Set(author.books.map((b) => b.category.name))] : []),
    [author],
  );
  const otherBooks = useMemo(
    () => (author ? author.books.filter((b) => b.id !== currentBookId) : []),
    [author, currentBookId],
  );

  return (
    <section id="about-the-writer" className="scroll-mt-24" aria-labelledby="about-the-writer-heading">
      <h2 id="about-the-writer-heading" className="mb-4 text-2xl">
        About the Writer
      </h2>

      {status === 'loading' && <div className="card h-40 animate-pulse bg-paper-100" aria-busy="true" />}

      {status === 'error' && (
        <p className="card p-4 text-sm text-stone-500">Author details are unavailable right now.</p>
      )}

      {status === 'ready' && author && (
        <div className="card p-5">
          <div className="flex flex-col gap-5 sm:flex-row">
            {author.photoUrl ? (
              <img
                src={author.photoUrl}
                alt={`Portrait of ${author.name}`}
                className="h-28 w-28 shrink-0 rounded-full object-cover shadow-card"
                loading="lazy"
              />
            ) : (
              <div
                className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-brand-100 to-brand-200 font-serif text-3xl font-bold text-brand-800"
                aria-hidden="true"
              >
                {initials(author.name)}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h3 className="text-xl">{author.name}</h3>
              <p className="mt-0.5 text-sm text-stone-500">
                {[author.nationality, author.birthYear ? `Born ${author.birthYear}` : null]
                  .filter(Boolean)
                  .join(' · ') || 'Author'}
              </p>

              {genres.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {genres.map((g) => (
                    <span key={g} className="badge bg-paper-200 text-stone-600">
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {author.bio ? (
                <>
                  <p className={`mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-700 ${expanded ? '' : 'line-clamp-4'}`}>
                    {author.bio}
                  </p>
                  {author.bio.length > 280 && (
                    <button
                      type="button"
                      onClick={() => setExpanded((v) => !v)}
                      className="mt-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
                    >
                      {expanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </>
              ) : (
                <p className="mt-3 text-sm text-stone-500">No biography available yet.</p>
              )}
            </div>
          </div>

          {otherBooks.length > 0 && (
            <div className="mt-6 border-t border-paper-300 pt-4">
              <h3 className="mb-3 text-base">More by {author.name}</h3>
              <ul className="flex gap-4 overflow-x-auto pb-2">
                {otherBooks.map((b) => (
                  <li key={b.id} className="w-28 shrink-0">
                    <Link to={`/books/${b.id}`} className="group block">
                      {b.coverUrl ? (
                        <img
                          src={b.coverUrl}
                          alt={`Cover of ${b.title}`}
                          className="h-40 w-28 rounded object-cover shadow-card transition-shadow group-hover:shadow-card-hover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-40 w-28 items-end justify-center rounded bg-gradient-to-b from-brand-100 to-brand-200 p-2">
                          <span className="text-center text-xs font-semibold text-brand-800 line-clamp-4">{b.title}</span>
                        </div>
                      )}
                      <p className="mt-2 text-xs font-semibold text-stone-900 line-clamp-2 group-hover:text-brand-800">
                        {b.title}
                      </p>
                    </Link>
                    <RatingStars rating={b.avgRating} size={11} className="mt-0.5" />
                    <p className="text-xs font-bold text-brand-800">{formatPrice(b.price)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

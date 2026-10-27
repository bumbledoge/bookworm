import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PenLine, ThumbsUp } from 'lucide-react';
import { RatingStars } from '@/components/books/RatingStars';
import { AuthModal } from '@/components/layout/AuthModal';
import { Modal } from '@/components/ui/Overlay';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { cn } from '@/lib/cn';
import { getErrorMessage, reviewApi, type ReviewSort } from '@/services/api';
import type { ReviewList } from '@/types';

const VOTED_KEY = 'bookworm.helpfulVotes';
const PAGE_SIZE = 5;

const SORT_OPTIONS: { value: ReviewSort; label: string }[] = [
  { value: 'helpful', label: 'Most helpful' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating_desc', label: 'Highest rated' },
  { value: 'rating_asc', label: 'Lowest rated' },
];

const RATING_LABEL = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

function loadVoted(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(VOTED_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

interface ReviewsSectionProps {
  bookId: string;
  bookTitle: string;
  /** Called after a review is posted so the page can refresh the aggregate rating. */
  onReviewPosted?: () => void;
}

export function ReviewsSection({ bookId, bookTitle, onReviewPosted }: ReviewsSectionProps) {
  const { isGuest } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<ReviewList | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sort, setSort] = useState<ReviewSort>('helpful');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [voted, setVoted] = useState<Set<string>>(loadVoted);

  const load = useCallback(
    async (nextPage: number, nextSort: ReviewSort) => {
      try {
        const res = await reviewApi.list(bookId, { sort: nextSort, page: nextPage, pageSize: PAGE_SIZE });
        setData(res);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    },
    [bookId],
  );

  useEffect(() => {
    setStatus('loading');
    setPage(1);
  }, [bookId]);

  useEffect(() => {
    void load(page, sort);
  }, [load, page, sort]);

  const handleHelpful = async (reviewId: string) => {
    if (voted.has(reviewId)) return;
    try {
      const updated = await reviewApi.helpful(reviewId);
      setData((prev) =>
        prev ? { ...prev, items: prev.items.map((r) => (r.id === reviewId ? { ...r, helpful: updated.helpful } : r)) } : prev,
      );
      const next = new Set(voted).add(reviewId);
      setVoted(next);
      localStorage.setItem(VOTED_KEY, JSON.stringify([...next]));
    } catch {
      // The Axios interceptor already showed an error toast.
    }
  };

  const handleWriteClick = () => {
    if (isGuest) {
      toast.info('Please sign in to write a review');
      setAuthOpen(true);
    } else {
      setFormOpen(true);
    }
  };

  const handlePosted = () => {
    setFormOpen(false);
    toast.success('Thanks! Your review has been posted');
    if (page !== 1 || sort !== 'newest') {
      setPage(1);
      setSort('newest');
    } else {
      void load(1, 'newest');
    }
    onReviewPosted?.();
  };

  return (
    <section id="reviews" className="scroll-mt-24" aria-labelledby="reviews-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="reviews-heading" className="text-2xl">
          Customer Reviews
        </h2>
        <button type="button" onClick={handleWriteClick} className="btn-outline">
          <PenLine className="h-4 w-4" />
          Write a review
        </button>
      </div>

      {status === 'loading' && <div className="card h-48 animate-pulse bg-paper-100" aria-busy="true" />}
      {status === 'error' && (
        <div className="card flex items-center justify-between gap-3 p-4 text-sm text-stone-600">
          <span>Reviews could not be loaded.</span>
          <button type="button" className="btn-outline" onClick={() => void load(page, sort)}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && data && (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <RatingSummary data={data} />

          <div>
            {data.total === 0 ? (
              <div className="card p-8 text-center">
                <p className="font-serif text-lg text-stone-900">No reviews yet</p>
                <p className="mt-1 text-sm text-stone-500">Be the first to share what you thought of this book.</p>
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-stone-500">
                    {data.total} review{data.total === 1 ? '' : 's'}
                  </p>
                  <label className="flex items-center gap-2 text-sm text-stone-600">
                    Sort by
                    <select
                      className="input w-auto py-1"
                      value={sort}
                      onChange={(e) => {
                        setSort(e.target.value as ReviewSort);
                        setPage(1);
                      }}
                    >
                      {SORT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <ul className="space-y-3">
                  {data.items.map((r) => (
                    <li key={r.id} className="card p-4">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800"
                          aria-hidden="true"
                        >
                          {r.user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-stone-900">{r.user.name}</span>
                        <span className="text-xs text-stone-400">{formatDate(r.createdAt)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <RatingStars rating={r.rating} size={14} />
                        {r.title && <h3 className="font-sans text-sm font-semibold">{r.title}</h3>}
                      </div>
                      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-stone-700">{r.comment}</p>
                      <button
                        type="button"
                        onClick={() => void handleHelpful(r.id)}
                        disabled={voted.has(r.id)}
                        className={cn(
                          'mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                          voted.has(r.id)
                            ? 'border-brand-300 bg-brand-50 text-brand-800'
                            : 'border-stone-300 text-stone-600 hover:border-brand-600 hover:text-brand-700',
                        )}
                        aria-label={`Mark review by ${r.user.name} as helpful`}
                      >
                        <ThumbsUp className={cn('h-3.5 w-3.5', voted.has(r.id) && 'fill-current')} />
                        Helpful{r.helpful > 0 ? ` (${r.helpful})` : ''}
                      </button>
                    </li>
                  ))}
                </ul>

                {data.totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </button>
                    <span className="text-sm text-stone-500">
                      Page {data.page} of {data.totalPages}
                    </span>
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={page >= data.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <ReviewFormModal
        open={formOpen}
        bookId={bookId}
        bookTitle={bookTitle}
        onClose={() => setFormOpen(false)}
        onPosted={handlePosted}
      />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </section>
  );
}

function RatingSummary({ data }: { data: ReviewList }) {
  const maxCount = Math.max(1, ...Object.values(data.breakdown));
  return (
    <div className="card h-fit p-5">
      <div className="flex items-center gap-4">
        <span className="font-serif text-5xl font-bold text-stone-900">{data.avgRating.toFixed(1)}</span>
        <div>
          <RatingStars rating={data.avgRating} size={18} />
          <p className="mt-1 text-sm text-stone-500">
            {data.ratingCount.toLocaleString()} rating{data.ratingCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = data.breakdown[String(star) as keyof ReviewList['breakdown']];
          const pct = data.ratingCount > 0 ? Math.round((count / data.ratingCount) * 100) : 0;
          return (
            <li key={star} className="flex items-center gap-2 text-xs text-stone-600">
              <span className="w-6 shrink-0 text-right font-semibold">{star}★</span>
              <div
                className="h-2.5 flex-1 overflow-hidden rounded-full bg-paper-200"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${star} star reviews`}
              >
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${(count / maxCount) * 100}%` }} />
              </div>
              <span className="w-9 shrink-0 text-right tabular-nums">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface ReviewFormModalProps {
  open: boolean;
  bookId: string;
  bookTitle: string;
  onClose: () => void;
  onPosted: () => void;
}

function ReviewFormModal({ open, bookId, bookTitle, onClose, onPosted }: ReviewFormModalProps) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRating(0);
      setTitle('');
      setComment('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      setError('Please select a star rating');
      return;
    }
    if (comment.trim().length < 3) {
      setError('Please write at least 3 characters in your review');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await reviewApi.create(bookId, {
        rating,
        title: title.trim() || undefined,
        comment: comment.trim(),
      });
      onPosted();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Write a review">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <p className="text-sm text-stone-500">
          Reviewing <span className="font-semibold text-stone-800">{bookTitle}</span>
        </p>

        <div>
          <span className="label">Your rating</span>
          <div className="flex items-center gap-2">
            <RatingStars rating={rating} size={28} interactive onChange={setRating} />
            {rating > 0 && <span className="text-sm text-stone-600">{RATING_LABEL[rating]}</span>}
          </div>
        </div>

        <div>
          <label htmlFor="review-title" className="label">
            Title (optional)
          </label>
          <input
            id="review-title"
            className="input"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sum up your thoughts"
          />
        </div>

        <div>
          <label htmlFor="review-comment" className="label">
            Your review
          </label>
          <textarea
            id="review-comment"
            className="input min-h-[120px]"
            value={comment}
            maxLength={2000}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did you like or dislike about this book?"
          />
          <p className="mt-1 text-right text-xs text-stone-400">{comment.length}/2000</p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Posting…' : 'Post review'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

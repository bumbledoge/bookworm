import { Review, User } from '@prisma/client';
import { Request, Response } from 'express';
import { forbidden, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { getUserId } from '../middleware/auth';
import { parsePagination, queryString } from '../lib/validation';

export interface ReviewBody {
  rating: number;
  title?: string;
  comment: string;
}

export const REVIEW_SORTS = ['newest', 'helpful', 'rating_desc', 'rating_asc'] as const;
type ReviewSort = (typeof REVIEW_SORTS)[number];

const ORDER_BY = {
  newest: [{ createdAt: 'desc' }],
  helpful: [{ helpful: 'desc' }, { createdAt: 'desc' }],
  rating_desc: [{ rating: 'desc' }, { createdAt: 'desc' }],
  rating_asc: [{ rating: 'asc' }, { createdAt: 'desc' }],
} as const;

type ReviewWithUser = Review & { user: Pick<User, 'id' | 'name'> };

function serializeReview(r: ReviewWithUser) {
  return {
    id: r.id,
    bookId: r.bookId,
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    helpful: r.helpful,
    createdAt: r.createdAt,
    user: { id: r.user.id, name: r.user.name },
  };
}

const withUser = { user: { select: { id: true, name: true } } } as const;

/** Count of reviews per star, always containing all of 1..5. */
async function ratingBreakdown(bookId: string): Promise<Record<'1' | '2' | '3' | '4' | '5', number>> {
  const groups = await prisma.review.groupBy({ by: ['rating'], where: { bookId }, _count: { _all: true } });
  const breakdown = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  for (const g of groups) {
    if (g.rating >= 1 && g.rating <= 5) breakdown[String(g.rating) as keyof typeof breakdown] = g._count._all;
  }
  return breakdown;
}

/** Recomputes and stores the book's aggregate rating from its reviews. */
export async function recalculateBookRating(bookId: string) {
  const agg = await prisma.review.aggregate({ where: { bookId }, _avg: { rating: true }, _count: { _all: true } });
  const avgRating = agg._avg.rating === null ? 0 : Math.round(agg._avg.rating * 10) / 10;
  return prisma.book.update({
    where: { id: bookId },
    data: { avgRating, ratingCount: agg._count._all },
    select: { avgRating: true, ratingCount: true },
  });
}

async function requireBook(bookId: string) {
  const book = await prisma.book.findUnique({ where: { id: bookId }, select: { id: true, avgRating: true, ratingCount: true } });
  if (!book) throw notFound('Book not found');
  return book;
}

export async function listReviews(req: Request, res: Response) {
  const book = await requireBook(req.params.bookId);
  const requested = queryString(req.query.sort) ?? 'newest';
  const sort: ReviewSort = (REVIEW_SORTS as readonly string[]).includes(requested) ? (requested as ReviewSort) : 'newest';
  const { page, pageSize, skip } = parsePagination(req.query, 10);

  const [total, reviews, breakdown] = await Promise.all([
    prisma.review.count({ where: { bookId: book.id } }),
    prisma.review.findMany({
      where: { bookId: book.id },
      include: withUser,
      orderBy: [...ORDER_BY[sort], { id: 'asc' }],
      skip,
      take: pageSize,
    }),
    ratingBreakdown(book.id),
  ]);

  res.json({
    items: reviews.map(serializeReview),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    avgRating: book.avgRating,
    ratingCount: book.ratingCount,
    breakdown,
  });
}

export async function getReviewStats(req: Request, res: Response) {
  const book = await requireBook(req.params.bookId);
  res.json({ bookId: book.id, avgRating: book.avgRating, ratingCount: book.ratingCount, breakdown: await ratingBreakdown(book.id) });
}

/** One review per user per book: posting again updates the existing review. */
export async function createReview(req: Request, res: Response) {
  const userId = getUserId(req);
  const book = await requireBook(req.params.bookId);
  const body = req.body as ReviewBody;

  const data = { rating: body.rating, title: body.title ?? null, comment: body.comment };
  const review = await prisma.review.upsert({
    where: { bookId_userId: { bookId: book.id, userId } },
    create: { ...data, bookId: book.id, userId },
    update: data,
    include: withUser,
  });
  await recalculateBookRating(book.id);
  res.status(201).json(serializeReview(review));
}

export async function markReviewHelpful(req: Request, res: Response) {
  const existing = await prisma.review.findUnique({ where: { id: req.params.reviewId } });
  if (!existing) throw notFound('Review not found');
  const review = await prisma.review.update({
    where: { id: existing.id },
    data: { helpful: { increment: 1 } },
    include: withUser,
  });
  res.json(serializeReview(review));
}

export async function deleteReview(req: Request, res: Response) {
  const userId = getUserId(req);
  const review = await prisma.review.findUnique({ where: { id: req.params.reviewId } });
  if (!review) throw notFound('Review not found');
  if (review.userId !== userId) throw forbidden('You can only delete your own reviews');

  await prisma.review.delete({ where: { id: review.id } });
  await recalculateBookRating(review.bookId);
  res.status(204).end();
}

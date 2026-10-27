import { Router } from 'express';
import {
  createReview,
  deleteReview,
  getReviewStats,
  listReviews,
  markReviewHelpful,
  ReviewBody,
} from '../controllers/review.controller';
import { optString, reqInt, reqString } from '../lib/validation';
import { authenticateJwt, requireRegistered } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { validateBody } from '../middleware/validate';

const parseReview = validateBody<ReviewBody>((b, e) => ({
  rating: reqInt(b, 'rating', e, { min: 1, max: 5 }),
  title: optString(b, 'title', e, { max: 120 }),
  comment: reqString(b, 'comment', e, { min: 3, max: 2000 }),
}));

/**
 * Mounted at `/api` because it spans two resource paths:
 * `/books/:bookId/reviews` and `/reviews/:reviewId`.
 */
export const reviewRouter = Router();

reviewRouter.get('/books/:bookId/reviews', asyncHandler(listReviews));
reviewRouter.get('/books/:bookId/reviews/stats', asyncHandler(getReviewStats));
reviewRouter.post('/books/:bookId/reviews', authenticateJwt, requireRegistered, parseReview, asyncHandler(createReview));

reviewRouter.post('/reviews/:reviewId/helpful', asyncHandler(markReviewHelpful));
reviewRouter.delete('/reviews/:reviewId', authenticateJwt, requireRegistered, asyncHandler(deleteReview));

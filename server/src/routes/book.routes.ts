import { Router } from 'express';
import {
  getAuthor,
  getBestsellers,
  getBook,
  getBookFilters,
  getNewLaunches,
  getRecommended,
  getRelatedBooks,
  listCategories,
  searchBooks,
} from '../controllers/book.controller';
import { optionalAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

export const bookRouter = Router();
// Fixed paths must be registered before `/:bookId`.
bookRouter.get('/', asyncHandler(searchBooks));
bookRouter.get('/filters', asyncHandler(getBookFilters));
bookRouter.get('/recommended', optionalAuth, asyncHandler(getRecommended));
bookRouter.get('/bestsellers', asyncHandler(getBestsellers));
bookRouter.get('/new-launches', asyncHandler(getNewLaunches));
bookRouter.get('/:bookId', asyncHandler(getBook));
bookRouter.get('/:bookId/related', asyncHandler(getRelatedBooks));

export const categoryRouter = Router();
categoryRouter.get('/', asyncHandler(listCategories));

export const authorRouter = Router();
authorRouter.get('/:authorId', asyncHandler(getAuthor));

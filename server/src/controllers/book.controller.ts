import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { badRequest, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { parsePagination, queryBool, queryInt, queryNumber, queryString } from '../lib/validation';
import { bookInclude, serializeBook, serializeBookDetail } from '../services/book.serializer';

export const BOOK_FORMATS = ['PAPERBACK', 'HARDCOVER', 'EBOOK'] as const;
export const BOOK_SORTS = ['relevance', 'price_asc', 'price_desc', 'rating', 'newest'] as const;
type BookSort = (typeof BOOK_SORTS)[number];

const ORDER_BY: Record<BookSort, Prisma.BookOrderByWithRelationInput[]> = {
  relevance: [{ totalSales: 'desc' }, { avgRating: 'desc' }],
  price_asc: [{ price: 'asc' }],
  price_desc: [{ price: 'desc' }],
  rating: [{ avgRating: 'desc' }, { ratingCount: 'desc' }],
  newest: [{ publicationDate: 'desc' }],
};

// ------------------------------------------------------------------ categories

export async function listCategories(_req: Request, res: Response) {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { books: true } } },
  });
  res.json(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
      bookCount: c._count.books,
    }))
  );
}

// ---------------------------------------------------------------------- search

export async function searchBooks(req: Request, res: Response) {
  const q = req.query;
  const errors: string[] = [];

  const format = queryString(q.format)?.toUpperCase();
  if (format && !(BOOK_FORMATS as readonly string[]).includes(format)) {
    errors.push(`format must be one of: ${BOOK_FORMATS.join(', ')}`);
  }
  const sort = (queryString(q.sort) ?? 'relevance') as BookSort;
  if (!BOOK_SORTS.includes(sort)) errors.push(`sort must be one of: ${BOOK_SORTS.join(', ')}`);

  const minPrice = queryNumber(q.minPrice, 'minPrice', errors);
  const maxPrice = queryNumber(q.maxPrice, 'maxPrice', errors);
  const minRating = queryNumber(q.minRating, 'minRating', errors);
  if (minPrice !== undefined && minPrice < 0) errors.push('minPrice must be at least 0');
  if (maxPrice !== undefined && maxPrice < 0) errors.push('maxPrice must be at least 0');
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    errors.push('minPrice must not be greater than maxPrice');
  }
  if (minRating !== undefined && (minRating < 1 || minRating > 5)) errors.push('minRating must be between 1 and 5');
  if (errors.length > 0) throw badRequest('Invalid query parameters', errors);

  const keyword = queryString(q.q);
  const categorySlug = queryString(q.category);
  const language = queryString(q.language);
  const authorId = queryString(q.authorId);

  const where: Prisma.BookWhereInput = {};
  const and: Prisma.BookWhereInput[] = [];

  // SQLite's LIKE is case-insensitive for ASCII; on PostgreSQL add `mode: 'insensitive'`.
  if (keyword) {
    and.push({
      OR: [
        { title: { contains: keyword } },
        { subtitle: { contains: keyword } },
        { isbn: { contains: keyword } },
        { description: { contains: keyword } },
        { author: { name: { contains: keyword } } },
      ],
    });
  }
  if (categorySlug) and.push({ category: { slug: categorySlug } });
  if (language) and.push({ language });
  if (format) and.push({ format });
  if (authorId) and.push({ authorId });
  if (minPrice !== undefined || maxPrice !== undefined) {
    and.push({ price: { ...(minPrice !== undefined && { gte: minPrice }), ...(maxPrice !== undefined && { lte: maxPrice }) } });
  }
  if (minRating !== undefined) and.push({ avgRating: { gte: minRating } });
  if (queryBool(q.inStock)) and.push({ stock: { gt: 0 } });
  if (and.length > 0) where.AND = and;

  const { page, pageSize, skip } = parsePagination(q);
  const [total, books] = await Promise.all([
    prisma.book.count({ where }),
    prisma.book.findMany({
      where,
      include: bookInclude,
      // `id` as a final tiebreaker keeps pagination stable.
      orderBy: [...ORDER_BY[sort], { id: 'asc' }],
      skip,
      take: pageSize,
    }),
  ]);

  res.json({ items: books.map(serializeBook), page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}

export async function getBookFilters(_req: Request, res: Response) {
  const [languages, formats, price] = await Promise.all([
    prisma.book.findMany({ distinct: ['language'], select: { language: true }, orderBy: { language: 'asc' } }),
    prisma.book.findMany({ distinct: ['format'], select: { format: true }, orderBy: { format: 'asc' } }),
    prisma.book.aggregate({ _min: { price: true }, _max: { price: true } }),
  ]);
  res.json({
    languages: languages.map((l) => l.language),
    formats: formats.map((f) => f.format),
    priceRange: { min: price._min.price ?? 0, max: price._max.price ?? 0 },
  });
}

// ------------------------------------------------------------------- featured

const limitOf = (req: Request) => queryInt(req.query.limit, 8, 1, 50);

export async function getBestsellers(req: Request, res: Response) {
  const books = await prisma.book.findMany({
    where: { isBestseller: true },
    include: bookInclude,
    orderBy: [{ totalSales: 'desc' }, { id: 'asc' }],
    take: limitOf(req),
  });
  res.json(books.map(serializeBook));
}

export async function getNewLaunches(req: Request, res: Response) {
  const books = await prisma.book.findMany({
    where: { isNewLaunch: true },
    include: bookInclude,
    orderBy: [{ publicationDate: 'desc' }, { id: 'asc' }],
    take: limitOf(req),
  });
  res.json(books.map(serializeBook));
}

/**
 * Personalised for registered users with order history: unpurchased books from
 * the categories / authors they have bought from come first, topped up with the
 * curated "recommended" picks. Everyone else gets the curated picks.
 */
export async function getRecommended(req: Request, res: Response) {
  const limit = limitOf(req);
  const userId = req.auth?.userId;
  const picked = new Map<string, Awaited<ReturnType<typeof findCurated>>[number]>();

  if (userId) {
    const purchased = await prisma.orderItem.findMany({
      where: { order: { userId, status: { not: 'CANCELLED' } } },
      select: { book: { select: { id: true, categoryId: true, authorId: true } } },
    });
    if (purchased.length > 0) {
      const boughtIds = [...new Set(purchased.map((p) => p.book.id))];
      const categoryIds = [...new Set(purchased.map((p) => p.book.categoryId))];
      const authorIds = [...new Set(purchased.map((p) => p.book.authorId))];
      const personal = await prisma.book.findMany({
        where: { id: { notIn: boughtIds }, OR: [{ categoryId: { in: categoryIds } }, { authorId: { in: authorIds } }] },
        include: bookInclude,
        orderBy: [{ avgRating: 'desc' }, { totalSales: 'desc' }, { id: 'asc' }],
        take: limit,
      });
      personal.forEach((b) => picked.set(b.id, b));
    }
  }

  if (picked.size < limit) {
    const curated = await findCurated(limit + picked.size);
    for (const b of curated) {
      if (picked.size >= limit) break;
      if (!picked.has(b.id)) picked.set(b.id, b);
    }
  }
  res.json([...picked.values()].slice(0, limit).map(serializeBook));
}

function findCurated(take: number) {
  return prisma.book.findMany({
    where: { isRecommended: true },
    include: bookInclude,
    orderBy: [{ avgRating: 'desc' }, { totalSales: 'desc' }, { id: 'asc' }],
    take,
  });
}

// -------------------------------------------------------------------- details

export async function getBook(req: Request, res: Response) {
  const book = await prisma.book.findUnique({ where: { id: req.params.bookId }, include: bookInclude });
  if (!book) throw notFound('Book not found');
  res.json(serializeBookDetail(book));
}

/** Same author (strongest signal) or same category, then best rated. */
export async function getRelatedBooks(req: Request, res: Response) {
  const book = await prisma.book.findUnique({ where: { id: req.params.bookId } });
  if (!book) throw notFound('Book not found');

  const candidates = await prisma.book.findMany({
    where: { id: { not: book.id }, OR: [{ authorId: book.authorId }, { categoryId: book.categoryId }] },
    include: bookInclude,
  });
  const score = (b: (typeof candidates)[number]) => (b.authorId === book.authorId ? 2 : 0) + (b.categoryId === book.categoryId ? 1 : 0);
  candidates.sort(
    (a, b) => score(b) - score(a) || b.avgRating - a.avgRating || b.totalSales - a.totalSales || a.id.localeCompare(b.id)
  );
  res.json(candidates.slice(0, limitOf(req)).map(serializeBook));
}

export async function getAuthor(req: Request, res: Response) {
  const author = await prisma.author.findUnique({
    where: { id: req.params.authorId },
    include: { books: { include: bookInclude, orderBy: [{ totalSales: 'desc' }, { id: 'asc' }] } },
  });
  if (!author) throw notFound('Author not found');
  res.json({
    id: author.id,
    name: author.name,
    bio: author.bio,
    photoUrl: author.photoUrl,
    nationality: author.nationality,
    birthYear: author.birthYear,
    books: author.books.map(serializeBook),
  });
}

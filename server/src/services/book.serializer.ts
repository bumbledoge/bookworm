import { Prisma } from '@prisma/client';

export const bookInclude = {
  author: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.BookInclude;

export type BookWithRelations = Prisma.BookGetPayload<{ include: typeof bookInclude }>;

const DAY_MS = 24 * 60 * 60 * 1000;

export function serializeBook(b: BookWithRelations) {
  return {
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    author: b.author,
    category: b.category,
    language: b.language,
    format: b.format,
    price: b.price,
    originalPrice: b.originalPrice,
    coverUrl: b.coverUrl,
    avgRating: b.avgRating,
    ratingCount: b.ratingCount,
    inStock: b.stock > 0,
    isRecommended: b.isRecommended,
    isBestseller: b.isBestseller,
    isNewLaunch: b.isNewLaunch,
  };
}

export function serializeBookDetail(b: BookWithRelations) {
  return {
    ...serializeBook(b),
    description: b.description,
    isbn: b.isbn,
    publisher: b.publisher,
    pages: b.pages,
    publicationDate: b.publicationDate,
    stock: b.stock,
    totalSales: b.totalSales,
    deliveryDays: b.deliveryDays,
    estimatedDelivery: new Date(Date.now() + b.deliveryDays * DAY_MS),
  };
}

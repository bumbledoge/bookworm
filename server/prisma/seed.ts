import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const cover = (seed: string) => `https://picsum.photos/seed/${seed}/400/600`;
const portrait = (seed: string) => `https://picsum.photos/seed/${seed}/300/300`;
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
const categories = [
  { name: 'Fiction', description: 'Novels and short stories from around the world.' },
  { name: 'Mystery & Thriller', description: 'Page-turners full of suspense and twists.' },
  { name: 'Science Fiction & Fantasy', description: 'Other worlds, futures and magic systems.' },
  { name: 'Romance', description: 'Love stories, from slow burns to grand passions.' },
  { name: 'Non-Fiction', description: 'Biography, memoir, history and big ideas.' },
  { name: 'Self-Help & Business', description: 'Habits, productivity, money and leadership.' },
  { name: 'Technology', description: 'Programming, AI and the craft of building software.' },
  { name: "Children's Books", description: 'Stories and adventures for young readers.' },
];

// ---------------------------------------------------------------------------
// Authors
// ---------------------------------------------------------------------------
const authors = [
  { name: 'Eleanor Marsh', nationality: 'British', birthYear: 1974, bio: 'Eleanor Marsh is a British novelist whose quiet, character-driven fiction explores memory, family and the places we call home. A former librarian, she has published six novels and been shortlisted for several national prizes.' },
  { name: 'Rafael Ortega', nationality: 'Spanish', birthYear: 1968, bio: 'Rafael Ortega writes lyrical historical fiction set along the Mediterranean coast. His novels have been translated into more than twenty languages and adapted for television.' },
  { name: 'Priya Nair', nationality: 'Indian', birthYear: 1981, bio: 'Priya Nair is an award-winning Indian author known for sweeping family sagas and sharp social observation. She lives in Kochi and teaches creative writing.' },
  { name: 'Daniel Brooks', nationality: 'American', birthYear: 1971, bio: 'Daniel Brooks is a former investigative journalist turned thriller writer. His Detective Hale series has spent over 100 weeks on national bestseller lists.' },
  { name: 'Mara Lindqvist', nationality: 'Swedish', birthYear: 1979, bio: 'Mara Lindqvist is a leading voice in Nordic noir, praised for atmospheric settings and morally complex investigators.' },
  { name: 'Theo Calloway', nationality: 'American', birthYear: 1985, bio: 'Theo Calloway is a science fiction author and former aerospace engineer. His hard-SF novels blend rigorous science with deeply human stories.' },
  { name: 'Amara Okafor', nationality: 'Nigerian', birthYear: 1983, bio: 'Amara Okafor draws on West African mythology to build lush fantasy worlds. Her debut trilogy has been hailed as a landmark of modern fantasy.' },
  { name: 'Sophie Laurent', nationality: 'French', birthYear: 1987, bio: 'Sophie Laurent writes warm, witty contemporary romance set in Paris and Provence. She is a two-time winner of the Readers\' Choice Romance Award.' },
  { name: 'Dr. Marcus Reid', nationality: 'American', birthYear: 1966, bio: 'Marcus Reid is a historian and professor at a leading university. His narrative histories bring the past to life for general readers.' },
  { name: 'Hannah Whitfield', nationality: 'Canadian', birthYear: 1980, bio: 'Hannah Whitfield is a behavioural scientist and bestselling author on habits, focus and building a meaningful career.' },
  { name: 'Vikram Desai', nationality: 'Indian', birthYear: 1975, bio: 'Vikram Desai is an entrepreneur and investor who writes about leadership, startups and personal finance in plain, practical language.' },
  { name: 'Lena Fischer', nationality: 'German', birthYear: 1984, bio: 'Lena Fischer is a software architect and educator. Her books on clean code and distributed systems are widely used in engineering teams.' },
  { name: 'Arjun Mehta', nationality: 'Indian', birthYear: 1990, bio: 'Arjun Mehta is a machine learning researcher who explains AI concepts with clarity and a healthy dose of humour.' },
  { name: 'Beatrice Holloway', nationality: 'British', birthYear: 1962, bio: 'Beatrice Holloway has delighted generations of children with her illustrated adventures featuring curious animals and brave young explorers.' },
];

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------
type Fmt = 'PAPERBACK' | 'HARDCOVER' | 'EBOOK';
interface BookSeed {
  title: string;
  subtitle?: string;
  author: string;
  category: string;
  description: string;
  isbn: string;
  publisher: string;
  language?: string;
  format: Fmt;
  price: number;
  originalPrice?: number;
  stock: number;
  pages: number;
  publishedDaysAgo: number;
  totalSales: number;
  recommended?: boolean;
  bestseller?: boolean;
  newLaunch?: boolean;
  deliveryDays?: number;
}

const books: BookSeed[] = [
  // Fiction
  { title: 'The Lighthouse Keeper\'s Daughter', author: 'Eleanor Marsh', category: 'Fiction', description: 'On a windswept Cornish headland, three generations of women guard a secret that the sea is slowly giving back. A tender, haunting novel about inheritance and forgiveness.', isbn: '9780000000011', publisher: 'Harbour Press', format: 'PAPERBACK', price: 14.99, originalPrice: 17.99, stock: 120, pages: 352, publishedDaysAgo: 420, totalSales: 48210, recommended: true, bestseller: true },
  { title: 'Quiet Rooms', subtitle: 'A Novel', author: 'Eleanor Marsh', category: 'Fiction', description: 'When Nora inherits her late aunt\'s boarding house, she discovers letters that rewrite the family\'s history. A slow-burning, beautifully observed story.', isbn: '9780000000028', publisher: 'Harbour Press', format: 'EBOOK', price: 8.99, stock: 999, pages: 298, publishedDaysAgo: 900, totalSales: 21040, deliveryDays: 0 },
  { title: 'Salt and Olive Trees', author: 'Rafael Ortega', category: 'Fiction', description: 'Spain, 1936. Two brothers on opposite sides of a coming war try to protect the olive grove that binds their family. An epic of love, loyalty and loss.', isbn: '9780000000035', publisher: 'Meridian Books', format: 'HARDCOVER', price: 24.5, originalPrice: 28.0, stock: 64, pages: 512, publishedDaysAgo: 210, totalSales: 33870, recommended: true },
  { title: 'Sal y Olivos', subtitle: 'Edición en español', author: 'Rafael Ortega', category: 'Fiction', language: 'Spanish', description: 'La edición original en español de la épica novela de Rafael Ortega sobre dos hermanos y el olivar que los une.', isbn: '9780000000042', publisher: 'Editorial Meridiano', format: 'PAPERBACK', price: 16.5, stock: 40, pages: 520, publishedDaysAgo: 600, totalSales: 12400 },
  { title: 'The Monsoon House', author: 'Priya Nair', category: 'Fiction', description: 'Kerala, 1962. A rambling ancestral house, a family feud and a young woman determined to write her own future. A richly sensory saga of tradition and change.', isbn: '9780000000059', publisher: 'Lotus & Ink', format: 'PAPERBACK', price: 13.99, stock: 150, pages: 424, publishedDaysAgo: 30, totalSales: 5320, newLaunch: true, recommended: true },
  { title: 'मानसून का घर', subtitle: 'हिन्दी संस्करण', author: 'Priya Nair', category: 'Fiction', language: 'Hindi', description: 'प्रिया नायर के चर्चित उपन्यास का हिन्दी अनुवाद — एक परिवार, एक पुरानी हवेली और बदलते समय की कहानी।', isbn: '9780000000066', publisher: 'Lotus & Ink', format: 'PAPERBACK', price: 11.5, stock: 55, pages: 440, publishedDaysAgo: 20, totalSales: 1900, newLaunch: true },

  // Mystery & Thriller
  { title: 'The Last Witness', author: 'Daniel Brooks', category: 'Mystery & Thriller', description: 'Detective Elias Hale has 72 hours to protect the only witness to a city-wide conspiracy, and no one in the department can be trusted.', isbn: '9780000000073', publisher: 'Blackwood', format: 'PAPERBACK', price: 12.99, originalPrice: 15.99, stock: 200, pages: 389, publishedDaysAgo: 120, totalSales: 91200, bestseller: true, recommended: true },
  { title: 'Dead Reckoning', author: 'Daniel Brooks', category: 'Mystery & Thriller', description: 'A shipwreck, a missing ledger and a killer who has been waiting twenty years. Detective Hale returns in a pulse-pounding maritime thriller.', isbn: '9780000000080', publisher: 'Blackwood', format: 'HARDCOVER', price: 22.0, stock: 85, pages: 416, publishedDaysAgo: 25, totalSales: 14500, newLaunch: true, bestseller: true },
  { title: 'The Frozen Fjord', author: 'Mara Lindqvist', category: 'Mystery & Thriller', description: 'When a body is found beneath the ice of a remote Norwegian fjord, Inspector Astrid Voll must confront the village\'s darkest secrets.', isbn: '9780000000097', publisher: 'Northlight', format: 'PAPERBACK', price: 13.5, stock: 110, pages: 360, publishedDaysAgo: 340, totalSales: 40250, recommended: true },
  { title: 'Midnight in Malmö', author: 'Mara Lindqvist', category: 'Mystery & Thriller', description: 'A string of disappearances links a famous architect to a decades-old crime. Nordic noir at its most chilling.', isbn: '9780000000103', publisher: 'Northlight', format: 'EBOOK', price: 7.99, stock: 999, pages: 340, publishedDaysAgo: 45, totalSales: 8800, newLaunch: true, deliveryDays: 0 },

  // Science Fiction & Fantasy
  { title: 'Orbital Drift', author: 'Theo Calloway', category: 'Science Fiction & Fantasy', description: 'A crew of misfit engineers aboard a failing orbital station discovers a signal that should not exist. Hard science fiction with a beating heart.', isbn: '9780000000110', publisher: 'Starlane', format: 'PAPERBACK', price: 15.99, stock: 95, pages: 448, publishedDaysAgo: 260, totalSales: 36700, bestseller: true, recommended: true },
  { title: 'The Europa Protocol', author: 'Theo Calloway', category: 'Science Fiction & Fantasy', description: 'Beneath Europa\'s ice, the first human expedition finds life — and a countdown. A thrilling first-contact story.', isbn: '9780000000127', publisher: 'Starlane', format: 'HARDCOVER', price: 26.0, stock: 70, pages: 480, publishedDaysAgo: 15, totalSales: 6100, newLaunch: true, recommended: true },
  { title: 'Children of the Ember Throne', subtitle: 'Book One of the Ashen Crown', author: 'Amara Okafor', category: 'Science Fiction & Fantasy', description: 'In a kingdom ruled by ancestral spirits, a young scribe discovers she can speak with the dead and the dead are afraid.', isbn: '9780000000134', publisher: 'Baobab House', format: 'PAPERBACK', price: 16.99, originalPrice: 19.99, stock: 140, pages: 560, publishedDaysAgo: 500, totalSales: 78000, bestseller: true },
  { title: 'The Ashen Crown', subtitle: 'Book Two of the Ashen Crown', author: 'Amara Okafor', category: 'Science Fiction & Fantasy', description: 'The war for the Ember Throne ignites. Alliances shatter, gods wake and a reluctant queen must choose what to sacrifice.', isbn: '9780000000141', publisher: 'Baobab House', format: 'HARDCOVER', price: 27.5, stock: 60, pages: 640, publishedDaysAgo: 40, totalSales: 19400, newLaunch: true, bestseller: true, recommended: true },

  // Romance
  { title: 'Lavender Summers', author: 'Sophie Laurent', category: 'Romance', description: 'A burnt-out pastry chef inherits a lavender farm in Provence and a grumpy neighbour who is determined to buy it. Sun-drenched and swoon-worthy.', isbn: '9780000000158', publisher: 'Rosewater', format: 'PAPERBACK', price: 11.99, stock: 175, pages: 320, publishedDaysAgo: 180, totalSales: 52300, bestseller: true, recommended: true },
  { title: 'Letters from Montmartre', author: 'Sophie Laurent', category: 'Romance', description: 'Two strangers, one misdelivered love letter and a Paris spring. A charming epistolary romance.', isbn: '9780000000165', publisher: 'Rosewater', format: 'EBOOK', price: 6.99, stock: 999, pages: 280, publishedDaysAgo: 10, totalSales: 3100, newLaunch: true, deliveryDays: 0 },
  { title: 'Lettres de Montmartre', subtitle: 'Édition française', author: 'Sophie Laurent', category: 'Romance', language: 'French', description: 'Deux inconnus, une lettre d\'amour égarée et un printemps parisien. Une romance épistolaire pleine de charme.', isbn: '9780000000172', publisher: 'Éditions Rosewater', format: 'PAPERBACK', price: 12.5, stock: 35, pages: 290, publishedDaysAgo: 90, totalSales: 4700 },

  // Non-Fiction
  { title: 'The Rise and Fall of Empires', subtitle: 'A Narrative History', author: 'Dr. Marcus Reid', category: 'Non-Fiction', description: 'From Rome to the modern superpowers, a gripping account of why great civilisations flourish — and why they collapse.', isbn: '9780000000189', publisher: 'Agora', format: 'HARDCOVER', price: 29.99, originalPrice: 34.99, stock: 80, pages: 720, publishedDaysAgo: 300, totalSales: 27800, recommended: true },
  { title: 'Voices of the Silk Road', author: 'Dr. Marcus Reid', category: 'Non-Fiction', description: 'Merchants, monks and mapmakers: the human stories behind history\'s greatest trade network.', isbn: '9780000000196', publisher: 'Agora', format: 'PAPERBACK', price: 18.0, stock: 90, pages: 448, publishedDaysAgo: 700, totalSales: 15900 },

  // Self-Help & Business
  { title: 'Tiny Habits, Big Lives', author: 'Hannah Whitfield', category: 'Self-Help & Business', description: 'A science-backed, step-by-step system for building habits that stick, with practical exercises you can start today.', isbn: '9780000000202', publisher: 'Beacon', format: 'PAPERBACK', price: 14.0, originalPrice: 16.99, stock: 300, pages: 288, publishedDaysAgo: 150, totalSales: 120500, bestseller: true, recommended: true },
  { title: 'Deep Focus', subtitle: 'Reclaiming Attention in a Distracted World', author: 'Hannah Whitfield', category: 'Self-Help & Business', description: 'Why we can\'t concentrate and what to do about it. A practical guide to protecting your attention and doing your best work.', isbn: '9780000000219', publisher: 'Beacon', format: 'EBOOK', price: 9.99, stock: 999, pages: 256, publishedDaysAgo: 35, totalSales: 9200, newLaunch: true, deliveryDays: 0 },
  { title: 'The Founder\'s Playbook', author: 'Vikram Desai', category: 'Self-Help & Business', description: 'Hard-won lessons on hiring, fundraising and finding product-market fit from an entrepreneur who has built and sold three companies.', isbn: '9780000000226', publisher: 'Summit', format: 'HARDCOVER', price: 23.0, stock: 75, pages: 336, publishedDaysAgo: 240, totalSales: 31000, bestseller: true },
  { title: 'Money, Simply', author: 'Vikram Desai', category: 'Self-Help & Business', description: 'Budgeting, investing and retirement planning explained without jargon. Build lasting wealth one sensible decision at a time.', isbn: '9780000000233', publisher: 'Summit', format: 'PAPERBACK', price: 15.5, stock: 130, pages: 304, publishedDaysAgo: 55, totalSales: 11800, newLaunch: true, recommended: true },

  // Technology
  { title: 'Clean Systems', subtitle: 'Designing Software That Lasts', author: 'Lena Fischer', category: 'Technology', description: 'Principles and patterns for building maintainable, scalable software, with real-world case studies from distributed systems.', isbn: '9780000000240', publisher: 'ByteWorks', format: 'PAPERBACK', price: 39.99, originalPrice: 44.99, stock: 100, pages: 464, publishedDaysAgo: 380, totalSales: 24600, recommended: true },
  { title: 'Distributed Systems in Practice', author: 'Lena Fischer', category: 'Technology', description: 'Consensus, replication, failure and recovery. A hands-on guide for engineers who build services that must never go down.', isbn: '9780000000257', publisher: 'ByteWorks', format: 'EBOOK', price: 29.99, stock: 999, pages: 520, publishedDaysAgo: 60, totalSales: 7300, newLaunch: true, deliveryDays: 0 },
  { title: 'Machine Learning, Explained', author: 'Arjun Mehta', category: 'Technology', description: 'From linear regression to transformers, a friendly, math-light tour of how modern AI really works.', isbn: '9780000000264', publisher: 'ByteWorks', format: 'PAPERBACK', price: 34.0, stock: 115, pages: 400, publishedDaysAgo: 200, totalSales: 29900, bestseller: true, recommended: true },

  // Children's Books
  { title: 'Pip and the Moonlit Forest', author: 'Beatrice Holloway', category: "Children's Books", description: 'Pip the hedgehog sets out to find where the moon sleeps. A gentle, beautifully illustrated bedtime adventure for ages 3–7.', isbn: '9780000000271', publisher: 'Little Acorn', format: 'HARDCOVER', price: 12.99, stock: 210, pages: 40, publishedDaysAgo: 365, totalSales: 66400, bestseller: true, recommended: true },
  { title: 'Captain Clementine and the Sea of Stars', author: 'Beatrice Holloway', category: "Children's Books", description: 'Captain Clementine and her crew of clever creatures sail a sea of stars in search of a lost constellation. Ages 5–9.', isbn: '9780000000288', publisher: 'Little Acorn', format: 'PAPERBACK', price: 8.99, stock: 160, pages: 96, publishedDaysAgo: 28, totalSales: 5400, newLaunch: true },
];

// ---------------------------------------------------------------------------
// Review content
// ---------------------------------------------------------------------------
const reviewTemplates: Record<number, { title: string; comment: string }[]> = {
  5: [
    { title: 'Couldn\'t put it down', comment: 'Absolutely loved it from the first page to the last. I stayed up far too late finishing it. Highly recommended!' },
    { title: 'A new favourite', comment: 'Beautifully written with characters that stay with you. I\'ve already bought copies for two friends.' },
    { title: 'Worth every penny', comment: 'Excellent quality and a genuinely rewarding read. One of the best I\'ve read this year.' },
  ],
  4: [
    { title: 'Really enjoyable', comment: 'Strong writing and a compelling story. The pacing dipped slightly in the middle, but the ending more than made up for it.' },
    { title: 'Great read', comment: 'Thoughtful and engaging. I would happily read more from this author.' },
  ],
  3: [
    { title: 'Decent, not amazing', comment: 'Some great moments but it did not fully live up to the hype for me. Still worth a try.' },
  ],
  2: [
    { title: 'Not for me', comment: 'The premise was interesting but I struggled to connect with the story.' },
  ],
};

const reviewers = [
  { email: 'demo@bookworm.com', name: 'Demo Reader' },
  { email: 'alice@example.com', name: 'Alice Johnson' },
  { email: 'ben@example.com', name: 'Ben Carter' },
  { email: 'chitra@example.com', name: 'Chitra Rao' },
  { email: 'diego@example.com', name: 'Diego Alvarez' },
  { email: 'emma@example.com', name: 'Emma Wilson' },
];

// Deterministic rating pattern per book so seed output is stable.
const ratingPatterns: number[][] = [
  [5, 5, 4, 5],
  [4, 5, 4],
  [5, 4, 5, 3],
  [5, 5, 5],
  [4, 4, 3, 5],
  [5, 4],
];

async function main() {
  console.log('Seeding Book Worm database...');

  // Clean (child tables first)
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.review.deleteMany();
  await prisma.book.deleteMany();
  await prisma.author.deleteMany();
  await prisma.category.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();
  await prisma.coupon.deleteMany();

  // Users --------------------------------------------------------------
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const adminHash = await bcrypt.hash('Admin123!', 10);

  const admin = await prisma.user.create({
    data: { email: 'admin@bookworm.com', passwordHash: adminHash, name: 'Store Admin', role: 'ADMIN' },
  });

  const userRecords = [];
  for (const r of reviewers) {
    userRecords.push(
      await prisma.user.create({
        data: {
          email: r.email,
          passwordHash,
          name: r.name,
          role: 'CUSTOMER',
          giftPoints: r.email === 'demo@bookworm.com' ? 500 : 100,
          walletBalance: r.email === 'demo@bookworm.com' ? 50 : 0,
        },
      })
    );
  }
  const demo = userRecords[0];

  await prisma.address.createMany({
    data: [
      { userId: demo.id, label: 'Home', fullName: 'Demo Reader', phone: '555-0100', line1: '221 Maple Street', line2: 'Apt 4B', city: 'Springfield', state: 'IL', postalCode: '62704', country: 'US', isDefault: true },
      { userId: demo.id, label: 'Office', fullName: 'Demo Reader', phone: '555-0101', line1: '100 Market Square', city: 'Springfield', state: 'IL', postalCode: '62701', country: 'US', isDefault: false },
    ],
  });

  // Categories & authors -------------------------------------------------
  const categoryMap = new Map<string, string>();
  for (const c of categories) {
    const created = await prisma.category.create({
      data: { name: c.name, slug: slugify(c.name), description: c.description, imageUrl: cover(`cat-${slugify(c.name)}`) },
    });
    categoryMap.set(c.name, created.id);
  }

  const authorMap = new Map<string, string>();
  for (const a of authors) {
    const created = await prisma.author.create({
      data: { name: a.name, bio: a.bio, nationality: a.nationality, birthYear: a.birthYear, photoUrl: portrait(`author-${slugify(a.name)}`) },
    });
    authorMap.set(a.name, created.id);
  }

  // Books ---------------------------------------------------------------
  const bookRecords = [];
  for (const b of books) {
    const authorId = authorMap.get(b.author);
    const categoryId = categoryMap.get(b.category);
    if (!authorId || !categoryId) throw new Error(`Missing author/category for ${b.title}`);
    bookRecords.push(
      await prisma.book.create({
        data: {
          title: b.title,
          subtitle: b.subtitle,
          description: b.description,
          isbn: b.isbn,
          authorId,
          categoryId,
          publisher: b.publisher,
          language: b.language ?? 'English',
          format: b.format,
          price: b.price,
          originalPrice: b.originalPrice,
          stock: b.stock,
          pages: b.pages,
          coverUrl: cover(slugify(b.isbn)),
          publicationDate: daysAgo(b.publishedDaysAgo),
          totalSales: b.totalSales,
          isRecommended: !!b.recommended,
          isBestseller: !!b.bestseller,
          isNewLaunch: !!b.newLaunch,
          deliveryDays: b.deliveryDays ?? 4,
        },
      })
    );
  }

  // Reviews + aggregate ratings -----------------------------------------
  let reviewCount = 0;
  for (let i = 0; i < bookRecords.length; i++) {
    const pattern = ratingPatterns[i % ratingPatterns.length];
    const ratings: number[] = [];
    for (let j = 0; j < pattern.length; j++) {
      const rating = pattern[j];
      const templates = reviewTemplates[rating];
      const tpl = templates[(i + j) % templates.length];
      const user = userRecords[(i + j) % userRecords.length];
      await prisma.review.create({
        data: {
          bookId: bookRecords[i].id,
          userId: user.id,
          rating,
          title: tpl.title,
          comment: tpl.comment,
          helpful: (i * 3 + j * 7) % 25,
          createdAt: daysAgo(((i + 1) * (j + 2)) % 120 + 1),
        },
      });
      ratings.push(rating);
      reviewCount++;
    }
    const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
    await prisma.book.update({
      where: { id: bookRecords[i].id },
      data: { avgRating: Math.round(avg * 10) / 10, ratingCount: ratings.length },
    });
  }

  // Coupons -------------------------------------------------------------
  await prisma.coupon.createMany({
    data: [
      { code: 'WELCOME10', description: '10% off your first order', discountType: 'PERCENT', discountValue: 10, minOrderAmount: 0, maxDiscount: 15 },
      { code: 'BOOKWORM20', description: '20% off orders over $50 (max $25 off)', discountType: 'PERCENT', discountValue: 20, minOrderAmount: 50, maxDiscount: 25 },
      { code: 'FLAT5', description: '$5 off any order over $20', discountType: 'FIXED', discountValue: 5, minOrderAmount: 20 },
      { code: 'FREESHIP', description: '$4.99 off — covers standard delivery', discountType: 'FIXED', discountValue: 4.99, minOrderAmount: 0 },
      { code: 'SUMMER15', description: '15% summer reading sale', discountType: 'PERCENT', discountValue: 15, minOrderAmount: 30, maxDiscount: 20, expiresAt: new Date(Date.now() + 90 * DAY) },
      { code: 'EXPIRED50', description: 'Expired promotion (for testing)', discountType: 'PERCENT', discountValue: 50, minOrderAmount: 0, expiresAt: daysAgo(30), isActive: true },
    ],
  });

  // Sample orders for the demo user (enables "Buy It Again") ------------
  const byTitle = (t: string) => {
    const found = bookRecords.find((b) => b.title === t);
    if (!found) throw new Error(`Book not found: ${t}`);
    return found;
  };
  const TAX_RATE = 0.08;
  const shipFor = (subtotal: number) => (subtotal >= 35 ? 0 : 4.99);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  async function createOrder(opts: {
    number: string;
    placedDaysAgo: number;
    status: string;
    items: { title: string; qty: number }[];
    method: string;
    coupon?: { code: string; discount: number };
    cancelled?: boolean;
  }) {
    const lines = opts.items.map((i) => ({ book: byTitle(i.title), qty: i.qty }));
    const subtotal = round2(lines.reduce((s, l) => s + l.book.price * l.qty, 0));
    const discount = opts.coupon?.discount ?? 0;
    const tax = round2((subtotal - discount) * TAX_RATE);
    const shipping = shipFor(subtotal);
    const total = round2(subtotal - discount + tax + shipping);
    const placedAt = daysAgo(opts.placedDaysAgo);
    await prisma.order.create({
      data: {
        orderNumber: opts.number,
        userId: demo.id,
        status: opts.status,
        subtotal,
        tax,
        shipping,
        discount,
        total,
        couponCode: opts.coupon?.code,
        paymentMethod: opts.method,
        paymentStatus: opts.cancelled ? 'REFUNDED' : 'PAID',
        paymentReference: `SIM-${opts.number}`,
        shipFullName: 'Demo Reader',
        shipPhone: '555-0100',
        shipLine1: '221 Maple Street',
        shipLine2: 'Apt 4B',
        shipCity: 'Springfield',
        shipState: 'IL',
        shipPostalCode: '62704',
        shipCountry: 'US',
        estimatedDelivery: new Date(placedAt.getTime() + 5 * DAY),
        placedAt,
        cancellableUntil: new Date(placedAt.getTime() + 2 * DAY),
        cancelledAt: opts.cancelled ? new Date(placedAt.getTime() + DAY) : null,
        cancelReason: opts.cancelled ? 'Ordered by mistake' : null,
        items: {
          create: lines.map((l) => ({
            bookId: l.book.id,
            title: l.book.title,
            unitPrice: l.book.price,
            quantity: l.qty,
          })),
        },
      },
    });
  }

  await createOrder({
    number: 'BW-100001',
    placedDaysAgo: 75,
    status: 'DELIVERED',
    method: 'CREDIT_CARD',
    items: [
      { title: 'The Last Witness', qty: 1 },
      { title: 'Tiny Habits, Big Lives', qty: 1 },
    ],
  });
  await createOrder({
    number: 'BW-100002',
    placedDaysAgo: 30,
    status: 'DELIVERED',
    method: 'UPI',
    items: [{ title: 'Lavender Summers', qty: 2 }],
    coupon: { code: 'WELCOME10', discount: 2.4 },
  });
  await createOrder({
    number: 'BW-100003',
    placedDaysAgo: 10,
    status: 'CANCELLED',
    method: 'DEBIT_CARD',
    items: [{ title: 'Machine Learning, Explained', qty: 1 }],
    cancelled: true,
  });
  // Placed an hour ago: still inside the 48h cancellation window
  await createOrder({
    number: 'BW-100004',
    placedDaysAgo: 1 / 24,
    status: 'PLACED',
    method: 'WALLET',
    items: [
      { title: 'Orbital Drift', qty: 1 },
      { title: 'Pip and the Moonlit Forest', qty: 1 },
    ],
  });

  // Starter cart for the demo user -------------------------------------
  await prisma.cartItem.create({ data: { userId: demo.id, bookId: byTitle('The Monsoon House').id, quantity: 1 } });

  console.log(
    `Seeded: ${userRecords.length + 1} users (admin: ${admin.email}), ${categories.length} categories, ` +
      `${authors.length} authors, ${bookRecords.length} books, ${reviewCount} reviews, 6 coupons, 4 orders.`
  );
  console.log('Demo login: demo@bookworm.com / Password123!   Admin: admin@bookworm.com / Admin123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

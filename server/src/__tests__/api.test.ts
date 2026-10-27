import request from 'supertest';
import { app } from '../index';
import { prisma } from '../lib/prisma';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const api = () => request(app);
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const HOUR_MS = 60 * 60 * 1000;

let emailSeq = 0;
const uniqueEmail = () => `tester_${Date.now()}_${emailSeq++}@example.com`;

const GOOD_CARD = { cardNumber: '4242424242424242', cardHolder: 'Test Reader', expiry: '12/29', cvv: '123' };
const DECLINED_CARD = { ...GOOD_CARD, cardNumber: '4000000000000002' };
const GUEST_ADDRESS = {
  fullName: 'Guest Buyer',
  phone: '555-0199',
  line1: '1 Test Lane',
  city: 'Springfield',
  state: 'IL',
  postalCode: '62704',
};

async function guestSession() {
  const res = await api().post('/api/auth/guest').expect(201);
  return { token: res.body.token as string, id: res.body.user.id as string };
}

async function registerUser() {
  const email = uniqueEmail();
  const res = await api().post('/api/auth/register').send({ email, password: 'Password123!', name: 'Test Reader' }).expect(201);
  return { token: res.body.token as string, id: res.body.user.id as string, email };
}

async function loginDemo() {
  const res = await api().post('/api/auth/login').send({ email: 'demo@bookworm.com', password: 'Password123!' }).expect(200);
  return { token: res.body.token as string, id: res.body.user.id as string };
}

async function bookId(title: string) {
  const book = await prisma.book.findFirstOrThrow({ where: { title } });
  return book.id;
}

const addToCart = (token: string, id: string, quantity = 1) =>
  api().post('/api/cart/items').set(bearer(token)).send({ bookId: id, quantity });

const emptyCart = (token: string) => api().delete('/api/cart').set(bearer(token)).expect(204);

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// System / middleware
// ---------------------------------------------------------------------------
describe('system & middleware', () => {
  it('reports healthy status with a database connection', async () => {
    const res = await api().get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'connected' });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await api().get('/api/does-not-exist').expect(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('rejects malformed JSON bodies with 400', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{ not json').expect(400);
    expect(res.body.error).toBe('Invalid JSON body');
  });

  it('rejects protected routes without a token (401) and with a bad token (401)', async () => {
    await api().get('/api/cart').expect(401);
    const res = await api().get('/api/cart').set(bearer('not.a.token')).expect(401);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  it('treats an invalid token on an optional-auth route as anonymous', async () => {
    await api().get('/api/books/recommended').set(bearer('garbage')).expect(200);
  });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
describe('auth', () => {
  it('creates a guest session whose token works on /auth/me', async () => {
    const res = await api().post('/api/auth/guest').expect(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ role: 'GUEST', isGuest: true, giftPoints: 0, walletBalance: 0 });

    const me = await api().get('/api/auth/me').set(bearer(res.body.token)).expect(200);
    expect(me.body).toMatchObject({ id: res.body.user.id, isGuest: true });
  });

  it('issues a distinct guest id each time', async () => {
    const [a, b] = await Promise.all([guestSession(), guestSession()]);
    expect(a.id).not.toBe(b.id);
  });

  it('registers a customer, normalises the email and never returns the password hash', async () => {
    const email = uniqueEmail();
    const res = await api()
      .post('/api/auth/register')
      .send({ email: email.toUpperCase(), password: 'Password123!', name: '  Jane Reader  ', phone: '555-0123' })
      .expect(201);
    expect(res.body.user).toMatchObject({ email, name: 'Jane Reader', role: 'CUSTOMER', isGuest: false });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('rejects duplicate registration with 409', async () => {
    const { email } = await registerUser();
    const res = await api().post('/api/auth/register').send({ email, password: 'Password123!', name: 'Dup' }).expect(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('validates registration input and lists every problem', async () => {
    const res = await api().post('/api/auth/register').send({ email: 'nope', password: 'short' }).expect(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        'email must be a valid email address',
        'password must be at least 8 characters',
        'name is required',
      ])
    );
  });

  it('logs in with valid credentials and returns a JWT', async () => {
    const { email } = await registerUser();
    const res = await api().post('/api/auth/login').send({ email, password: 'Password123!' }).expect(200);
    expect(res.body.token).toEqual(expect.any(String));
    const me = await api().get('/api/auth/me').set(bearer(res.body.token)).expect(200);
    expect(me.body.email).toBe(email);
  });

  it('rejects a wrong password and an unknown email with the same 401 message', async () => {
    const { email } = await registerUser();
    const wrongPw = await api().post('/api/auth/login').send({ email, password: 'WrongPassword1' }).expect(401);
    const unknown = await api().post('/api/auth/login').send({ email: 'nobody@example.com', password: 'Password123!' }).expect(401);
    expect(wrongPw.body.error).toBe('Invalid email or password');
    expect(unknown.body.error).toBe(wrongPw.body.error);
  });

  it('updates the profile and requires at least one field', async () => {
    const { token } = await registerUser();
    const res = await api().put('/api/auth/me').set(bearer(token)).send({ name: 'Renamed', phone: '555-9999' }).expect(200);
    expect(res.body).toMatchObject({ name: 'Renamed', phone: '555-9999' });
    await api().put('/api/auth/me').set(bearer(token)).send({}).expect(400);
  });

  it('forbids guests from profile updates and the address book', async () => {
    const { token } = await guestSession();
    await api().put('/api/auth/me').set(bearer(token)).send({ name: 'x' }).expect(403);
    await api().get('/api/auth/addresses').set(bearer(token)).expect(403);
    await api().post('/api/auth/addresses').set(bearer(token)).send(GUEST_ADDRESS).expect(403);
  });

  it('merges a guest cart into the user cart on login', async () => {
    const { email } = await registerUser();
    const guest = await guestSession();
    const id = await bookId('The Last Witness');
    await addToCart(guest.token, id, 2).expect(200);

    const login = await api()
      .post('/api/auth/login')
      .set(bearer(guest.token))
      .send({ email, password: 'Password123!' })
      .expect(200);

    const cart = await api().get('/api/cart').set(bearer(login.body.token)).expect(200);
    expect(cart.body.items).toHaveLength(1);
    expect(cart.body.items[0]).toMatchObject({ bookId: id, quantity: 2 });

    const guestCart = await api().get('/api/cart').set(bearer(guest.token)).expect(200);
    expect(guestCart.body.items).toHaveLength(0);
  });

  describe('address book', () => {
    it('supports list / add / update / delete with default handling', async () => {
      const { token } = await registerUser();

      expect((await api().get('/api/auth/addresses').set(bearer(token)).expect(200)).body).toEqual([]);

      const first = await api().post('/api/auth/addresses').set(bearer(token)).send({ ...GUEST_ADDRESS, label: 'Home' }).expect(201);
      expect(first.body.isDefault).toBe(true); // first address is always the default

      const second = await api()
        .post('/api/auth/addresses')
        .set(bearer(token))
        .send({ ...GUEST_ADDRESS, label: 'Office', isDefault: true })
        .expect(201);
      expect(second.body.isDefault).toBe(true);

      let list = (await api().get('/api/auth/addresses').set(bearer(token)).expect(200)).body;
      expect(list).toHaveLength(2);
      expect(list.filter((a: { isDefault: boolean }) => a.isDefault)).toHaveLength(1);
      expect(list[0].id).toBe(second.body.id); // default listed first

      const updated = await api()
        .put(`/api/auth/addresses/${first.body.id}`)
        .set(bearer(token))
        .send({ ...GUEST_ADDRESS, label: 'Parents', city: 'Chicago' })
        .expect(200);
      expect(updated.body).toMatchObject({ label: 'Parents', city: 'Chicago', isDefault: false });

      // Deleting the default promotes the remaining address.
      await api().delete(`/api/auth/addresses/${second.body.id}`).set(bearer(token)).expect(204);
      list = (await api().get('/api/auth/addresses').set(bearer(token)).expect(200)).body;
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ id: first.body.id, isDefault: true });
    });

    it('validates address fields and returns 404 for unknown or foreign addresses', async () => {
      const owner = await registerUser();
      const other = await registerUser();
      const bad = await api().post('/api/auth/addresses').set(bearer(owner.token)).send({ label: 'x' }).expect(400);
      expect(bad.body.details).toEqual(expect.arrayContaining(['fullName is required', 'postalCode is required']));

      const created = await api().post('/api/auth/addresses').set(bearer(owner.token)).send(GUEST_ADDRESS).expect(201);
      await api().put(`/api/auth/addresses/${created.body.id}`).set(bearer(other.token)).send(GUEST_ADDRESS).expect(404);
      await api().delete(`/api/auth/addresses/${created.body.id}`).set(bearer(other.token)).expect(404);
      await api().delete('/api/auth/addresses/missing').set(bearer(owner.token)).expect(404);
    });
  });
});

// ---------------------------------------------------------------------------
// Books & catalogue
// ---------------------------------------------------------------------------
describe('books & catalogue', () => {
  it('lists categories with book counts', async () => {
    const res = await api().get('/api/categories').expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(8);
    const romance = res.body.find((c: { slug: string }) => c.slug === 'romance');
    expect(romance).toMatchObject({ name: 'Romance', bookCount: 3 });
  });

  it('returns a paginated default catalogue', async () => {
    const res = await api().get('/api/books?pageSize=5').expect(200);
    expect(res.body.items).toHaveLength(5);
    expect(res.body).toMatchObject({ page: 1, pageSize: 5 });
    expect(res.body.totalPages).toBe(Math.ceil(res.body.total / 5));
    expect(res.body.items[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), title: expect.any(String), author: expect.objectContaining({ name: expect.any(String) }), inStock: true })
    );

    const last = await api().get(`/api/books?pageSize=5&page=${res.body.totalPages + 1}`).expect(200);
    expect(last.body.items).toEqual([]);
  });

  it('does not repeat or drop books across pages', async () => {
    const all = await api().get('/api/books?pageSize=50&sort=price_asc').expect(200);
    const pages: string[] = [];
    for (let page = 1; page <= Math.ceil(all.body.total / 10); page++) {
      const res = await api().get(`/api/books?pageSize=10&page=${page}&sort=price_asc`).expect(200);
      pages.push(...res.body.items.map((b: { id: string }) => b.id));
    }
    expect(pages).toEqual(all.body.items.map((b: { id: string }) => b.id));
  });

  it('searches by title, author name and ISBN case-insensitively', async () => {
    const byTitle = await api().get('/api/books?q=LAVENDER').expect(200);
    expect(byTitle.body.items.map((b: { title: string }) => b.title)).toContain('Lavender Summers');

    const byAuthor = await api().get('/api/books?q=lindqvist').expect(200);
    expect(byAuthor.body.items.map((b: { title: string }) => b.title).sort()).toEqual(['Midnight in Malmö', 'The Frozen Fjord']);

    const book = await prisma.book.findFirstOrThrow({ where: { title: 'Quiet Rooms' } });
    const byIsbn = await api().get(`/api/books?q=${book.isbn}`).expect(200);
    expect(byIsbn.body.items.map((b: { title: string }) => b.title)).toEqual(['Quiet Rooms']);

    const none = await api().get('/api/books?q=zzzz-no-such-book').expect(200);
    expect(none.body).toMatchObject({ items: [], total: 0, totalPages: 0 });
  });

  it('filters by category slug', async () => {
    const res = await api().get('/api/books?category=romance').expect(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items.every((b: { category: { slug: string } }) => b.category.slug === 'romance')).toBe(true);
  });

  it('filters by language', async () => {
    const res = await api().get('/api/books?language=Spanish').expect(200);
    expect(res.body.items.map((b: { title: string }) => b.title)).toEqual(['Sal y Olivos']);
  });

  it('filters by format (case-insensitive) and rejects unknown formats', async () => {
    const res = await api().get('/api/books?format=ebook&pageSize=50').expect(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.items.every((b: { format: string }) => b.format === 'EBOOK')).toBe(true);

    const bad = await api().get('/api/books?format=vinyl').expect(400);
    expect(bad.body.details).toEqual([expect.stringMatching(/format must be one of/)]);
  });

  it('filters by price range', async () => {
    const res = await api().get('/api/books?minPrice=20&maxPrice=30&pageSize=50').expect(200);
    expect(res.body.total).toBeGreaterThan(0);
    for (const b of res.body.items) {
      expect(b.price).toBeGreaterThanOrEqual(20);
      expect(b.price).toBeLessThanOrEqual(30);
    }
    await api().get('/api/books?minPrice=30&maxPrice=20').expect(400);
    await api().get('/api/books?minPrice=abc').expect(400);
  });

  it('filters by minimum rating', async () => {
    const res = await api().get('/api/books?minRating=4.8&pageSize=50').expect(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.items.every((b: { avgRating: number }) => b.avgRating >= 4.8)).toBe(true);
    await api().get('/api/books?minRating=6').expect(400);
  });

  it('filters to in-stock books and by author', async () => {
    const id = await bookId('Sal y Olivos');
    await prisma.book.update({ where: { id }, data: { stock: 0 } });
    try {
      const inStock = await api().get('/api/books?language=Spanish&inStock=true').expect(200);
      expect(inStock.body.total).toBe(0);
      const all = await api().get('/api/books?language=Spanish').expect(200);
      expect(all.body.items[0].inStock).toBe(false);
    } finally {
      await prisma.book.update({ where: { id }, data: { stock: 40 } });
    }

    const detail = await api().get(`/api/books/${await bookId('The Last Witness')}`).expect(200);
    const byAuthor = await api().get(`/api/books?authorId=${detail.body.author.id}`).expect(200);
    expect(byAuthor.body.items.every((b: { author: { id: string } }) => b.author.id === detail.body.author.id)).toBe(true);
    expect(byAuthor.body.total).toBe(2);
  });

  it('combines filters', async () => {
    const res = await api().get('/api/books?category=technology&format=EBOOK&maxPrice=30').expect(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const b of res.body.items) {
      expect(b.category.slug).toBe('technology');
      expect(b.format).toBe('EBOOK');
      expect(b.price).toBeLessThanOrEqual(30);
    }
  });

  it('sorts by price, rating and newest', async () => {
    const asc = (await api().get('/api/books?sort=price_asc&pageSize=50').expect(200)).body.items.map((b: { price: number }) => b.price);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));

    const desc = (await api().get('/api/books?sort=price_desc&pageSize=50').expect(200)).body.items.map((b: { price: number }) => b.price);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));

    const rating = (await api().get('/api/books?sort=rating&pageSize=50').expect(200)).body.items.map((b: { avgRating: number }) => b.avgRating);
    expect(rating).toEqual([...rating].sort((a, b) => b - a));

    const newest = await api().get('/api/books?sort=newest&pageSize=3').expect(200);
    const dates = await Promise.all(
      newest.body.items.map(async (b: { id: string }) => (await prisma.book.findUniqueOrThrow({ where: { id: b.id } })).publicationDate.getTime())
    );
    expect(dates).toEqual([...dates].sort((a, b) => b - a));

    await api().get('/api/books?sort=cheapest').expect(400);
  });

  it('exposes filter facets', async () => {
    const res = await api().get('/api/books/filters').expect(200);
    expect(res.body.languages).toEqual(expect.arrayContaining(['English', 'French', 'Hindi', 'Spanish']));
    expect(res.body.formats).toEqual(['EBOOK', 'HARDCOVER', 'PAPERBACK']);
    expect(res.body.priceRange.min).toBeLessThan(res.body.priceRange.max);
  });

  describe('featured sections', () => {
    it('returns bestsellers, honouring limit', async () => {
      const res = await api().get('/api/books/bestsellers?limit=4').expect(200);
      expect(res.body).toHaveLength(4);
      expect(res.body.every((b: { isBestseller: boolean }) => b.isBestseller)).toBe(true);
    });

    it('returns new launches', async () => {
      const res = await api().get('/api/books/new-launches').expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.every((b: { isNewLaunch: boolean }) => b.isNewLaunch)).toBe(true);
    });

    it('returns curated recommendations to guests and users without history', async () => {
      const anon = await api().get('/api/books/recommended').expect(200);
      expect(anon.body.length).toBeGreaterThan(0);
      expect(anon.body.every((b: { isRecommended: boolean }) => b.isRecommended)).toBe(true);

      const fresh = await registerUser();
      const res = await api().get('/api/books/recommended').set(bearer(fresh.token)).expect(200);
      expect(res.body.every((b: { isRecommended: boolean }) => b.isRecommended)).toBe(true);
    });

    it('personalises recommendations from order history and excludes books already bought', async () => {
      const demo = await loginDemo();
      const res = await api().get('/api/books/recommended?limit=8').set(bearer(demo.token)).expect(200);
      const titles = res.body.map((b: { title: string }) => b.title);
      expect(titles.length).toBeGreaterThan(0);
      expect(titles).not.toContain('The Last Witness'); // purchased in BW-100001
      expect(titles).not.toContain('Lavender Summers'); // purchased in BW-100002
      // Personal picks are not limited to the curated flag.
      expect(res.body.some((b: { isRecommended: boolean }) => !b.isRecommended)).toBe(true);
    });
  });

  describe('details, related reads and authors', () => {
    it('returns full book details with an estimated delivery date', async () => {
      const id = await bookId('The Last Witness');
      const res = await api().get(`/api/books/${id}`).expect(200);
      expect(res.body).toMatchObject({
        id,
        title: 'The Last Witness',
        format: 'PAPERBACK',
        deliveryDays: 4,
        author: { name: 'Daniel Brooks' },
        category: { slug: 'mystery-thriller' },
      });
      expect(res.body.isbn).toEqual(expect.any(String));
      expect(res.body.totalSales).toBeGreaterThan(0);
      const days = (new Date(res.body.estimatedDelivery).getTime() - Date.now()) / (24 * HOUR_MS);
      expect(days).toBeGreaterThan(3.9);
      expect(days).toBeLessThanOrEqual(4);
    });

    it('returns 404 for an unknown book', async () => {
      await api().get('/api/books/unknown-id').expect(404);
      await api().get('/api/books/unknown-id/related').expect(404);
    });

    it('returns related reads: same author first, never the book itself', async () => {
      const id = await bookId('The Last Witness');
      const res = await api().get(`/api/books/${id}/related?limit=5`).expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.length).toBeLessThanOrEqual(5);
      expect(res.body.map((b: { id: string }) => b.id)).not.toContain(id);
      expect(res.body[0].title).toBe('Dead Reckoning'); // same author + same category
    });

    it('returns the author profile with their other works', async () => {
      const detail = await api().get(`/api/books/${await bookId('The Last Witness')}`).expect(200);
      const res = await api().get(`/api/authors/${detail.body.author.id}`).expect(200);
      expect(res.body).toMatchObject({ name: 'Daniel Brooks', nationality: 'American' });
      expect(res.body.bio).toEqual(expect.any(String));
      expect(res.body.books.map((b: { title: string }) => b.title).sort()).toEqual(['Dead Reckoning', 'The Last Witness']);
      await api().get('/api/authors/unknown').expect(404);
    });
  });
});

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
describe('reviews', () => {
  const roundTo1 = (n: number) => Math.round(n * 10) / 10;

  it('lists reviews with a breakdown that matches the aggregate rating', async () => {
    const id = await bookId('Tiny Habits, Big Lives');
    const res = await api().get(`/api/books/${id}/reviews`).expect(200);
    const { breakdown, ratingCount, avgRating, items } = res.body;

    expect(Object.keys(breakdown)).toEqual(['1', '2', '3', '4', '5']);
    const counted = Object.values<number>(breakdown).reduce((a, b) => a + b, 0);
    expect(counted).toBe(ratingCount);
    expect(res.body.total).toBe(ratingCount);
    const weighted = Object.entries<number>(breakdown).reduce((s, [star, n]) => s + Number(star) * n, 0);
    expect(avgRating).toBe(roundTo1(weighted / ratingCount));
    expect(items[0]).toEqual(expect.objectContaining({ rating: expect.any(Number), comment: expect.any(String), user: { id: expect.any(String), name: expect.any(String) } }));
    expect(JSON.stringify(items)).not.toMatch(/email|passwordHash/);
  });

  it('sorts and paginates reviews', async () => {
    const id = await bookId('The Last Witness');
    const high = await api().get(`/api/books/${id}/reviews?sort=rating_desc`).expect(200);
    const ratings = high.body.items.map((r: { rating: number }) => r.rating);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));

    const paged = await api().get(`/api/books/${id}/reviews?pageSize=2&page=2`).expect(200);
    expect(paged.body.items).toHaveLength(2);
    expect(paged.body.totalPages).toBe(Math.ceil(paged.body.total / 2));
    await api().get('/api/books/unknown/reviews').expect(404);
  });

  it('creates a review and updates the book aggregate rating', async () => {
    const id = await bookId('Clean Systems');
    const before = (await api().get(`/api/books/${id}/reviews/stats`).expect(200)).body;
    const { token } = await registerUser();

    const res = await api()
      .post(`/api/books/${id}/reviews`)
      .set(bearer(token))
      .send({ rating: 1, title: 'Not for me', comment: 'Too dense for my taste.' })
      .expect(201);
    expect(res.body).toMatchObject({ bookId: id, rating: 1, title: 'Not for me', helpful: 0, user: { name: 'Test Reader' } });

    const after = (await api().get(`/api/books/${id}/reviews/stats`).expect(200)).body;
    expect(after.ratingCount).toBe(before.ratingCount + 1);
    expect(after.breakdown['1']).toBe(before.breakdown['1'] + 1);
    const weighted = Object.entries<number>(after.breakdown).reduce((s, [star, n]) => s + Number(star) * n, 0);
    expect(after.avgRating).toBe(roundTo1(weighted / after.ratingCount));
    expect(after.avgRating).toBeLessThan(before.avgRating);

    // The book itself reflects the new aggregate.
    const book = await api().get(`/api/books/${id}`).expect(200);
    expect(book.body).toMatchObject({ avgRating: after.avgRating, ratingCount: after.ratingCount });
  });

  it('updates (not duplicates) when the same user reviews a book again', async () => {
    const id = await bookId('Money, Simply');
    const { token } = await registerUser();
    const before = (await api().get(`/api/books/${id}/reviews/stats`).expect(200)).body;

    await api().post(`/api/books/${id}/reviews`).set(bearer(token)).send({ rating: 2, comment: 'Meh at first.' }).expect(201);
    await api().post(`/api/books/${id}/reviews`).set(bearer(token)).send({ rating: 5, comment: 'Grew on me!' }).expect(201);

    const after = (await api().get(`/api/books/${id}/reviews/stats`).expect(200)).body;
    expect(after.ratingCount).toBe(before.ratingCount + 1);
    expect(after.breakdown['2']).toBe(before.breakdown['2']);
    expect(after.breakdown['5']).toBe(before.breakdown['5'] + 1);
  });

  it('validates review input', async () => {
    const id = await bookId('Clean Systems');
    const { token } = await registerUser();
    const res = await api().post(`/api/books/${id}/reviews`).set(bearer(token)).send({ rating: 6, comment: 'ok' }).expect(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining(['rating must be at most 5', 'comment must be at least 3 characters'])
    );
    await api().post(`/api/books/${id}/reviews`).set(bearer(token)).send({ rating: 3.5, comment: 'fine book' }).expect(400);
  });

  it('requires a registered account to review: 401 anonymous, 403 guest, 404 unknown book', async () => {
    const id = await bookId('Clean Systems');
    const payload = { rating: 4, comment: 'Solid read.' };
    await api().post(`/api/books/${id}/reviews`).send(payload).expect(401);
    const guest = await guestSession();
    await api().post(`/api/books/${id}/reviews`).set(bearer(guest.token)).send(payload).expect(403);
    const { token } = await registerUser();
    await api().post('/api/books/unknown/reviews').set(bearer(token)).send(payload).expect(404);
  });

  it('marks a review helpful', async () => {
    const id = await bookId('The Last Witness');
    const first = (await api().get(`/api/books/${id}/reviews`).expect(200)).body.items[0];
    const res = await api().post(`/api/reviews/${first.id}/helpful`).expect(200);
    expect(res.body.helpful).toBe(first.helpful + 1);
    await api().post('/api/reviews/unknown/helpful').expect(404);
  });

  it('lets users delete only their own review, recalculating the rating', async () => {
    const id = await bookId('Deep Focus');
    const before = (await api().get(`/api/books/${id}/reviews/stats`).expect(200)).body;
    const author = await registerUser();
    const stranger = await registerUser();

    const review = await api().post(`/api/books/${id}/reviews`).set(bearer(author.token)).send({ rating: 1, comment: 'Awful, sorry.' }).expect(201);
    await api().delete(`/api/reviews/${review.body.id}`).set(bearer(stranger.token)).expect(403);
    await api().delete(`/api/reviews/${review.body.id}`).expect(401);
    await api().delete(`/api/reviews/${review.body.id}`).set(bearer(author.token)).expect(204);
    await api().delete(`/api/reviews/${review.body.id}`).set(bearer(author.token)).expect(404);

    const after = (await api().get(`/api/books/${id}/reviews/stats`).expect(200)).body;
    expect(after).toMatchObject({ ratingCount: before.ratingCount, avgRating: before.avgRating });
  });
});

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------
describe('cart', () => {
  it('supports a full guest cart lifecycle', async () => {
    const { token } = await guestSession();
    const witness = await bookId('The Last Witness');
    const deepFocus = await bookId('Deep Focus');

    expect((await api().get('/api/cart').set(bearer(token)).expect(200)).body).toEqual({ items: [], itemCount: 0, subtotal: 0 });

    await addToCart(token, witness, 1).expect(200);
    const added = await addToCart(token, witness, 2).expect(200); // quantity accumulates
    expect(added.body.items[0]).toMatchObject({ bookId: witness, quantity: 3, lineTotal: 38.97 });

    await addToCart(token, deepFocus).expect(200);
    const cart = (await api().get('/api/cart').set(bearer(token)).expect(200)).body;
    expect(cart.itemCount).toBe(4);
    expect(cart.subtotal).toBe(48.96);
    expect(cart.items.map((i: { bookId: string }) => i.bookId)).toEqual([witness, deepFocus]);
    expect(cart.items[0].book).toMatchObject({ title: 'The Last Witness', author: { name: 'Daniel Brooks' } });

    const updated = await api().put(`/api/cart/items/${witness}`).set(bearer(token)).send({ quantity: 1 }).expect(200);
    expect(updated.body).toMatchObject({ itemCount: 2, subtotal: 22.98 });

    const removed = await api().delete(`/api/cart/items/${deepFocus}`).set(bearer(token)).expect(200);
    expect(removed.body).toMatchObject({ itemCount: 1, subtotal: 12.99 });

    await emptyCart(token);
    expect((await api().get('/api/cart').set(bearer(token)).expect(200)).body.items).toEqual([]);
  });

  it('removes a line when quantity is set to 0', async () => {
    const { token } = await guestSession();
    const id = await bookId('The Last Witness');
    await addToCart(token, id, 2).expect(200);
    const res = await api().put(`/api/cart/items/${id}`).set(bearer(token)).send({ quantity: 0 }).expect(200);
    expect(res.body.items).toEqual([]);
  });

  it('keeps registered carts separate from guest carts and persists across logins', async () => {
    const user = await registerUser();
    const guest = await guestSession();
    const id = await bookId('Orbital Drift');
    await addToCart(user.token, id, 2).expect(200);

    expect((await api().get('/api/cart').set(bearer(guest.token))).body.items).toEqual([]);

    const again = await api().post('/api/auth/login').send({ email: user.email, password: 'Password123!' }).expect(200);
    const cart = await api().get('/api/cart').set(bearer(again.body.token)).expect(200);
    expect(cart.body.items[0]).toMatchObject({ bookId: id, quantity: 2 });
  });

  it('validates input and handles missing items', async () => {
    const { token } = await guestSession();
    const id = await bookId('The Last Witness');
    await api().post('/api/cart/items').set(bearer(token)).send({}).expect(400);
    await addToCart(token, id, 0).expect(400);
    await addToCart(token, id, 21).expect(400);
    await addToCart(token, id, 1.5).expect(400);
    await addToCart(token, 'unknown-book').expect(404);
    await api().put(`/api/cart/items/${id}`).set(bearer(token)).send({ quantity: 2 }).expect(404); // not in cart
    await api().put(`/api/cart/items/${id}`).set(bearer(token)).send({ quantity: -1 }).expect(400);
    await api().delete(`/api/cart/items/${id}`).set(bearer(token)).expect(404);
  });

  it('enforces the per-title limit and available stock with 409', async () => {
    const { token } = await guestSession();
    const witness = await bookId('The Last Witness');
    await addToCart(token, witness, 20).expect(200);
    const over = await addToCart(token, witness, 1).expect(409);
    expect(over.body.error).toMatch(/at most 20/);

    const scarce = await bookId('Lettres de Montmartre');
    await prisma.book.update({ where: { id: scarce }, data: { stock: 2 } });
    try {
      const res = await addToCart(token, scarce, 3).expect(409);
      expect(res.body.error).toMatch(/only 2 copies/i);
      await addToCart(token, scarce, 2).expect(200);

      await prisma.book.update({ where: { id: scarce }, data: { stock: 0 } });
      await api().put(`/api/cart/items/${scarce}`).set(bearer(token)).send({ quantity: 1 }).expect(409);
    } finally {
      await prisma.book.update({ where: { id: scarce }, data: { stock: 35 } });
    }
  });
});

// ---------------------------------------------------------------------------
// Coupons & checkout pricing
// ---------------------------------------------------------------------------
describe('coupons & checkout summary', () => {
  it('lists only currently usable coupons', async () => {
    const res = await api().get('/api/coupons').expect(200);
    const codes = res.body.map((c: { code: string }) => c.code);
    expect(codes).toEqual(expect.arrayContaining(['WELCOME10', 'BOOKWORM20', 'FLAT5', 'FREESHIP', 'SUMMER15']));
    expect(codes).not.toContain('EXPIRED50');
  });

  it('validates a coupon against the cart, ignoring case and whitespace', async () => {
    const { token } = await guestSession();
    await addToCart(token, await bookId('The Last Witness'), 2).expect(200); // 25.98

    const res = await api().post('/api/coupons/validate').set(bearer(token)).send({ code: '  welcome10 ' }).expect(200);
    expect(res.body).toMatchObject({ valid: true, discount: 2.6, coupon: { code: 'WELCOME10', discountType: 'PERCENT' } });
  });

  it('rejects unknown, expired, under-minimum and empty-cart coupon use', async () => {
    const { token } = await guestSession();
    const empty = await api().post('/api/coupons/validate').set(bearer(token)).send({ code: 'WELCOME10' }).expect(400);
    expect(empty.body.error).toMatch(/cart is empty/i);

    await addToCart(token, await bookId('The Last Witness'), 2).expect(200);
    const unknown = await api().post('/api/coupons/validate').set(bearer(token)).send({ code: 'NOPE' }).expect(400);
    expect(unknown.body.error).toBe('Invalid coupon code');
    const expired = await api().post('/api/coupons/validate').set(bearer(token)).send({ code: 'EXPIRED50' }).expect(400);
    expect(expired.body.error).toMatch(/expired/i);
    const low = await api().post('/api/coupons/validate').set(bearer(token)).send({ code: 'BOOKWORM20' }).expect(400);
    expect(low.body.error).toMatch(/add \$24\.02 more/i); // 50 - 25.98
    await api().post('/api/coupons/validate').set(bearer(token)).send({}).expect(400);
    await api().post('/api/coupons/validate').send({ code: 'WELCOME10' }).expect(401);
  });

  it('honours usage limits', async () => {
    const { token } = await guestSession();
    await addToCart(token, await bookId('The Last Witness'), 2).expect(200);
    const coupon = await prisma.coupon.create({
      data: { code: 'ONCEONLY', description: 'test', discountType: 'FIXED', discountValue: 1, usageLimit: 1, usedCount: 1 },
    });
    try {
      const res = await api().post('/api/coupons/validate').set(bearer(token)).send({ code: 'ONCEONLY' }).expect(400);
      expect(res.body.error).toMatch(/usage limit/i);
      const listed = (await api().get('/api/coupons').expect(200)).body.map((c: { code: string }) => c.code);
      expect(listed).not.toContain('ONCEONLY');
    } finally {
      await prisma.coupon.delete({ where: { id: coupon.id } });
    }
  });

  it('calculates subtotal + tax + paid delivery for a small cart', async () => {
    const { token } = await guestSession();
    await addToCart(token, await bookId('The Last Witness'), 2).expect(200); // 25.98
    const res = await api().post('/api/checkout/summary').set(bearer(token)).send({}).expect(200);
    expect(res.body).toMatchObject({
      subtotal: 25.98,
      couponCode: null,
      couponDiscount: 0,
      pointsRedeemed: 0,
      pointsDiscount: 0,
      tax: 2.08, // 8% of 25.98
      shipping: 4.99,
      total: 33.05,
    });
    expect(new Date(res.body.estimatedDelivery).getTime()).toBeGreaterThan(Date.now());
  });

  it('applies free delivery at the $35 threshold', async () => {
    const { token } = await guestSession();
    await addToCart(token, await bookId('The Last Witness'), 3).expect(200); // 38.97
    const res = await api().post('/api/checkout/summary').set(bearer(token)).send({}).expect(200);
    expect(res.body).toMatchObject({ subtotal: 38.97, shipping: 0, tax: 3.12, total: 42.09 });
  });

  it('charges no delivery on e-book-only carts', async () => {
    const { token } = await guestSession();
    await addToCart(token, await bookId('Deep Focus')).expect(200); // 9.99
    const res = await api().post('/api/checkout/summary').set(bearer(token)).send({}).expect(200);
    expect(res.body).toMatchObject({ subtotal: 9.99, shipping: 0, tax: 0.8, total: 10.79 });

    // ...even with express delivery selected.
    const express = await api().post('/api/checkout/summary').set(bearer(token)).send({ deliverySpeed: 'EXPRESS' }).expect(200);
    expect(express.body.shipping).toBe(0);
  });

  it('adds the express surcharge and shortens the delivery estimate', async () => {
    const { token } = await guestSession();
    await addToCart(token, await bookId('The Last Witness'), 3).expect(200);
    const standard = (await api().post('/api/checkout/summary').set(bearer(token)).send({}).expect(200)).body;
    const express = (await api().post('/api/checkout/summary').set(bearer(token)).send({ deliverySpeed: 'EXPRESS' }).expect(200)).body;
    expect(express.shipping).toBe(9.99);
    expect(express.total).toBe(Math.round((standard.total + 9.99) * 100) / 100);
    expect(new Date(express.estimatedDelivery).getTime()).toBeLessThan(new Date(standard.estimatedDelivery).getTime());
  });

  it('applies a percentage coupon before tax', async () => {
    const { token } = await guestSession();
    await addToCart(token, await bookId('The Last Witness'), 2).expect(200); // 25.98
    const res = await api().post('/api/checkout/summary').set(bearer(token)).send({ couponCode: 'welcome10' }).expect(200);
    // 25.98 - 2.60 = 23.38; tax 1.87; shipping 4.99
    expect(res.body).toMatchObject({ couponCode: 'WELCOME10', couponDiscount: 2.6, tax: 1.87, shipping: 4.99, total: 30.24 });
  });

  it('applies fixed coupons and caps percentage coupons at maxDiscount', async () => {
    const { token } = await guestSession();
    await addToCart(token, await bookId('Clean Systems'), 3).expect(200); // 119.97
    const percent = await api().post('/api/checkout/summary').set(bearer(token)).send({ couponCode: 'BOOKWORM20' }).expect(200);
    expect(percent.body.couponDiscount).toBe(23.99); // 20% = 23.994, under the $25 cap
    expect(percent.body.shipping).toBe(0);

    await addToCart(token, await bookId('Clean Systems'), 3).expect(200); // 239.94 total: 20% = 47.99 -> capped
    await api().put(`/api/cart/items/${await bookId('Clean Systems')}`).set(bearer(token)).send({ quantity: 6 }).expect(200);
    const capped = await api().post('/api/checkout/summary').set(bearer(token)).send({ couponCode: 'BOOKWORM20' }).expect(200);
    expect(capped.body.couponDiscount).toBe(25);

    const fixed = await api().post('/api/checkout/summary').set(bearer(token)).send({ couponCode: 'FLAT5' }).expect(200);
    expect(fixed.body.couponDiscount).toBe(5);
  });

  it('never discounts below zero', async () => {
    const { token } = await guestSession();
    await addToCart(token, await bookId('Letters from Montmartre')).expect(200); // 6.99
    const res = await api().post('/api/checkout/summary').set(bearer(token)).send({ couponCode: 'FLAT5' }).expect(400);
    expect(res.body.error).toMatch(/add \$13\.01 more/i); // min order $20
  });

  it('redeems gift points for registered users (1 point = $0.01)', async () => {
    const demo = await loginDemo();
    await emptyCart(demo.token);
    await addToCart(demo.token, await bookId('The Last Witness'), 2).expect(200); // 25.98
    const res = await api().post('/api/checkout/summary').set(bearer(demo.token)).send({ pointsToRedeem: 200 }).expect(200);
    // 25.98 - 2.00 = 23.98; tax 1.92; shipping 4.99
    expect(res.body).toMatchObject({ pointsRedeemed: 200, pointsDiscount: 2, tax: 1.92, shipping: 4.99, total: 30.89 });

    const tooMany = await api().post('/api/checkout/summary').set(bearer(demo.token)).send({ pointsToRedeem: 501 }).expect(400);
    expect(tooMany.body.error).toMatch(/only have 500 gift points/i);
    await emptyCart(demo.token);
  });

  it('does not let guests redeem points', async () => {
    const { token } = await guestSession();
    await addToCart(token, await bookId('The Last Witness'), 2).expect(200);
    const res = await api().post('/api/checkout/summary').set(bearer(token)).send({ pointsToRedeem: 10 }).expect(400);
    expect(res.body.error).toMatch(/only have 0 gift points/i);
  });

  it('rejects an empty cart, bad options and anonymous callers', async () => {
    const { token } = await guestSession();
    const empty = await api().post('/api/checkout/summary').set(bearer(token)).send({}).expect(400);
    expect(empty.body.error).toMatch(/cart is empty/i);

    await addToCart(token, await bookId('The Last Witness')).expect(200);
    await api().post('/api/checkout/summary').set(bearer(token)).send({ deliverySpeed: 'TELEPORT' }).expect(400);
    await api().post('/api/checkout/summary').set(bearer(token)).send({ pointsToRedeem: -5 }).expect(400);
    await api().post('/api/checkout/summary').set(bearer(token)).send({ couponCode: 'NOPE' }).expect(400);
    await api().post('/api/checkout/summary').send({}).expect(401);
  });
});

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
describe('payments', () => {
  it('lists methods, disabling account-based ones for guests', async () => {
    const guest = await guestSession();
    const asGuest = await api().get('/api/payments/methods').set(bearer(guest.token)).expect(200);
    const byId = Object.fromEntries(asGuest.body.methods.map((m: { id: string; enabled: boolean }) => [m.id, m.enabled]));
    expect(byId).toEqual({ CREDIT_CARD: true, DEBIT_CARD: true, UPI: true, WALLET: false, GIFT_POINTS: false });
    expect(asGuest.body).toMatchObject({ walletBalance: 0, giftPoints: 0 });

    const anon = await api().get('/api/payments/methods').expect(200);
    expect(anon.body.methods.find((m: { id: string }) => m.id === 'WALLET').enabled).toBe(false);

    const demo = await loginDemo();
    const asUser = await api().get('/api/payments/methods').set(bearer(demo.token)).expect(200);
    expect(asUser.body.methods.every((m: { enabled: boolean }) => m.enabled)).toBe(true);
    expect(asUser.body.walletBalance).toBeGreaterThan(0);
    expect(asUser.body.giftPoints).toBeGreaterThan(0);
  });

  it('authorises credit and debit card payments', async () => {
    const { token } = await guestSession();
    for (const method of ['CREDIT_CARD', 'DEBIT_CARD']) {
      const res = await api().post('/api/payments/process').set(bearer(token)).send({ method, amount: 32.18, details: GOOD_CARD }).expect(200);
      expect(res.body).toMatchObject({ status: 'AUTHORISED', method, amount: 32.18 });
      expect(res.body.reference).toMatch(/^SIM-[0-9A-F]{8}$/);
    }
  });

  it('declines the 0002 test card with 402', async () => {
    const { token } = await guestSession();
    const res = await api().post('/api/payments/process').set(bearer(token)).send({ method: 'CREDIT_CARD', amount: 10, details: DECLINED_CARD }).expect(402);
    expect(res.body.error).toMatch(/declined/i);
  });

  it('validates card details', async () => {
    const { token } = await guestSession();
    const res = await api()
      .post('/api/payments/process')
      .set(bearer(token))
      .send({ method: 'DEBIT_CARD', amount: 10, details: { cardNumber: '1234', expiry: '13/99', cvv: 'ab' } })
      .expect(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining(['cardNumber must be 16 digits', 'cardHolder is required', 'expiry must be in MM/YY format', 'cvv must be 3 or 4 digits'])
    );
    const expired = await api().post('/api/payments/process').set(bearer(token)).send({ method: 'CREDIT_CARD', amount: 10, details: { ...GOOD_CARD, expiry: '01/20' } }).expect(400);
    expect(expired.body.details).toContain('card has expired');
  });

  it('processes UPI payments and validates the UPI id', async () => {
    const { token } = await guestSession();
    const ok = await api().post('/api/payments/process').set(bearer(token)).send({ method: 'UPI', amount: 20, details: { upiId: 'jane@okbank' } }).expect(200);
    expect(ok.body.method).toBe('UPI');
    await api().post('/api/payments/process').set(bearer(token)).send({ method: 'UPI', amount: 20, details: { upiId: 'not-a-upi-id' } }).expect(400);
  });

  it('handles wallet and gift-point payments, and blocks them for guests', async () => {
    const guest = await guestSession();
    await api().post('/api/payments/process').set(bearer(guest.token)).send({ method: 'WALLET', amount: 5 }).expect(403);
    await api().post('/api/payments/process').set(bearer(guest.token)).send({ method: 'GIFT_POINTS', amount: 5 }).expect(403);

    const demo = await loginDemo();
    await api().post('/api/payments/process').set(bearer(demo.token)).send({ method: 'WALLET', amount: 10 }).expect(200);
    const poor = await api().post('/api/payments/process').set(bearer(demo.token)).send({ method: 'WALLET', amount: 1000 }).expect(402);
    expect(poor.body.error).toMatch(/insufficient wallet/i);
    await api().post('/api/payments/process').set(bearer(demo.token)).send({ method: 'GIFT_POINTS', amount: 5 }).expect(200); // 500 pts
    await api().post('/api/payments/process').set(bearer(demo.token)).send({ method: 'GIFT_POINTS', amount: 5.01 }).expect(402);
  });

  it('validates the request shape and requires authentication', async () => {
    const { token } = await guestSession();
    const res = await api().post('/api/payments/process').set(bearer(token)).send({ method: 'BITCOIN', amount: -1 }).expect(400);
    expect(res.body.details).toEqual(expect.arrayContaining([expect.stringMatching(/method must be one of/), expect.stringMatching(/amount/)]));
    await api().post('/api/payments/process').send({ method: 'UPI', amount: 1 }).expect(401);
  });

  it('does not change any balances (simulation only)', async () => {
    const demo = await loginDemo();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: demo.id } });
    await api().post('/api/payments/process').set(bearer(demo.token)).send({ method: 'WALLET', amount: 10 }).expect(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: demo.id } });
    expect(after.walletBalance).toBe(before.walletBalance);
    expect(after.giftPoints).toBe(before.giftPoints);
  });
});

// ---------------------------------------------------------------------------
// Orders: placement, history, 48-hour cancellation, Buy It Again
// ---------------------------------------------------------------------------
describe('orders', () => {
  let demo: { token: string; id: string };
  let homeAddressId: string;
  let witness: string;

  beforeAll(async () => {
    demo = await loginDemo();
    witness = await bookId('The Last Witness');
    const addresses = await api().get('/api/auth/addresses').set(bearer(demo.token)).expect(200);
    homeAddressId = addresses.body.find((a: { isDefault: boolean }) => a.isDefault).id;
  });

  beforeEach(async () => {
    await prisma.cartItem.deleteMany({ where: { userId: demo.id } });
  });

  const placeAsDemo = (body: Record<string, unknown> = {}) =>
    api()
      .post('/api/orders')
      .set(bearer(demo.token))
      .send({ addressId: homeAddressId, paymentMethod: 'CREDIT_CARD', paymentDetails: GOOD_CARD, ...body });

  const stockOf = async (id: string) => (await prisma.book.findUniqueOrThrow({ where: { id } })).stock;

  describe('placing an order', () => {
    it('places an order from the cart with server-side totals and a 48-hour cancellation window', async () => {
      await addToCart(demo.token, witness, 2).expect(200);
      const stockBefore = await stockOf(witness);
      const couponBefore = await prisma.coupon.findUniqueOrThrow({ where: { code: 'WELCOME10' } });

      const res = await placeAsDemo({ couponCode: 'welcome10' }).expect(201);
      const order = res.body;

      expect(order).toMatchObject({
        status: 'PLACED',
        subtotal: 25.98,
        discount: 2.6,
        couponCode: 'WELCOME10',
        tax: 1.87,
        shipping: 4.99,
        total: 30.24,
        paymentMethod: 'CREDIT_CARD',
        paymentStatus: 'PAID',
        canCancel: true,
        cancelledAt: null,
        shippingAddress: { fullName: 'Demo Reader', city: 'Springfield', postalCode: '62704' },
      });
      expect(order.orderNumber).toMatch(/^BW-\d{6}$/);
      expect(Number(order.orderNumber.slice(3))).toBeGreaterThan(100004);
      expect(order.paymentReference).toMatch(/^SIM-/);
      expect(order.items).toEqual([expect.objectContaining({ bookId: witness, title: 'The Last Witness', unitPrice: 12.99, quantity: 2, lineTotal: 25.98 })]);

      const windowMs = new Date(order.cancellableUntil).getTime() - new Date(order.placedAt).getTime();
      expect(windowMs).toBe(48 * HOUR_MS);
      expect(new Date(order.estimatedDelivery).getTime()).toBeGreaterThan(new Date(order.placedAt).getTime());
      expect(order.tracking.map((t: { status: string; completed: boolean }) => [t.status, t.completed])).toEqual([
        ['PLACED', true],
        ['PROCESSING', false],
        ['SHIPPED', false],
        ['DELIVERED', false],
      ]);

      // Side effects: cart emptied, stock decremented, coupon use recorded.
      expect((await api().get('/api/cart').set(bearer(demo.token)).expect(200)).body.items).toEqual([]);
      expect(await stockOf(witness)).toBe(stockBefore - 2);
      expect((await prisma.coupon.findUniqueOrThrow({ where: { code: 'WELCOME10' } })).usedCount).toBe(couponBefore.usedCount + 1);
    });

    it('assigns sequential order numbers', async () => {
      await addToCart(demo.token, witness).expect(200);
      const a = (await placeAsDemo().expect(201)).body;
      await addToCart(demo.token, witness).expect(200);
      const b = (await placeAsDemo().expect(201)).body;
      expect(Number(b.orderNumber.slice(3))).toBe(Number(a.orderNumber.slice(3)) + 1);
    });

    it('snapshots price and title, so later catalogue changes do not alter the order', async () => {
      await addToCart(demo.token, witness).expect(200);
      const order = (await placeAsDemo().expect(201)).body;
      await prisma.book.update({ where: { id: witness }, data: { price: 99, title: 'Renamed' } });
      try {
        const fetched = await api().get(`/api/orders/${order.id}`).set(bearer(demo.token)).expect(200);
        expect(fetched.body.items[0]).toMatchObject({ title: 'The Last Witness', unitPrice: 12.99 });
        expect(fetched.body.total).toBe(order.total);
      } finally {
        await prisma.book.update({ where: { id: witness }, data: { price: 12.99, title: 'The Last Witness' } });
      }
    });

    it('accepts an inline shipping address', async () => {
      await addToCart(demo.token, witness).expect(200);
      const res = await placeAsDemo({ addressId: undefined, shippingAddress: { ...GUEST_ADDRESS, line2: 'Unit 9' } }).expect(201);
      expect(res.body.shippingAddress).toMatchObject({ fullName: 'Guest Buyer', line1: '1 Test Lane', line2: 'Unit 9', country: 'US' });
    });

    it('redeems gift points and later refunds them on cancel', async () => {
      await addToCart(demo.token, witness, 2).expect(200); // 25.98
      const pointsBefore = (await prisma.user.findUniqueOrThrow({ where: { id: demo.id } })).giftPoints;

      const order = (await placeAsDemo({ pointsToRedeem: 200 }).expect(201)).body;
      expect(order).toMatchObject({ pointsRedeemed: 200, discount: 2, total: 30.89 });
      expect((await prisma.user.findUniqueOrThrow({ where: { id: demo.id } })).giftPoints).toBe(pointsBefore - 200);

      await api().post(`/api/orders/${order.id}/cancel`).set(bearer(demo.token)).send({}).expect(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: demo.id } })).giftPoints).toBe(pointsBefore);
    });

    it('pays from the wallet and refunds the wallet on cancel', async () => {
      await addToCart(demo.token, witness).expect(200); // 12.99 + 1.04 tax + 4.99 shipping = 19.02
      const walletBefore = (await prisma.user.findUniqueOrThrow({ where: { id: demo.id } })).walletBalance;

      const order = (await placeAsDemo({ paymentMethod: 'WALLET', paymentDetails: undefined }).expect(201)).body;
      expect(order).toMatchObject({ total: 19.02, paymentMethod: 'WALLET' });
      const walletAfter = (await prisma.user.findUniqueOrThrow({ where: { id: demo.id } })).walletBalance;
      expect(walletAfter).toBeCloseTo(walletBefore - 19.02, 2);

      await api().post(`/api/orders/${order.id}/cancel`).set(bearer(demo.token)).send({}).expect(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: demo.id } })).walletBalance).toBeCloseTo(walletBefore, 2);
    });

    it('declines on insufficient wallet or points, leaving cart, stock and balances untouched', async () => {
      await addToCart(demo.token, witness, 5).expect(200); // way over the $50 wallet and 500 points
      const stockBefore = await stockOf(witness);
      const userBefore = await prisma.user.findUniqueOrThrow({ where: { id: demo.id } });

      const wallet = await placeAsDemo({ paymentMethod: 'WALLET', paymentDetails: undefined }).expect(402);
      expect(wallet.body.error).toMatch(/insufficient wallet/i);
      const points = await placeAsDemo({ paymentMethod: 'GIFT_POINTS', paymentDetails: undefined }).expect(402);
      expect(points.body.error).toMatch(/insufficient gift points/i);

      expect(await stockOf(witness)).toBe(stockBefore);
      const userAfter = await prisma.user.findUniqueOrThrow({ where: { id: demo.id } });
      expect(userAfter).toMatchObject({ walletBalance: userBefore.walletBalance, giftPoints: userBefore.giftPoints });
      expect((await api().get('/api/cart').set(bearer(demo.token))).body.itemCount).toBe(5);
    });

    it('declines the 0002 test card with 402 and creates no order', async () => {
      await addToCart(demo.token, witness).expect(200);
      const countBefore = await prisma.order.count({ where: { userId: demo.id } });
      const stockBefore = await stockOf(witness);

      const res = await placeAsDemo({ paymentDetails: DECLINED_CARD }).expect(402);
      expect(res.body.error).toMatch(/declined/i);
      expect(await prisma.order.count({ where: { userId: demo.id } })).toBe(countBefore);
      expect(await stockOf(witness)).toBe(stockBefore);
      expect((await api().get('/api/cart').set(bearer(demo.token))).body.itemCount).toBe(1);
    });

    it('supports UPI and express delivery', async () => {
      await addToCart(demo.token, witness).expect(200);
      const res = await placeAsDemo({ paymentMethod: 'UPI', paymentDetails: { upiId: 'jane@okbank' }, deliverySpeed: 'EXPRESS' }).expect(201);
      expect(res.body).toMatchObject({ paymentMethod: 'UPI', shipping: 14.98 }); // 4.99 + 9.99
    });

    it('rolls back everything when stock runs out between cart and checkout', async () => {
      await addToCart(demo.token, witness, 3).expect(200);
      const stockBefore = await stockOf(witness);
      await prisma.book.update({ where: { id: witness }, data: { stock: 2 } });
      try {
        const res = await placeAsDemo().expect(409);
        expect(res.body.error).toMatch(/no longer has enough stock/i);
        expect(await stockOf(witness)).toBe(2);
        expect((await api().get('/api/cart').set(bearer(demo.token))).body.itemCount).toBe(3);
      } finally {
        await prisma.book.update({ where: { id: witness }, data: { stock: stockBefore } });
      }
    });

    it('validates the request', async () => {
      await addToCart(demo.token, witness).expect(200);
      const bad = await api().post('/api/orders').set(bearer(demo.token)).send({ paymentMethod: 'CASH' }).expect(400);
      expect(bad.body.details).toEqual([expect.stringMatching(/paymentMethod must be one of/)]);

      const noAddress = await api().post('/api/orders').set(bearer(demo.token)).send({ paymentMethod: 'CREDIT_CARD', paymentDetails: GOOD_CARD }).expect(400);
      expect(noAddress.body.error).toMatch(/addressId or shippingAddress/);

      const badNested = await placeAsDemo({ addressId: undefined, shippingAddress: { city: 'x' } }).expect(400);
      expect(badNested.body.details).toEqual(expect.arrayContaining(['fullName is required', 'line1 is required']));

      await placeAsDemo({ addressId: 'missing' }).expect(404);
      const badCard = await placeAsDemo({ paymentDetails: { cardNumber: '12' } }).expect(400);
      expect(badCard.body.details).toContain('cardNumber must be 16 digits');
      await placeAsDemo({ couponCode: 'NOPE' }).expect(400);

      // Nothing above should have consumed the cart.
      expect((await api().get('/api/cart').set(bearer(demo.token))).body.itemCount).toBe(1);
    });

    it("refuses another user's saved address", async () => {
      const other = await registerUser();
      const theirs = await api().post('/api/auth/addresses').set(bearer(other.token)).send(GUEST_ADDRESS).expect(201);
      await addToCart(demo.token, witness).expect(200);
      await placeAsDemo({ addressId: theirs.body.id }).expect(404);
    });

    it('rejects an empty cart and anonymous callers', async () => {
      const res = await placeAsDemo().expect(400);
      expect(res.body.error).toMatch(/cart is empty/i);
      await api().post('/api/orders').send({ paymentMethod: 'UPI' }).expect(401);
    });
  });

  describe('guest checkout', () => {
    it('lets a guest place an order with an email and inline address, but not view history', async () => {
      const guest = await guestSession();
      await addToCart(guest.token, witness, 3).expect(200);
      const body = { guestEmail: 'Guest@Example.com', shippingAddress: GUEST_ADDRESS, paymentMethod: 'DEBIT_CARD', paymentDetails: GOOD_CARD };

      const res = await api().post('/api/orders').set(bearer(guest.token)).send(body).expect(201);
      expect(res.body).toMatchObject({ status: 'PLACED', subtotal: 38.97, shipping: 0, total: 42.09, canCancel: true });
      const stored = await prisma.order.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(stored).toMatchObject({ userId: null, guestEmail: 'guest@example.com' });

      expect((await api().get('/api/cart').set(bearer(guest.token))).body.items).toEqual([]);
      await api().get('/api/orders').set(bearer(guest.token)).expect(403);
      await api().get(`/api/orders/${res.body.id}`).set(bearer(guest.token)).expect(403);
      await api().post(`/api/orders/${res.body.id}/cancel`).set(bearer(guest.token)).send({}).expect(403);
      await api().post(`/api/orders/${res.body.id}/reorder`).set(bearer(guest.token)).expect(403);
    });

    it('requires guestEmail and an inline address, and blocks wallet / points', async () => {
      const guest = await guestSession();
      await addToCart(guest.token, witness).expect(200);
      const base = { shippingAddress: GUEST_ADDRESS, paymentMethod: 'CREDIT_CARD', paymentDetails: GOOD_CARD };

      const noEmail = await api().post('/api/orders').set(bearer(guest.token)).send(base).expect(400);
      expect(noEmail.body.error).toMatch(/guestEmail is required/);
      await api().post('/api/orders').set(bearer(guest.token)).send({ ...base, guestEmail: 'not-an-email' }).expect(400);
      const savedAddr = await api().post('/api/orders').set(bearer(guest.token)).send({ ...base, guestEmail: 'g@example.com', shippingAddress: undefined, addressId: 'abc' }).expect(400);
      expect(savedAddr.body.error).toMatch(/guests must provide a shippingAddress/i);
      await api().post('/api/orders').set(bearer(guest.token)).send({ ...base, guestEmail: 'g@example.com', paymentMethod: 'WALLET' }).expect(403);
      await api().post('/api/orders').set(bearer(guest.token)).send({ ...base, guestEmail: 'g@example.com', pointsToRedeem: 50 }).expect(400);
    });
  });

  describe('history and details', () => {
    it('lists the seeded history newest-first with tab filters', async () => {
      const all = await api().get('/api/orders?status=ALL&pageSize=50').set(bearer(demo.token)).expect(200);
      const numbers = all.body.items.map((o: { orderNumber: string }) => o.orderNumber);
      expect(numbers).toEqual(expect.arrayContaining(['BW-100001', 'BW-100002', 'BW-100003', 'BW-100004']));
      const placedTimes = all.body.items.map((o: { placedAt: string }) => new Date(o.placedAt).getTime());
      expect(placedTimes).toEqual([...placedTimes].sort((a, b) => b - a));
      expect(all.body.totalPages).toBe(1);

      const delivered = await api().get('/api/orders?status=delivered&pageSize=50').set(bearer(demo.token)).expect(200);
      expect(delivered.body.items.every((o: { status: string }) => o.status === 'DELIVERED')).toBe(true);
      expect(delivered.body.items.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(expect.arrayContaining(['BW-100001', 'BW-100002']));

      const cancelled = await api().get('/api/orders?status=CANCELLED&pageSize=50').set(bearer(demo.token)).expect(200);
      expect(cancelled.body.items.every((o: { status: string }) => o.status === 'CANCELLED')).toBe(true);
      expect(cancelled.body.items.map((o: { orderNumber: string }) => o.orderNumber)).toContain('BW-100003');

      const active = await api().get('/api/orders?status=ACTIVE&pageSize=50').set(bearer(demo.token)).expect(200);
      expect(active.body.items.every((o: { status: string }) => ['PLACED', 'PROCESSING', 'SHIPPED'].includes(o.status))).toBe(true);
      expect(active.body.items.map((o: { orderNumber: string }) => o.orderNumber)).toContain('BW-100004');

      await api().get('/api/orders?status=BOGUS').set(bearer(demo.token)).expect(400);
    });

    it('paginates history', async () => {
      const page1 = await api().get('/api/orders?pageSize=2&page=1').set(bearer(demo.token)).expect(200);
      const page2 = await api().get('/api/orders?pageSize=2&page=2').set(bearer(demo.token)).expect(200);
      expect(page1.body.items).toHaveLength(2);
      const ids = [...page1.body.items, ...page2.body.items].map((o: { id: string }) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('fetches an order by id or by order number with tracking', async () => {
      const byNumber = await api().get('/api/orders/BW-100001').set(bearer(demo.token)).expect(200);
      expect(byNumber.body).toMatchObject({ orderNumber: 'BW-100001', status: 'DELIVERED', canCancel: false });
      expect(byNumber.body.items.map((i: { title: string }) => i.title).sort()).toEqual(['The Last Witness', 'Tiny Habits, Big Lives']);
      expect(byNumber.body.tracking.every((t: { completed: boolean }) => t.completed)).toBe(true);

      const byId = await api().get(`/api/orders/${byNumber.body.id}`).set(bearer(demo.token)).expect(200);
      expect(byId.body.orderNumber).toBe('BW-100001');

      const cancelled = await api().get('/api/orders/BW-100003').set(bearer(demo.token)).expect(200);
      expect(cancelled.body.tracking.map((t: { status: string }) => t.status)).toEqual(['PLACED', 'CANCELLED']);
    });

    it("hides other users' orders behind a 404 and requires authentication", async () => {
      const stranger = await registerUser();
      await api().get('/api/orders/BW-100001').set(bearer(stranger.token)).expect(404);
      expect((await api().get('/api/orders').set(bearer(stranger.token)).expect(200)).body.total).toBe(0);
      await api().get('/api/orders/unknown').set(bearer(demo.token)).expect(404);
      await api().get('/api/orders').expect(401);
    });
  });

  describe('48-hour cancellation policy', () => {
    it('cancels within the window: status, refund, restock and coupon release', async () => {
      await addToCart(demo.token, witness, 2).expect(200);
      const stockBefore = await stockOf(witness);
      const couponBefore = await prisma.coupon.findUniqueOrThrow({ where: { code: 'WELCOME10' } });
      const order = (await placeAsDemo({ couponCode: 'WELCOME10' }).expect(201)).body;
      expect(await stockOf(witness)).toBe(stockBefore - 2);

      const res = await api().post(`/api/orders/${order.id}/cancel`).set(bearer(demo.token)).send({ reason: 'Ordered by mistake' }).expect(200);
      expect(res.body).toMatchObject({
        status: 'CANCELLED',
        paymentStatus: 'REFUNDED',
        canCancel: false,
        cancelReason: 'Ordered by mistake',
      });
      expect(new Date(res.body.cancelledAt).getTime()).toBeLessThanOrEqual(Date.now());
      expect(res.body.tracking.map((t: { status: string }) => t.status)).toEqual(['PLACED', 'CANCELLED']);

      expect(await stockOf(witness)).toBe(stockBefore);
      expect((await prisma.coupon.findUniqueOrThrow({ where: { code: 'WELCOME10' } })).usedCount).toBe(couponBefore.usedCount);

      const listed = await api().get('/api/orders?status=CANCELLED&pageSize=50').set(bearer(demo.token)).expect(200);
      expect(listed.body.items.map((o: { id: string }) => o.id)).toContain(order.id);
    });

    it('cancels using the order number and without a reason', async () => {
      await addToCart(demo.token, witness).expect(200);
      const order = (await placeAsDemo().expect(201)).body;
      const res = await api().post(`/api/orders/${order.orderNumber}/cancel`).set(bearer(demo.token)).expect(200);
      expect(res.body).toMatchObject({ status: 'CANCELLED', cancelReason: null });
    });

    it('rejects a second cancellation with 409 and does not double-refund', async () => {
      await addToCart(demo.token, witness).expect(200);
      const stockBefore = await stockOf(witness);
      const order = (await placeAsDemo().expect(201)).body;
      await api().post(`/api/orders/${order.id}/cancel`).set(bearer(demo.token)).send({}).expect(200);

      const again = await api().post(`/api/orders/${order.id}/cancel`).set(bearer(demo.token)).send({}).expect(409);
      expect(again.body.error).toMatch(/already been cancelled/i);
      expect(await stockOf(witness)).toBe(stockBefore); // restocked exactly once
    });

    it('rejects cancellation once the 48-hour window has expired', async () => {
      await addToCart(demo.token, witness).expect(200);
      const order = (await placeAsDemo().expect(201)).body;
      expect(order.canCancel).toBe(true);
      const stockAfterPlacing = await stockOf(witness);

      // Age the order past the window.
      await prisma.order.update({ where: { id: order.id }, data: { cancellableUntil: new Date(Date.now() - 1000) } });

      const detail = await api().get(`/api/orders/${order.id}`).set(bearer(demo.token)).expect(200);
      expect(detail.body.canCancel).toBe(false);

      const res = await api().post(`/api/orders/${order.id}/cancel`).set(bearer(demo.token)).send({ reason: 'too late' }).expect(409);
      expect(res.body.error).toMatch(/48-hour cancellation window .* expired/i);
      expect(await stockOf(witness)).toBe(stockAfterPlacing);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PLACED');
    });

    it('allows cancellation right up to the deadline', async () => {
      await addToCart(demo.token, witness).expect(200);
      const order = (await placeAsDemo().expect(201)).body;
      await prisma.order.update({
        where: { id: order.id },
        data: { placedAt: new Date(Date.now() - 47.9 * HOUR_MS), cancellableUntil: new Date(Date.now() + 0.1 * HOUR_MS) },
      });
      await api().post(`/api/orders/${order.id}/cancel`).set(bearer(demo.token)).send({}).expect(200);
    });

    it('allows PROCESSING orders but blocks SHIPPED and DELIVERED ones, even inside the window', async () => {
      await addToCart(demo.token, witness).expect(200);
      const order = (await placeAsDemo().expect(201)).body;

      await prisma.order.update({ where: { id: order.id }, data: { status: 'SHIPPED' } });
      expect((await api().get(`/api/orders/${order.id}`).set(bearer(demo.token))).body.canCancel).toBe(false);
      const shipped = await api().post(`/api/orders/${order.id}/cancel`).set(bearer(demo.token)).send({}).expect(409);
      expect(shipped.body.error).toMatch(/shipped.*can no longer be cancelled/i);

      await prisma.order.update({ where: { id: order.id }, data: { status: 'PROCESSING' } });
      expect((await api().get(`/api/orders/${order.id}`).set(bearer(demo.token))).body.canCancel).toBe(true);
      await api().post(`/api/orders/${order.id}/cancel`).set(bearer(demo.token)).send({}).expect(200);

      const delivered = await api().post('/api/orders/BW-100001/cancel').set(bearer(demo.token)).send({}).expect(409);
      expect(delivered.body.error).toMatch(/delivered/i);
    });

    it("cannot cancel another user's order", async () => {
      await addToCart(demo.token, witness).expect(200);
      const order = (await placeAsDemo().expect(201)).body;
      const stranger = await registerUser();
      await api().post(`/api/orders/${order.id}/cancel`).set(bearer(stranger.token)).send({}).expect(404);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PLACED');
      await api().post(`/api/orders/${order.id}/cancel`).send({}).expect(401);
      await api().post('/api/orders/unknown/cancel').set(bearer(demo.token)).send({}).expect(404);
    });
  });

  describe('Buy It Again', () => {
    it('adds every item from a previous order to the cart', async () => {
      const res = await api().post('/api/orders/BW-100001/reorder').set(bearer(demo.token)).expect(200);
      expect(res.body.skipped).toEqual([]);
      const titles = res.body.cart.items.map((i: { book: { title: string } }) => i.book.title).sort();
      expect(titles).toEqual(['The Last Witness', 'Tiny Habits, Big Lives']);
      expect(res.body.cart).toMatchObject({ itemCount: 2, subtotal: 26.99 });
    });

    it('reorders from a cancelled order and repeats the original quantities', async () => {
      const res = await api().post('/api/orders/BW-100002/reorder').set(bearer(demo.token)).expect(200); // Lavender Summers x2
      expect(res.body.cart.items).toHaveLength(1);
      expect(res.body.cart.items[0]).toMatchObject({ quantity: 2, lineTotal: 23.98 });
      const cancelled = await api().post('/api/orders/BW-100003/reorder').set(bearer(demo.token)).expect(200);
      expect(cancelled.body.cart.items.map((i: { book: { title: string } }) => i.book.title)).toContain('Machine Learning, Explained');
    });

    it('merges into existing cart lines instead of duplicating them', async () => {
      await addToCart(demo.token, witness, 1).expect(200);
      const res = await api().post('/api/orders/BW-100001/reorder').set(bearer(demo.token)).expect(200);
      const line = res.body.cart.items.find((i: { bookId: string }) => i.bookId === witness);
      expect(line.quantity).toBe(2);
      expect(res.body.cart.items).toHaveLength(2);
    });

    it('skips out-of-stock titles and reports them', async () => {
      const tiny = await bookId('Tiny Habits, Big Lives');
      const stock = await stockOf(tiny);
      await prisma.book.update({ where: { id: tiny }, data: { stock: 0 } });
      try {
        const res = await api().post('/api/orders/BW-100001/reorder').set(bearer(demo.token)).expect(200);
        expect(res.body.skipped).toEqual(['Tiny Habits, Big Lives']);
        expect(res.body.cart.items.map((i: { bookId: string }) => i.bookId)).toEqual([witness]);
      } finally {
        await prisma.book.update({ where: { id: tiny }, data: { stock } });
      }
    });

    it('caps reordered quantity at available stock', async () => {
      const lavender = await bookId('Lavender Summers');
      const stock = await stockOf(lavender);
      await prisma.book.update({ where: { id: lavender }, data: { stock: 1 } });
      try {
        const res = await api().post('/api/orders/BW-100002/reorder').set(bearer(demo.token)).expect(200); // originally x2
        expect(res.body.cart.items[0].quantity).toBe(1);
      } finally {
        await prisma.book.update({ where: { id: lavender }, data: { stock } });
      }
    });

    it('lets the reordered cart go straight through checkout', async () => {
      await api().post('/api/orders/BW-100001/reorder').set(bearer(demo.token)).expect(200);
      const order = (await placeAsDemo().expect(201)).body;
      expect(order.items.map((i: { title: string }) => i.title).sort()).toEqual(['The Last Witness', 'Tiny Habits, Big Lives']);
      await api().post(`/api/orders/${order.id}/cancel`).set(bearer(demo.token)).send({}).expect(200);
    });

    it("404s for unknown or other users' orders and requires authentication", async () => {
      const stranger = await registerUser();
      await api().post('/api/orders/BW-100001/reorder').set(bearer(stranger.token)).expect(404);
      await api().post('/api/orders/unknown/reorder').set(bearer(demo.token)).expect(404);
      await api().post('/api/orders/BW-100001/reorder').expect(401);
    });
  });
});

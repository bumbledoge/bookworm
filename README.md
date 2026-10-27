# Book Worm 📚

A production-grade full-stack e-commerce platform for buying books online, built as an AI-assisted capstone project using **IBM Bob**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, Tailwind CSS, Lucide Icons, React Router v6, Axios |
| Backend | Node.js + Express, TypeScript, Prisma ORM |
| Database | SQLite (default, zero setup) · PostgreSQL (optional) |
| Auth | JWT (registered users) + Guest sessions |
| API Docs | OpenAPI 3.0 + Swagger UI |

---

## Project Structure

```
library/
├── client/          # React + Vite frontend (port 5173)
│   └── src/
│       ├── components/    # Reusable UI components
│       ├── context/       # AuthContext, CartContext, WishlistContext, ToastContext
│       ├── hooks/         # useCheckoutSummary
│       ├── lib/           # Formatting, cn(), coupon store, toast bus
│       ├── pages/         # Page-level components
│       ├── services/      # api.ts — all Axios API calls
│       └── types/         # Shared TypeScript types
└── server/          # Express backend (port 5000)
    ├── prisma/
    │   ├── schema.prisma  # Data model
    │   └── seed.ts        # Seed script (books, authors, coupons, demo users)
    └── src/
        ├── controllers/   # Request handlers
        ├── routes/        # Express routers
        ├── services/      # Business logic (orders, cart, pricing, payment)
        ├── middleware/     # JWT auth, validation, error handling
        └── docs/          # openapi.yaml
```

---

## Quick Start

### Prerequisites

- Node.js 18 or later
- npm 9 or later

### 1 — Install dependencies

```bash
# Backend
cd server && npm install

# Frontend
cd client && npm install
```

### 2 — Configure the backend

```bash
cd server
cp .env.example .env
```

The defaults work out of the box with SQLite. No database installation required.

> **Port conflict?** If port 5000 is in use (common on macOS due to AirPlay Receiver), either:
> - Kill the conflicting process: `lsof -ti :5000 | xargs kill -9`
> - Or set a different port: `PORT=5001 npm run dev` and update `client/.env` → `VITE_API_URL=http://localhost:5001/api`

### 3 — Seed the database

```bash
cd server
npm run prisma:push   # create tables
npm run db:seed       # populate books, authors, coupons, demo accounts
```

> The repo ships with a pre-seeded `server/prisma/dev.db`, so this step is only needed if you reset the database.

### 4 — Run both servers

**Terminal 1 — Backend**
```bash
cd server
npm run dev
# → http://localhost:5000
# → Swagger UI: http://localhost:5000/api-docs
```

**Terminal 2 — Frontend**
```bash
cd client
npm run dev
# → http://localhost:5173
```

---

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Customer | `demo@bookworm.com` | `Password123!` |
| Admin | `admin@bookworm.com` | `Admin123!` |

Use the **Sign In** button in the top-right navbar, or the demo account switcher.  
Browsing without signing in works automatically via a guest session.

---

## Features

### Catalogue & Search
- Browse books by category, language, format (Paperback / Hardcover / E-Book)
- Multi-faceted filter sidebar: price range, rating, in-stock only
- Sort by relevance, price, rating, or newest
- Curated home page sections: Recommended for You, Bestsellers, New Launches

### Product Detail
- Book metadata: ISBN, publisher, pages, publication date, delivery estimate
- Author biography and other works
- Customer reviews with star breakdown, submission modal, and helpfulness voting
- Related Reads recommendations

### Cart & Checkout
- Persistent cart (synced across guest → registered account)
- Quantity controls, remove, save for later
- Live order summary: subtotal, tax, delivery, coupon discount, gift points
- Coupon codes: `WELCOME10` (10% off), `BOOKWORM20` (20% off)
- Delivery speed: Standard or Express
- Payment methods: Credit Card, Debit Card, UPI, Digital Wallet, Gift Points

### Order Management
- Order History with tabs: All / Active / Delivered / Cancelled
- Real-time status tracking bar: Placed → Processing → Shipped → Delivered
- **48-Hour Cancellation**: live countdown timer, reason picker, full refund simulation
- **Buy It Again**: 1-click reorder adds all items back to the active cart

### User Profile (`/account`)
- Avatar, role badge, wallet balance, gift points dashboard
- Edit name and phone
- Address Book: add, edit, set default, delete saved addresses
- Personalised book recommendations

### Wishlist
- Save books for later, move to cart with one click

---

## Available Coupon Codes

| Code | Discount |
|------|----------|
| `WELCOME10` | 10% off your order |
| `BOOKWORM20` | 20% off orders over $30 |

Apply a coupon in the cart or during checkout.

---

## API Reference

Interactive Swagger UI is served at **`http://localhost:5000/api-docs`** when the backend is running.

### Key endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/guest` | Start a guest session |
| `POST` | `/api/auth/register` | Register a new account |
| `POST` | `/api/auth/login` | Log in (returns JWT) |
| `GET`  | `/api/auth/me` | Get current user profile |
| `PUT`  | `/api/auth/me` | Update name / phone |
| `GET`  | `/api/books` | Search & filter books |
| `GET`  | `/api/books/bestsellers` | Bestseller list |
| `GET`  | `/api/books/recommended` | Recommended books |
| `GET`  | `/api/books/new-launches` | New releases |
| `GET`  | `/api/books/:id` | Book detail |
| `GET`  | `/api/books/:id/reviews` | Paginated reviews |
| `POST` | `/api/books/:id/reviews` | Submit a review |
| `GET`  | `/api/cart` | Get current cart |
| `POST` | `/api/cart/items` | Add item to cart |
| `POST` | `/api/checkout/summary` | Calculate order totals |
| `GET`  | `/api/coupons` | List active coupons |
| `POST` | `/api/coupons/validate` | Validate a coupon code |
| `POST` | `/api/orders` | Place an order |
| `GET`  | `/api/orders` | Order history (status filter) |
| `GET`  | `/api/orders/:id` | Single order detail |
| `POST` | `/api/orders/:id/cancel` | Cancel within 48-hour window |
| `POST` | `/api/orders/:id/reorder` | Buy It Again (adds to cart) |
| `GET`  | `/api/auth/addresses` | List saved addresses |
| `POST` | `/api/auth/addresses` | Add a new address |
| `PUT`  | `/api/auth/addresses/:id` | Update / set default address |
| `DELETE` | `/api/auth/addresses/:id` | Delete an address |

---

## Database Schema

```
User ──< Address
User ──< Review
User ──< CartItem >── Book
User ──< Order  ──< OrderItem >── Book
Book ──< Review
Book >── Author
Book >── Category
Coupon (standalone)
```

All models use `cuid()` primary keys. SQLite is used locally; switch to PostgreSQL by changing the `datasource provider` in [`server/prisma/schema.prisma`](server/prisma/schema.prisma) and updating `DATABASE_URL`.

---

## Useful Scripts

### Backend (`server/`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with live reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled build |
| `npm run typecheck` | TypeScript check with no emit |
| `npm run db:seed` | Seed the database |
| `npm run db:reset` | Drop and re-seed the database |
| `npm run prisma:push` | Push schema changes to the database |
| `npm test` | Run Jest integration tests |

### Frontend (`client/`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | TypeScript check with no emit |
| `npm run preview` | Preview the production build |

---

## Environment Variables

### `server/.env`

```env
PORT=5000
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d

# SQLite (default)
DATABASE_URL="file:./dev.db"

# PostgreSQL (optional — uncomment and update)
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bookworm?schema=public"
```

### `client/.env` (optional)

```env
# Only needed if the backend runs on a port other than 5000
VITE_API_URL=http://localhost:5001/api
```

---

## Switching to PostgreSQL

1. Edit [`server/prisma/schema.prisma`](server/prisma/schema.prisma) — change `provider = "sqlite"` to `provider = "postgresql"`.
2. Update `DATABASE_URL` in `server/.env` to your PostgreSQL connection string.
3. Run:
   ```bash
   cd server
   npm run prisma:push
   npm run db:seed
   ```

---

## Development Notes

- The frontend proxies all `/api` requests to the backend via `VITE_API_URL` (defaults to `/api`, resolved by Vite's dev server proxy or the `baseURL` in [`client/src/services/api.ts`](client/src/services/api.ts)).
- Guest sessions are created automatically on first visit. Items added to a guest cart are merged into the user's cart on login or registration.
- The 48-hour cancellation window is computed server-side (`cancellableUntil = placedAt + 48h`) and enforced in [`server/src/services/order.service.ts`](server/src/services/order.service.ts).
- Payment processing is **simulated** — no real money moves. Wallet and gift point balances are read from the database and decremented on order placement.

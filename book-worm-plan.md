# Implementation Plan - "Book Worm" Full-Stack E-Commerce Platform

A production-grade, full-stack e-commerce web platform for **Book Worm**, built with React (Vite), Tailwind CSS, Node.js / Express, PostgreSQL (with Prisma ORM), and complete OpenAPI / Swagger documentation.

## User Review Required

> [!NOTE]
> Please review the architectural breakdown, data models, and sub-task milestones before we proceed to execution in Agent mode.

---

## Architecture & System Design

```
+--------------------------------------------------------------------------------+
|                               FRONTEND (React + Vite)                          |
|  - React Router DOM (Pages & Layouts)                                          |
|  - Tailwind CSS + Lucide Icons (Responsive, modern bookstore theme)            |
|  - State Management: CartContext, AuthContext, WishlistContext                 |
|  - API Client: Axios / Fetch wrapper with OpenAPI-aligned endpoints            |
+--------------------------------------------------------------------------------+
                                       |
                                HTTP / REST
                                       v
+--------------------------------------------------------------------------------+
|                         BACKEND API (Node.js + Express)                        |
|  - OpenAPI 3.0 Specification & Swagger UI (/api-docs)                          |
|  - Auth Middleware (JWT & Guest Session Support)                               |
|  - Routers: /auth, /books, /categories, /cart, /orders, /coupons, /reviews     |
|  - Business Logic: Tax, shipping, coupon discount, 48h cancellation engine     |
+--------------------------------------------------------------------------------+
                                       |
                                Prisma ORM
                                       v
+--------------------------------------------------------------------------------+
|                          DATABASE (PostgreSQL / SQLite)                        |
|  - Users, Addresses, Books, Authors, Categories, Reviews, Orders, OrderItems   |
|  - Seed script with rich bookstore data and author profiles                    |
+--------------------------------------------------------------------------------+
```

---

## Sub-Tasks

### Sub-Task 1: Backend Foundation, Database Schema & OpenAPI Specification
- **Intent**: Establish the Express backend project, Prisma schema with PostgreSQL support (with automated fallback for local testing), data seeding, and OpenAPI 3.0 specification with Swagger UI.
- **Expected Outcomes**:
  - Express server running on port 5000 with CORS, JSON body parser, and error middleware.
  - Complete Prisma schema covering `User`, `Address`, `Author`, `Category`, `Book`, `Review`, `CartItem`, `Order`, `OrderItem`, and `Coupon`.
  - Rich database seed script populated with realistic bookstore inventory (Bestsellers, New Launches, Recommended books, Authors, Coupons).
  - OpenAPI 3.0 documentation served interactively at `/api-docs`.
- **Todo List**:
  - [ ] Initialize `server/` with `package.json`, TypeScript/ESM configuration, and dependencies (`express`, `cors`, `@prisma/client`, `swagger-ui-express`, `yamljs`, `bcryptjs`, `jsonwebtoken`, `dotenv`).
  - [ ] Write Prisma schema (`server/prisma/schema.prisma`) and seed script (`server/prisma/seed.ts`).
  - [ ] Write OpenAPI 3.0 spec (`server/src/docs/openapi.yaml`) covering all auth, catalogue, cart, order, and review endpoints.
  - [ ] Mount Swagger UI at `/api-docs` and verify endpoint contracts.
- **Relevant Context**: `server/src/index.ts`, `server/prisma/schema.prisma`, `server/src/docs/openapi.yaml`
- **Status**: `[x] done`

---

### Sub-Task 2: Backend REST API Endpoints & Business Logic
- **Intent**: Implement all backend controller logic and services fulfilling the customer journeys defined in the capstone guide.
- **Expected Outcomes**:
  - Authentication: Guest session initialization, User registration, Login (JWT), Profile & Address management.
  - Catalogue & Search: Filter by category, language, format (paperback, e-book), price range, ratings, and keyword search. Featured endpoints for *Recommended for You*, *Bestsellers*, and *New Launches*.
  - Product Details: Book metadata, author biography, review creation and retrieval with aggregate ratings, related reads algorithm.
  - Cart & Checkout: Item addition, quantity updates, shipping address management, coupon validation, pricing calculation (subtotal + tax + delivery - discounts).
  - Payment & Orders: Payment simulation (Credit Card, Debit Card, UPI, Wallet, Gift points), order placement, order history with "Buy It Again", and 48-hour order cancellation window logic.
- **Todo List**:
  - [x] Implement Auth Controller & JWT / Guest middleware (`server/src/controllers/auth.controller.ts`).
  - [x] Implement Books & Authors Controller (`server/src/controllers/book.controller.ts`).
  - [x] Implement Reviews Controller (`server/src/controllers/review.controller.ts`).
  - [x] Implement Cart & Checkout Controller (`server/src/controllers/cart.controller.ts`).
  - [x] Implement Orders & Payment Controller with 48h cancellation policy (`server/src/controllers/order.controller.ts`).
  - [x] Connect routes to Express app and write integration tests with Supertest/Jest.
- **Relevant Context**: `server/src/routes/`, `server/src/controllers/`, `server/src/services/`
- **Status**: `[x] done`

---

### Sub-Task 3: Frontend Foundation, Design System & Application Shell
- **Intent**: Set up the React + Vite frontend application with Tailwind CSS, custom bookstore design tokens, layout navigation, and global context providers.
- **Expected Outcomes**:
  - Vite React client running on port 3000/5173 with Tailwind CSS and Lucide icons.
  - Global State Providers: `AuthContext` (handling Registered vs Guest modes), `CartContext` (cart sync, item count badge), and `WishlistContext`.
  - Responsive Navbar with live search bar, category navigation menu, cart drawer/badge, user auth modal, and quick guest switcher.
  - Responsive Footer with customer service links, newsletter signup, and store guarantee badges.
- **Todo List**:
  - [x] Initialize `client/` with Vite (React + Tailwind CSS + Lucide React + React Router + Axios).
  - [x] Configure Tailwind theme with warm bookstore colors, clean typography, and toast notifications.
  - [x] Implement `AuthContext`, `CartContext`, and API client utilities (`client/src/services/api.ts`).
  - [x] Build Header / Navbar, Mobile Menu, Footer, and App Layout (`client/src/components/layout/`).
- **Relevant Context**: `client/src/App.tsx`, `client/src/context/`, `client/src/components/layout/`
- **Status**: `[x] done`

---

### Sub-Task 4: Catalogue, Search & Home Customer Journeys
- **Intent**: Build the Home Page and Catalogue Browse/Search views with interactive filtering, sorting, and curated merchandising sections.
- **Expected Outcomes**:
  - Home Page featuring Hero promotion, Category cards, *Recommended for You*, *Bestsellers this Month*, and *New Launches*.
  - Catalogue Page featuring multi-faceted sidebar filters (Category, Language, Format: Paperback/E-Book, Price Slider, Rating Stars, In-Stock), Sort selector (Relevance, Price Low/High, Rating, Newest), and Search query handling.
  - Product Card component with hover preview, rating stars, price, format pill, and "Add to Cart" / "Wishlist" actions.
- **Todo List**:
  - [x] Build `HomePage` with hero carousel, featured sections, and newsletter promo (`client/src/pages/HomePage.tsx`).
  - [x] Build `CataloguePage` with filter sidebar, sorting bar, active filter tags, and book grid (`client/src/pages/CataloguePage.tsx`).
  - [x] Build reusable `BookCard`, `RatingStars`, `FilterSidebar`, and `SearchBar` components.
- **Relevant Context**: `client/src/pages/HomePage.tsx`, `client/src/pages/CataloguePage.tsx`, `client/src/components/books/`
- **Status**: `[x] done`

---

### Sub-Task 5: Product Detail Page & Author / Reviews System
- **Intent**: Implement the complete Product Detail Page with metadata, author profile ("About the writer"), interactive reviews, and related reads recommendations.
- **Expected Outcomes**:
  - Detailed product view with book cover image zoom, metadata (Author, Publisher, ISBN, Format, Publication Date, Delivery Estimate, Total Sales counter).
  - "About the Writer" author profile section with author photo, bio, and other works by the author.
  - Reviews & Ratings section with customer review breakdown, review submission modal with star rating and commentary.
  - "Related Reads" sidebar / recommendations carousel.
- **Todo List**:
  - [x] Build `BookDetailPage` layout and product actions (`client/src/pages/BookDetailPage.tsx`).
  - [x] Build `AuthorProfileSection` and `RelatedReadsSection`.
  - [x] Build `ReviewsSection` with interactive review submission form, rating breakdown bars, and helpfulness upvoting.
- **Relevant Context**: `client/src/pages/BookDetailPage.tsx`, `client/src/components/reviews/`, `client/src/components/author/`
- **Status**: `[x] done`

---

### Sub-Task 6: Shopping Cart, Multi-Step Checkout & Payment Processing
- **Intent**: Build the shopping cart, address management, coupon redemption, dynamic order summary calculation, and multi-option payment simulation.
- **Expected Outcomes**:
  - Shopping Cart page with line item quantity modifiers (`-`, `+`), format badge, remove action, and save for later.
  - Order summary breakdown showing Item Subtotal, Taxes, Delivery Charges, Coupon Discounts (e.g. `WELCOME10`, `BOOKWORM20`), and Grand Total.
  - Checkout flow: Saved shipping address selection / manual entry form, Delivery speed selection.
  - Payment screen supporting Credit/Debit Card, UPI, Digital Wallet, and Gift Points redemption with real-time balance update.
  - Order Purchase Confirmation screen with order ID, receipt summary, and estimated delivery timeline.
- **Todo List**:
  - [x] Build `CartPage` with item controls and live pricing calculation (`client/src/pages/CartPage.tsx`).
  - [x] Build `CheckoutPage` with Address Selector and Coupon redemption (`client/src/pages/CheckoutPage.tsx`).
  - [x] Build `PaymentModal` / `PaymentSection` for Card/UPI/Wallet/Points (`client/src/components/checkout/PaymentSection.tsx`).
  - [x] Build `OrderConfirmationPage` with order summary and shipment tracking preview (`client/src/pages/OrderConfirmationPage.tsx`).
- **Relevant Context**: `client/src/pages/CartPage.tsx`, `client/src/pages/CheckoutPage.tsx`, `client/src/components/checkout/`
- **Status**: `[x] done`

---

### Sub-Task 7: Order History, 48-Hour Cancellation & "Buy It Again" Personalization
- **Intent**: Build the user account center featuring order history tracking, 48-hour order cancellation with live countdown/status badge, "Buy It Again" 1-click reorder, and personalized recommendations.
- **Expected Outcomes**:
  - Order History dashboard with tabbed statuses (All, Active, Delivered, Cancelled).
  - 48-Hour Cancellation policy action allowing instant order cancellation if within the eligible window with reason capture and refund simulation.
  - "Buy It Again" quick action adding prior purchased books directly into active cart.
  - User profile with saved addresses, points balance, and order-history-driven recommendation feed.
- **Todo List**:
  - [ ] Build `OrderHistoryPage` with order cards, status timeline, and cancel order modal (`client/src/pages/OrderHistoryPage.tsx`).
  - [ ] Implement 48-hour countdown timer and cancellation action logic.
  - [ ] Implement "Buy It Again" reorder functionality.
  - [ ] Build `UserProfilePage` with address book and points redemption history (`client/src/pages/UserProfilePage.tsx`).
- **Relevant Context**: `client/src/pages/OrderHistoryPage.tsx`, `client/src/pages/UserProfilePage.tsx`
- **Status**: `[ ] pending`

---

### Sub-Task 8: End-to-End Verification, Automated Tests & Demonstration Guide
- **Intent**: Validate the complete full-stack platform with automated tests, responsive testing, OpenAPI compliance check, and provide the capstone submission documentation.
- **Expected Outcomes**:
  - Backend integration tests passing for auth, books, cart, and orders.
  - Frontend component and workflow tests passing for navigation, cart, and checkout.
  - Complete project README with setup instructions, OpenAPI documentation link, demo script for the 3-minute video presentation, and Git PR readiness.
- **Todo List**:
  - [ ] Write backend API test suites (`server/src/__tests__/`).
  - [ ] Write frontend unit/integration tests (`client/src/__tests__/`).
  - [ ] Run full build verification for both client and server (`npm run build`).
  - [ ] Create comprehensive `README.md` and `DEMO_GUIDE.md` detailing the agentic development workflow with IBM BOB / Agentic IDEs.
- **Relevant Context**: `server/src/__tests__/`, `client/src/__tests__/`, `README.md`, `DEMO_GUIDE.md`
- **Status**: `[ ] pending`

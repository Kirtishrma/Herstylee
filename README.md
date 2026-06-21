# HERSTYLE

AI-powered women's fashion e-commerce — Groq stylist, Stripe payments, admin dashboard, MongoDB.

## Project structure

```
herstyle/
├── README.md
├── frontend/                 # Tailwind CSS + ES modules
│   ├── src/
│   │   ├── styles/main.css   # Tailwind + component styles
│   │   └── js/               # Modular JavaScript (esbuild bundle)
│   ├── views/                # EJS templates
│   ├── public/               # Built assets + images
│   │   ├── css/app.css       # ← Tailwind build output
│   │   └── js/app.js         # ← JS bundle output
│   └── package.json
└── backend/                  # Express + TypeScript API
    ├── src/
    ├── data/fashion_products.csv
    └── package.json
```

## Stack

| Layer | Tech |
|-------|------|
| Frontend | **Tailwind CSS 3**, EJS, ES modules (esbuild) |
| Backend | Express 5, TypeScript, MongoDB |
| Auth | JWT + Google OAuth |
| Payments | Stripe (INR display → USD checkout) |
| Email | Brevo |
| AI | Groq (Llama 3.3) |

## Setup

### 1. Install dependencies

```bash
npm run install:all
# or: cd frontend && npm install && cd ../backend && npm install
```

### 2. Build frontend (Tailwind + JS)

```bash
cd frontend && npm run build
```

This generates `public/css/app.css` and `public/js/app.js`.

### 2. Environment

**Backend** (`backend/.env`):
```bash
cp backend/.env.example backend/.env
```

**Frontend** (`frontend/.env`):
```bash
cp frontend/.env.example frontend/.env
```

Fill in `backend/.env`:

- `APP_URL` — your live site URL (emails, Stripe success redirect)
- `FRONTEND_URL` — only if frontend and backend are on **different domains** (enables CORS)
- `MONGODB_URI` — local or [MongoDB Atlas](https://www.mongodb.com/atlas)
- `JWT_SECRET` — long random string
- `GROQ_API_KEY` — [console.groq.com](https://console.groq.com/keys)
- `STRIPE_*` — [dashboard.stripe.com](https://dashboard.stripe.com/test/apikeys)
- `BREVO_API_KEY` + `EMAIL_FROM` — [app.brevo.com](https://app.brevo.com) (verify sender email)
- `GOOGLE_CLIENT_SECRET` — OAuth secret (Client ID goes in `frontend/.env`)
- `ADMIN_EMAILS` — comma-separated admin emails (auto-promoted on server start)
- `ADMIN_EMAIL` — legacy single admin (still works if `ADMIN_EMAILS` not set)

Fill in `frontend/.env`:

- `API_URL` — Render backend URL (leave **empty** for local `:3000`)
  ```env
  API_URL=https://your-app.onrender.com
  ```
- `GOOGLE_CLIENT_ID` — from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
  - Redirect URI: `{API_URL}/auth/google/callback` (or `http://localhost:3000/auth/google/callback` locally)

### 4. Run

**From project root (recommended):**
```bash
npm run dev
```
Builds frontend once, then watches Tailwind + JS + backend together.

**Or separately:**
```bash
npm run dev:frontend   # Tailwind + JS watch
npm run dev:backend    # Express server
```

> `frontend/` uses **Tailwind CSS** — edit `frontend/src/styles/main.css` or EJS templates, CSS rebuilds automatically in dev mode.

Open [http://localhost:3000](http://localhost:3000)

Admin panel: [http://localhost:3000/admin](http://localhost:3000/admin) (login with an `ADMIN_EMAILS` account)

## Deploy

HERSTYLE is a **monolith** — the Express backend serves EJS pages, static assets, and `/api/*` routes together. Recommended: deploy one server (Render, Railway, Fly.io, VPS).

### Single-server deploy (recommended)

1. Build frontend + backend:
   ```bash
   npm run build
   ```
2. Set env on your host:
   - `backend/.env` — `APP_URL`, `MONGODB_URI`, `JWT_SECRET`, Stripe, Brevo, etc.
   - `frontend/.env` — `API_URL` leave **empty** (same server)
3. Start: `cd backend && npm start`
4. Google OAuth redirect URI: `https://your-app.onrender.com/auth/google/callback`
5. Stripe webhook: `https://your-app.onrender.com/api/payments/webhook`

### Split frontend + backend (advanced)

If the frontend and API run on different URLs:

| File | Variable | Example |
|------|----------|---------|
| `backend/.env` | `APP_URL` | `https://herstyle.vercel.app` (emails, Stripe return) |
| `backend/.env` | `FRONTEND_URL` | `https://herstyle.vercel.app` (CORS) |
| `frontend/.env` | `API_URL` | `https://herstyle-api.onrender.com` (Render URL) |
| `frontend/.env` | `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` |
| `backend/.env` | `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` (never put in frontend!) |

Google OAuth redirect URI must use the **backend** URL:  
`https://herstyle-api.onrender.com/auth/google/callback`

> Note: pages are EJS templates rendered by Express, so the frontend still needs a Node server (or proxy) that serves those pages. Static-only hosting without the backend won't work for full pages.

## Features

- Product catalog (8 collections), search, cart, wishlist, checkout
- **Guest checkout** — shop & pay without login (cart saved in browser)
- **Multiple saved addresses** in profile + picker at checkout
- **Print receipt** on orders page
- Stripe payments + coupons (HERSTYLE10, WELCOME500, FLAT20)
- Order tracking + receipt & shipped emails
- Style Muse chat (multi-turn, Groq) + Complete the Look + occasion presets
- Reviews, newsletter, profile, recently viewed, previously purchased
- Search sort + pagination, related products on product pages
- User order cancellation, abandoned cart reminder emails (Brevo)
- Admin: dashboard charts, orders, products (add/edit/delete + **collection picker**), coupons

## Scripts

```bash
cd backend
npm run dev      # Development (tsx watch)
npm run build    # Compile TypeScript → dist/
npm start        # Production (node dist/index.js)
```

## API (highlights)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Sign up |
| POST | `/api/auth/login` | Login |
| GET | `/auth/google` | Google OAuth |
| POST | `/api/ai/chat` | Style Muse chat (auth required) |
| POST | `/api/payments/create-session` | Stripe checkout |
| GET | `/api/admin/analytics` | Sales dashboard data |

JWT via `herstyle_token` cookie or `Authorization: Bearer` header.

<div align="center">

# HERSTYLE

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&duration=3000&pause=800&color=C08497&center=true&vCenter=true&width=520&lines=Premium+Women's+Fashion+E-Commerce;AI-Powered+Style+Muse+%7C+Groq+Llama;Stripe+Payments+%7C+MongoDB+Atlas;Full-Stack+Monolith+%7C+Express+%2B+EJS" alt="HERSTYLE tagline" />

<br />

[![Live Demo](https://img.shields.io/badge/Live-herstylee.onrender.com-C08497?style=for-the-badge&logo=render&logoColor=white)](https://herstylee.onrender.com)
[![Node](https://img.shields.io/badge/Node.js-22+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com)

<br />

*A full-stack fashion storefront with an AI personal stylist, secure checkout, order lifecycle emails, and a complete admin dashboard — all served from a single Express monolith.*

<br />

[Explore Live Site](https://herstylee.onrender.com) · [Local Setup](#-quick-start) · [Deploy](#-deployment) · [API Reference](#-api-reference)

</div>

---

## Table of Contents

- [Overview](#-overview)
- [Highlights](#-highlights)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Collections](#-collections)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment)
- [Features Deep Dive](#-features-deep-dive)
- [Admin Panel](#-admin-panel)
- [API Reference](#-api-reference)
- [Scripts](#-scripts)
- [Troubleshooting](#-troubleshooting)

---

## Overview

HERSTYLE is a production-ready women's fashion e-commerce platform built as a *monolith*: one Express server renders EJS pages, serves static assets (Tailwind CSS, bundled JS, product images), and exposes REST APIs under /api/*.

Shoppers browse eight curated collections, get AI outfit recommendations from *Style Muse, check out with **Stripe* (INR display with USD settlement), and track orders with status-aware email notifications. Admins manage products, orders, coupons, and analytics from a dedicated dashboard.

---

## Highlights

<table>
<tr>
<td width="50%">

### Shopping Experience

- 8 seasonal & occasion collections
- Search with sort, filters & pagination
- Product detail pages with reviews & related items
- Cart, wishlist & guest checkout
- Multiple saved addresses at checkout
- Recently viewed & reorder from past purchases
- Coupon codes at checkout

</td>
<td width="50%">

### Platform & Ops

- *Style Muse* — multi-turn AI chat (Groq Llama 3.3)
- Complete-the-Look outfit bundles
- JWT + Google OAuth authentication
- Stripe webhooks for payment confirmation
- Brevo transactional emails (confirmed / shipped / delivered)
- Abandoned cart reminder scheduler
- Admin analytics, orders & catalog management

</td>
</tr>
</table>

---

## Architecture

mermaid
flowchart TB
    subgraph Client["Browser"]
        UI["EJS Pages + Tailwind UI"]
        JS["app.js Bundle"]
    end

    subgraph Server["Express Monolith :3000"]
        Pages["Page Routes\n/ · /casual · /product/:slug"]
        API["REST API\n/api/*"]
        Static["Static Assets\n/css · /js · /images"]
        Auth["Auth Middleware\nJWT Cookie + Bearer"]
    end

    subgraph Services["External Services"]
        Mongo[(MongoDB Atlas)]
        Groq[Groq AI]
        Stripe[Stripe Checkout]
        Brevo[Brevo Email]
        Google[Google OAuth]
    end

    UI --> Pages
    JS --> API
    Pages --> Auth
    API --> Auth
    Auth --> Mongo
    API --> Groq
    API --> Stripe
    API --> Brevo
    Auth --> Google
    Stripe -->|webhook| API


<details>
<summary><strong>Request flow — checkout to confirmation</strong></summary>

mermaid
sequenceDiagram
    participant U as User
    participant S as Express Server
    participant DB as MongoDB
    participant ST as Stripe
    participant EM as Brevo

    U->>S: POST /api/payments/create-session
    S->>DB: Create pending order
    S->>ST: Create Checkout Session
    ST-->>U: Redirect to Stripe
    U->>ST: Complete payment
    ST->>S: POST /api/payments/webhook
    S->>DB: Mark order paid + confirmed
    S->>EM: Send order receipt email
    ST-->>U: Redirect to /orders?success=1


</details>

---

## Tech Stack

| Layer        | Technology                                  | Purpose                                      |
| ------------ | ------------------------------------------- | -------------------------------------------- |
| *Runtime*  | Node.js 22+, Express 5                      | HTTP server & routing                        |
| *Language* | TypeScript (backend), ES modules (frontend) | Type-safe API logic                          |
| *Views*    | EJS templates                               | Server-rendered HTML pages                   |
| *Styling*  | Tailwind CSS 3, PostCSS                     | Utility-first responsive UI                  |
| *Bundling* | esbuild                                     | Frontend JS → public/js/app.js             |
| *Database* | MongoDB + Mongoose                          | Products, orders, users, carts               |
| *Auth*     | JWT (httpOnly cookie) + Google OAuth        | Login, register, admin guard                 |
| *Payments* | Stripe Checkout                             | INR display → USD charge + webhooks          |
| *Email*    | Brevo (SMTP/API)                            | Receipts, shipping, delivery, password reset |
| *AI*       | Groq SDK (Llama 3.3)                        | Style Muse chat & product matching           |
| *Hosting*  | Render (recommended)                        | Single-service monolith deploy               |

---

## Project Structure


HerStyle/
├── README.md
├── package.json                 # Root scripts (dev, build, install:all)
│
├── frontend/
│   ├── src/
│   │   ├── styles/
│   │   │   ├── main.css         # Tailwind entry
│   │   │   └── legacy/          # Page-specific CSS modules
│   │   └── js/
│   │       ├── main.js          # Bundle entry
│   │       └── lib/             # api, auth, cart, guestCart, recent…
│   ├── views/                   # EJS templates
│   │   ├── partials/            # head, header, footer
│   │   ├── home.ejs
│   │   ├── stylist.ejs          # Style Muse UI
│   │   ├── admin.ejs
│   │   └── …
│   ├── public/
│   │   ├── css/app.css          # ← Tailwind build output
│   │   ├── js/app.js            # ← esbuild output
│   │   ├── images/              # Product & hero images (gitignored locally optional)
│   │   └── favicon.svg
│   ├── .env.example
│   └── package.json
│
└── backend/
    ├── src/
    │   ├── index.ts             # App entry — static, routes, DB seed
    │   ├── routes/              # auth, shop, payments, admin, api…
    │   ├── models/              # User, Product, Order, Cart, Coupon…
    │   ├── services/            # groq, stripe, email, coupons, seed…
    │   ├── middleware/          # auth, cors
    │   └── config/              # collections, public env, sizes
    ├── data/
    │   └── fashion_products.csv # Product seed data
    ├── .env.example
    └── package.json


---

## Collections

Eight curated categories, each with a dedicated landing page, hero imagery, and product grid.

| Route            | Category    | Theme                                 |
| ---------------- | ----------- | ------------------------------------- |
| /casual        | Casual      | Everyday street & travel style        |
| /formals       | Formal      | Office & power dressing               |
| /night         | Night Wear  | Lounge & sleepwear                    |
| /party-western | Partywear   | Evening & celebration looks           |
| /traditional   | Traditional | Lehengas, sarees, ethnic wear         |
| /summer        | Summer      | Light, breathable warm-weather pieces |
| /winter        | Winter      | Layered cozy outfits                  |
| /spring        | Spring      | Floral & pastel spring styles         |

Product pages live at /product/:slug with size selection, reviews, and related products.

---

## Quick Start

### Prerequisites

- *Node.js 22+* and npm
- *MongoDB* — local or [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- API keys for optional integrations (Groq, Stripe, Brevo, Google OAuth)

### 1 · Clone & install

bash
git clone https://github.com/Kirtishrma/Herstylee.git
cd Herstylee
npm run install:all


### 2 · Environment files

bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env


Fill in the values — see [Environment Variables](#-environment-variables) below.

### 3 · Build & run

bash
npm run dev


This builds the frontend once, then watches Tailwind CSS, JS, and the backend together.

| URL                                                            | Description     |
| -------------------------------------------------------------- | --------------- |
| [http://localhost:3000](http://localhost:3000)                 | Storefront      |
| [http://localhost:3000/stylist](http://localhost:3000/stylist) | Style Muse AI   |
| [http://localhost:3000/admin](http://localhost:3000/admin)     | Admin dashboard |
| [http://localhost:3000/search](http://localhost:3000/search)   | Product search  |

> Admin access: register with an email listed in ADMIN_EMAILS, then restart the server so the seed promotes that account.

---

## Environment Variables

<details open>
<summary><strong>Backend — <code>backend/.env</code></strong></summary>

| Variable                 | Required     | Description                                                                |
| ------------------------ | ------------ | -------------------------------------------------------------------------- |
| APP_URL                | Yes          | Public site URL (emails, Stripe redirects). Local: http://localhost:3000 |
| PORT                   | Local only   | Default 3000. *Do not set on Render* — platform injects it             |
| MONGODB_URI            | Yes          | MongoDB connection string                                                  |
| JWT_SECRET             | Yes          | Long random string (32+ chars) for signing tokens                          |
| GROQ_API_KEY           | For AI       | [Groq Console](https://console.groq.com/keys) — Style Muse                 |
| STRIPE_PUBLISHABLE_KEY | For payments | pk_test_… or pk_live_…                                                 |
| STRIPE_SECRET_KEY      | For payments | sk_test_… or sk_live_…                                                 |
| STRIPE_WEBHOOK_SECRET  | For payments | whsec_… from Stripe webhook endpoint                                     |
| BREVO_API_KEY          | For email    | [Brevo](https://app.brevo.com) API key                                     |
| EMAIL_FROM             | For email    | Verified sender, e.g. HERSTYLE <you@email.com>                           |
| GOOGLE_CLIENT_SECRET   | For OAuth    | Never expose in frontend                                                   |
| ADMIN_EMAILS           | For admin    | Comma-separated emails auto-promoted on startup                            |
| FRONTEND_URL           | Split deploy | Only when frontend & API are on different domains (CORS)                   |
| INR_USD_RATE           | Optional     | Fixed INR→USD rate; leave empty for live rate                              |

</details>

<details>
<summary><strong>Frontend — <code>frontend/.env</code></strong></summary>

| Variable           | Required        | Description                                           |
| ------------------ | --------------- | ----------------------------------------------------- |
| API_URL          | Monolith: empty | Leave *empty* when frontend & backend share one URL |
| API_URL          | Split deploy    | Backend URL, e.g. https://herstylee.onrender.com    |
| GOOGLE_CLIENT_ID | For OAuth       | Public client ID from Google Cloud Console            |

*Google OAuth redirect URI* (must match your backend URL):


{BACKEND_URL}/auth/google/callback


Examples:

- Local: http://localhost:3000/auth/google/callback
- Production: https://herstylee.onrender.com/auth/google/callback

</details>

<details>
<summary><strong>Stripe webhook setup</strong></summary>

1. [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/test/webhooks) (test mode for development)
2. *Add endpoint* → URL: https://your-domain.com/api/payments/webhook
3. Select event: checkout.session.completed
4. Copy *Signing secret* (whsec_…) → STRIPE_WEBHOOK_SECRET

For local testing:

bash
stripe listen --forward-to localhost:3000/api/payments/webhook


Use the CLI-provided whsec_… in backend/.env.

</details>

---

## Deployment

HERSTYLE ships as a *single web service* — no separate frontend host required.

### Render (recommended)

| Setting            | Value                                  |
| ------------------ | -------------------------------------- |
| *Repository*     | Kirtishrma/Herstylee                 |
| *Branch*         | main                                 |
| *Root Directory* | (leave blank)                        |
| *Build Command*  | npm run install:all && npm run build |
| *Start Command*  | cd backend && npm start              |
| *Instance*       | Free or paid                           |

*Environment variables on Render* — paste all keys from backend/.env and frontend/.env into the Render dashboard (.env files are not committed). Key points:

- APP_URL = your Render URL, e.g. https://herstylee.onrender.com
- API_URL = *leave empty* (monolith)
- PORT = *do not set* (Render assigns automatically)
- GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET both go in Render env

*Post-deploy checklist:*

- [ ] MongoDB Atlas → Network Access → allow 0.0.0.0/0 (or Render IPs)
- [ ] Google OAuth → add production redirect URI
- [ ] Stripe → webhook URL points to live domain
- [ ] Brevo → sender email verified
- [ ] Manual redeploy after env changes

<details>
<summary><strong>Split frontend + backend (advanced)</strong></summary>

If the API runs on a different domain than the storefront:

| File            | Variable       | Example                    |
| --------------- | -------------- | -------------------------- |
| backend/.env  | APP_URL      | https://shop.example.com |
| backend/.env  | FRONTEND_URL | https://shop.example.com |
| frontend/.env | API_URL      | https://api.example.com  |

OAuth redirect URI must use the *backend* URL.

> Pages are EJS templates rendered by Express — static-only hosting (Netlify/Vercel without a Node proxy) will not serve full pages.

</details>

---

## Features Deep Dive

<details>
<summary><strong>Style Muse — AI Personal Stylist</strong></summary>

- Multi-turn conversational chat powered by *Groq Llama 3.3*
- Context-aware product recommendations from the live catalog
- *Complete the Look* — curated outfit bundles added to cart in one click
- Occasion presets (office, wedding, date night, vacation…)
- Chat session history persisted per user
- Requires login + GROQ_API_KEY

</details>

<details>
<summary><strong>Shopping & Checkout</strong></summary>

- Full-text search with category filter, price sort, and pagination
- Persistent cart (logged-in) or *guest cart* in browser localStorage
- Guest checkout flow with Stripe — no account required
- Size selection from configurable size charts per category
- Wishlist toggle on product cards
- Coupon validation at checkout (HERSTYLE10, WELCOME500, FLAT20 seeded by default)
- INR prices displayed; Stripe charges in USD with live or fixed exchange rate
- Print-friendly order receipt on /orders

</details>

<details>
<summary><strong>Orders & Email Notifications</strong></summary>

Order lifecycle emails sent via Brevo based on status:

| Status      | Email                               |
| ----------- | ----------------------------------- |
| confirmed | Order receipt with line items       |
| shipped   | Shipping notification + tracking ID |
| delivered | Delivery confirmation               |

Users can cancel orders before shipping. Admins update status from the dashboard; saving triggers the matching email automatically.

</details>

<details>
<summary><strong>User Account</strong></summary>

- Email/password register & login
- Google OAuth one-click sign-in
- Forgot / reset password flow
- Profile: name, phone, avatar
- Multiple shipping addresses with default picker at checkout
- Order history with status badges
- Recently viewed products on homepage
- Previously purchased — quick reorder section

</details>

<details>
<summary><strong>Reviews & Newsletter</strong></summary>

- Star ratings and text reviews on product pages
- Average rating displayed on cards
- Footer newsletter subscription stored in MongoDB

</details>

---

## Admin Panel

Access at /admin — requires an account whose email is in ADMIN_EMAILS.

| Section       | Capabilities                                                    |
| ------------- | --------------------------------------------------------------- |
| *Dashboard* | Revenue, order count, top products, sales charts                |
| *Orders*    | List, filter, update status & tracking ID, resend status email  |
| *Products*  | Add, edit, delete; collection picker; image path helper         |
| *Coupons*   | Create percent/fixed discounts, min order, expiry, usage limits |

On server start the app automatically:

- Seeds products from CSV if the catalog is empty
- Syncs product images from frontend/public/images/
- Seeds default coupons
- Promotes ADMIN_EMAILS accounts to admin role

---

## API Reference

Authentication via herstyle_token httpOnly cookie or Authorization: Bearer <token> header.

<details>
<summary><strong>Auth</strong></summary>

| Method | Endpoint                    | Auth | Description          |
| ------ | --------------------------- | ---- | -------------------- |
| POST   | /api/auth/register        | —    | Create account       |
| POST   | /api/auth/login           | —    | Email/password login |
| GET    | /api/auth/me              | User | Current user profile |
| POST   | /api/auth/logout          | —    | Clear session cookie |
| POST   | /api/auth/forgot-password | —    | Send reset email     |
| POST   | /api/auth/reset-password  | —    | Set new password     |
| POST   | /api/auth/change-password | User | Change password      |
| GET    | /auth/google              | —    | Start Google OAuth   |
| GET    | /auth/google/callback     | —    | OAuth callback       |

</details>

<details>
<summary><strong>Products & Shop</strong></summary>

| Method | Endpoint                    | Auth | Description                         |
| ------ | --------------------------- | ---- | ----------------------------------- |
| GET    | /api/products             | —    | List products (filters, pagination) |
| GET    | /api/products/categories  | —    | Category list                       |
| GET    | /api/products/by-slugs    | —    | Bulk fetch by slug                  |
| GET    | /api/products/:id/reviews | —    | Product reviews                     |
| POST   | /api/products/:id/reviews | User | Submit review                       |

</details>

<details>
<summary><strong>Cart, Wishlist & Orders</strong></summary>

| Method | Endpoint                 | Auth | Description              |
| ------ | ------------------------ | ---- | ------------------------ |
| GET    | /api/cart              | User | Get cart                 |
| POST   | /api/cart              | User | Add item                 |
| PATCH  | /api/cart/:productId   | User | Update quantity/size     |
| DELETE | /api/cart/:productId   | User | Remove item              |
| POST   | /api/cart/bundle       | User | Add outfit bundle        |
| GET    | /api/wishlist          | User | Get wishlist             |
| POST   | /api/wishlist/toggle   | User | Add/remove wishlist item |
| GET    | /api/orders            | User | Order history            |
| POST   | /api/orders/:id/cancel | User | Cancel order             |

</details>

<details>
<summary><strong>Payments & Guest</strong></summary>

| Method | Endpoint                             | Auth   | Description                |
| ------ | ------------------------------------ | ------ | -------------------------- |
| GET    | /api/payments/preview              | User   | Checkout totals + coupon   |
| POST   | /api/payments/create-session       | User   | Stripe Checkout session    |
| GET    | /api/payments/verify-session       | User   | Post-payment verify        |
| POST   | /api/payments/webhook              | Stripe | Payment webhook (raw body) |
| POST   | /api/guest/payments/create-session | —      | Guest Stripe checkout      |
| POST   | /api/coupons/validate              | User   | Validate coupon code       |

</details>

<details>
<summary><strong>AI & Admin</strong></summary>

| Method                | Endpoint                | Auth  | Description           |
| --------------------- | ----------------------- | ----- | --------------------- |
| POST                  | /api/ai/chat          | User  | Style Muse message    |
| GET                   | /api/ai/sessions      | User  | List chat sessions    |
| GET                   | /api/ai/sessions/:id  | User  | Session messages      |
| POST                  | /api/ai/find-dress    | User  | Occasion-based search |
| GET                   | /api/admin/analytics  | Admin | Dashboard data        |
| GET                   | /api/admin/orders     | Admin | All orders            |
| PATCH                 | /api/admin/orders/:id | Admin | Update order          |
| GET/POST/PATCH/DELETE | /api/admin/products   | Admin | Product CRUD          |
| GET/POST/PATCH/DELETE | /api/admin/coupons    | Admin | Coupon CRUD           |

</details>

---

## Scripts

Run from the *project root*:

| Command                | Description                              |
| ---------------------- | ---------------------------------------- |
| npm run install:all  | Install frontend + backend dependencies  |
| npm run build        | Production build (CSS + JS + TypeScript) |
| npm run dev          | Dev mode — watch all layers              |
| npm run dev:frontend | Tailwind + esbuild watch only            |
| npm run dev:backend  | Express tsx watch only                   |

Backend-only (from backend/):

| Command         | Description                  |
| --------------- | ---------------------------- |
| npm run dev   | Development with hot reload  |
| npm run build | Compile TypeScript → dist/ |
| npm start     | Production server            |

---

## Troubleshooting

<details>
<summary><strong>Images not showing on production</strong></summary>

Product images live in frontend/public/images/. Ensure they are committed and pushed to GitHub (use git add -f if gitignored). After push, trigger a Render redeploy.

</details>

<details>
<summary><strong>MongoDB connection failed</strong></summary>

- Verify MONGODB_URI in Render env (no typos, correct password)
- Atlas → *Network Access* → allow Render (0.0.0.0/0 for free tier)
- Check cluster is not paused (Atlas free tier)

</details>

<details>
<summary><strong>Stripe payment succeeds but order stays pending</strong></summary>

- Confirm STRIPE_WEBHOOK_SECRET matches the endpoint signing secret
- Webhook URL must be exactly /api/payments/webhook
- Check Stripe Dashboard → Webhooks → event deliveries for 4xx errors
- Test and live mode keys/webhooks must match the same mode

</details>

<details>
<summary><strong>Google login redirect error</strong></summary>

- Redirect URI in Google Cloud must exactly match {APP_URL}/auth/google/callback
- GOOGLE_CLIENT_ID in env; GOOGLE_CLIENT_SECRET in backend env only
- After env changes on Render, redeploy

</details>

<details>
<summary><strong>Render free tier slow first load</strong></summary>

Free instances spin down after ~15 minutes of inactivity. The first request after sleep may take 30–60 seconds — this is expected on the free plan.

</details>

<details>
<summary><strong>Git push timeout for large images</strong></summary>

Push image folders in smaller batches (~5 files, ~10 MB each):

bash
git add -f frontend/public/images/casual/c1.png ...
git commit -m "Add casual images batch 1"
git push origin main


Or increase buffer: git config http.postBuffer 524288000

</details>

---

<div align="center">

<br />

*HERSTYLE* — Fashion designed for modern women.

<br />

[![Live Demo](https://img.shields.io/badge/Visit-herstylee.onrender.com-C08497?style=for-the-badge)](https://herstylee.onrender.com)

</div>

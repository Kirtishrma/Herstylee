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

# PlanHub — digital subscription store

A small storefront for selling ChatGPT, Claude, Netflix, Spotify and similar plans.
Built with Next.js (App Router) and a SQLite database (Turso in production).

- **Storefront** (`/`) — live catalog, category filter, cart and checkout.
- **Admin** (`/admin`) — private, unlinked inventory dashboard: add products, change names, prices and quantity.
  It is only reachable by typing the URL and signing in with `ADMIN_PASSWORD`; it is not linked from the
  storefront and is marked `noindex`.
- **Database** — `products` (name, slug, category, description, price_cents, quantity) and `orders`.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no database variables set, the store creates
`data/store.db` and seeds 15 sample plans on first request.

The admin dashboard is separate from the store: there is no link to it on the page, and it requires the
`ADMIN_PASSWORD` environment variable. Local development reads it from `.env.local` (gitignored). Without
`ADMIN_PASSWORD` set, `/admin` refuses every sign-in — there is no fallback password.

## Deploy to Vercel

1. Create a free database at [turso.tech](https://turso.tech) (or `turso db create planhub`), then copy the
   database URL (`libsql://…`) and create a token with `turso db tokens create planhub`.
2. Import [oussama-blh/my-store](https://github.com/oussama-blh/my-store) into Vercel.
   Choose the **Next.js** preset, keep the root directory at the repository root, and use
   **Node.js 22.x**. Keep the default build command (`npm run build`) and output directory.
3. Add environment variables in Vercel → Settings → Environment Variables:

   | Variable | Value |
   | --- | --- |
   | `TURSO_DATABASE_URL` | `libsql://your-db.turso.io` |
   | `TURSO_AUTH_TOKEN` | the token from step 1 |
   | `ADMIN_PASSWORD` | a long password only you know (required for `/admin`) |

4. Add all three variables to **Production** before deploying. For Preview deployments,
   use a separate Turso database and token so testing does not change live inventory or orders.
5. Deploy. The tables are created and seeded automatically on the first request.
   Open `/` to verify the catalog, then `/admin` to sign in and check inventory management.
   Future pushes to `main` trigger production deployments once the GitHub integration is connected.

Vercel requires a hosted database: the local `data/store.db` file is not deployed and its
existing products/orders are not migrated automatically. A fresh database starts with sample
products; review prices and stock before accepting orders. Keep credentials in Vercel environment
variables or the ignored `.env.local`, never in Git. No custom `vercel.json` is needed.

## Checkout behaviour

Prices and stock are validated on the server, never taken from the browser. Placing an
order decrements each product's `quantity` in one transaction and stores an order with a
`PH-XXXXXXXX` reference. Payment is not wired up: the confirmation tells the buyer your
team will email the access details, so collect payment however you prefer before delivery.

## Useful commands

```bash
npm run build      # production build
npm run typecheck  # TypeScript check
```

# Margewise

True profit for Shopify stores: every order, after product cost, payment fees, courier,
packaging, returns, VAT and Meta ad spend.

Phase 1 runs privately for Flexi Muscles (fleximuscles.co.za).

## How it works

```
Shopify orders ─┐                      ┌─> daily_results ─> dashboard (/)
                ├─> Supabase ─> engine ┤
Meta ad spend ──┘                      └─> products, campaigns vs break-even
```

- `src/lib/engine.ts`: the profit maths. Pure functions, no I/O.
- `test/engine.test.ts`: reproduces the September 2026 answer key
  (contribution R100,923.88, profit after ads R32,547.21) to the cent.
- `src/lib/shopify.ts`, `src/lib/meta.ts`: read-only data pulls.
- `src/lib/sync.ts`: stores orders and ad spend, recomputes daily results.
- `/api/cron/sync`: runs nightly at 05:00 SAST (03:00 UTC) and re-pulls the last 3 days.
- `/api/backfill?from=YYYY-MM-DD&to=YYYY-MM-DD`: one-off history load.
  Both endpoints require `Authorization: Bearer $CRON_SECRET`.
- `/`: the dashboard, behind a username and password.

## Settings live in the database

Fee rules, courier rates, packaging and bulky products are rows in Supabase
(`shop_settings`, `payment_fee_rules`, `product_settings`), not code. Change them there;
the next recompute picks them up. A settings screen comes in phase 2.

## Environment variables

See `.env.example`. Secrets are set in Vercel only, never committed.

## Commands

```
npm install
npm test        # profit engine vs September answer key
npm run build
```

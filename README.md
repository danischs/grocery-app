# Prime Mart

An online grocery platform for a Pakistani retailer, built mobile-first for a market where most orders are cash on delivery, addresses are free text, and the store's existing POS system stays in charge of prices and stock.

> **Status:** in active development. Database, product import, and home screen are done; cart and checkout are next.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Components), TypeScript |
| Styling | Tailwind CSS v4 with a token-based theme |
| Database | PostgreSQL 16 (Docker), Drizzle ORM + drizzle-kit migrations |
| Data import | TypeScript seed script (exceljs, tsx) |
| Product matching | Python (pandas, rapidfuzz) |
| Fonts | Bricolage Grotesque (English), Noto Nastaliq Urdu |

## Interesting problems

### 1. Matching 9,700 POS items to product content

The retailer had no product images or clean names, just a POS export with abbreviated descriptions like `NAT CUSTARD VANILLA 300GM` and `MIT KETCHUP 800G`. I built a matching pipeline against a scraped catalogue of about 5,000 products:

- **Normalising both sides:** units are standardised (`1 LTR` → `1l`, `30GM` → `30g`) and POS brand abbreviations are expanded (`NAT` → National, `MIT` → Mitchells).
- **Hard filters before fuzzy scoring:** brand must match, size must match when both sides have one, and variant words (zero, diet, lite) must agree on both sides.
- **Three confidence tiers:** auto-accept, human review (top 3 candidates with image links), or unmatched.

Results: 739 items auto-matched, with about 94% agreement against earlier manual matches. Most of the disagreements turned out to be errors in the *manual* matches. A further 1,333 items were queued for review, sorted by sales volume so the best sellers get reviewed first.

### 2. The POS is the source of truth

Prices and stock live in the store's existing POS. The app never edits them; it syncs from the POS, keyed by item code (usually the EAN barcode). Product content (names, images) is owned by the app.

- **Re-runnable imports:** the seed script upserts on item code. Re-runs update price and stock, but never overwrite a product name someone edited by hand.
- **Negative stock is stored as-is.** Real POS data contains negative stock, so a `>= 0` check would break the sync.
- **Available stock** = on hand − reserved by open orders − a safety buffer that covers in-store sales between syncs.

### 3. Modelling how orders work in Pakistan

- **Cash on delivery is two states:** `delivered` and `cash_collected` are separate, because a rider delivers before handing in the cash.
- **Out-of-stock handling:** the customer chooses at checkout to substitute, remove, or be called. Order lines track ordered vs picked quantity and any substitute.
- **Sold-by-weight items:** the customer orders a target weight, the picker records the actual weight, and the charge follows the actual weight up to a cap.
- **Addresses are free text plus a map pin**, not US-style fields.

### 4. Schema decisions that prevent bugs

- **Money is stored as integer paisa** (1 rupee = 100 paisa), never as floats. Weights are integer grams.
- **Every timestamp is `timestamptz`**, because the server runs on UTC while the store runs on Pakistan time.
- **Orders snapshot the delivery address and product names**, so old orders stay correct when a customer edits their address or a product is renamed.
- **Status fields use CHECK constraints**, so a typo like `"deliverd"` can't be saved.
- **Every order status change is logged** in `order_events` (from, to, actor, timestamp).

### 5. English and Urdu from day one

Product and category fields have English and Urdu versions, with an Urdu Nastaliq font and right-to-left layout support built into the theme.

## Architecture

```
app/              Next.js routes (Server Components by default)
lib/db/           Drizzle schema, client, queries
lib/validation/   Zod schemas for all API input
migrations/       Generated SQL migrations (schema changes only via migrations)
scripts/          POS seed script + product matching pipeline
docs/             Product decisions
```

The database has 12 tables: categories, products, variants, stock, customers, addresses, delivery_zones, riders, orders, order_items, order_events, payments.

## Running locally

Requires Node 18+ and Docker. After cloning the repo:

```bash
npm install
cp .env.example .env
docker compose up -d        # Postgres on port 5433
npx drizzle-kit migrate
npm run seed                # needs POS data in data/ (client data not included)
npm run dev                 # http://localhost:3000
```

## Roadmap

- [x] Database schema and migrations
- [x] POS import with product matching
- [x] Home screen
- [ ] Cart, checkout, and stock reservation
- [ ] Order management for pickers and riders
- [ ] Scheduled POS sync
- [ ] Installable app (PWA) + Play Store release
- [ ] Online payments (JazzCash, Easypaisa)

# Product Decisions

Status: v1 defaults, chosen to minimise work. Revisit after launch.

## 0. Source of truth: the POS

- The in-store POS owns **price** and **stock**. The app never edits either.
- The app syncs from the POS on a schedule (target: every 5–15 min), keyed by **Item Code**.
- Item Code (usually the EAN barcode) is the unique key for a sellable item.
- Product content (name, images, description, category) is owned by the **app**. It comes from the matching pipeline (`match_products.py`) and manual edits.
- Prices are stored as integer paisa. POS prices are rupees, so multiply by 100 on import.

**Open:** how do we get data out of the POS (API, DB access, or scheduled CSV/Excel export)? This decides how the sync job is built.

## 1. Variants

- `products` (shared content: brand, name, images, description) → `variants` (one per POS Item Code: size, price, stock).
- The POS already has one row per size with its own barcode, so each POS item = one variant.
- A product with one size still gets one variant row.

## 2. Stock

- One location at launch. The stock table still has `location_id`, with a single row for now.
- `available = on_hand (from POS) − reserved (open app orders) − safety_buffer`.
- The safety buffer (default 2 units, configurable per variant) covers in-store sales between syncs.

## 3. Order states

```
pending → confirmed → picking → out_for_delivery → delivered → cash_collected
   ↘ cancelled (allowed from pending, confirmed, picking)
```

- `delivered` and `cash_collected` are separate: the rider can deliver before handing in the cash.
- Every state change is logged in `order_events` (from, to, actor, timestamp).

## 4. Out of stock at picking

- At checkout the customer picks one option per order: **substitute similar** / **remove item** / **call me**.
- Order lines store `ordered_qty`, `picked_qty`, `substituted_by_variant_id`.
- The total is recalculated after picking, before dispatch.

## 5. Inventory reservation

- Stock is reserved when the order is placed and released on cancel or after picking.
- Reservations live in the app DB only. They are never written back to the POS.

## 6. Sold-by-weight items

- These are flagged on the variant (`sold_by_weight`, priced per kg).
- The customer orders a target weight. The picker records the actual weight.
- The charge is for the actual weight, capped at +10% of the ordered weight.

## 7. Payments

- COD only at launch.
- `payments` is its own table (method, amount_paisa, status, collected_by, collected_at), so JazzCash and Easypaisa can be added later without changing orders.

## 8. Defaults (no schema impact)

| Topic | v1 |
|---|---|
| Cities | One city. A `delivery_zones` table (name, fee, active) restricts where we deliver. |
| Delivery timing | ASAP only. Time slots later, via config. |
| Riders | Own riders. `rider_id` on the order, with a simple riders table. |
| Addresses | Free text + map pin (lat/lng) + phone. No US-style fields. |
| Languages | Product name/description fields support English + Urdu from day one. |

## 9. Out of scope for v1

Online payments, multiple cities or warehouses, delivery slots, third-party riders, loyalty/promos, and pushing anything back to the POS.

## Rules for Claude Code (also in CLAUDE.md)

- Schema changes only via migration files.
- Money as integer paisa.
- Never trust price or quantity from the client. Recompute server-side from the DB.
- All API input validated with Zod in `/lib/validation`.

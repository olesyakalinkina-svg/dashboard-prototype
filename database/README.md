# Hockey Club BI Database

PostgreSQL star schema for the hockey club analytics dashboard. Revenue streams: **tickets**, **merch**, and **subscriptions** (no foodcourt/catering).

## Overview

The schema follows a classic star layout:

- **Dimensions** — club, arena, opponents, matches, products, customers, promotions, calendar (`dim_date`)
- **Facts** — `sale` (ticket and merch transactions), `subscription` (abonement purchases), `subscription_redemption` (match visits via abonement)

All analytical views live in the `bi` schema and mirror KPIs and charts from `lib/filters.ts`.

```
                    ┌─────────────┐
                    │  dim_date   │
                    └──────┬──────┘
                           │
    ┌──────────┐    ┌──────┴──────┐    ┌─────────────┐
    │  match   │◄───│    sale     │───►│   product   │
    └────┬─────┘    └─────────────┘    └──────┬──────┘
         │                                    │
    ┌────┴─────┐                         ┌────┴────────────┐
    │ opponent │                         │ product_category│
    └──────────┘                         └────────┬────────┘
                                                  │
                                           ┌──────┴──────┐
                                           │revenue_stream│
                                           └─────────────┘

    ┌──────────────────┐         ┌─────────────────────────┐
    │ subscription_plan│◄────────│      subscription       │
    └──────────────────┘         └───────────┬─────────────┘
                                               │
                               ┌───────────────┴───────────────┐
                               │  subscription_redemption      │
                               └───────────────┬───────────────┘
                                               │
                                          ┌────┴────┐
                                          │  match  │
                                          └─────────┘
```

## Tables

### Dimensions

| Table | Description |
|-------|-------------|
| `club` | Hockey club (e.g. Металлург Магнитогорск) |
| `arena` | Venues: `main` (12 000) and `secondary` (3 000), `code` matches mock `arena` |
| `opponent` | Away teams |
| `match` | Home games: `season`, `league` (KHL/VHL/MHL), `tournament_stage`, `match_class`, per-match `capacity` (MHL 6300 on main arena), `ticket_sales_window_days`, plus date/attendance/status |
| `revenue_stream` | Lookup: `tickets`, `merch`, `subscriptions` |
| `sales_channel` | `online`, `arena`, `kiosk` |
| `sector` | Arena sections `A`, `B1`–`B4`, `C1`–`C4`, `D1`–`D4`, `VIP`, with `zone_group` A/B/C/D/VIP |
| `product_category` | Product groups per revenue stream |
| `product` | SKUs: tickets, merch items (`base_price`, optional `sector_id`) |
| `subscription_plan` | Abonement tariffs (match count, price, validity) |
| `customer_segment` | Fan segments (regular, VIP, student, …) |
| `customer` | Optional buyer profile |
| `promotion` | Marketing campaigns with `target_stream` |
| `promotion_match` | M:N link between promotions and matches |
| `dim_date` | Calendar dimension for time intelligence |

### Facts

| Table | Description |
|-------|-------------|
| `sale` | Ticket and merch sales: amount, quantity, loyalty discount, `ticket_type` (`arena` / `parking`), `price_zone` (four unit-price buckets, NULL for parking/merch), links to `match_id`, `product_id`, `sector_id`, optional `promotion_id` |
| `subscription` | Abonement purchase: plan, price, validity, `season` / `league` / `tournament_stage` / `ticket_type` / `sector_id`, `matches_total` / `matches_used`, channel, status |
| `subscription_redemption` | One row per abonement use at a `match_id` |

### Key relationships

- `sale.match_id` → `match.id` — revenue attributed to a home game (nullable for online merch)
- `sale.stream_id` → `revenue_stream` — `tickets` or `merch`
- `sale.product_id` → `product` → `product_category` → `revenue_stream`
- `subscription_redemption.match_id` → `match.id` — which game the abonement was used at
- `promotion_match` links campaigns to specific matches

## Views (dashboard tabs)

| View | Dashboard tab | Purpose |
|------|---------------|---------|
| `v_revenue_unified` | All | Unified fact: sales + subscription purchases (season, league, sector, price_zone, ticket_type) |
| `v_tickets_kpi`, `v_tickets_kpi_summary` | Билеты | Revenue, tickets sold, avg price, loyalty discount, today |
| `v_sector_sales` | Билеты | Sales by price zone and zone group |
| `v_match_catalog` | All | Match dimension: season, league, stage, class, arena |
| `v_match_revenue` | Билеты / Мерч | Revenue per match by stream |
| `v_merch_by_match` | Мерч | Merch revenue per match |
| `v_top_products` | Мерч | Top merch SKUs |
| `v_channel_mix` | All tabs | Revenue share by channel per stream |
| `v_subscription_stats` | Абонементы | Sold, revenue, utilization per plan |
| `v_subscription_by_season` | Абонементы | Sold and revenue by season, league, zone |
| `v_subscription_redemptions_by_match` | Абонементы | Redemptions per match |
| `v_weekly_revenue` | — | Weekly breakdown: tickets, merch, subscriptions |
| `v_daily_kpi` | — | Daily totals for BI tools |
| `v_promotion_performance` | — | Campaign ROI and conversion |
| `v_match_attendance` | — | Fill rate per match |

## File layout

| File | Role |
|------|------|
| `01_schema.sql` | DDL: tables, indexes, `populate_dim_date()` |
| `02_seed.sql` | Reference data: club, arenas, opponents (KHL/VHL/MHL), 14 price zones, products, plans, promotions |
| `03_seed_facts.sql` | Generated matches (from mock JSON) + sales, subscriptions, redemptions |
| `04_views.sql` | Analytical views |
| `generate-seed.mjs` | Regenerates `03_seed_facts.sql` from `lib/mock/data/hockey-mock.json` |
| `manual-init.sql` | Runs all scripts in order (used by Docker init) |
| `reset.ps1` | Full reset: generate seed → recreate Docker volume → verify |
| `reset-local.ps1` | Reset against local PostgreSQL (no Docker) |

## How to run

### Docker (recommended)

```bash
# Start PostgreSQL (first run loads schema + seed automatically)
npm run db:up

# Full reset: regenerate facts, wipe volume, re-init
npm run db:reset

# Stop container
npm run db:down
```

Connection after `db:up` or `db:reset`:

- Host: `localhost:5432`
- Database: `hockey_bi`
- User: `bi_user`
- Password: `bi_password`
- Schema: `bi`

### Regenerate fact data only

```bash
npm run db:generate
```

Writes `database/03_seed_facts.sql`. Re-run `db:reset` or apply the file manually to refresh facts.

### Example queries

```sql
SET search_path TO bi, public;

-- Ticket KPI summary
SELECT * FROM v_tickets_kpi_summary;

-- Merch top products
SELECT * FROM v_top_products LIMIT 10;

-- Subscription utilization
SELECT * FROM v_subscription_stats;
```

## Alignment with the UI

The Next.js dashboard (`app/page.tsx`) uses in-memory mock data from `lib/mock/hockey.ts` by default. The database schema matches the same dimensions as the mocks:

- seasons `2024/25` and `2025/26`
- leagues KHL, VHL, MHL (VHL on secondary arena 3000; MHL on main arena at 6300 seats)
- price zones A, B1–B4, C1–C4, D1–D4, VIP (`sector.zone_group` for A/B/C/D/VIP rollups)
- ticket type `arena` vs `parking`

Use `v_match_catalog`, `v_sector_sales`, and `v_subscription_by_season` to slice the same way as the UI filters.

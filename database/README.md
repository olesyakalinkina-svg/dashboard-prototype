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
| `arena` | Venues with capacity, linked to `club` |
| `opponent` | Away teams |
| `match` | Home games: `id`, `arena_id`, `opponent_id`, `match_date`, `attendance`, `status` |
| `revenue_stream` | Lookup: `tickets`, `merch`, `subscriptions` |
| `sales_channel` | `online`, `arena`, `kiosk` |
| `sector` | Seating zones (A, B, C, VIP) |
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
| `sale` | Ticket and merch sales: amount, quantity, loyalty discount, links to `match_id`, `product_id`, `stream_id`, `channel_id`, optional `promotion_id` |
| `subscription` | Abonement purchase: plan, price, validity, `matches_total` / `matches_used`, channel, status |
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
| `v_revenue_unified` | All | Unified fact: sales + subscription purchases |
| `v_tickets_kpi`, `v_tickets_kpi_summary` | Билеты | Revenue, tickets sold, avg price, loyalty discount, today |
| `v_sector_sales` | Билеты | Sales by price zone (pie chart) |
| `v_match_revenue` | Билеты / Мерч | Revenue per match by stream |
| `v_merch_by_match` | Мерч | Merch revenue per match |
| `v_top_products` | Мерч | Top merch SKUs |
| `v_channel_mix` | All tabs | Revenue share by channel per stream |
| `v_subscription_stats` | Абонементы | Sold, revenue, utilization per plan |
| `v_subscription_redemptions_by_match` | Абонементы | Redemptions per match |
| `v_weekly_revenue` | — | Weekly breakdown: tickets, merch, subscriptions |
| `v_daily_kpi` | — | Daily totals for BI tools |
| `v_promotion_performance` | — | Campaign ROI and conversion |
| `v_match_attendance` | — | Fill rate per match |

## File layout

| File | Role |
|------|------|
| `01_schema.sql` | DDL: tables, indexes, `populate_dim_date()` |
| `02_seed.sql` | Reference data: clubs, matches, products, plans, promotions |
| `03_seed_facts.sql` | Generated sales, subscriptions, redemptions |
| `04_views.sql` | Analytical views |
| `generate-seed.mjs` | Regenerates `03_seed_facts.sql` from same logic as `lib/mock/hockey.ts` |
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

The Next.js dashboard (`app/page.tsx`) uses in-memory mock data from `lib/mock/hockey.ts` by default. The database schema and views are designed to match the same entities and metrics when you connect a BI tool or replace mocks with SQL queries.

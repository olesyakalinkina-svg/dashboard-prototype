-- =============================================================================
-- BI views for dashboard KPIs and charts
-- Mirrors metrics from lib/filters.ts and types/dashboard.ts
-- =============================================================================

SET search_path TO bi, public;

-- Unified revenue fact: ticket/merch sales + subscription purchases
CREATE OR REPLACE VIEW v_revenue_unified AS
SELECT
    s.id AS transaction_id,
    s.sold_at,
    s.date_key,
    d.full_date,
    d.year_week,
    d.year_month,
    rs.code AS stream,
    rs.name AS stream_name,
    sc.code AS channel,
    sc.name AS channel_name,
    p.name AS product_name,
    p.sku,
    m.id AS match_id,
    o.name AS opponent,
    m.match_date,
    m.season,
    m.league,
    m.tournament_stage,
    m.match_class,
    m.series,
    m.capacity AS match_capacity,
    sec.code AS sector,
    sec.zone_group,
    s.ticket_type,
    s.price_zone,
    s.quantity,
    s.unit_price,
    s.amount,
    s.discount_amount,
    s.loyalty_discount_amount,
    pr.id AS promotion_id,
    pr.name AS promotion_name
FROM sale s
JOIN dim_date d ON d.date_key = s.date_key
JOIN revenue_stream rs ON rs.id = s.stream_id
JOIN sales_channel sc ON sc.id = s.channel_id
JOIN product p ON p.id = s.product_id
LEFT JOIN match m ON m.id = s.match_id
LEFT JOIN opponent o ON o.id = m.opponent_id
LEFT JOIN sector sec ON sec.id = s.sector_id
LEFT JOIN promotion pr ON pr.id = s.promotion_id

UNION ALL

SELECT
    sub.id::TEXT,
    sub.purchased_at,
    sub.date_key,
    d.full_date,
    d.year_week,
    d.year_month,
    'subscriptions'::TEXT,
    'Абонементы'::TEXT,
    sc.code,
    sc.name,
    sp.name,
    sp.code,
    NULL,
    NULL,
    NULL,
    sub.season,
    sub.league,
    sub.tournament_stage,
    NULL::TEXT,
    NULL::INTEGER,
    sec.code,
    sec.zone_group,
    sub.ticket_type,
    NULL::TEXT,
    1,
    sub.price,
    sub.price,
    0,
    0,
    NULL,
    NULL
FROM subscription sub
JOIN dim_date d ON d.date_key = sub.date_key
JOIN subscription_plan sp ON sp.id = sub.plan_id
JOIN sales_channel sc ON sc.id = sub.channel_id
LEFT JOIN sector sec ON sec.id = COALESCE(sub.sector_id, sp.sector_id);

-- Weekly revenue by stream (WeeklyRevenueChart)
CREATE OR REPLACE VIEW v_weekly_revenue AS
SELECT
    year_week AS week,
    COALESCE(SUM(amount) FILTER (WHERE stream = 'tickets'), 0)       AS tickets,
    COALESCE(SUM(amount) FILTER (WHERE stream = 'merch'), 0)         AS merch,
    COALESCE(SUM(amount) FILTER (WHERE stream = 'subscriptions'), 0) AS subscriptions,
    COALESCE(SUM(amount), 0)                                         AS total
FROM v_revenue_unified
GROUP BY year_week
ORDER BY week;

-- Revenue per match (MatchRevenueChart)
CREATE OR REPLACE VIEW v_match_revenue AS
SELECT
    COALESCE('vs ' || opponent, 'Без матча') AS match_label,
    match_id,
    match_date,
    season,
    league,
    COALESCE(SUM(amount) FILTER (WHERE stream = 'tickets'), 0) AS tickets,
    COALESCE(SUM(amount) FILTER (WHERE stream = 'merch'), 0)   AS merch,
    COALESCE(SUM(amount), 0)                                   AS total
FROM v_revenue_unified
WHERE match_id IS NOT NULL
GROUP BY match_id, opponent, match_date, season, league
ORDER BY match_date;

-- Ticket sales by sector (SectorPieChart)
CREATE OR REPLACE VIEW v_sector_sales AS
SELECT
    COALESCE(sector, '—') AS sector,
    zone_group,
    SUM(amount) AS value,
    SUM(quantity) AS tickets_sold
FROM v_revenue_unified
WHERE stream = 'tickets' AND sector IS NOT NULL
GROUP BY sector, zone_group
ORDER BY value DESC;

-- Merch by match
CREATE OR REPLACE VIEW v_merch_by_match AS
SELECT
    'vs ' || opponent AS match_label,
    match_id,
    match_date,
    COALESCE(SUM(amount) FILTER (WHERE stream = 'merch'), 0) AS merch
FROM v_revenue_unified
WHERE match_id IS NOT NULL
  AND stream = 'merch'
GROUP BY match_id, opponent, match_date
ORDER BY match_date;

-- Match attendance & fill rate
CREATE OR REPLACE VIEW v_match_attendance AS
SELECT
    m.id AS match_id,
    m.match_date,
    o.name AS opponent,
    m.season,
    m.league,
    m.tournament_stage,
    m.match_class,
    m.series,
    a.code AS arena,
    m.attendance,
    COALESCE(m.capacity, a.capacity) AS capacity,
    ROUND(
        m.attendance::NUMERIC / NULLIF(COALESCE(m.capacity, a.capacity), 0) * 100,
        1
    ) AS fill_rate_pct
FROM match m
JOIN opponent o ON o.id = m.opponent_id
JOIN arena a ON a.id = m.arena_id
ORDER BY m.match_date;

-- Promotion performance (PromotionsTable)
CREATE OR REPLACE VIEW v_promotion_performance AS
SELECT
    p.id,
    p.name,
    p.start_date,
    p.end_date,
    p.target_stream,
    p.reach,
    p.conversions,
    p.revenue_lift,
    ROUND(
        CASE WHEN p.reach > 0 THEN p.conversions::NUMERIC / p.reach * 100 ELSE 0 END,
        2
    ) AS conversion_rate_pct,
    ROUND(
        CASE WHEN p.reach > 0 THEN p.revenue_lift / p.reach ELSE 0 END,
        2
    ) AS roi_per_reach
FROM promotion p
ORDER BY p.revenue_lift DESC;

-- Subscription analytics
CREATE OR REPLACE VIEW v_subscription_stats AS
SELECT
    sp.code AS plan_code,
    sp.name AS plan_name,
    sp.match_count,
    sp.price AS plan_price,
    COUNT(sub.id) AS subscriptions_sold,
    SUM(sub.price) AS total_revenue,
    SUM(sub.matches_used) AS total_redemptions,
    SUM(sub.matches_total - sub.matches_used) AS remaining_entries,
    ROUND(AVG(sub.matches_used::NUMERIC / NULLIF(sub.matches_total, 0) * 100), 1) AS avg_utilization_pct
FROM subscription_plan sp
LEFT JOIN subscription sub ON sub.plan_id = sp.id
GROUP BY sp.id, sp.code, sp.name, sp.match_count, sp.price
ORDER BY total_revenue DESC NULLS LAST;

-- Daily KPI snapshot (filter by date range in BI tool)
CREATE OR REPLACE VIEW v_daily_kpi AS
SELECT
    full_date,
    SUM(amount) AS total_revenue,
    SUM(quantity) FILTER (WHERE stream = 'tickets') AS tickets_sold,
    SUM(amount) FILTER (WHERE stream = 'merch') AS merch_revenue,
    SUM(amount) FILTER (WHERE stream = 'subscriptions') AS subscription_revenue,
    COUNT(DISTINCT transaction_id) AS transaction_count
FROM v_revenue_unified
GROUP BY full_date
ORDER BY full_date;

-- Channel mix
CREATE OR REPLACE VIEW v_channel_mix AS
SELECT
    stream,
    channel,
    SUM(amount) AS revenue,
    SUM(quantity) AS units,
    ROUND(SUM(amount) / NULLIF(SUM(SUM(amount)) OVER (PARTITION BY stream), 0) * 100, 1) AS share_pct
FROM v_revenue_unified
GROUP BY stream, channel
ORDER BY stream, revenue DESC;

-- Top products
CREATE OR REPLACE VIEW v_top_products AS
SELECT
    stream,
    product_name,
    sku,
    SUM(quantity) AS units_sold,
    SUM(amount) AS revenue
FROM v_revenue_unified
WHERE stream = 'merch'
GROUP BY stream, product_name, sku
ORDER BY revenue DESC;

-- Match catalog (filters: season, league, stage, class, arena)
CREATE OR REPLACE VIEW v_match_catalog AS
SELECT
    m.id AS match_id,
    m.match_date,
    o.name AS opponent,
    m.season,
    m.league,
    m.tournament_stage,
    m.match_class,
    m.series,
    m.status,
    a.code AS arena,
    a.name AS arena_name,
    m.attendance,
    m.capacity,
    m.ticket_sales_window_days
FROM match m
JOIN opponent o ON o.id = m.opponent_id
JOIN arena a ON a.id = m.arena_id
ORDER BY m.match_date;

-- Subscriptions by season / league / price zone
CREATE OR REPLACE VIEW v_subscription_by_season AS
SELECT
    sub.season,
    sub.league,
    sub.tournament_stage,
    sub.ticket_type,
    sec.code AS price_zone,
    sec.zone_group,
    COUNT(sub.id) AS subscriptions_sold,
    SUM(sub.price) AS total_revenue
FROM subscription sub
LEFT JOIN sector sec ON sec.id = sub.sector_id
GROUP BY
    sub.season,
    sub.league,
    sub.tournament_stage,
    sub.ticket_type,
    sec.code,
    sec.zone_group
ORDER BY sub.season, sub.league, total_revenue DESC NULLS LAST;

-- Abonement redemptions per match
CREATE OR REPLACE VIEW v_subscription_redemptions_by_match AS
SELECT
    m.id AS match_id,
    m.match_date,
    o.name AS opponent,
    COUNT(sr.id) AS redemptions,
    COUNT(DISTINCT sr.subscription_id) AS unique_subscribers
FROM match m
JOIN opponent o ON o.id = m.opponent_id
LEFT JOIN subscription_redemption sr ON sr.match_id = m.id
GROUP BY m.id, m.match_date, o.name
ORDER BY m.match_date;

-- Ticket KPIs for dashboard (Билеты tab)
CREATE OR REPLACE VIEW v_tickets_kpi AS
SELECT
    d.full_date,
    SUM(s.amount) FILTER (WHERE rs.code = 'tickets') AS revenue,
    SUM(s.quantity) FILTER (WHERE rs.code = 'tickets') AS tickets_sold,
    ROUND(
        AVG(s.amount / NULLIF(s.quantity, 0)) FILTER (WHERE rs.code = 'tickets'),
        2
    ) AS avg_price,
    SUM(s.loyalty_discount_amount) FILTER (WHERE rs.code = 'tickets') AS loyalty_discount,
    SUM(s.amount) FILTER (
        WHERE rs.code = 'tickets' AND d.full_date = CURRENT_DATE
    ) AS revenue_today,
    SUM(s.quantity) FILTER (
        WHERE rs.code = 'tickets' AND d.full_date = CURRENT_DATE
    ) AS tickets_today
FROM sale s
JOIN dim_date d ON d.date_key = s.date_key
JOIN revenue_stream rs ON rs.id = s.stream_id
GROUP BY d.full_date
ORDER BY d.full_date;

CREATE OR REPLACE VIEW v_tickets_kpi_summary AS
SELECT
    COALESCE(SUM(revenue), 0) AS total_revenue,
    COALESCE(SUM(tickets_sold), 0) AS total_tickets,
    COALESCE(SUM(loyalty_discount), 0) AS total_loyalty_discount,
    COALESCE(
        SUM(revenue) / NULLIF(SUM(tickets_sold), 0),
        0
    ) AS avg_price,
    COALESCE(SUM(revenue_today), 0) AS revenue_today,
    COALESCE(SUM(tickets_today), 0) AS tickets_today
FROM v_tickets_kpi;

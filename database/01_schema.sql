-- =============================================================================
-- BI Database: Hockey Club (tickets, subscriptions, merch)
-- PostgreSQL 15+
-- Star schema: dimensions + facts, optimized for analytics dashboards
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS bi;
SET search_path TO bi, public;

-- ---------------------------------------------------------------------------
-- Lookup / dimension tables
-- ---------------------------------------------------------------------------

CREATE TABLE club (
    id          SMALLSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    city        TEXT NOT NULL,
    league      TEXT NOT NULL DEFAULT 'KHL'
);

CREATE TABLE arena (
    id          SMALLSERIAL PRIMARY KEY,
    club_id     SMALLINT NOT NULL REFERENCES club (id),
    name        TEXT NOT NULL,
    capacity    INTEGER NOT NULL CHECK (capacity > 0),
    code        TEXT NOT NULL UNIQUE
        CHECK (code IN ('main', 'secondary'))
);

CREATE TABLE opponent (
    id          SMALLSERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE
);

CREATE TABLE match (
    id          TEXT PRIMARY KEY,
    arena_id    SMALLINT NOT NULL REFERENCES arena (id),
    opponent_id SMALLINT NOT NULL REFERENCES opponent (id),
    match_date  DATE NOT NULL,
    attendance  INTEGER NOT NULL CHECK (attendance >= 0),
    status      TEXT NOT NULL DEFAULT 'completed'
        CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    season      TEXT NOT NULL,
    league      TEXT NOT NULL
        CHECK (league IN ('KHL', 'VHL', 'MHL')),
    tournament_stage TEXT NOT NULL DEFAULT 'regular'
        CHECK (tournament_stage IN ('regular', 'playoff')),
    match_class TEXT NOT NULL DEFAULT 'class_2'
        CHECK (match_class IN ('class_1', 'class_2', 'class_3', 'playoff')),
    ticket_sales_window_days SMALLINT NOT NULL DEFAULT 14
        CHECK (ticket_sales_window_days BETWEEN 1 AND 60),
    series      TEXT,
    capacity    INTEGER NOT NULL CHECK (capacity > 0)
);

CREATE INDEX idx_match_date ON match (match_date);
CREATE INDEX idx_match_opponent ON match (opponent_id);
CREATE INDEX idx_match_season ON match (season);
CREATE INDEX idx_match_league ON match (league);
CREATE INDEX idx_match_season_league ON match (season, league);

CREATE TABLE revenue_stream (
    id          SMALLSERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL
);

CREATE TABLE sales_channel (
    id          SMALLSERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL
);

CREATE TABLE sector (
    id          SMALLSERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    zone_group  TEXT NOT NULL
        CHECK (zone_group IN ('A', 'B', 'C', 'D', 'VIP')),
    sort_order  SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE product_category (
    id          SMALLSERIAL PRIMARY KEY,
    stream_id   SMALLINT NOT NULL REFERENCES revenue_stream (id),
    name        TEXT NOT NULL,
    UNIQUE (stream_id, name)
);

CREATE TABLE product (
    id              SERIAL PRIMARY KEY,
    category_id     SMALLINT NOT NULL REFERENCES product_category (id),
    sku             TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    base_price      NUMERIC(12, 2) NOT NULL CHECK (base_price >= 0),
    sector_id       SMALLINT REFERENCES sector (id),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_product_category ON product (category_id);

CREATE TABLE subscription_plan (
    id              SMALLSERIAL PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    match_count     SMALLINT NOT NULL CHECK (match_count > 0),
    price           NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    valid_days      INTEGER NOT NULL CHECK (valid_days > 0),
    sector_id       SMALLINT REFERENCES sector (id),
    description     TEXT
);

CREATE TABLE customer_segment (
    id          SMALLSERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL
);

CREATE TABLE customer (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE,
    full_name       TEXT,
    segment_id      SMALLINT REFERENCES customer_segment (id),
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE promotion (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL CHECK (end_date >= start_date),
    target_stream   TEXT NOT NULL
        CHECK (target_stream IN ('tickets', 'merch', 'subscriptions', 'all')),
    reach           INTEGER NOT NULL DEFAULT 0,
    conversions     INTEGER NOT NULL DEFAULT 0,
    revenue_lift    NUMERIC(14, 2) NOT NULL DEFAULT 0
);

CREATE TABLE promotion_match (
    promotion_id    TEXT NOT NULL REFERENCES promotion (id) ON DELETE CASCADE,
    match_id        TEXT NOT NULL REFERENCES match (id) ON DELETE CASCADE,
    PRIMARY KEY (promotion_id, match_id)
);

-- Date dimension for time-intelligence in BI tools
CREATE TABLE dim_date (
    date_key        INTEGER PRIMARY KEY,
    full_date       DATE NOT NULL UNIQUE,
    year            SMALLINT NOT NULL,
    quarter         SMALLINT NOT NULL,
    month           SMALLINT NOT NULL,
    month_name      TEXT NOT NULL,
    week_of_year    SMALLINT NOT NULL,
    day_of_month    SMALLINT NOT NULL,
    day_of_week     SMALLINT NOT NULL,
    day_name        TEXT NOT NULL,
    is_weekend      BOOLEAN NOT NULL,
    year_month      TEXT NOT NULL,
    year_week       TEXT NOT NULL
);

CREATE INDEX idx_dim_date_full ON dim_date (full_date);

-- ---------------------------------------------------------------------------
-- Fact tables
-- ---------------------------------------------------------------------------

CREATE TABLE sale (
    id              TEXT PRIMARY KEY,
    sold_at         TIMESTAMPTZ NOT NULL,
    date_key        INTEGER NOT NULL REFERENCES dim_date (date_key),
    stream_id       SMALLINT NOT NULL REFERENCES revenue_stream (id),
    channel_id      SMALLINT NOT NULL REFERENCES sales_channel (id),
    product_id      INTEGER NOT NULL REFERENCES product (id),
    match_id        TEXT REFERENCES match (id),
    customer_id     UUID REFERENCES customer (id),
    promotion_id    TEXT REFERENCES promotion (id),
    sector_id       SMALLINT REFERENCES sector (id),
    ticket_type     TEXT
        CHECK (ticket_type IS NULL OR ticket_type IN ('arena', 'parking')),
    price_zone      TEXT
        CHECK (
            price_zone IS NULL
            OR price_zone IN (
                'up_to_500',
                'from_500_to_1000',
                'from_1000_to_1500',
                'from_1500_to_2000',
                'from_2000_to_2500',
                'from_2500_to_3000'
            )
        ),
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    amount          NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    loyalty_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (loyalty_discount_amount >= 0),
    CHECK (
        (ticket_type = 'arena' AND price_zone IS NOT NULL)
        OR (ticket_type IS DISTINCT FROM 'arena' AND price_zone IS NULL)
    )
);

CREATE INDEX idx_sale_sold_at ON sale (sold_at);
CREATE INDEX idx_sale_date_key ON sale (date_key);
CREATE INDEX idx_sale_stream ON sale (stream_id);
CREATE INDEX idx_sale_match ON sale (match_id);
CREATE INDEX idx_sale_promotion ON sale (promotion_id);
CREATE INDEX idx_sale_sector ON sale (sector_id);
CREATE INDEX idx_sale_ticket_type ON sale (ticket_type);
CREATE INDEX idx_sale_price_zone ON sale (price_zone);

CREATE TABLE subscription (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id         SMALLINT NOT NULL REFERENCES subscription_plan (id),
    customer_id     UUID REFERENCES customer (id),
    purchased_at    TIMESTAMPTZ NOT NULL,
    date_key        INTEGER NOT NULL REFERENCES dim_date (date_key),
    valid_from      DATE NOT NULL,
    valid_to        DATE NOT NULL CHECK (valid_to >= valid_from),
    price           NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    matches_total   SMALLINT NOT NULL,
    matches_used    SMALLINT NOT NULL DEFAULT 0 CHECK (matches_used >= 0),
    channel_id      SMALLINT NOT NULL REFERENCES sales_channel (id),
    status          TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'cancelled', 'fully_used')),
    season          TEXT NOT NULL,
    league          TEXT NOT NULL
        CHECK (league IN ('KHL', 'VHL', 'MHL')),
    tournament_stage TEXT NOT NULL DEFAULT 'regular'
        CHECK (tournament_stage IN ('regular', 'playoff')),
    arena_id        SMALLINT REFERENCES arena (id),
    ticket_type     TEXT NOT NULL DEFAULT 'arena'
        CHECK (ticket_type IN ('arena', 'parking')),
    sector_id       SMALLINT REFERENCES sector (id)
);

CREATE INDEX idx_subscription_purchased ON subscription (purchased_at);
CREATE INDEX idx_subscription_plan ON subscription (plan_id);
CREATE INDEX idx_subscription_status ON subscription (status);
CREATE INDEX idx_subscription_season_league ON subscription (season, league);

CREATE TABLE subscription_redemption (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscription (id) ON DELETE CASCADE,
    match_id        TEXT NOT NULL REFERENCES match (id),
    redeemed_at     TIMESTAMPTZ NOT NULL,
    sector_id       SMALLINT REFERENCES sector (id),
    UNIQUE (subscription_id, match_id)
);

CREATE INDEX idx_redemption_match ON subscription_redemption (match_id);

-- ---------------------------------------------------------------------------
-- Helper: populate dim_date for a range
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION populate_dim_date(p_start DATE, p_end DATE)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    d DATE := p_start;
BEGIN
    WHILE d <= p_end LOOP
        INSERT INTO dim_date (
            date_key, full_date, year, quarter, month, month_name,
            week_of_year, day_of_month, day_of_week, day_name,
            is_weekend, year_month, year_week
        ) VALUES (
            TO_CHAR(d, 'YYYYMMDD')::INTEGER,
            d,
            EXTRACT(YEAR FROM d)::SMALLINT,
            EXTRACT(QUARTER FROM d)::SMALLINT,
            EXTRACT(MONTH FROM d)::SMALLINT,
            TO_CHAR(d, 'TMMonth'),
            EXTRACT(WEEK FROM d)::SMALLINT,
            EXTRACT(DAY FROM d)::SMALLINT,
            EXTRACT(ISODOW FROM d)::SMALLINT,
            TO_CHAR(d, 'TMDy'),
            EXTRACT(ISODOW FROM d) IN (6, 7),
            TO_CHAR(d, 'YYYY-MM'),
            TO_CHAR(d, 'IYYY-IW')
        )
        ON CONFLICT (date_key) DO NOTHING;
        d := d + 1;
    END LOOP;
END;
$$;

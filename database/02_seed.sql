-- =============================================================================
-- Reference data & dimension seed for hockey club BI database
-- Run after schema.sql; matches + sales/subscriptions loaded via generate-seed.mjs
-- Aligned with lib/mock/hockey-generator.ts (seasons 2024/25–2025/26, KHL/VHL/MHL, 14 sectors)
-- =============================================================================

SET search_path TO bi, public;

SELECT populate_dim_date('2024-08-01', '2026-06-15');

INSERT INTO club (id, name, city, league) VALUES
    (1, 'Металлург Магнитогорск', 'Магнитогорск', 'KHL');

INSERT INTO arena (id, club_id, name, capacity, code) VALUES
    (1, 1, 'Арена «Металлург»', 12000, 'main'),
    (2, 1, 'Тренировочная арена', 3000, 'secondary');

INSERT INTO opponent (id, name) VALUES
    -- KHL
    (1,  'СКА'),
    (2,  'ЦСКА'),
    (3,  'Авангард'),
    (4,  'Ак Барс'),
    (5,  'Локомотив'),
    (6,  'Трактор'),
    (7,  'Металлург'),
    (8,  'Салават Юлаев'),
    (9,  'Динамо Минск'),
    (10, 'Спартак'),
    (11, 'Сибирь'),
    (12, 'Амур'),
    (13, 'Сочи'),
    (14, 'Торпедо'),
    (15, 'Динамо Мск'),
    (16, 'Шанхай'),
    -- VHL
    (17, 'Торос'),
    (18, 'Нефтяник'),
    (19, 'Рубин'),
    (20, 'Ижсталь'),
    (21, 'Химик'),
    (22, 'Звезда'),
    (23, 'СКА-ВМФ'),
    (24, 'Дизель'),
    -- MHL
    (25, 'Красная Армия'),
    (26, 'Алмаз'),
    (27, 'Чайка'),
    (28, 'СКА-1946'),
    (29, 'МХК Спартак'),
    (30, 'Капитан'),
    (31, 'Локо'),
    (32, 'Молот');

INSERT INTO revenue_stream (id, code, name) VALUES
    (1, 'tickets',       'Билеты'),
    (2, 'merch',         'Мерч'),
    (3, 'subscriptions', 'Абонементы');

INSERT INTO sales_channel (id, code, name) VALUES
    (1, 'online', 'Онлайн'),
    (2, 'arena',  'Касса арены'),
    (3, 'kiosk',  'Киоск / POS');

-- Arena sectors from types/dashboard.ts Sector (A, B1–B4, C1–C4, D1–D4, VIP)
INSERT INTO sector (id, code, name, zone_group, sort_order) VALUES
    (1,  'A',   'Сектор A',   'A',   1),
    (2,  'B1',  'Сектор B1',  'B',   2),
    (3,  'B2',  'Сектор B2',  'B',   3),
    (4,  'B3',  'Сектор B3',  'B',   4),
    (5,  'B4',  'Сектор B4',  'B',   5),
    (6,  'C1',  'Сектор C1',  'C',   6),
    (7,  'C2',  'Сектор C2',  'C',   7),
    (8,  'C3',  'Сектор C3',  'C',   8),
    (9,  'C4',  'Сектор C4',  'C',   9),
    (10, 'D1',  'Сектор D1',  'D',   10),
    (11, 'D2',  'Сектор D2',  'D',   11),
    (12, 'D3',  'Сектор D3',  'D',   12),
    (13, 'D4',  'Сектор D4',  'D',   13),
    (14, 'VIP', 'VIP-ложа',   'VIP', 14);

INSERT INTO product_category (id, stream_id, name) VALUES
    (1, 1, 'Разовые билеты'),
    (2, 1, 'Парковка'),
    (3, 2, 'Одежда'),
    (4, 2, 'Аксессуары'),
    (5, 2, 'Сувениры'),
    (6, 3, 'Сезонные абонементы'),
    (7, 3, 'Пакетные абонементы');

-- Ticket list prices span the four cost buckets (до 1500 … от 4000 до 6000).
INSERT INTO product (id, category_id, sku, name, base_price, sector_id) VALUES
    (1,  1, 'TKT-A',      'Билет сектор A',    2800.00, 1),
    (2,  1, 'TKT-B1',     'Билет сектор B1',   2200.00, 2),
    (3,  1, 'TKT-B2',     'Билет сектор B2',   2100.00, 3),
    (4,  1, 'TKT-B3',     'Билет сектор B3',   2000.00, 4),
    (5,  1, 'TKT-B4',     'Билет сектор B4',   1900.00, 5),
    (6,  1, 'TKT-C1',     'Билет сектор C1',   1600.00, 6),
    (7,  1, 'TKT-C2',     'Билет сектор C2',   1500.00, 7),
    (8,  1, 'TKT-C3',     'Билет сектор C3',   1400.00, 8),
    (9,  1, 'TKT-C4',     'Билет сектор C4',   1300.00, 9),
    (10, 1, 'TKT-D1',     'Билет сектор D1',   1100.00, 10),
    (11, 1, 'TKT-D2',     'Билет сектор D2',   1000.00, 11),
    (12, 1, 'TKT-D3',     'Билет сектор D3',    900.00, 12),
    (13, 1, 'TKT-D4',     'Билет сектор D4',    800.00, 13),
    (14, 1, 'TKT-VIP',    'VIP-билет ложа',    5500.00, 14),
    (15, 2, 'TKT-PARK',   'Парковка',           500.00, NULL),
    -- Merch
    (20, 3, 'MRC-SHIRT-H', 'Футболка домашняя',           3500.00, NULL),
    (21, 3, 'MRC-SHIRT-A', 'Футболка гостевая',           3500.00, NULL),
    (22, 4, 'MRC-SCARF',   'Шарф клубный',                1500.00, NULL),
    (23, 4, 'MRC-CAP',     'Кепка с логотипом',           2200.00, NULL),
    (24, 5, 'MRC-STICK',   'Хоккейная клюшка mini',       2800.00, NULL),
    (25, 3, 'MRC-KIDS',    'Детская форма',               4000.00, NULL),
    (26, 5, 'MRC-MUG',     'Термокружка',                 1200.00, NULL);

SELECT setval('product_id_seq', 100);

INSERT INTO subscription_plan (id, code, name, match_count, price, valid_days, sector_id, description) VALUES
    (1, 'SUB-5-A',    'Абонемент на 5 матчей (сектор A)',  5,  10000.00, 90,  1,  '5 домашних матчей, сектор A'),
    (2, 'SUB-5-B',    'Абонемент на 5 матчей (сектор B)',  5,   7500.00, 90,  2,  '5 домашних матчей, зона B'),
    (3, 'SUB-10-A',   'Абонемент на 10 матчей',           10,  18000.00, 180, 1,  '10 домашних матчей'),
    (4, 'SUB-SEASON', 'Сезонный абонемент',               30,  85000.00, 365, 1,  'Все домашние матчи сезона'),
    (5, 'SUB-VIP',    'VIP-сезонный абонемент',           30, 250000.00, 365, 14, 'VIP-ложа на все домашние матчи'),
    (6, 'SUB-STUD',   'Студенческий абонемент',           10,   6000.00, 180, 6,  '10 матчей, сектор C1, по студ. билету');

INSERT INTO customer_segment (id, code, name) VALUES
    (1, 'regular',  'Обычный болельщик'),
    (2, 'vip',      'VIP / корпоратив'),
    (3, 'student',  'Студент'),
    (4, 'family',   'Семейный'),
    (5, 'corporate','Корпоративный клиент');

INSERT INTO promotion (id, name, start_date, end_date, target_stream, reach, conversions, revenue_lift) VALUES
    ('promo-1', 'Семейный матч −20%',              CURRENT_DATE - 85, CURRENT_DATE - 70, 'tickets',       45000,  820,  1250000),
    ('promo-2', 'Первый гол — скидка на мерч',     CURRENT_DATE - 75, CURRENT_DATE - 55, 'merch',         62000, 1340,   890000),
    ('promo-3', 'День болельщика',                 CURRENT_DATE - 60, CURRENT_DATE - 45, 'all',           38000, 2100,   560000),
    ('promo-4', 'Спонсор X2 баллы',                CURRENT_DATE - 50, CURRENT_DATE - 30, 'merch',         71000,  980,   720000),
    ('promo-6', 'VIP-ложа: гость бесплатно',       CURRENT_DATE - 35, CURRENT_DATE - 15, 'tickets',       12000,  145,  2100000),
    ('promo-7', 'Новогодний хоккейный вечер',      CURRENT_DATE - 25, CURRENT_DATE - 10, 'all',           55000, 1680,   980000),
    ('promo-8', 'Студенческий билет −30%',         CURRENT_DATE - 20, CURRENT_DATE,      'tickets',       33000,  890,   420000),
    ('promo-9', 'Абонемент: +1 матч в подарок',    CURRENT_DATE - 30, CURRENT_DATE + 15, 'subscriptions', 18000,  420,  3200000);

-- Matches and promotion_match are generated from lib/mock/data/hockey-mock.json
-- by database/generate-seed.mjs into 03_seed_facts.sql

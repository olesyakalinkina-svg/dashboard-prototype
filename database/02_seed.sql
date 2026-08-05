-- =============================================================================
-- Reference data & dimension seed for hockey club BI database
-- Run after schema.sql; sales/subscriptions loaded via generate-seed.mjs
-- =============================================================================

SET search_path TO bi, public;

SELECT populate_dim_date(CURRENT_DATE - INTERVAL '120 days', CURRENT_DATE + INTERVAL '30 days');

INSERT INTO club (id, name, city, league) VALUES
    (1, 'Металлург Магнитогорск', 'Магнитогорск', 'KHL');

INSERT INTO arena (id, club_id, name, capacity) VALUES
    (1, 1, 'Арена «Металлург»', 12000),
    (2, 1, 'Тренировочная арена', 3000);

INSERT INTO opponent (id, name) VALUES
    (1,  'СКА'),
    (2,  'ЦСКА'),
    (3,  'Авангард'),
    (4,  'Ак Барс'),
    (5,  'Локомотив'),
    (6,  'Трактор'),
    (7,  'Металлург'),
    (8,  'Салават Юлаев'),
    (9,  'Динамо М'),
    (10, 'Спартак'),
    (11, 'Сибирь'),
    (12, 'Амур'),
    (13, 'Сочи'),
    (14, 'Торпедо'),
    (15, 'Шанхай');

INSERT INTO revenue_stream (id, code, name) VALUES
    (1, 'tickets',       'Билеты'),
    (2, 'merch',         'Мерч'),
    (3, 'subscriptions', 'Абонементы');

INSERT INTO sales_channel (id, code, name) VALUES
    (1, 'online', 'Онлайн'),
    (2, 'arena',  'Касса арены'),
    (3, 'kiosk',  'Киоск / POS');

INSERT INTO sector (id, code, name, sort_order) VALUES
    (1, 'A',   'Сектор A',   1),
    (2, 'B',   'Сектор B',   2),
    (3, 'C',   'Сектор C',   3),
    (4, 'VIP', 'VIP-ложа',   4);

INSERT INTO product_category (id, stream_id, name) VALUES
    (1, 1, 'Разовые билеты'),
    (2, 1, 'Пакеты'),
    (3, 2, 'Одежда'),
    (4, 2, 'Аксессуары'),
    (5, 2, 'Сувениры'),
    (6, 3, 'Сезонные абонементы'),
    (7, 3, 'Пакетные абонементы');

INSERT INTO product (id, category_id, sku, name, base_price, sector_id) VALUES
    -- Tickets
    (1,  1, 'TKT-A-STD',   'Обычный билет сектор A',      2500.00, 1),
    (2,  1, 'TKT-B-STD',   'Обычный билет сектор B',      1800.00, 2),
    (3,  1, 'TKT-C-STD',   'Обычный билет сектор C',      1200.00, 3),
    (4,  1, 'TKT-VIP-BOX', 'VIP-билет ложа',              8500.00, 4),
    (5,  2, 'TKT-FAM-4',   'Семейный пакет (4 места)',    6000.00, 2),
    -- Merch
    (10, 3, 'MRC-SHIRT-H', 'Футболка домашняя',           3500.00, NULL),
    (11, 3, 'MRC-SHIRT-A', 'Футболка гостевая',           3500.00, NULL),
    (12, 4, 'MRC-SCARF',   'Шарф клубный',                1500.00, NULL),
    (13, 4, 'MRC-CAP',     'Кепка с логотипом',           2200.00, NULL),
    (14, 5, 'MRC-STICK',   'Хоккейная клюшка mini',       2800.00, NULL),
    (15, 3, 'MRC-KIDS',    'Детская форма',               4000.00, NULL),
    (16, 5, 'MRC-MUG',     'Термокружка',                 1200.00, NULL);

SELECT setval('product_id_seq', 100);

INSERT INTO subscription_plan (id, code, name, match_count, price, valid_days, sector_id, description) VALUES
    (1, 'SUB-5-A',    'Абонемент на 5 матчей (сектор A)',  5,  10000.00, 90,  1, '5 домашних матчей, сектор A'),
    (2, 'SUB-5-B',    'Абонемент на 5 матчей (сектор B)',  5,   7500.00, 90,  2, '5 домашних матчей, сектор B'),
    (3, 'SUB-10-A',   'Абонемент на 10 матчей',           10,  18000.00, 180, 1, '10 домашних матчей'),
    (4, 'SUB-SEASON', 'Сезонный абонемент',               30,  85000.00, 365, 1, 'Все домашние матчи сезона'),
    (5, 'SUB-VIP',    'VIP-сезонный абонемент',           30, 250000.00, 365, 4, 'VIP-ложа на все домашние матчи'),
    (6, 'SUB-STUD',   'Студенческий абонемент',           10,   6000.00, 180, 3, '10 матчей, сектор C, по студ. билету');

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

-- Matches (aligned with lib/mock/hockey.ts)
INSERT INTO match (id, arena_id, opponent_id, match_date, attendance, status) VALUES
    ('match-1',  1,  1, CURRENT_DATE - 90, 7980,  'completed'),
    ('match-2',  1,  2, CURRENT_DATE - 84, 9240,  'completed'),
    ('match-3',  1,  3, CURRENT_DATE - 78, 6720,  'completed'),
    ('match-4',  1,  4, CURRENT_DATE - 72, 9870,  'completed'),
    ('match-5',  1,  5, CURRENT_DATE - 66, 7350,  'completed'),
    ('match-6',  1,  6, CURRENT_DATE - 60, 8820,  'completed'),
    ('match-7',  1,  7, CURRENT_DATE - 54, 9450,  'completed'),
    ('match-8',  1,  8, CURRENT_DATE - 48, 6930,  'completed'),
    ('match-9',  1,  9, CURRENT_DATE - 42, 8190,  'completed'),
    ('match-10', 1, 10, CURRENT_DATE - 36, 9660,  'completed'),
    ('match-11', 1, 11, CURRENT_DATE - 30, 7140,  'completed'),
    ('match-12', 1, 12, CURRENT_DATE - 24, 8610,  'completed'),
    ('match-13', 1, 13, CURRENT_DATE - 18, 9030,  'completed'),
    ('match-14', 1, 14, CURRENT_DATE - 12, 7560,  'completed'),
    ('match-15', 1, 15, CURRENT_DATE -  6, 9870,  'completed');

INSERT INTO promotion_match (promotion_id, match_id) VALUES
    ('promo-1', 'match-1'), ('promo-1', 'match-2'),
    ('promo-2', 'match-3'), ('promo-2', 'match-4'), ('promo-2', 'match-5'),
    ('promo-3', 'match-6'), ('promo-3', 'match-7'),
    ('promo-4', 'match-8'), ('promo-4', 'match-9'), ('promo-4', 'match-10'),
    ('promo-6', 'match-11'), ('promo-6', 'match-12'),
    ('promo-7', 'match-13'), ('promo-7', 'match-14'),
    ('promo-8', 'match-14'), ('promo-8', 'match-15'),
    ('promo-9', 'match-1'), ('promo-9', 'match-2'), ('promo-9', 'match-3'),
    ('promo-9', 'match-4'), ('promo-9', 'match-5');

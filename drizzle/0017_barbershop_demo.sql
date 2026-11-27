INSERT INTO sites (id, slug, name, type, description, theme, cover_url, currency, status, nfc_key, created_at,
  show_services, show_hours, opening_hours, guest_order)
SELECT '8482eb88-6c5a-4703-a349-56aa24a012c0', 'barbershop', 'Контур', 'Барбершоп',
  'Мужские стрижки, оформление бороды и уход. Демонстрационная страница Nefio.', 'graphite',
  'https://nefio.site/assets/barbershop/cover.jpg', 'BYN', 'live', '1d304253-66b6-4bf9-b1e7-669d93e83f99',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 1, 1, 'Пн–Пт 10:00–21:00' || char(10) || 'Сб–Вс 10:00–19:00',
  '["services","hours"]'
WHERE EXISTS (SELECT 1 FROM sites WHERE slug='coffe1')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
WITH services (position, name, category, description, price) AS (VALUES
  (1, 'Мужская стрижка', 'Стрижки', 'Подбор формы, мытьё головы, стрижка и укладка · 45 мин', 4500),
  (2, 'Стрижка машинкой', 'Стрижки', 'Короткая стрижка с одной или двумя насадками · 25 мин', 2800),
  (3, 'Удлинённая стрижка', 'Стрижки', 'Стрижка ножницами для волос средней длины · 60 мин', 5500),
  (4, 'Детская стрижка', 'Стрижки', 'Стрижка для детей от 6 до 12 лет · 35 мин', 3500),
  (5, 'Моделирование бороды', 'Борода', 'Подбор формы, окантовка и уход с маслом · 30 мин', 3000),
  (6, 'Коррекция усов', 'Борода', 'Подравнивание и укладка усов · 15 мин', 1500),
  (7, 'Классическое бритьё', 'Борода', 'Распаривание горячим полотенцем, бритьё и бальзам · 40 мин', 3800),
  (8, 'Стрижка и борода', 'Комплексы', 'Мужская стрижка и моделирование бороды · 75 мин', 6700),
  (9, 'Отец и сын', 'Комплексы', 'Мужская и детская стрижки за один визит · 85 мин', 7200),
  (10, 'Мытьё и укладка', 'Уход', 'Мытьё головы, сушка и укладка · 20 мин', 1800),
  (11, 'Камуфляж седины', 'Уход', 'Тонирование для мягкого выравнивания оттенка · 30 мин', 3500),
  (12, 'Уход за кожей головы', 'Уход', 'Очищение и увлажняющий уход · 25 мин', 2500)
)
INSERT INTO items (id, site_id, catalog, name, category, description, price, created_at, sort_order)
SELECT 'demo-kontur-service-' || services.position, sites.id, 'services', services.name, services.category,
  services.description, services.price, sites.created_at, services.position
FROM services CROSS JOIN sites
WHERE sites.id='8482eb88-6c5a-4703-a349-56aa24a012c0' AND sites.slug='barbershop'
ON CONFLICT(id) DO NOTHING;

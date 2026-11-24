UPDATE sites SET
  logo_url=CASE WHEN logo_url IN ('', 'https://tap-panel-nfc.epicaudio3.chatgpt.site/assets/coffe1/logo.png') THEN 'https://nefio.site/assets/coffe1/logo.png' ELSE logo_url END,
  cover_url=CASE WHEN cover_url IN ('', 'https://tap-panel-nfc.epicaudio3.chatgpt.site/assets/coffe1/cover.jpg') THEN 'https://nefio.site/assets/coffe1/cover.jpg' ELSE cover_url END,
  show_menu=1,
  show_website=1,
  website_url=COALESCE(NULLIF(website_url, ''), 'https://nefio.site/about'),
  show_maps=1,
  maps_url=COALESCE(NULLIF(maps_url, ''), 'https://yandex.by/maps/157/minsk/'),
  hidden_links=(SELECT COALESCE(json_group_array(value), '[]') FROM json_each(sites.hidden_links) WHERE value <> 'maps_url'),
  show_hours=1,
  opening_hours=COALESCE(NULLIF(opening_hours, ''), 'Демо: пн–пт 08:00–21:00, сб–вс 09:00–21:00'),
  show_wifi=1,
  wifi_name=COALESCE(NULLIF(wifi_name, ''), 'Tap Coffee Demo'),
  wifi_password=COALESCE(NULLIF(wifi_password, ''), 'tap-demo-01'),
  show_reviews=1,
  yandex_review_url=COALESCE(NULLIF(yandex_review_url, ''), 'https://yandex.by/maps/157/minsk/'),
  google_review_url=COALESCE(NULLIF(google_review_url, ''), 'https://www.google.com/maps/search/?api=1&query=Minsk'),
  guest_order=CASE WHEN guest_order='[]' THEN '["menu","hours","wifi","maps","feedback","website","vk","telegram","instagram","tips"]' ELSE guest_order END,
  guest_version=guest_version+1
WHERE slug='coffe1';
--> statement-breakpoint
INSERT INTO site_feedback (site_id, id, rating, comment, guest_name, guest_place, source, created_at, read_at)
SELECT sites.id, demo.id, demo.rating, demo.comment, demo.guest_name, demo.guest_place, demo.source,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', demo.age),
  CASE WHEN demo.rating=3 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END
FROM sites CROSS JOIN (
  SELECT 'c0ffe001-0000-4000-8000-000000000001' AS id, 1 AS rating,
    'Демо: долго ждали заказ в обеденное время.' AS comment, '' AS guest_name, 'У стойки' AS guest_place, 'nfc' AS source, '-1 day' AS age
  UNION ALL SELECT 'c0ffe001-0000-4000-8000-000000000002', 2,
    'Демо: было бы удобно видеть состав блюд в меню.', 'Демо-гость', '', 'direct', '-2 days'
  UNION ALL SELECT 'c0ffe001-0000-4000-8000-000000000003', 3,
    'Демо: кофе понравился, выпечку принесли чуть позже.', 'Демо-гость', 'Стол у окна', 'nfc', '-3 days'
) demo WHERE sites.slug='coffe1'
ON CONFLICT(site_id, id) DO NOTHING;

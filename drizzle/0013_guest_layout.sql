ALTER TABLE sites ADD COLUMN guest_order TEXT NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN guest_version INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN show_reviews INTEGER NOT NULL DEFAULT 0 CHECK (show_reviews IN (0, 1));
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN yandex_review_url TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN google_review_url TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE sites SET show_reviews=1, show_maps=0, yandex_review_url=maps_url
WHERE show_maps=1 AND (maps_url LIKE 'https://yandex.ru/%' OR maps_url LIKE 'https://yandex.by/%' OR maps_url LIKE 'https://yandex.com/%' OR maps_url LIKE 'https://ya.cc/%');
--> statement-breakpoint
UPDATE sites SET show_reviews=1, show_maps=0, google_review_url=maps_url
WHERE show_maps=1 AND (maps_url LIKE 'https://www.google.com/maps/%' OR maps_url LIKE 'https://maps.google.com/%' OR maps_url LIKE 'https://maps.app.goo.gl/%' OR maps_url LIKE 'https://g.page/%' OR maps_url LIKE 'https://search.google.com/local/writereview%');

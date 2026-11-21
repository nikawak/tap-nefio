ALTER TABLE items ADD COLUMN photo_key TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX items_photo_key ON items(photo_key) WHERE photo_key IS NOT NULL;

ALTER TABLE sites ADD COLUMN logo_key TEXT;
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN cover_key TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX sites_logo_key ON sites(logo_key) WHERE logo_key IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX sites_cover_key ON sites(cover_key) WHERE cover_key IS NOT NULL;
--> statement-breakpoint
ALTER TABLE items ADD COLUMN sort_order INTEGER;

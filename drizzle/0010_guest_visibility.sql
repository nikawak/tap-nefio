ALTER TABLE sites ADD COLUMN show_maps INTEGER NOT NULL DEFAULT 0 CHECK (show_maps IN (0, 1));
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN show_hours INTEGER CHECK (show_hours IN (0, 1));
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN show_wifi INTEGER CHECK (show_wifi IN (0, 1));

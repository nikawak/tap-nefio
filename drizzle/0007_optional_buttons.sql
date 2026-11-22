ALTER TABLE sites ADD COLUMN show_menu INTEGER NOT NULL DEFAULT 0 CHECK (show_menu IN (0, 1));
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN website_url TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN show_website INTEGER NOT NULL DEFAULT 0 CHECK (show_website IN (0, 1));

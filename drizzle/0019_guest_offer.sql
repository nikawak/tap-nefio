ALTER TABLE sites ADD COLUMN show_offer INTEGER NOT NULL DEFAULT 0 CHECK (show_offer IN (0, 1));
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN offer_title TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN offer_description TEXT NOT NULL DEFAULT '';

ALTER TABLE sites ADD COLUMN opening_hours TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN wifi_name TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN wifi_password TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE TABLE site_feedback (
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 3),
  comment TEXT NOT NULL,
  guest_name TEXT NOT NULL DEFAULT '',
  guest_place TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL CHECK (source IN ('nfc', 'direct')),
  created_at TEXT NOT NULL,
  read_at TEXT,
  PRIMARY KEY (site_id, id)
);
--> statement-breakpoint
CREATE INDEX site_feedback_date ON site_feedback(site_id, created_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX site_feedback_unread ON site_feedback(site_id, created_at DESC, id DESC) WHERE read_at IS NULL;

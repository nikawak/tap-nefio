ALTER TABLE sites ADD COLUMN show_booking INTEGER NOT NULL DEFAULT 0 CHECK (show_booking IN (0, 1));
--> statement-breakpoint
CREATE TABLE site_bookings (
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  visit_date TEXT NOT NULL,
  visit_time TEXT NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size BETWEEN 1 AND 99),
  guest_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled')),
  PRIMARY KEY (site_id, id)
);
--> statement-breakpoint
CREATE INDEX site_bookings_created ON site_bookings(site_id, created_at DESC, id DESC);

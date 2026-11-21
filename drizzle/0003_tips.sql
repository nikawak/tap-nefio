CREATE TABLE site_tip_settings (
  site_id TEXT PRIMARY KEY NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  links TEXT NOT NULL,
  checkout_enabled INTEGER NOT NULL CHECK (checkout_enabled IN (0, 1)),
  checkout_test INTEGER NOT NULL CHECK (checkout_test IN (0, 1)),
  checkout_recipient TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  shop_key TEXT NOT NULL,
  public_key TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE tip_opens (
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  day TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('nfc', 'direct')),
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (site_id, method, day, source)
);
--> statement-breakpoint
CREATE TABLE tip_payments (
  id TEXT PRIMARY KEY NOT NULL,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('nfc', 'direct')),
  amount INTEGER NOT NULL CHECK (amount BETWEEN 100 AND 30000),
  test INTEGER NOT NULL CHECK (test IN (0, 1)),
  shop_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  public_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  checkout_url TEXT,
  provider_uid TEXT UNIQUE,
  paid_day TEXT
);
--> statement-breakpoint
CREATE INDEX tip_payments_site_paid ON tip_payments(site_id, paid_day);

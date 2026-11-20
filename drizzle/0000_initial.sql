CREATE TABLE sites (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL,
  logo_url TEXT NOT NULL DEFAULT '',
  cover_url TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'BYN',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('live', 'draft')),
  maps_url TEXT NOT NULL DEFAULT '',
  telegram_url TEXT NOT NULL DEFAULT '',
  instagram_url TEXT NOT NULL DEFAULT '',
  vk_url TEXT NOT NULL DEFAULT '',
  nfc_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE items (
  id TEXT PRIMARY KEY NOT NULL,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL CHECK (price >= 0),
  available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX items_site ON items(site_id, created_at);
--> statement-breakpoint
CREATE TABLE site_admins (
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  PRIMARY KEY (site_id, email)
);
--> statement-breakpoint
CREATE INDEX site_admins_email ON site_admins(email, site_id);
--> statement-breakpoint
CREATE TABLE events (
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('visit','menu','maps','telegram','instagram','vk')),
  source TEXT NOT NULL DEFAULT 'direct' CHECK (source IN ('nfc','direct')),
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1 CHECK (count > 0),
  PRIMARY KEY (site_id, day, kind, source)
);

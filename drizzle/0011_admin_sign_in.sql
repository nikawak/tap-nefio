CREATE TABLE admin_profiles (
  email TEXT PRIMARY KEY NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  telegram_username TEXT NOT NULL DEFAULT '',
  CHECK (length(phone) = 13 AND substr(phone, 1, 4) = '+375' AND substr(phone, 5) NOT GLOB '*[^0-9]*')
);
--> statement-breakpoint
ALTER TABLE google_sessions ADD COLUMN provider TEXT NOT NULL DEFAULT 'google' CHECK (provider IN ('google', 'sms', 'telegram', 'viber'));
--> statement-breakpoint
ALTER TABLE google_sessions ADD COLUMN phone TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE TABLE phone_login_codes (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'viber')),
  code_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  delivered INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX phone_login_codes_phone_date ON phone_login_codes(phone, created_at);
--> statement-breakpoint
CREATE TRIGGER remove_unassigned_admin_profile AFTER DELETE ON site_admins
WHEN NOT EXISTS (SELECT 1 FROM site_admins WHERE email = OLD.email)
BEGIN
  DELETE FROM admin_profiles WHERE email = OLD.email;
  DELETE FROM google_sessions WHERE email = OLD.email;
  DELETE FROM phone_login_codes WHERE email = OLD.email;
END;
--> statement-breakpoint
CREATE TRIGGER revoke_admin_phone_login AFTER UPDATE OF phone ON admin_profiles
WHEN OLD.phone <> NEW.phone
BEGIN
  DELETE FROM google_sessions WHERE email = OLD.email AND phone <> '';
  DELETE FROM phone_login_codes WHERE email = OLD.email;
END;

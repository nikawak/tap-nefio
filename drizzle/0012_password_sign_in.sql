CREATE TABLE password_accounts (
  email TEXT PRIMARY KEY NOT NULL,
  login TEXT UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager')),
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  attempt_window INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE password_auth_budget (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  attempt_window INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
--> statement-breakpoint
DROP TRIGGER remove_unassigned_admin_profile;
--> statement-breakpoint
DROP TRIGGER revoke_admin_phone_login;
--> statement-breakpoint
CREATE TABLE google_sessions_next (
  token_hash TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google' CHECK (provider IN ('google', 'sms', 'telegram', 'viber', 'password')),
  phone TEXT NOT NULL DEFAULT '',
  password_salt TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
INSERT INTO google_sessions_next (token_hash, email, name, expires_at, provider, phone)
SELECT token_hash, email, name, expires_at, provider, phone FROM google_sessions;
--> statement-breakpoint
DROP TABLE google_sessions;
--> statement-breakpoint
ALTER TABLE google_sessions_next RENAME TO google_sessions;
--> statement-breakpoint
CREATE INDEX google_sessions_expiry ON google_sessions(expires_at);
--> statement-breakpoint
CREATE TRIGGER remove_unassigned_admin_profile AFTER DELETE ON site_admins
WHEN NOT EXISTS (SELECT 1 FROM site_admins WHERE email = OLD.email)
BEGIN
  DELETE FROM admin_profiles WHERE email = OLD.email;
  DELETE FROM google_sessions WHERE email = OLD.email;
  DELETE FROM phone_login_codes WHERE email = OLD.email;
  DELETE FROM password_accounts WHERE email = OLD.email AND role = 'manager';
END;
--> statement-breakpoint
CREATE TRIGGER revoke_admin_phone_login AFTER UPDATE OF phone ON admin_profiles
WHEN OLD.phone <> NEW.phone
BEGIN
  DELETE FROM google_sessions WHERE email = OLD.email AND phone <> '';
  DELETE FROM phone_login_codes WHERE email = OLD.email;
END;

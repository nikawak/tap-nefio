ALTER TABLE sites ADD COLUMN contact_address TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN contact_phone TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN directions_url TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN appointment_url TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE TABLE site_notifications (
  site_id TEXT PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  staff_chat_id TEXT NOT NULL DEFAULT '',
  staff_code_hash TEXT UNIQUE,
  staff_code_expires INTEGER NOT NULL DEFAULT 0,
  guest_enabled INTEGER NOT NULL DEFAULT 0 CHECK (guest_enabled IN (0, 1))
);
--> statement-breakpoint
ALTER TABLE site_bookings ADD COLUMN visit_at INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE site_bookings ADD COLUMN telegram_chat_id TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE site_bookings ADD COLUMN telegram_code_hash TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX site_bookings_telegram_code ON site_bookings(telegram_code_hash) WHERE telegram_code_hash IS NOT NULL;
--> statement-breakpoint
CREATE INDEX site_bookings_telegram_chat ON site_bookings(telegram_chat_id) WHERE telegram_chat_id <> '';
--> statement-breakpoint
CREATE TABLE telegram_notifications (
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('staff_booking', 'staff_feedback', 'guest_confirmed', 'guest_declined', 'guest_cancelled', 'guest_reminder')),
  due_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  PRIMARY KEY (site_id, subject_id, kind)
);
--> statement-breakpoint
CREATE INDEX telegram_notifications_due ON telegram_notifications(due_at) WHERE done=0;
--> statement-breakpoint
CREATE INDEX telegram_notifications_expiry ON telegram_notifications(expires_at);
--> statement-breakpoint
CREATE TRIGGER telegram_staff_chat_changed AFTER UPDATE OF staff_chat_id ON site_notifications
WHEN OLD.staff_chat_id <> '' AND NEW.staff_chat_id <> OLD.staff_chat_id
BEGIN
  DELETE FROM telegram_notifications WHERE site_id=NEW.site_id AND kind IN ('staff_booking', 'staff_feedback') AND done=0;
END;
--> statement-breakpoint
CREATE TRIGGER telegram_guest_updates_disabled AFTER UPDATE OF guest_enabled ON site_notifications
WHEN NEW.guest_enabled=0 AND OLD.guest_enabled=1
BEGIN
  DELETE FROM telegram_notifications WHERE site_id=NEW.site_id AND kind LIKE 'guest_%' AND done=0;
  UPDATE site_bookings SET telegram_chat_id='', telegram_code_hash=NULL WHERE site_id=NEW.site_id
    AND (telegram_chat_id <> '' OR telegram_code_hash IS NOT NULL);
END;
--> statement-breakpoint
CREATE TRIGGER telegram_new_booking AFTER INSERT ON site_bookings
WHEN EXISTS (SELECT 1 FROM site_notifications WHERE site_id=NEW.site_id AND staff_chat_id <> '')
BEGIN
  INSERT INTO telegram_notifications (site_id, subject_id, kind, due_at, expires_at)
  VALUES (NEW.site_id, NEW.id, 'staff_booking', unixepoch(), unixepoch()+86400)
  ON CONFLICT(site_id, subject_id, kind) DO NOTHING;
END;
--> statement-breakpoint
CREATE TRIGGER telegram_new_feedback AFTER INSERT ON site_feedback
WHEN EXISTS (SELECT 1 FROM site_notifications WHERE site_id=NEW.site_id AND staff_chat_id <> '')
BEGIN
  INSERT INTO telegram_notifications (site_id, subject_id, kind, due_at, expires_at)
  VALUES (NEW.site_id, NEW.id, 'staff_feedback', unixepoch(), unixepoch()+86400)
  ON CONFLICT(site_id, subject_id, kind) DO NOTHING;
END;
--> statement-breakpoint
CREATE TRIGGER telegram_booking_updates AFTER UPDATE OF status, telegram_chat_id ON site_bookings
WHEN NEW.telegram_chat_id <> '' AND NEW.status <> 'pending' AND NEW.visit_at > unixepoch()
  AND (NEW.status <> OLD.status OR NEW.telegram_chat_id <> OLD.telegram_chat_id)
  AND EXISTS (SELECT 1 FROM site_notifications WHERE site_id=NEW.site_id AND guest_enabled=1)
BEGIN
  INSERT INTO telegram_notifications (site_id, subject_id, kind, due_at, expires_at)
  VALUES (NEW.site_id, NEW.id, 'guest_' || NEW.status, unixepoch(), NEW.visit_at)
  ON CONFLICT(site_id, subject_id, kind) DO NOTHING;

  INSERT INTO telegram_notifications (site_id, subject_id, kind, due_at, expires_at)
  SELECT NEW.site_id, NEW.id, 'guest_reminder', NEW.visit_at-7200, NEW.visit_at-900
  WHERE NEW.status='confirmed' AND NEW.visit_at-7200 > unixepoch()+900
  ON CONFLICT(site_id, subject_id, kind) DO NOTHING;
END;

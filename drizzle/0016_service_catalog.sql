ALTER TABLE items ADD COLUMN catalog TEXT NOT NULL DEFAULT 'menu' CHECK (catalog IN ('menu', 'services'));
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN show_services INTEGER NOT NULL DEFAULT 0 CHECK (show_services IN (0, 1));
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN services_url TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN services_order_version INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN legacy_services INTEGER NOT NULL DEFAULT 0 CHECK (legacy_services IN (0, 1));
--> statement-breakpoint
UPDATE sites SET legacy_services=1, show_services=show_menu, services_url=menu_url, show_menu=0, menu_url='',
  services_order_version=menu_order_version, menu_order_version=menu_order_version+1,
  guest_order=REPLACE(guest_order, '"menu"', '"services"'), guest_version=guest_version+1
WHERE type='Студия красоты';
--> statement-breakpoint
UPDATE items SET catalog='services' WHERE site_id IN (SELECT id FROM sites WHERE legacy_services=1);
--> statement-breakpoint
CREATE INDEX items_site_catalog ON items(site_id, catalog);
--> statement-breakpoint
DROP TRIGGER items_order_after_insert;
--> statement-breakpoint
DROP TRIGGER items_order_after_delete;
--> statement-breakpoint
DROP TRIGGER items_order_after_update;
--> statement-breakpoint
CREATE TRIGGER items_order_after_insert AFTER INSERT ON items
BEGIN
  UPDATE sites SET menu_order_version=menu_order_version+(NEW.catalog='menu'),
    services_order_version=services_order_version+(NEW.catalog='services') WHERE id=NEW.site_id;
END;
--> statement-breakpoint
CREATE TRIGGER items_order_after_delete AFTER DELETE ON items
BEGIN
  UPDATE sites SET menu_order_version=menu_order_version+(OLD.catalog='menu'),
    services_order_version=services_order_version+(OLD.catalog='services') WHERE id=OLD.site_id;
END;
--> statement-breakpoint
CREATE TRIGGER items_order_after_update AFTER UPDATE OF sort_order, name ON items
WHEN NEW.sort_order IS NOT OLD.sort_order OR NEW.name IS NOT OLD.name
BEGIN
  UPDATE sites SET menu_order_version=menu_order_version+(NEW.catalog='menu'),
    services_order_version=services_order_version+(NEW.catalog='services') WHERE id=NEW.site_id;
END;

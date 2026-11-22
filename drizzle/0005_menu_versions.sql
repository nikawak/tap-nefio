ALTER TABLE items ADD COLUMN edit_version INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE sites ADD COLUMN menu_order_version INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE TRIGGER items_order_after_insert AFTER INSERT ON items
BEGIN
  UPDATE sites SET menu_order_version = menu_order_version + 1 WHERE id = NEW.site_id;
END;
--> statement-breakpoint
CREATE TRIGGER items_order_after_delete AFTER DELETE ON items
BEGIN
  UPDATE sites SET menu_order_version = menu_order_version + 1 WHERE id = OLD.site_id;
END;
--> statement-breakpoint
CREATE TRIGGER items_order_after_update AFTER UPDATE OF sort_order, name ON items
WHEN NEW.sort_order IS NOT OLD.sort_order OR NEW.name IS NOT OLD.name
BEGIN
  UPDATE sites SET menu_order_version = menu_order_version + 1 WHERE id = NEW.site_id;
END;

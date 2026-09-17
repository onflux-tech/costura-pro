CREATE TRIGGER `stock_movement_no_update` BEFORE UPDATE ON `stock_movement`
BEGIN
	SELECT RAISE(ABORT, 'stock_movement é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `stock_movement_no_delete` BEFORE DELETE ON `stock_movement`
BEGIN
	SELECT RAISE(ABORT, 'stock_movement é append-only');
END;

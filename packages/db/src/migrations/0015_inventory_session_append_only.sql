CREATE TRIGGER `inventory_session_no_update` BEFORE UPDATE ON `inventory_session`
BEGIN
	SELECT RAISE(ABORT, 'inventory_session é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `inventory_session_no_delete` BEFORE DELETE ON `inventory_session`
BEGIN
	SELECT RAISE(ABORT, 'inventory_session é append-only');
END;

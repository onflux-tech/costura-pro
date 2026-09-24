CREATE TRIGGER `quote_approval_no_update` BEFORE UPDATE ON `quote_approval`
BEGIN
	SELECT RAISE(ABORT, 'quote_approval é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `quote_approval_no_delete` BEFORE DELETE ON `quote_approval`
BEGIN
	SELECT RAISE(ABORT, 'quote_approval é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `stock_reservation_no_update` BEFORE UPDATE ON `stock_reservation`
BEGIN
	SELECT RAISE(ABORT, 'stock_reservation é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `stock_reservation_no_delete` BEFORE DELETE ON `stock_reservation`
BEGIN
	SELECT RAISE(ABORT, 'stock_reservation é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `receivable_no_update` BEFORE UPDATE ON `receivable`
BEGIN
	SELECT RAISE(ABORT, 'receivable é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `receivable_no_delete` BEFORE DELETE ON `receivable`
BEGIN
	SELECT RAISE(ABORT, 'receivable é append-only');
END;

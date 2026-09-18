CREATE TRIGGER `purchase_no_update` BEFORE UPDATE ON `purchase`
BEGIN
	SELECT RAISE(ABORT, 'purchase é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `purchase_no_delete` BEFORE DELETE ON `purchase`
BEGIN
	SELECT RAISE(ABORT, 'purchase é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `obligation_no_update` BEFORE UPDATE ON `obligation`
BEGIN
	SELECT RAISE(ABORT, 'obligation é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `obligation_no_delete` BEFORE DELETE ON `obligation`
BEGIN
	SELECT RAISE(ABORT, 'obligation é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `purchase_reversal_no_update` BEFORE UPDATE ON `purchase_reversal`
BEGIN
	SELECT RAISE(ABORT, 'purchase_reversal é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `purchase_reversal_no_delete` BEFORE DELETE ON `purchase_reversal`
BEGIN
	SELECT RAISE(ABORT, 'purchase_reversal é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `financial_movement_no_update` BEFORE UPDATE ON `financial_movement`
BEGIN
	SELECT RAISE(ABORT, 'financial_movement é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `financial_movement_no_delete` BEFORE DELETE ON `financial_movement`
BEGIN
	SELECT RAISE(ABORT, 'financial_movement é append-only');
END;

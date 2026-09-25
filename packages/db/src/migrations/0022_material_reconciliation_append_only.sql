CREATE TRIGGER `material_reconciliation_no_update` BEFORE UPDATE ON `material_reconciliation`
BEGIN
	SELECT RAISE(ABORT, 'material_reconciliation é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `material_reconciliation_no_delete` BEFORE DELETE ON `material_reconciliation`
BEGIN
	SELECT RAISE(ABORT, 'material_reconciliation é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `material_reconciliation_reversal_no_update` BEFORE UPDATE ON `material_reconciliation_reversal`
BEGIN
	SELECT RAISE(ABORT, 'material_reconciliation_reversal é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `material_reconciliation_reversal_no_delete` BEFORE DELETE ON `material_reconciliation_reversal`
BEGIN
	SELECT RAISE(ABORT, 'material_reconciliation_reversal é append-only');
END;
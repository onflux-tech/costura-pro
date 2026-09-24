CREATE TRIGGER `quote_revision_update_only_redaction` BEFORE UPDATE ON `quote_revision`
WHEN NOT (
	NEW.id = OLD.id
	AND NEW.quote_id = OLD.quote_id
	AND NEW.number = OLD.number
	AND NEW.emitted_on = OLD.emitted_on
	AND NEW.valid_until = OLD.valid_until
	AND NEW.gross_cents = OLD.gross_cents
	AND NEW.discount_cents = OLD.discount_cents
	AND NEW.total_cents = OLD.total_cents
	AND NEW.cost_cents IS OLD.cost_cents
	AND NEW.target_margin_basis_points = OLD.target_margin_basis_points
	AND NEW.created_at = OLD.created_at
	AND NEW.version = OLD.version + 1
	AND EXISTS (
		SELECT 1 FROM `redacted_aggregate`
		WHERE `redacted_aggregate`.`aggregate_type` = 'quoteRevision'
		AND `redacted_aggregate`.`aggregate_id` = OLD.id
	)
)
BEGIN
	SELECT RAISE(ABORT, 'quote_revision é append-only fora da redação');
END;
--> statement-breakpoint
CREATE TRIGGER `quote_revision_no_delete` BEFORE DELETE ON `quote_revision`
BEGIN
	SELECT RAISE(ABORT, 'quote_revision é append-only');
END;

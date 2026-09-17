DROP TRIGGER `change_log_no_update`;
--> statement-breakpoint
CREATE TRIGGER `change_log_update_only_redaction` BEFORE UPDATE ON `change_log`
WHEN NOT (
	NEW.cursor = OLD.cursor
	AND NEW.aggregate_type = OLD.aggregate_type
	AND NEW.aggregate_id = OLD.aggregate_id
	AND NEW.version = OLD.version
	AND NEW.epoch = OLD.epoch
	AND NEW.op_id IS OLD.op_id
	AND NEW.changed_at = OLD.changed_at
	AND EXISTS (
		SELECT 1 FROM `redacted_aggregate`
		WHERE `redacted_aggregate`.`aggregate_type` = OLD.aggregate_type
		AND `redacted_aggregate`.`aggregate_id` = OLD.aggregate_id
	)
)
BEGIN
	SELECT RAISE(ABORT, 'change_log é append-only fora da redação');
END;
--> statement-breakpoint
CREATE TRIGGER `redacted_aggregate_no_update` BEFORE UPDATE ON `redacted_aggregate`
BEGIN
	SELECT RAISE(ABORT, 'redacted_aggregate é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `redacted_aggregate_no_delete` BEFORE DELETE ON `redacted_aggregate`
BEGIN
	SELECT RAISE(ABORT, 'redacted_aggregate é append-only');
END;

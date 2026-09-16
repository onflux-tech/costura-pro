CREATE TRIGGER `audit_event_no_update` BEFORE UPDATE ON `audit_event`
BEGIN
	SELECT RAISE(ABORT, 'audit_event é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `audit_event_no_delete` BEFORE DELETE ON `audit_event`
BEGIN
	SELECT RAISE(ABORT, 'audit_event é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `change_log_no_update` BEFORE UPDATE ON `change_log`
BEGIN
	SELECT RAISE(ABORT, 'change_log é append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `change_log_no_delete` BEFORE DELETE ON `change_log`
BEGIN
	SELECT RAISE(ABORT, 'change_log é append-only');
END;

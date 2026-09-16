import type { Database } from "@costura-pro/db";
import { auditEvent } from "@costura-pro/db/schema/installation";

import type { Access } from "./context";

export type AuditOutcome = "succeeded" | "failed" | "locked" | "rate_limited";

export type AuditLog = (fields: Record<string, unknown>) => void;

export type AuditInput = {
	access: Access;
	details?: Record<string, unknown>;
	deviceId?: string | null;
	ip?: string | null;
	outcome: AuditOutcome;
	type: string;
};

export function appendAudit(
	db: Pick<Database, "insert">,
	now: Date,
	{
		access,
		details = {},
		deviceId = null,
		ip = null,
		outcome,
		type,
	}: AuditInput,
	log?: AuditLog
): void {
	db.insert(auditEvent)
		.values({
			access,
			details,
			deviceId,
			id: crypto.randomUUID(),
			ip: access === "remote" ? ip : null,
			occurredAt: now,
			outcome,
			type,
		})
		.run();
	log?.({ audit: { [type]: { access, outcome } } });
}

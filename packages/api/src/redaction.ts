import type { Database } from "@costura-pro/db";
import { redactedAggregate } from "@costura-pro/db/schema/clients";
import {
	changeLog,
	operation,
	syncConflict,
} from "@costura-pro/db/schema/sync";
import { and, eq } from "drizzle-orm";

import type { AggregateType } from "./change-log";
import { commandMessages } from "./command-messages";
import type { Executor } from "./executor";

export const redactedOpHash = "redacted";

export const personalDataAggregates: ReadonlySet<AggregateType> = new Set([
	"client",
	"materialReconciliation",
	"materialReconciliationReversal",
	"measurement",
	"profile",
	"quote",
	"quoteApproval",
	"quoteRevision",
	"receivedItem",
	"serviceOrder",
	"serviceOrderItem",
]);

export const redactionReason = commandMessages.clientAnonymized;

export type RedactionStamp = { epoch: string; now: Date; opId: string };

export type Redaction = {
	current: { version: number };
	id: string;
	type: AggregateType;
};

export function isRedacted(
	db: Pick<Database, "select">,
	type: string,
	id: string
): boolean {
	return (
		db
			.select({ id: redactedAggregate.aggregateId })
			.from(redactedAggregate)
			.where(
				and(
					eq(redactedAggregate.aggregateType, type),
					eq(redactedAggregate.aggregateId, id)
				)
			)
			.get() !== undefined
	);
}

export function redactHistory(
	tx: Executor,
	{ current, id, type }: Redaction,
	stamp: RedactionStamp
): void {
	tx.insert(redactedAggregate)
		.values({
			aggregateId: id,
			aggregateType: type,
			opId: stamp.opId,
			redactedAt: stamp.now,
		})
		.run();
	const history = tx
		.select({ cursor: changeLog.cursor, version: changeLog.version })
		.from(changeLog)
		.where(
			and(eq(changeLog.aggregateType, type), eq(changeLog.aggregateId, id))
		)
		.all();
	for (const row of history) {
		tx.update(changeLog)
			.set({ data: { ...current, version: row.version } })
			.where(eq(changeLog.cursor, row.cursor))
			.run();
	}
	const sameConflictAggregate = and(
		eq(syncConflict.aggregateType, type),
		eq(syncConflict.aggregateId, id)
	);
	tx.update(syncConflict)
		.set({
			choice: "keepServer",
			resolvedAt: stamp.now,
			resolvedByOpId: stamp.opId,
			status: "resolved",
		})
		.where(and(sameConflictAggregate, eq(syncConflict.status, "open")))
		.run();
	tx.update(syncConflict)
		.set({ currentValues: {}, localValues: {}, reason: redactionReason })
		.where(sameConflictAggregate)
		.run();
	const sameOperationAggregate = and(
		eq(operation.aggregateType, type),
		eq(operation.aggregateId, id)
	);
	const conflicts = tx
		.select({ opId: operation.opId, result: operation.result })
		.from(operation)
		.where(and(sameOperationAggregate, eq(operation.status, "conflict")))
		.all();
	for (const row of conflicts) {
		tx.update(operation)
			.set({ result: { ...(row.result as Record<string, unknown>), current } })
			.where(eq(operation.opId, row.opId))
			.run();
	}
	tx.update(operation)
		.set({ opHash: redactedOpHash })
		.where(sameOperationAggregate)
		.run();
}

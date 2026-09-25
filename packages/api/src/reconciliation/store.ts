import type { Database } from "@costura-pro/db";
import {
	materialReconciliation,
	materialReconciliationReversal,
	type ReconciliationLineRow,
} from "@costura-pro/db/schema/reconciliation";
import { and, eq, isNull } from "drizzle-orm";

import { appendChange } from "../change-log";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";

type Reader = Pick<Database, "select">;

export type MaterialReconciliationRow =
	typeof materialReconciliation.$inferSelect;

export type MaterialReconciliationFields = {
	lines: ReconciliationLineRow[];
	note: string | null;
	occurredOn: string;
	serviceOrderItemId: string;
};

export type MaterialReconciliationSnapshot = MaterialReconciliationFields & {
	createdAt: string;
	id: string;
	version: number;
};

export function materialReconciliationSnapshot(
	row: MaterialReconciliationRow
): MaterialReconciliationSnapshot {
	return {
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		lines: row.lines,
		note: row.note,
		occurredOn: row.occurredOn,
		serviceOrderItemId: row.serviceOrderItemId,
		version: row.version,
	};
}

export function readMaterialReconciliation(
	db: Reader,
	id: string
): MaterialReconciliationRow | undefined {
	return db
		.select()
		.from(materialReconciliation)
		.where(eq(materialReconciliation.id, id))
		.get();
}

export function readActiveReconciliation(
	db: Reader,
	itemId: string
): MaterialReconciliationRow | undefined {
	return db
		.select({ reconciliation: materialReconciliation })
		.from(materialReconciliation)
		.leftJoin(
			materialReconciliationReversal,
			eq(
				materialReconciliationReversal.reconciliationId,
				materialReconciliation.id
			)
		)
		.where(
			and(
				eq(materialReconciliation.serviceOrderItemId, itemId),
				isNull(materialReconciliationReversal.id)
			)
		)
		.get()?.reconciliation;
}

export function insertMaterialReconciliation(
	db: Executor,
	id: string,
	fields: MaterialReconciliationFields,
	stamp: ChangeStamp
): MaterialReconciliationRow {
	const row = db
		.insert(materialReconciliation)
		.values({ ...fields, createdAt: stamp.now, id, version: 1 })
		.returning()
		.get();
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "materialReconciliation",
		data: materialReconciliationSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
	return row;
}

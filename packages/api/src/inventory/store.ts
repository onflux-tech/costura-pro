import type { Database } from "@costura-pro/db";
import {
	type InventoryLineRecord,
	inventorySession,
} from "@costura-pro/db/schema/stock";
import { eq } from "drizzle-orm";

import { appendChange } from "../change-log";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";

export type InventoryLine = InventoryLineRecord;

export type InventorySessionRow = typeof inventorySession.$inferSelect;

export type InventorySessionSnapshot = {
	createdAt: string;
	id: string;
	lines: InventoryLine[];
	notes: string | null;
	occurredOn: string;
	reason: string;
	version: number;
};

export type InventorySessionFields = Pick<
	InventorySessionSnapshot,
	"lines" | "notes" | "occurredOn" | "reason"
>;

type Reader = Pick<Database, "select">;

export function inventorySessionSnapshot(
	row: InventorySessionRow
): InventorySessionSnapshot {
	return {
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		lines: row.lines,
		notes: row.notes,
		occurredOn: row.occurredOn,
		reason: row.reason,
		version: row.version,
	};
}

export function readInventorySession(
	db: Reader,
	id: string
): InventorySessionRow | undefined {
	return db
		.select()
		.from(inventorySession)
		.where(eq(inventorySession.id, id))
		.get();
}

export function insertInventorySession(
	db: Executor,
	id: string,
	fields: InventorySessionFields,
	stamp: ChangeStamp
): InventorySessionRow {
	const row = db
		.insert(inventorySession)
		.values({ ...fields, createdAt: stamp.now, id, version: 1 })
		.returning()
		.get();
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "inventorySession",
		data: inventorySessionSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
	return row;
}

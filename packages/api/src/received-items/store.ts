import type { Database } from "@costura-pro/db";
import {
	type ReceivedItemPhotoRow,
	receivedItem,
} from "@costura-pro/db/schema/received-items";
import { changeLog, syncConflict } from "@costura-pro/db/schema/sync";
import type { ReceivedItemCondition } from "@costura-pro/domain/received-item";
import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";

import { appendChange } from "../change-log";
import { readClient } from "../clients/store";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";

export type ReceivedItemRow = typeof receivedItem.$inferSelect;

export type ReceivedItemFields = Pick<
	ReceivedItemRow,
	| "accessories"
	| "clientId"
	| "condition"
	| "description"
	| "expectedReturnOn"
	| "notes"
	| "photos"
	| "quantity"
	| "receivedOn"
>;

export type ReceivedItemPatch = Partial<
	Pick<
		ReceivedItemRow,
		| "accessories"
		| "archivedAt"
		| "condition"
		| "description"
		| "expectedReturnOn"
		| "notes"
		| "photos"
		| "quantity"
		| "receivedOn"
		| "returnedOn"
	>
>;

export type ReceivedItemSnapshot = {
	accessories: string | null;
	archivedAt: string | null;
	clientId: string;
	condition: ReceivedItemCondition;
	createdAt: string;
	description: string;
	expectedReturnOn: string | null;
	id: string;
	notes: string | null;
	photos: ReceivedItemPhotoRow[];
	quantity: number;
	receivedOn: string;
	returnedOn: string | null;
	version: number;
};

type Reader = Pick<Database, "select">;

export function receivedItemSnapshot(
	row: ReceivedItemRow
): ReceivedItemSnapshot {
	return {
		accessories: row.accessories,
		archivedAt: row.archivedAt?.toISOString() ?? null,
		clientId: row.clientId,
		condition: row.condition,
		createdAt: row.createdAt.toISOString(),
		description: row.description,
		expectedReturnOn: row.expectedReturnOn,
		id: row.id,
		notes: row.notes,
		photos: row.photos,
		quantity: row.quantity,
		receivedOn: row.receivedOn,
		returnedOn: row.returnedOn,
		version: row.version,
	};
}

export function readReceivedItem(
	db: Reader,
	id: string
): ReceivedItemRow | undefined {
	return db.select().from(receivedItem).where(eq(receivedItem.id, id)).get();
}

export function listReceivedItemsOfClient(
	db: Reader,
	clientId: string
): ReceivedItemRow[] {
	return db
		.select()
		.from(receivedItem)
		.where(eq(receivedItem.clientId, clientId))
		.orderBy(
			desc(receivedItem.receivedOn),
			desc(receivedItem.createdAt),
			desc(receivedItem.id)
		)
		.all();
}

export function isReceivedItemAnonymized(
	db: Reader,
	row: ReceivedItemRow
): boolean {
	return (readClient(db, row.clientId)?.anonymizedAt ?? null) !== null;
}

function recordReceivedItem(
	db: Executor,
	row: ReceivedItemRow,
	stamp: ChangeStamp
) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "receivedItem",
		data: receivedItemSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

export function insertReceivedItem(
	db: Executor,
	id: string,
	fields: ReceivedItemFields,
	stamp: ChangeStamp
): ReceivedItemRow {
	const row = db
		.insert(receivedItem)
		.values({
			...fields,
			createdAt: stamp.now,
			id,
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordReceivedItem(db, row, stamp);
	return row;
}

export function updateReceivedItem(
	db: Executor,
	current: ReceivedItemRow,
	patch: ReceivedItemPatch,
	stamp: ChangeStamp
): ReceivedItemRow {
	const next = db
		.update(receivedItem)
		.set({ ...patch, updatedAt: stamp.now, version: current.version + 1 })
		.where(
			and(
				eq(receivedItem.id, current.id),
				eq(receivedItem.version, current.version)
			)
		)
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Peça mudou durante a operação",
		});
	}
	recordReceivedItem(db, next, stamp);
	return next;
}

export function receivedItemHistoryValues(db: Reader, id: string): unknown[] {
	const changes = db
		.select({ data: changeLog.data })
		.from(changeLog)
		.where(
			and(
				eq(changeLog.aggregateType, "receivedItem"),
				eq(changeLog.aggregateId, id)
			)
		)
		.all();
	const conflicts = db
		.select({
			current: syncConflict.currentValues,
			local: syncConflict.localValues,
		})
		.from(syncConflict)
		.where(
			and(
				eq(syncConflict.aggregateType, "receivedItem"),
				eq(syncConflict.aggregateId, id)
			)
		)
		.all();
	return [
		...changes.map((change) => change.data),
		...conflicts.flatMap((conflict) => [conflict.local, conflict.current]),
	];
}

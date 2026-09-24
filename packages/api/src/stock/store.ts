import type { Database } from "@costura-pro/db";
import {
	stockBalance,
	stockLocation,
	stockLot,
	stockMovement,
} from "@costura-pro/db/schema/stock";
import type { StockMovementKind } from "@costura-pro/domain/stock";
import { balancePointId } from "@costura-pro/domain/stock";
import { ORPCError } from "@orpc/server";
import { and, eq, ne, sql } from "drizzle-orm";

import { appendChange } from "../change-log";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";

export type StockLocationRow = typeof stockLocation.$inferSelect;
export type StockLotRow = typeof stockLot.$inferSelect;
export type StockMovementRow = typeof stockMovement.$inferSelect;
export type StockBalanceRow = typeof stockBalance.$inferSelect;

export type StockLocationFields = Pick<StockLocationRow, "name" | "notes">;

export type StockLocationPatch = Partial<
	StockLocationFields & Pick<StockLocationRow, "archivedAt">
>;

export type StockLotFields = Pick<StockLotRow, "label" | "notes" | "variantId">;

export type StockLotPatch = Partial<
	Pick<StockLotRow, "archivedAt" | "label" | "notes">
>;

export type StockMovementFields = {
	inventorySessionId: string | null;
	kind: StockMovementKind;
	locationId: string;
	lotId: string | null;
	occurredOn: string;
	purchaseId: string | null;
	quantityMicros: string;
	reason: string | null;
	reversesMovementId: string | null;
	transferId: string | null;
	valueCents: string;
	variantId: string;
};

export type StockLocationSnapshot = {
	archivedAt: string | null;
	createdAt: string;
	id: string;
	name: string;
	notes: string | null;
	version: number;
};

export type StockLotSnapshot = {
	archivedAt: string | null;
	createdAt: string;
	id: string;
	label: string;
	notes: string | null;
	variantId: string;
	version: number;
};

export type StockMovementSnapshot = {
	createdAt: string;
	id: string;
	inventorySessionId: string | null;
	kind: StockMovementKind;
	locationId: string;
	lotId: string | null;
	occurredOn: string;
	purchaseId: string | null;
	quantityMicros: string;
	reason: string | null;
	reversesMovementId: string | null;
	transferId: string | null;
	valueCents: string;
	variantId: string;
	version: number;
};

type Reader = Pick<Database, "select">;

const isoOrNull = (value: Date | null) => value?.toISOString() ?? null;

export function stockLocationSnapshot(
	row: StockLocationRow
): StockLocationSnapshot {
	return {
		archivedAt: isoOrNull(row.archivedAt),
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		name: row.name,
		notes: row.notes,
		version: row.version,
	};
}

export function stockLotSnapshot(row: StockLotRow): StockLotSnapshot {
	return {
		archivedAt: isoOrNull(row.archivedAt),
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		label: row.label,
		notes: row.notes,
		variantId: row.variantId,
		version: row.version,
	};
}

export function stockMovementSnapshot(
	row: StockMovementRow
): StockMovementSnapshot {
	return {
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		inventorySessionId: row.inventorySessionId,
		kind: row.kind,
		locationId: row.locationId,
		lotId: row.lotId,
		occurredOn: row.occurredOn,
		purchaseId: row.purchaseId,
		quantityMicros: row.quantityMicros.toString(),
		reason: row.reason,
		reversesMovementId: row.reversesMovementId,
		transferId: row.transferId,
		valueCents: row.valueCents.toString(),
		variantId: row.variantId,
		version: row.version,
	};
}

export function readStockLocation(
	db: Reader,
	id: string
): StockLocationRow | undefined {
	return db.select().from(stockLocation).where(eq(stockLocation.id, id)).get();
}

export function readStockLot(db: Reader, id: string): StockLotRow | undefined {
	return db.select().from(stockLot).where(eq(stockLot.id, id)).get();
}

export function readStockMovement(
	db: Reader,
	id: string
): StockMovementRow | undefined {
	return db.select().from(stockMovement).where(eq(stockMovement.id, id)).get();
}

export function readReversalOf(
	db: Reader,
	movementId: string
): StockMovementRow | undefined {
	return db
		.select()
		.from(stockMovement)
		.where(eq(stockMovement.reversesMovementId, movementId))
		.get();
}

export function readTransferCounterpart(
	db: Reader,
	transferId: string,
	movementId: string
): StockMovementRow | undefined {
	return db
		.select()
		.from(stockMovement)
		.where(
			and(
				eq(stockMovement.transferId, transferId),
				ne(stockMovement.id, movementId)
			)
		)
		.get();
}

export function readStockBalancePoint(
	db: Reader,
	variantId: string,
	locationId: string,
	lotId: string | null
): StockBalanceRow | undefined {
	return db
		.select()
		.from(stockBalance)
		.where(eq(stockBalance.id, balancePointId(variantId, locationId, lotId)))
		.get();
}

function recordLocation(
	db: Executor,
	row: StockLocationRow,
	stamp: ChangeStamp
) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "stockLocation",
		data: stockLocationSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

function recordLot(db: Executor, row: StockLotRow, stamp: ChangeStamp) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "stockLot",
		data: stockLotSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

function recordMovement(
	db: Executor,
	row: StockMovementRow,
	stamp: ChangeStamp
) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "stockMovement",
		data: stockMovementSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

export function insertStockLocation(
	db: Executor,
	id: string,
	fields: StockLocationFields,
	stamp: ChangeStamp
): StockLocationRow {
	const row = db
		.insert(stockLocation)
		.values({
			...fields,
			createdAt: stamp.now,
			id,
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordLocation(db, row, stamp);
	return row;
}

export function updateStockLocation(
	db: Executor,
	current: StockLocationRow,
	patch: StockLocationPatch,
	stamp: ChangeStamp
): StockLocationRow {
	const next = db
		.update(stockLocation)
		.set({ ...patch, updatedAt: stamp.now, version: current.version + 1 })
		.where(
			and(
				eq(stockLocation.id, current.id),
				eq(stockLocation.version, current.version)
			)
		)
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Local mudou durante a operação",
		});
	}
	recordLocation(db, next, stamp);
	return next;
}

export function insertStockLot(
	db: Executor,
	id: string,
	fields: StockLotFields,
	stamp: ChangeStamp
): StockLotRow {
	const row = db
		.insert(stockLot)
		.values({
			...fields,
			createdAt: stamp.now,
			id,
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordLot(db, row, stamp);
	return row;
}

export function updateStockLot(
	db: Executor,
	current: StockLotRow,
	patch: StockLotPatch,
	stamp: ChangeStamp
): StockLotRow {
	const next = db
		.update(stockLot)
		.set({ ...patch, updatedAt: stamp.now, version: current.version + 1 })
		.where(
			and(eq(stockLot.id, current.id), eq(stockLot.version, current.version))
		)
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Lote mudou durante a operação",
		});
	}
	recordLot(db, next, stamp);
	return next;
}

function applyMovement(db: Executor, row: StockMovementRow, now: Date): void {
	db.insert(stockBalance)
		.values({
			id: balancePointId(row.variantId, row.locationId, row.lotId),
			locationId: row.locationId,
			lotId: row.lotId,
			quantityMicros: row.quantityMicros,
			updatedAt: now,
			valueCents: row.valueCents,
			variantId: row.variantId,
		})
		.onConflictDoUpdate({
			set: {
				quantityMicros: sql`${stockBalance.quantityMicros} + ${row.quantityMicros}`,
				updatedAt: now,
				valueCents: sql`${stockBalance.valueCents} + ${row.valueCents}`,
			},
			target: stockBalance.id,
		})
		.run();
}

export function insertStockMovement(
	db: Executor,
	id: string,
	fields: StockMovementFields,
	stamp: ChangeStamp
): StockMovementRow {
	const row = db
		.insert(stockMovement)
		.values({
			...fields,
			createdAt: stamp.now,
			id,
			quantityMicros: BigInt(fields.quantityMicros),
			valueCents: BigInt(fields.valueCents),
			version: 1,
		})
		.returning()
		.get();
	recordMovement(db, row, stamp);
	applyMovement(db, row, stamp.now);
	return row;
}

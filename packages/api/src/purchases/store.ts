import type { Database } from "@costura-pro/db";
import {
	obligation,
	type PurchaseItemRecord,
	purchase,
	purchaseReversal,
} from "@costura-pro/db/schema/purchases";
import { eq } from "drizzle-orm";

import { appendChange } from "../change-log";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";

export type PurchaseItem = PurchaseItemRecord;
export type PurchaseRow = typeof purchase.$inferSelect;
export type ObligationRow = typeof obligation.$inferSelect;
export type PurchaseReversalRow = typeof purchaseReversal.$inferSelect;

export type PurchaseSnapshot = {
	createdAt: string;
	discountCents: string;
	freightCents: string;
	grossCents: string;
	id: string;
	items: PurchaseItem[];
	notes: string | null;
	occurredOn: string;
	reference: string | null;
	supplierId: string;
	totalCents: string;
	version: number;
};

export type PurchaseFields = Omit<
	PurchaseSnapshot,
	"createdAt" | "id" | "version"
>;

export type ObligationSnapshot = {
	amountCents: string;
	createdAt: string;
	dueOn: string;
	id: string;
	kind: "purchase";
	purchaseId: string;
	version: number;
};

export type ObligationFields = Omit<
	ObligationSnapshot,
	"createdAt" | "id" | "kind" | "version"
>;

export type PurchaseReversalSnapshot = {
	createdAt: string;
	id: string;
	occurredOn: string;
	purchaseId: string;
	reason: string;
	version: number;
};

export type PurchaseReversalFields = Pick<
	PurchaseReversalSnapshot,
	"occurredOn" | "purchaseId" | "reason"
>;

type Reader = Pick<Database, "select">;

export function purchaseSnapshot(row: PurchaseRow): PurchaseSnapshot {
	return {
		createdAt: row.createdAt.toISOString(),
		discountCents: row.discountCents.toString(),
		freightCents: row.freightCents.toString(),
		grossCents: row.grossCents.toString(),
		id: row.id,
		items: row.items,
		notes: row.notes,
		occurredOn: row.occurredOn,
		reference: row.reference,
		supplierId: row.supplierId,
		totalCents: row.totalCents.toString(),
		version: row.version,
	};
}

export function obligationSnapshot(row: ObligationRow): ObligationSnapshot {
	return {
		amountCents: row.amountCents.toString(),
		createdAt: row.createdAt.toISOString(),
		dueOn: row.dueOn,
		id: row.id,
		kind: row.kind,
		purchaseId: row.purchaseId,
		version: row.version,
	};
}

export function purchaseReversalSnapshot(
	row: PurchaseReversalRow
): PurchaseReversalSnapshot {
	return {
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		occurredOn: row.occurredOn,
		purchaseId: row.purchaseId,
		reason: row.reason,
		version: row.version,
	};
}

export function readPurchase(db: Reader, id: string): PurchaseRow | undefined {
	return db.select().from(purchase).where(eq(purchase.id, id)).get();
}

export function readObligation(
	db: Reader,
	id: string
): ObligationRow | undefined {
	return db.select().from(obligation).where(eq(obligation.id, id)).get();
}

export function readObligationOfPurchase(
	db: Reader,
	purchaseId: string
): ObligationRow | undefined {
	return db
		.select()
		.from(obligation)
		.where(eq(obligation.purchaseId, purchaseId))
		.get();
}

export function readPurchaseReversal(
	db: Reader,
	id: string
): PurchaseReversalRow | undefined {
	return db
		.select()
		.from(purchaseReversal)
		.where(eq(purchaseReversal.id, id))
		.get();
}

export function readReversalOfPurchase(
	db: Reader,
	purchaseId: string
): PurchaseReversalRow | undefined {
	return db
		.select()
		.from(purchaseReversal)
		.where(eq(purchaseReversal.purchaseId, purchaseId))
		.get();
}

export function insertPurchase(
	db: Executor,
	id: string,
	fields: PurchaseFields,
	stamp: ChangeStamp
): PurchaseRow {
	const row = db
		.insert(purchase)
		.values({
			...fields,
			createdAt: stamp.now,
			discountCents: BigInt(fields.discountCents),
			freightCents: BigInt(fields.freightCents),
			grossCents: BigInt(fields.grossCents),
			id,
			totalCents: BigInt(fields.totalCents),
			version: 1,
		})
		.returning()
		.get();
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "purchase",
		data: purchaseSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
	return row;
}

export function insertObligation(
	db: Executor,
	id: string,
	fields: ObligationFields,
	stamp: ChangeStamp
): ObligationRow {
	const row = db
		.insert(obligation)
		.values({
			amountCents: BigInt(fields.amountCents),
			createdAt: stamp.now,
			dueOn: fields.dueOn,
			id,
			kind: "purchase",
			purchaseId: fields.purchaseId,
			version: 1,
		})
		.returning()
		.get();
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "obligation",
		data: obligationSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
	return row;
}

export function insertPurchaseReversal(
	db: Executor,
	id: string,
	fields: PurchaseReversalFields,
	stamp: ChangeStamp
): PurchaseReversalRow {
	const row = db
		.insert(purchaseReversal)
		.values({ ...fields, createdAt: stamp.now, id, version: 1 })
		.returning()
		.get();
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "purchaseReversal",
		data: purchaseReversalSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
	return row;
}

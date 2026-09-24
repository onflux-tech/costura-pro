import type { Database } from "@costura-pro/db";
import { receivable } from "@costura-pro/db/schema/service-orders";
import { eq } from "drizzle-orm";

import { appendChange } from "../change-log";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";

type Reader = Pick<Database, "select">;

export type ReceivableRow = typeof receivable.$inferSelect;

export type ReceivableSnapshot = {
	amountCents: string;
	clientId: string;
	createdAt: string;
	id: string;
	kind: "serviceOrder";
	occurredOn: string;
	serviceOrderId: string | null;
	version: number;
};

export function receivableSnapshot(row: ReceivableRow): ReceivableSnapshot {
	return {
		amountCents: row.amountCents.toString(),
		clientId: row.clientId,
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		kind: row.kind,
		occurredOn: row.occurredOn,
		serviceOrderId: row.serviceOrderId,
		version: row.version,
	};
}

export function readReceivable(
	db: Reader,
	id: string
): ReceivableRow | undefined {
	return db.select().from(receivable).where(eq(receivable.id, id)).get();
}

export function readReceivableOfServiceOrder(
	db: Reader,
	serviceOrderId: string
): ReceivableRow | undefined {
	return db
		.select()
		.from(receivable)
		.where(eq(receivable.serviceOrderId, serviceOrderId))
		.get();
}

export function insertReceivable(
	db: Executor,
	id: string,
	fields: Omit<ReceivableSnapshot, "createdAt" | "id" | "version">,
	stamp: ChangeStamp
): ReceivableRow {
	const row = db
		.insert(receivable)
		.values({
			...fields,
			amountCents: BigInt(fields.amountCents),
			createdAt: stamp.now,
			id,
			version: 1,
		})
		.returning()
		.get();
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "receivable",
		data: receivableSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
	return row;
}

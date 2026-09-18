import type { Database } from "@costura-pro/db";
import {
	financialAccount,
	financialMovement,
} from "@costura-pro/db/schema/finance";
import type {
	FinancialAccountKind,
	FinancialMovementKind,
} from "@costura-pro/domain/finance";
import { ORPCError } from "@orpc/server";
import { and, eq, ne, sql } from "drizzle-orm";

import { appendChange } from "../change-log";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";

export type FinancialAccountRow = typeof financialAccount.$inferSelect;
export type FinancialMovementRow = typeof financialMovement.$inferSelect;

export type FinancialAccountFields = Pick<
	FinancialAccountRow,
	"kind" | "name" | "notes"
>;

export type FinancialAccountPatch = Partial<
	FinancialAccountFields & Pick<FinancialAccountRow, "archivedAt">
>;

export type FinancialAccountSnapshot = {
	archivedAt: string | null;
	createdAt: string;
	id: string;
	kind: FinancialAccountKind;
	name: string;
	notes: string | null;
	version: number;
};

export type FinancialMovementSnapshot = {
	accountId: string;
	amountCents: string;
	createdAt: string;
	id: string;
	kind: FinancialMovementKind;
	obligationId: string | null;
	occurredOn: string;
	reason: string | null;
	reversesMovementId: string | null;
	transferId: string | null;
	version: number;
};

export type FinancialMovementFields = Omit<
	FinancialMovementSnapshot,
	"createdAt" | "id" | "version"
>;

type Reader = Pick<Database, "select">;

export function financialAccountSnapshot(
	row: FinancialAccountRow
): FinancialAccountSnapshot {
	return {
		archivedAt: row.archivedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		kind: row.kind,
		name: row.name,
		notes: row.notes,
		version: row.version,
	};
}

export function financialMovementSnapshot(
	row: FinancialMovementRow
): FinancialMovementSnapshot {
	return {
		accountId: row.accountId,
		amountCents: row.amountCents.toString(),
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		kind: row.kind,
		obligationId: row.obligationId,
		occurredOn: row.occurredOn,
		reason: row.reason,
		reversesMovementId: row.reversesMovementId,
		transferId: row.transferId,
		version: row.version,
	};
}

export function readFinancialAccount(
	db: Reader,
	id: string
): FinancialAccountRow | undefined {
	return db
		.select()
		.from(financialAccount)
		.where(eq(financialAccount.id, id))
		.get();
}

export function readFinancialMovement(
	db: Reader,
	id: string
): FinancialMovementRow | undefined {
	return db
		.select()
		.from(financialMovement)
		.where(eq(financialMovement.id, id))
		.get();
}

export function readFinancialReversalOf(
	db: Reader,
	movementId: string
): FinancialMovementRow | undefined {
	return db
		.select()
		.from(financialMovement)
		.where(eq(financialMovement.reversesMovementId, movementId))
		.get();
}

export function readFinancialTransferCounterpart(
	db: Reader,
	transferId: string,
	movementId: string
): FinancialMovementRow | undefined {
	return db
		.select()
		.from(financialMovement)
		.where(
			and(
				eq(financialMovement.transferId, transferId),
				ne(financialMovement.id, movementId)
			)
		)
		.get();
}

export const notReversed = sql`NOT EXISTS (SELECT 1 FROM financial_movement AS reversal WHERE reversal.reverses_movement_id = "financial_movement"."id")`;

export function readActiveObligationPayment(
	db: Reader,
	obligationId: string
): FinancialMovementRow | undefined {
	return db
		.select()
		.from(financialMovement)
		.where(
			and(
				eq(financialMovement.obligationId, obligationId),
				eq(financialMovement.kind, "obligationPayment"),
				notReversed
			)
		)
		.get();
}

function recordAccount(
	db: Executor,
	row: FinancialAccountRow,
	stamp: ChangeStamp
) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "financialAccount",
		data: financialAccountSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

export function insertFinancialAccount(
	db: Executor,
	id: string,
	fields: FinancialAccountFields,
	stamp: ChangeStamp
): FinancialAccountRow {
	const row = db
		.insert(financialAccount)
		.values({
			...fields,
			createdAt: stamp.now,
			id,
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordAccount(db, row, stamp);
	return row;
}

export function updateFinancialAccount(
	db: Executor,
	current: FinancialAccountRow,
	patch: FinancialAccountPatch,
	stamp: ChangeStamp
): FinancialAccountRow {
	const next = db
		.update(financialAccount)
		.set({ ...patch, updatedAt: stamp.now, version: current.version + 1 })
		.where(
			and(
				eq(financialAccount.id, current.id),
				eq(financialAccount.version, current.version)
			)
		)
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Conta mudou durante a operação",
		});
	}
	recordAccount(db, next, stamp);
	return next;
}

export function insertFinancialMovement(
	db: Executor,
	id: string,
	fields: FinancialMovementFields,
	stamp: ChangeStamp
): FinancialMovementRow {
	const row = db
		.insert(financialMovement)
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
		aggregateType: "financialMovement",
		data: financialMovementSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
	return row;
}

export function financialReversalFields(
	original: FinancialMovementRow,
	occurredOn: string,
	reason: string,
	transferId: string | null
): FinancialMovementFields {
	return {
		accountId: original.accountId,
		amountCents: (-original.amountCents).toString(),
		kind: "reversal",
		obligationId: original.obligationId,
		occurredOn,
		reason,
		reversesMovementId: original.id,
		transferId,
	};
}

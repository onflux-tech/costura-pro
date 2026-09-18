import type { Database } from "@costura-pro/db";
import {
	financialAccount,
	financialMovement,
} from "@costura-pro/db/schema/finance";
import {
	obligation,
	purchase,
	supplier,
} from "@costura-pro/db/schema/purchases";
import { asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import {
	type FinancialAccountSnapshot,
	type FinancialMovementSnapshot,
	financialAccountSnapshot,
	financialMovementSnapshot,
} from "./store";

export const financialMovementPageSize = 200;

type Reader = Pick<Database, "select">;

export type FinancialAccountListItem = FinancialAccountSnapshot & {
	balanceCents: string;
	updatedAt: string;
};

export function listFinancialAccounts(
	db: Reader,
	archived: boolean
): { items: FinancialAccountListItem[] } {
	return {
		items: db
			.select({
				account: financialAccount,
				balanceCents: sql<string>`cast(coalesce((SELECT sum(movement.amount_cents) FROM financial_movement AS movement WHERE movement.account_id = "financial_account"."id"), 0) as text)`,
			})
			.from(financialAccount)
			.where(
				archived
					? isNotNull(financialAccount.archivedAt)
					: isNull(financialAccount.archivedAt)
			)
			.orderBy(asc(financialAccount.name), asc(financialAccount.id))
			.all()
			.map((row) => ({
				...financialAccountSnapshot(row.account),
				balanceCents: row.balanceCents,
				updatedAt: row.account.updatedAt.toISOString(),
			})),
	};
}

export type FinancialMovementListItem = FinancialMovementSnapshot & {
	purchaseId: string | null;
	purchaseReference: string | null;
	reversedByMovementId: string | null;
	supplierName: string | null;
};

export function listFinancialMovements(
	db: Reader,
	accountId: string
): { items: FinancialMovementListItem[] } {
	return {
		items: db
			.select({
				movement: financialMovement,
				purchaseId: purchase.id,
				purchaseReference: purchase.reference,
				reversedByMovementId: sql<
					string | null
				>`(SELECT reversal.id FROM financial_movement AS reversal WHERE reversal.reverses_movement_id = "financial_movement"."id")`,
				supplierName: supplier.name,
			})
			.from(financialMovement)
			.leftJoin(obligation, eq(obligation.id, financialMovement.obligationId))
			.leftJoin(purchase, eq(purchase.id, obligation.purchaseId))
			.leftJoin(supplier, eq(supplier.id, purchase.supplierId))
			.where(eq(financialMovement.accountId, accountId))
			.orderBy(
				desc(financialMovement.occurredOn),
				desc(financialMovement.createdAt),
				desc(financialMovement.id)
			)
			.limit(financialMovementPageSize)
			.all()
			.map((row) => ({
				...financialMovementSnapshot(row.movement),
				purchaseId: row.purchaseId,
				purchaseReference: row.purchaseReference,
				reversedByMovementId: row.reversedByMovementId,
				supplierName: row.supplierName,
			})),
	};
}

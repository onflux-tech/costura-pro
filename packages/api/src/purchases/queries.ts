import type { Database } from "@costura-pro/db";
import {
	financialAccount,
	financialMovement,
} from "@costura-pro/db/schema/finance";
import { material, materialVariant } from "@costura-pro/db/schema/materials";
import {
	obligation,
	purchase,
	supplier,
} from "@costura-pro/db/schema/purchases";
import { stockLocation, stockLot } from "@costura-pro/db/schema/stock";
import {
	type ObligationStatus,
	obligationStatus,
	obligationStatuses,
} from "@costura-pro/domain/finance";
import { searchTokens } from "@costura-pro/domain/search";
import type { BaseUnitCode } from "@costura-pro/domain/unit";
import { ORPCError } from "@orpc/server";
import {
	and,
	asc,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	not,
	type SQL,
	sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import z from "zod";

import { commandMessages } from "../command-messages";
import { notReversed } from "../finance/store";
import { containing } from "../search";
import {
	type PurchaseItem,
	type PurchaseSnapshot,
	purchaseSnapshot,
	readObligationOfPurchase,
	readPurchase,
	readReversalOfPurchase,
} from "./store";
import { type SupplierSnapshot, supplierSnapshot } from "./supplier-store";

export const purchasePageSize = 50;

type Reader = Pick<Database, "select">;

export const supplierListInput = z.object({
	archived: z.boolean().default(false),
	offset: z.number().int().nonnegative().default(0),
	query: z.string().max(100).optional(),
});

export function listSuppliers(
	db: Reader,
	{ archived, offset, query }: z.output<typeof supplierListInput>
): {
	items: (SupplierSnapshot & { updatedAt: string })[];
	nextOffset: number | null;
} {
	const rows = db
		.select()
		.from(supplier)
		.where(
			and(
				archived ? isNotNull(supplier.archivedAt) : isNull(supplier.archivedAt),
				...searchTokens(query ?? "").map(
					(token) =>
						sql`${supplier.searchText} LIKE ${containing(token)} ESCAPE '\\'`
				)
			)
		)
		.orderBy(asc(supplier.searchText), asc(supplier.id))
		.limit(purchasePageSize + 1)
		.offset(offset)
		.all();
	return {
		items: rows.slice(0, purchasePageSize).map((row) => ({
			...supplierSnapshot(row),
			updatedAt: row.updatedAt.toISOString(),
		})),
		nextOffset:
			rows.length > purchasePageSize ? offset + purchasePageSize : null,
	};
}

export type SupplierOption = {
	archivedAt: string | null;
	id: string;
	name: string;
};

export function listSupplierOptions(db: Reader): { items: SupplierOption[] } {
	return {
		items: db
			.select({
				archivedAt: supplier.archivedAt,
				id: supplier.id,
				name: supplier.name,
			})
			.from(supplier)
			.orderBy(asc(supplier.searchText), asc(supplier.id))
			.all()
			.map((row) => ({
				...row,
				archivedAt: row.archivedAt?.toISOString() ?? null,
			})),
	};
}

const purchaseReversed = sql<number>`EXISTS (SELECT 1 FROM purchase_reversal AS reversal WHERE reversal.purchase_id = "obligation"."purchase_id")`;

const obligationPaid = sql<number>`EXISTS (SELECT 1 FROM financial_movement AS payment WHERE payment.obligation_id = "obligation"."id" AND payment.kind = 'obligationPayment' AND NOT EXISTS (SELECT 1 FROM financial_movement AS undo WHERE undo.reverses_movement_id = payment.id))`;

function statusOf(row: { paid: number; reversed: number }): ObligationStatus {
	return obligationStatus({
		paid: Boolean(row.paid),
		reversed: Boolean(row.reversed),
	});
}

const purchaseStatusOf: Record<ObligationStatus, PurchaseStatus> = {
	cancelled: "reversed",
	open: "open",
	paid: "paid",
};

export type PurchaseStatus = "open" | "paid" | "reversed";

export const purchaseListInput = z.object({
	offset: z.number().int().nonnegative().default(0),
	supplierId: z.uuid().optional(),
});

export type PurchaseListItem = {
	dueOn: string;
	id: string;
	itemCount: number;
	occurredOn: string;
	reference: string | null;
	status: PurchaseStatus;
	supplierId: string;
	supplierName: string;
	totalCents: string;
};

export function listPurchases(
	db: Reader,
	{ offset, supplierId }: z.output<typeof purchaseListInput>
): { items: PurchaseListItem[]; nextOffset: number | null } {
	const rows = db
		.select({
			dueOn: obligation.dueOn,
			id: purchase.id,
			itemCount: sql<number>`json_array_length(${purchase.items})`,
			occurredOn: purchase.occurredOn,
			paid: obligationPaid,
			reference: purchase.reference,
			reversed: purchaseReversed,
			supplierId: purchase.supplierId,
			supplierName: supplier.name,
			totalCents: purchase.totalCents,
		})
		.from(purchase)
		.innerJoin(supplier, eq(supplier.id, purchase.supplierId))
		.innerJoin(obligation, eq(obligation.purchaseId, purchase.id))
		.where(
			supplierId === undefined ? undefined : eq(purchase.supplierId, supplierId)
		)
		.orderBy(
			desc(purchase.occurredOn),
			desc(purchase.createdAt),
			desc(purchase.id)
		)
		.limit(purchasePageSize + 1)
		.offset(offset)
		.all();
	return {
		items: rows
			.slice(0, purchasePageSize)
			.map(({ paid, reversed, ...row }) => ({
				...row,
				status: purchaseStatusOf[statusOf({ paid, reversed })],
				totalCents: row.totalCents.toString(),
			})),
		nextOffset:
			rows.length > purchasePageSize ? offset + purchasePageSize : null,
	};
}

export type PurchaseDetailItem = PurchaseItem & {
	baseUnit: BaseUnitCode;
	displayPrecision: number;
	locationName: string;
	lotLabel: string | null;
	materialName: string;
	variantName: string;
};

export type PurchasePayment = {
	accountId: string;
	accountName: string;
	movementId: string;
	occurredOn: string;
};

export type PurchaseDetail = {
	items: PurchaseDetailItem[];
	obligation: {
		amountCents: string;
		dueOn: string;
		id: string;
		payment: PurchasePayment | null;
		status: ObligationStatus;
	};
	purchase: PurchaseSnapshot & { supplierName: string };
	reversal: {
		createdAt: string;
		id: string;
		occurredOn: string;
		reason: string;
	} | null;
};

function activePayment(
	db: Reader,
	obligationId: string
): PurchasePayment | null {
	return (
		db
			.select({
				accountId: financialMovement.accountId,
				accountName: financialAccount.name,
				movementId: financialMovement.id,
				occurredOn: financialMovement.occurredOn,
			})
			.from(financialMovement)
			.innerJoin(
				financialAccount,
				eq(financialAccount.id, financialMovement.accountId)
			)
			.where(
				and(
					eq(financialMovement.obligationId, obligationId),
					eq(financialMovement.kind, "obligationPayment"),
					notReversed
				)
			)
			.get() ?? null
	);
}

function detailedItems(
	db: Reader,
	items: PurchaseItem[]
): PurchaseDetailItem[] {
	const variantIds = [...new Set(items.map((item) => item.variantId))];
	const locationIds = [...new Set(items.map((item) => item.locationId))];
	const lotIds = [
		...new Set(
			items.flatMap((item) => (item.lotId === null ? [] : [item.lotId]))
		),
	];
	const variants = new Map(
		db
			.select({
				baseUnit: materialVariant.baseUnit,
				displayPrecision: materialVariant.displayPrecision,
				id: materialVariant.id,
				materialName: material.name,
				variantName: materialVariant.name,
			})
			.from(materialVariant)
			.innerJoin(material, eq(material.id, materialVariant.materialId))
			.where(inArray(materialVariant.id, variantIds))
			.all()
			.map((row) => [row.id, row])
	);
	const locations = new Map(
		db
			.select({ id: stockLocation.id, name: stockLocation.name })
			.from(stockLocation)
			.where(inArray(stockLocation.id, locationIds))
			.all()
			.map((row) => [row.id, row.name])
	);
	const lots = new Map(
		lotIds.length === 0
			? []
			: db
					.select({ id: stockLot.id, label: stockLot.label })
					.from(stockLot)
					.where(inArray(stockLot.id, lotIds))
					.all()
					.map((row) => [row.id, row.label])
	);
	return items.map((item) => {
		const variant = variants.get(item.variantId);
		return {
			...item,
			baseUnit: variant?.baseUnit ?? "un",
			displayPrecision: variant?.displayPrecision ?? 0,
			locationName: locations.get(item.locationId) ?? "",
			lotLabel: item.lotId === null ? null : (lots.get(item.lotId) ?? null),
			materialName: variant?.materialName ?? "",
			variantName: variant?.variantName ?? "",
		};
	});
}

export function getPurchase(db: Reader, purchaseId: string): PurchaseDetail {
	const row = readPurchase(db, purchaseId);
	const due = row ? readObligationOfPurchase(db, row.id) : undefined;
	if (!(row && due)) {
		throw new ORPCError("NOT_FOUND", {
			message: commandMessages.purchaseNotFound,
		});
	}
	const reversal = readReversalOfPurchase(db, row.id);
	const payment = activePayment(db, due.id);
	const supplierRow = db
		.select({ name: supplier.name })
		.from(supplier)
		.where(eq(supplier.id, row.supplierId))
		.get();
	return {
		items: detailedItems(db, row.items),
		obligation: {
			amountCents: due.amountCents.toString(),
			dueOn: due.dueOn,
			id: due.id,
			payment,
			status: obligationStatus({
				paid: payment !== null,
				reversed: reversal !== undefined,
			}),
		},
		purchase: {
			...purchaseSnapshot(row),
			supplierName: supplierRow?.name ?? "",
		},
		reversal: reversal
			? {
					createdAt: reversal.createdAt.toISOString(),
					id: reversal.id,
					occurredOn: reversal.occurredOn,
					reason: reversal.reason,
				}
			: null,
	};
}

export const obligationListInput = z.object({
	offset: z.number().int().nonnegative().default(0),
	status: z.enum(obligationStatuses).default("open"),
});

export type ObligationListItem = {
	amountCents: string;
	dueOn: string;
	id: string;
	paidAccountName: string | null;
	paidOn: string | null;
	paymentMovementId: string | null;
	purchaseId: string;
	purchaseOccurredOn: string;
	reference: string | null;
	status: ObligationStatus;
	supplierId: string;
	supplierName: string;
};

const statusFilter: Record<ObligationStatus, SQL> = {
	cancelled: purchaseReversed,
	open: and(not(purchaseReversed), not(obligationPaid)) as SQL,
	paid: and(not(purchaseReversed), obligationPaid) as SQL,
};

const payment = alias(financialMovement, "payment");

const paymentAccount = alias(financialAccount, "payment_account");

export function listObligations(
	db: Reader,
	{ offset, status }: z.output<typeof obligationListInput>
): { items: ObligationListItem[]; nextOffset: number | null } {
	const order =
		status === "open"
			? [asc(obligation.dueOn), asc(obligation.id)]
			: [desc(obligation.dueOn), desc(obligation.id)];
	const rows = db
		.select({
			amountCents: obligation.amountCents,
			dueOn: obligation.dueOn,
			id: obligation.id,
			paidAccountName: paymentAccount.name,
			paidOn: payment.occurredOn,
			paymentMovementId: payment.id,
			purchaseId: purchase.id,
			purchaseOccurredOn: purchase.occurredOn,
			reference: purchase.reference,
			reversed: purchaseReversed,
			supplierId: supplier.id,
			supplierName: supplier.name,
		})
		.from(obligation)
		.innerJoin(purchase, eq(purchase.id, obligation.purchaseId))
		.innerJoin(supplier, eq(supplier.id, purchase.supplierId))
		.leftJoin(
			payment,
			and(
				eq(payment.obligationId, obligation.id),
				eq(payment.kind, "obligationPayment"),
				sql`NOT EXISTS (SELECT 1 FROM financial_movement AS undo WHERE undo.reverses_movement_id = "payment"."id")`
			)
		)
		.leftJoin(paymentAccount, eq(paymentAccount.id, payment.accountId))
		.where(statusFilter[status])
		.orderBy(...order)
		.limit(purchasePageSize + 1)
		.offset(offset)
		.all();
	return {
		items: rows.slice(0, purchasePageSize).map(({ reversed, ...row }) => ({
			...row,
			amountCents: row.amountCents.toString(),
			status: obligationStatus({
				paid: row.paymentMovementId !== null,
				reversed: Boolean(reversed),
			}),
		})),
		nextOffset:
			rows.length > purchasePageSize ? offset + purchasePageSize : null,
	};
}

import type { Database } from "@costura-pro/db";
import {
	serviceOrder,
	serviceOrderItem,
	stockReservation,
} from "@costura-pro/db/schema/service-orders";
import { stockBalance } from "@costura-pro/db/schema/stock";
import { and, asc, eq, inArray, ne, type SQL, sql } from "drizzle-orm";

import { appendChange } from "../change-log";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";
import { itemTitle } from "../service-orders/store";

type Reader = Pick<Database, "select">;

export type StockReservationRow = typeof stockReservation.$inferSelect;

export type StockReservationSnapshot = {
	createdAt: string;
	id: string;
	kind: "approval";
	occurredOn: string;
	quantityMicros: string;
	serviceOrderItemId: string;
	variantId: string;
	version: number;
};

export function stockReservationSnapshot(
	row: StockReservationRow
): StockReservationSnapshot {
	return {
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		kind: row.kind,
		occurredOn: row.occurredOn,
		quantityMicros: row.quantityMicros.toString(),
		serviceOrderItemId: row.serviceOrderItemId,
		variantId: row.variantId,
		version: row.version,
	};
}

export function readStockReservation(
	db: Reader,
	id: string
): StockReservationRow | undefined {
	return db
		.select()
		.from(stockReservation)
		.where(eq(stockReservation.id, id))
		.get();
}

export function insertStockReservation(
	db: Executor,
	id: string,
	fields: Omit<StockReservationSnapshot, "createdAt" | "id" | "version">,
	stamp: ChangeStamp
): StockReservationRow {
	const row = db
		.insert(stockReservation)
		.values({
			...fields,
			createdAt: stamp.now,
			id,
			quantityMicros: BigInt(fields.quantityMicros),
			version: 1,
		})
		.returning()
		.get();
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "stockReservation",
		data: stockReservationSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
	return row;
}

export function unreleasedReservation(alias: string): SQL {
	return sql.raw(
		`NOT EXISTS (SELECT 1 FROM material_reconciliation AS rec WHERE rec.service_order_item_id = ${alias}.service_order_item_id AND NOT EXISTS (SELECT 1 FROM material_reconciliation_reversal AS rev WHERE rev.reconciliation_id = rec.id))`
	);
}

function sumsBy(
	rows: readonly { total: string | null; variantId: string }[]
): Map<string, bigint> {
	return new Map(rows.map((row) => [row.variantId, BigInt(row.total ?? "0")]));
}

export function physicalByVariant(
	db: Reader,
	variantIds: readonly string[]
): Map<string, bigint> {
	if (variantIds.length === 0) {
		return new Map();
	}
	return sumsBy(
		db
			.select({
				total: sql<
					string | null
				>`cast(sum(${stockBalance.quantityMicros}) as text)`,
				variantId: stockBalance.variantId,
			})
			.from(stockBalance)
			.where(inArray(stockBalance.variantId, [...variantIds]))
			.groupBy(stockBalance.variantId)
			.all()
	);
}

export function reservedByVariant(
	db: Reader,
	variantIds: readonly string[]
): Map<string, bigint> {
	if (variantIds.length === 0) {
		return new Map();
	}
	return sumsBy(
		db
			.select({
				total: sql<
					string | null
				>`cast(sum(${stockReservation.quantityMicros}) as text)`,
				variantId: stockReservation.variantId,
			})
			.from(stockReservation)
			.where(
				and(
					inArray(stockReservation.variantId, [...variantIds]),
					unreleasedReservation("stock_reservation")
				)
			)
			.groupBy(stockReservation.variantId)
			.all()
	);
}

export function reservationsOfItems(
	db: Reader,
	itemIds: readonly string[]
): { itemId: string; reservedMicros: string; variantId: string }[] {
	if (itemIds.length === 0) {
		return [];
	}
	return db
		.select({
			itemId: stockReservation.serviceOrderItemId,
			reservedMicros: sql<string>`cast(sum(${stockReservation.quantityMicros}) as text)`,
			variantId: stockReservation.variantId,
		})
		.from(stockReservation)
		.where(inArray(stockReservation.serviceOrderItemId, [...itemIds]))
		.groupBy(stockReservation.serviceOrderItemId, stockReservation.variantId)
		.all();
}

export type VariantReservation = {
	code: string;
	itemId: string;
	itemTitle: string;
	reservedMicros: string;
	serviceOrderId: string;
};

export function reservationsOfVariant(
	db: Reader,
	variantId: string
): VariantReservation[] {
	const reserved = sql<string>`cast(sum(${stockReservation.quantityMicros}) as text)`;
	return db
		.select({
			code: serviceOrder.code,
			itemId: serviceOrderItem.id,
			line: serviceOrderItem.line,
			reservedMicros: reserved,
			serviceOrderId: serviceOrder.id,
		})
		.from(stockReservation)
		.innerJoin(
			serviceOrderItem,
			eq(serviceOrderItem.id, stockReservation.serviceOrderItemId)
		)
		.innerJoin(
			serviceOrder,
			eq(serviceOrder.id, serviceOrderItem.serviceOrderId)
		)
		.where(
			and(
				eq(stockReservation.variantId, variantId),
				unreleasedReservation("stock_reservation")
			)
		)
		.groupBy(stockReservation.serviceOrderItemId)
		.having(ne(sql`sum(${stockReservation.quantityMicros})`, 0))
		.orderBy(asc(serviceOrder.code), asc(serviceOrderItem.position))
		.all()
		.map(({ line, ...row }) => ({ ...row, itemTitle: itemTitle(line) }));
}

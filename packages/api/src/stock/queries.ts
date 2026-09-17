import type { Database } from "@costura-pro/db";
import { material, materialVariant } from "@costura-pro/db/schema/materials";
import {
	stockBalance,
	stockLocation,
	stockLot,
	stockMovement,
} from "@costura-pro/db/schema/stock";
import { searchTokens } from "@costura-pro/domain/client";
import type { BaseUnitCode } from "@costura-pro/domain/unit";
import {
	and,
	asc,
	desc,
	eq,
	isNotNull,
	isNull,
	ne,
	or,
	sql,
} from "drizzle-orm";
import z from "zod";

import {
	type StockLocationSnapshot,
	type StockLotSnapshot,
	type StockMovementSnapshot,
	stockLocationSnapshot,
	stockLotSnapshot,
	stockMovementSnapshot,
} from "./store";

export const stockPageSize = 50;

export const stockBalanceListInput = z.object({
	locationId: z.uuid().optional(),
	offset: z.number().int().nonnegative().default(0),
	query: z.string().max(100).optional(),
});

export type StockBalanceListItem = {
	baseUnit: BaseUnitCode;
	code: string | null;
	displayPrecision: number;
	materialId: string;
	materialName: string;
	quantityMicros: string;
	referenceCostCents: string | null;
	tracksLots: boolean;
	valueCents: string;
	variantId: string;
	variantName: string;
};

export type StockBalancePoint = {
	locationId: string;
	locationName: string;
	lotId: string | null;
	lotLabel: string | null;
	quantityMicros: string;
	valueCents: string;
};

type Reader = Pick<Database, "select" | "selectDistinct">;

const likeSpecial = /[\\%_]/g;

function containing(token: string): string {
	return `%${token.replace(likeSpecial, (character) => `\\${character}`)}%`;
}

export function listStockBalances(
	db: Reader,
	{ locationId, offset, query }: z.output<typeof stockBalanceListInput>
): { items: StockBalanceListItem[]; nextOffset: number | null } {
	const filters = [
		...(locationId === undefined
			? []
			: [eq(stockBalance.locationId, locationId)]),
		...searchTokens(query ?? "").map((token) =>
			or(
				sql`${material.searchText} LIKE ${containing(token)} ESCAPE '\\'`,
				sql`${materialVariant.searchText} LIKE ${containing(token)} ESCAPE '\\'`
			)
		),
	];
	const rows = db
		.select({
			baseUnit: materialVariant.baseUnit,
			code: materialVariant.code,
			displayPrecision: materialVariant.displayPrecision,
			materialId: material.id,
			materialName: material.name,
			quantityMicros: sql<string>`sum(${stockBalance.quantityMicros})`,
			referenceCostCents: materialVariant.referenceCostCents,
			searchText: materialVariant.searchText,
			tracksLots: materialVariant.tracksLots,
			valueCents: sql<string>`sum(${stockBalance.valueCents})`,
			variantId: materialVariant.id,
			variantName: materialVariant.name,
		})
		.from(stockBalance)
		.innerJoin(materialVariant, eq(materialVariant.id, stockBalance.variantId))
		.innerJoin(material, eq(material.id, materialVariant.materialId))
		.where(and(...filters))
		.groupBy(materialVariant.id)
		.having(
			or(
				ne(sql`sum(${stockBalance.quantityMicros})`, 0),
				ne(sql`sum(${stockBalance.valueCents})`, 0)
			)
		)
		.orderBy(asc(materialVariant.searchText), asc(materialVariant.id))
		.limit(stockPageSize + 1)
		.offset(offset)
		.all();
	return {
		items: rows.slice(0, stockPageSize).map(({ searchText, ...row }) => ({
			...row,
			quantityMicros: String(row.quantityMicros),
			referenceCostCents: row.referenceCostCents?.toString() ?? null,
			valueCents: String(row.valueCents),
		})),
		nextOffset: rows.length > stockPageSize ? offset + stockPageSize : null,
	};
}

export function getVariantBalance(
	db: Reader,
	variantId: string
): { points: StockBalancePoint[] } {
	return {
		points: db
			.select({
				locationId: stockBalance.locationId,
				locationName: stockLocation.name,
				lotId: stockBalance.lotId,
				lotLabel: stockLot.label,
				quantityMicros: stockBalance.quantityMicros,
				valueCents: stockBalance.valueCents,
			})
			.from(stockBalance)
			.innerJoin(stockLocation, eq(stockLocation.id, stockBalance.locationId))
			.leftJoin(stockLot, eq(stockLot.id, stockBalance.lotId))
			.where(
				and(
					eq(stockBalance.variantId, variantId),
					or(
						ne(stockBalance.quantityMicros, 0n),
						ne(stockBalance.valueCents, 0n)
					)
				)
			)
			.orderBy(asc(stockLocation.name), asc(stockBalance.id))
			.all()
			.map((row) => ({
				...row,
				quantityMicros: row.quantityMicros.toString(),
				valueCents: row.valueCents.toString(),
			})),
	};
}

export type StockMovementListItem = StockMovementSnapshot & {
	locationName: string;
	lotLabel: string | null;
	reversedByMovementId: string | null;
};

export function listStockMovements(
	db: Reader,
	variantId: string
): { items: StockMovementListItem[] } {
	return {
		items: db
			.select({
				locationName: stockLocation.name,
				lotLabel: stockLot.label,
				movement: stockMovement,
				reversedByMovementId: sql<
					string | null
				>`(SELECT reversal.id FROM stock_movement AS reversal WHERE reversal.reverses_movement_id = "stock_movement"."id")`,
			})
			.from(stockMovement)
			.innerJoin(stockLocation, eq(stockLocation.id, stockMovement.locationId))
			.leftJoin(stockLot, eq(stockLot.id, stockMovement.lotId))
			.where(eq(stockMovement.variantId, variantId))
			.orderBy(
				desc(stockMovement.occurredOn),
				desc(stockMovement.createdAt),
				desc(stockMovement.id)
			)
			.all()
			.map((row) => ({
				...stockMovementSnapshot(row.movement),
				locationName: row.locationName,
				lotLabel: row.lotLabel,
				reversedByMovementId: row.reversedByMovementId,
			})),
	};
}

export function listStockLocations(
	db: Reader,
	archived: boolean
): { items: (StockLocationSnapshot & { updatedAt: string })[] } {
	return {
		items: db
			.select()
			.from(stockLocation)
			.where(
				archived
					? isNotNull(stockLocation.archivedAt)
					: isNull(stockLocation.archivedAt)
			)
			.orderBy(asc(stockLocation.name), asc(stockLocation.id))
			.all()
			.map((row) => ({
				...stockLocationSnapshot(row),
				updatedAt: row.updatedAt.toISOString(),
			})),
	};
}

export function listStockLots(
	db: Reader,
	variantId: string,
	archived: boolean
): { items: (StockLotSnapshot & { updatedAt: string })[] } {
	return {
		items: db
			.select()
			.from(stockLot)
			.where(
				and(
					eq(stockLot.variantId, variantId),
					archived
						? isNotNull(stockLot.archivedAt)
						: isNull(stockLot.archivedAt)
				)
			)
			.orderBy(asc(stockLot.label), asc(stockLot.id))
			.all()
			.map((row) => ({
				...stockLotSnapshot(row),
				updatedAt: row.updatedAt.toISOString(),
			})),
	};
}

export function variantBalanceTotals(
	db: Reader,
	materialId: string
): Map<string, { quantityMicros: string; valueCents: string }> {
	return new Map(
		db
			.select({
				quantityMicros: sql<string>`sum(${stockBalance.quantityMicros})`,
				valueCents: sql<string>`sum(${stockBalance.valueCents})`,
				variantId: stockBalance.variantId,
			})
			.from(stockBalance)
			.innerJoin(
				materialVariant,
				eq(materialVariant.id, stockBalance.variantId)
			)
			.where(eq(materialVariant.materialId, materialId))
			.groupBy(stockBalance.variantId)
			.all()
			.map((row) => [
				row.variantId,
				{
					quantityMicros: String(row.quantityMicros),
					valueCents: String(row.valueCents),
				},
			])
	);
}

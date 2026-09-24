import type { Database } from "@costura-pro/db";
import { material, materialVariant } from "@costura-pro/db/schema/materials";
import {
	stockBalance,
	stockLocation,
	stockLot,
	stockMovement,
} from "@costura-pro/db/schema/stock";
import { searchTokens } from "@costura-pro/domain/client";
import { inventoryLimits } from "@costura-pro/domain/stock";
import type { BaseUnitCode } from "@costura-pro/domain/unit";
import {
	and,
	asc,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	ne,
	or,
	sql,
} from "drizzle-orm";
import z from "zod";

import { containing } from "../search";
import {
	type StockLocationSnapshot,
	type StockLotSnapshot,
	type StockMovementSnapshot,
	stockLocationSnapshot,
	stockLotSnapshot,
	stockMovementSnapshot,
} from "./store";

export const stockPageSize = 50;

export const movementPageSize = 200;

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

export function listStockBalances(
	db: Reader,
	{ locationId, offset, query }: z.output<typeof stockBalanceListInput>
): { items: StockBalanceListItem[]; nextOffset: number | null } {
	const byLocation =
		locationId === undefined
			? undefined
			: eq(stockBalance.locationId, locationId);
	const filters = [
		isNull(materialVariant.archivedAt),
		...searchTokens(query ?? "").map((token) =>
			or(
				sql`${material.searchText} LIKE ${containing(token)} ESCAPE '\\'`,
				sql`${materialVariant.searchText} LIKE ${containing(token)} ESCAPE '\\'`
			)
		),
	];
	const summed = db
		.select({
			baseUnit: materialVariant.baseUnit,
			code: materialVariant.code,
			displayPrecision: materialVariant.displayPrecision,
			materialId: material.id,
			materialName: material.name,
			quantityMicros: sql<string>`cast(coalesce(sum(${stockBalance.quantityMicros}), 0) as text)`,
			referenceCostCents: materialVariant.referenceCostCents,
			searchText: materialVariant.searchText,
			tracksLots: materialVariant.tracksLots,
			valueCents: sql<string>`cast(coalesce(sum(${stockBalance.valueCents}), 0) as text)`,
			variantId: materialVariant.id,
			variantName: materialVariant.name,
		})
		.from(materialVariant)
		.innerJoin(material, eq(material.id, materialVariant.materialId))
		.leftJoin(
			stockBalance,
			byLocation
				? and(eq(stockBalance.variantId, materialVariant.id), byLocation)
				: eq(stockBalance.variantId, materialVariant.id)
		)
		.where(and(...filters))
		.groupBy(materialVariant.id);
	const rows = (
		byLocation
			? summed.having(
					or(
						ne(sql`coalesce(sum(${stockBalance.quantityMicros}), 0)`, 0),
						ne(sql`coalesce(sum(${stockBalance.valueCents}), 0)`, 0)
					)
				)
			: summed
	)
		.orderBy(asc(materialVariant.searchText), asc(materialVariant.id))
		.limit(stockPageSize + 1)
		.offset(offset)
		.all();
	return {
		items: rows.slice(0, stockPageSize).map(({ searchText, ...row }) => ({
			...row,
			quantityMicros: row.quantityMicros,
			referenceCostCents: row.referenceCostCents?.toString() ?? null,
			valueCents: row.valueCents,
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

export const stockPointsInput = z.object({
	locationIds: z
		.array(z.uuid())
		.min(inventoryLimits.locations.min)
		.max(inventoryLimits.locations.max),
});

export type StockPointItem = {
	archived: boolean;
	baseUnit: BaseUnitCode;
	code: string | null;
	displayPrecision: number;
	locationId: string;
	locationName: string;
	lotId: string | null;
	lotLabel: string | null;
	materialId: string;
	materialName: string;
	quantityMicros: string;
	referenceCostCents: string | null;
	tracksLots: boolean;
	valueCents: string;
	variantId: string;
	variantName: string;
};

export function listStockPoints(
	db: Reader,
	{ locationIds }: z.output<typeof stockPointsInput>
): { items: StockPointItem[] } {
	return {
		items: db
			.select({
				baseUnit: materialVariant.baseUnit,
				code: materialVariant.code,
				displayPrecision: materialVariant.displayPrecision,
				locationId: stockBalance.locationId,
				locationName: stockLocation.name,
				lotId: stockBalance.lotId,
				lotLabel: stockLot.label,
				materialArchivedAt: material.archivedAt,
				materialId: material.id,
				materialName: material.name,
				quantityMicros: stockBalance.quantityMicros,
				referenceCostCents: materialVariant.referenceCostCents,
				tracksLots: materialVariant.tracksLots,
				valueCents: stockBalance.valueCents,
				variantArchivedAt: materialVariant.archivedAt,
				variantId: materialVariant.id,
				variantName: materialVariant.name,
			})
			.from(stockBalance)
			.innerJoin(
				materialVariant,
				eq(materialVariant.id, stockBalance.variantId)
			)
			.innerJoin(material, eq(material.id, materialVariant.materialId))
			.innerJoin(stockLocation, eq(stockLocation.id, stockBalance.locationId))
			.leftJoin(stockLot, eq(stockLot.id, stockBalance.lotId))
			.where(
				and(
					inArray(stockBalance.locationId, locationIds),
					or(
						ne(stockBalance.quantityMicros, 0n),
						ne(stockBalance.valueCents, 0n)
					)
				)
			)
			.orderBy(
				asc(stockLocation.name),
				asc(stockLocation.id),
				asc(material.searchText),
				asc(materialVariant.searchText),
				asc(stockLot.label),
				asc(stockBalance.id)
			)
			.all()
			.map(({ materialArchivedAt, variantArchivedAt, ...row }) => ({
				...row,
				archived: materialArchivedAt !== null || variantArchivedAt !== null,
				quantityMicros: row.quantityMicros.toString(),
				referenceCostCents: row.referenceCostCents?.toString() ?? null,
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
			.limit(movementPageSize)
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
				quantityMicros: sql<string>`cast(sum(${stockBalance.quantityMicros}) as text)`,
				valueCents: sql<string>`cast(sum(${stockBalance.valueCents}) as text)`,
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
				{ quantityMicros: row.quantityMicros, valueCents: row.valueCents },
			])
	);
}

import type { Database } from "@costura-pro/db";
import { material, materialVariant } from "@costura-pro/db/schema/materials";
import { searchTokens } from "@costura-pro/domain/search";
import type { BaseUnitCode } from "@costura-pro/domain/unit";
import { ORPCError } from "@orpc/server";
import {
	and,
	asc,
	eq,
	inArray,
	isNotNull,
	isNull,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import z from "zod";

import { commandMessages } from "../command-messages";
import { containing } from "../search";
import { variantBalanceTotals } from "../stock/queries";
import {
	listMaterialVariants,
	materialSnapshot,
	materialVariantSnapshot,
	readMaterial,
} from "./store";

export const materialPageSize = 50;

export const materialListInput = z.object({
	archived: z.boolean().default(false),
	category: z.string().max(40).optional(),
	offset: z.number().int().nonnegative().default(0),
	query: z.string().max(100).optional(),
});

export type MaterialListItem = {
	archivedAt: string | null;
	category: string | null;
	id: string;
	name: string;
	updatedAt: string;
	variantCount: number;
	version: number;
};

type Reader = Pick<Database, "select" | "selectDistinct">;

export function materialMatches(
	db: Reader,
	tokens: readonly string[]
): (SQL | undefined)[] {
	return tokens.map((token) =>
		or(
			sql`${material.searchText} LIKE ${containing(token)} ESCAPE '\\'`,
			inArray(
				material.id,
				db
					.select({ id: materialVariant.materialId })
					.from(materialVariant)
					.where(
						sql`${materialVariant.searchText} LIKE ${containing(token)} ESCAPE '\\'`
					)
			)
		)
	);
}

export function listMaterials(
	db: Reader,
	{ archived, category, offset, query }: z.output<typeof materialListInput>
): { items: MaterialListItem[]; nextOffset: number | null } {
	const filters = [
		archived ? isNotNull(material.archivedAt) : isNull(material.archivedAt),
		...(category === undefined
			? []
			: [
					category === ""
						? isNull(material.category)
						: eq(material.category, category),
				]),
		...materialMatches(db, searchTokens(query ?? "")),
	];
	const rows = db
		.select({
			archivedAt: material.archivedAt,
			category: material.category,
			id: material.id,
			name: material.name,
			updatedAt: material.updatedAt,
			variantCount: sql<number>`(SELECT count(*) FROM material_variant AS variant WHERE variant.material_id = "material"."id" AND variant.archived_at IS NULL)`,
			version: material.version,
		})
		.from(material)
		.where(and(...filters))
		.orderBy(asc(material.searchText), asc(material.id))
		.limit(materialPageSize + 1)
		.offset(offset)
		.all();
	return {
		items: rows.slice(0, materialPageSize).map((row) => ({
			...row,
			archivedAt: row.archivedAt?.toISOString() ?? null,
			updatedAt: row.updatedAt.toISOString(),
		})),
		nextOffset:
			rows.length > materialPageSize ? offset + materialPageSize : null,
	};
}

export function listMaterialCategories(db: Reader): { categories: string[] } {
	return {
		categories: db
			.selectDistinct({ category: material.category })
			.from(material)
			.where(and(isNull(material.archivedAt), isNotNull(material.category)))
			.orderBy(asc(material.category))
			.all()
			.flatMap((row) => (row.category === null ? [] : [row.category])),
	};
}

export function getMaterial(db: Reader, materialId: string) {
	const row = readMaterial(db, materialId);
	if (!row) {
		throw new ORPCError("NOT_FOUND", {
			message: commandMessages.materialNotFound,
		});
	}
	const totals = variantBalanceTotals(db, materialId);
	return {
		material: {
			...materialSnapshot(row),
			updatedAt: row.updatedAt.toISOString(),
		},
		variants: listMaterialVariants(db, materialId).map((variant) => {
			const balance = totals.get(variant.id);
			return {
				...materialVariantSnapshot(variant),
				quantityMicros: balance?.quantityMicros ?? "0",
				updatedAt: variant.updatedAt.toISOString(),
				valueCents: balance?.valueCents ?? "0",
			};
		}),
	};
}

export function findVariantsByCode(db: Reader, code: string) {
	return {
		items: db
			.select({
				code: materialVariant.code,
				id: materialVariant.id,
				materialId: materialVariant.materialId,
				materialName: material.name,
				name: materialVariant.name,
			})
			.from(materialVariant)
			.innerJoin(material, eq(material.id, materialVariant.materialId))
			.where(
				and(
					isNull(materialVariant.archivedAt),
					sql`lower(${materialVariant.code}) = lower(${code})`
				)
			)
			.orderBy(asc(materialVariant.searchText), asc(materialVariant.id))
			.limit(10)
			.all(),
	};
}

export const variantSearchInput = z.object({
	offset: z.number().int().nonnegative().default(0),
	query: z.string().max(100).optional(),
});

export type VariantOption = {
	baseUnit: BaseUnitCode;
	code: string | null;
	displayPrecision: number;
	id: string;
	materialId: string;
	materialName: string;
	name: string;
	packaging: { label: string; quantityMicros: string } | null;
	referenceCostCents: string | null;
	tracksLots: boolean;
};

export function searchMaterialVariants(
	db: Reader,
	{ offset, query }: z.output<typeof variantSearchInput>
): { items: VariantOption[]; nextOffset: number | null } {
	const rows = db
		.select({
			baseUnit: materialVariant.baseUnit,
			code: materialVariant.code,
			displayPrecision: materialVariant.displayPrecision,
			id: materialVariant.id,
			materialId: material.id,
			materialName: material.name,
			name: materialVariant.name,
			packagingLabel: materialVariant.packagingLabel,
			packagingQuantityMicros: materialVariant.packagingQuantityMicros,
			referenceCostCents: materialVariant.referenceCostCents,
			tracksLots: materialVariant.tracksLots,
		})
		.from(materialVariant)
		.innerJoin(material, eq(material.id, materialVariant.materialId))
		.where(
			and(
				isNull(materialVariant.archivedAt),
				isNull(material.archivedAt),
				...searchTokens(query ?? "").map((token) =>
					or(
						sql`${material.searchText} LIKE ${containing(token)} ESCAPE '\\'`,
						sql`${materialVariant.searchText} LIKE ${containing(token)} ESCAPE '\\'`
					)
				)
			)
		)
		.orderBy(
			asc(material.searchText),
			asc(materialVariant.searchText),
			asc(materialVariant.id)
		)
		.limit(materialPageSize + 1)
		.offset(offset)
		.all();
	return {
		items: rows
			.slice(0, materialPageSize)
			.map(
				({
					packagingLabel,
					packagingQuantityMicros,
					referenceCostCents,
					...row
				}) => ({
					...row,
					packaging:
						packagingLabel === null || packagingQuantityMicros === null
							? null
							: {
									label: packagingLabel,
									quantityMicros: packagingQuantityMicros.toString(),
								},
					referenceCostCents: referenceCostCents?.toString() ?? null,
				})
			),
		nextOffset:
			rows.length > materialPageSize ? offset + materialPageSize : null,
	};
}

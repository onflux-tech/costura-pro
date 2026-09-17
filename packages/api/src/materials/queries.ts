import type { Database } from "@costura-pro/db";
import { material, materialVariant } from "@costura-pro/db/schema/materials";
import { searchTokens } from "@costura-pro/domain/client";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import z from "zod";

import { commandMessages } from "../command-messages";
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

const likeSpecial = /[\\%_]/g;

function containing(token: string): string {
	return `%${token.replace(likeSpecial, (character) => `\\${character}`)}%`;
}

type Reader = Pick<Database, "select" | "selectDistinct">;

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
		...searchTokens(query ?? "").map((token) =>
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
		),
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
	return {
		material: {
			...materialSnapshot(row),
			updatedAt: row.updatedAt.toISOString(),
		},
		variants: listMaterialVariants(db, materialId).map((variant) => ({
			...materialVariantSnapshot(variant),
			updatedAt: variant.updatedAt.toISOString(),
		})),
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

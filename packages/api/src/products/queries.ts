import type { Database } from "@costura-pro/db";
import { material, materialVariant } from "@costura-pro/db/schema/materials";
import {
	product,
	productVariant,
	type SheetItemRow,
} from "@costura-pro/db/schema/products";
import { service } from "@costura-pro/db/schema/services";
import { productLimits } from "@costura-pro/domain/product";
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
import {
	listProductVariants,
	type ProductSnapshot,
	type ProductVariantRow,
	type ProductVariantSnapshot,
	productSnapshot,
	productVariantSnapshot,
	readProduct,
} from "./store";

export const productPageSize = 50;

export const productListInput = z.object({
	archived: z.boolean().default(false),
	category: z.string().max(productLimits.category).optional(),
	offset: z.number().int().nonnegative().default(0),
	query: z.string().max(100).optional(),
});

export type ProductListItem = {
	archivedAt: string | null;
	category: string | null;
	id: string;
	mainPhoto: { photoHash: string; thumbnailHash: string } | null;
	maxPriceCents: string | null;
	minPriceCents: string | null;
	name: string;
	updatedAt: string;
	variantCount: number;
	version: number;
};

export type MaterialVariantReference = {
	archived: boolean;
	baseUnit: BaseUnitCode;
	code: string | null;
	displayPrecision: number;
	id: string;
	materialId: string;
	materialName: string;
	name: string;
	referenceCostCents: string | null;
};

export type ServiceReference = {
	archived: boolean;
	costCents: string;
	id: string;
	name: string;
	outsourced: boolean;
};

export type ProductDetail = {
	product: ProductSnapshot & { updatedAt: string };
	references: {
		materialVariants: MaterialVariantReference[];
		services: ServiceReference[];
	};
	variants: (ProductVariantSnapshot & { updatedAt: string })[];
};

type Reader = Pick<Database, "select" | "selectDistinct">;

export function productMatches(
	db: Reader,
	tokens: readonly string[]
): (SQL | undefined)[] {
	return tokens.map((token) =>
		or(
			sql`${product.searchText} LIKE ${containing(token)} ESCAPE '\\'`,
			inArray(
				product.id,
				db
					.select({ id: productVariant.productId })
					.from(productVariant)
					.where(
						sql`${productVariant.searchText} LIKE ${containing(token)} ESCAPE '\\'`
					)
			)
		)
	);
}

export function listProducts(
	db: Reader,
	{ archived, category, offset, query }: z.output<typeof productListInput>
): { items: ProductListItem[]; nextOffset: number | null } {
	const filters = [
		archived ? isNotNull(product.archivedAt) : isNull(product.archivedAt),
		...(category === undefined
			? []
			: [
					category === ""
						? isNull(product.category)
						: eq(product.category, category),
				]),
		...productMatches(db, searchTokens(query ?? "")),
	];
	const rows = db
		.select({
			archivedAt: product.archivedAt,
			category: product.category,
			id: product.id,
			maxPriceCents: sql<
				string | null
			>`(SELECT cast(max(variant.price_cents) AS text) FROM product_variant AS variant WHERE variant.product_id = "product"."id" AND variant.archived_at IS NULL)`,
			minPriceCents: sql<
				string | null
			>`(SELECT cast(min(variant.price_cents) AS text) FROM product_variant AS variant WHERE variant.product_id = "product"."id" AND variant.archived_at IS NULL)`,
			name: product.name,
			photos: product.photos,
			updatedAt: product.updatedAt,
			variantCount: sql<number>`(SELECT count(*) FROM product_variant AS variant WHERE variant.product_id = "product"."id" AND variant.archived_at IS NULL)`,
			version: product.version,
		})
		.from(product)
		.where(and(...filters))
		.orderBy(asc(product.searchText), asc(product.id))
		.limit(productPageSize + 1)
		.offset(offset)
		.all();
	return {
		items: rows.slice(0, productPageSize).map(({ photos, ...row }) => {
			const [first] = photos;
			return {
				...row,
				archivedAt: row.archivedAt?.toISOString() ?? null,
				mainPhoto: first
					? { photoHash: first.photoHash, thumbnailHash: first.thumbnailHash }
					: null,
				updatedAt: row.updatedAt.toISOString(),
			};
		}),
		nextOffset: rows.length > productPageSize ? offset + productPageSize : null,
	};
}

export function listProductCategories(db: Reader): { categories: string[] } {
	return {
		categories: db
			.selectDistinct({ category: product.category })
			.from(product)
			.where(and(isNull(product.archivedAt), isNotNull(product.category)))
			.orderBy(asc(product.category))
			.all()
			.flatMap((row) => (row.category === null ? [] : [row.category])),
	};
}

function citedItems(
	sheet: readonly SheetItemRow[],
	variants: readonly ProductVariantRow[]
): SheetItemRow[] {
	return [
		...sheet,
		...variants.flatMap((variant) =>
			variant.sheetChanges.flatMap((change) =>
				change.kind === "remove" ? [] : [change.item]
			)
		),
	];
}

function materialReferences(
	db: Reader,
	ids: readonly string[]
): MaterialVariantReference[] {
	if (ids.length === 0) {
		return [];
	}
	return db
		.select({
			baseUnit: materialVariant.baseUnit,
			code: materialVariant.code,
			displayPrecision: materialVariant.displayPrecision,
			id: materialVariant.id,
			materialArchivedAt: material.archivedAt,
			materialId: material.id,
			materialName: material.name,
			name: materialVariant.name,
			referenceCostCents: materialVariant.referenceCostCents,
			variantArchivedAt: materialVariant.archivedAt,
		})
		.from(materialVariant)
		.innerJoin(material, eq(material.id, materialVariant.materialId))
		.where(inArray(materialVariant.id, [...ids]))
		.orderBy(asc(materialVariant.id))
		.all()
		.map(
			({
				materialArchivedAt,
				referenceCostCents,
				variantArchivedAt,
				...row
			}) => ({
				...row,
				archived: variantArchivedAt !== null || materialArchivedAt !== null,
				referenceCostCents: referenceCostCents?.toString() ?? null,
			})
		);
}

function serviceReferences(
	db: Reader,
	ids: readonly string[]
): ServiceReference[] {
	if (ids.length === 0) {
		return [];
	}
	return db
		.select({
			archivedAt: service.archivedAt,
			costCents: service.costCents,
			id: service.id,
			name: service.name,
			outsourced: service.outsourced,
		})
		.from(service)
		.where(inArray(service.id, [...ids]))
		.orderBy(asc(service.id))
		.all()
		.map(({ archivedAt, costCents, ...row }) => ({
			...row,
			archived: archivedAt !== null,
			costCents: costCents.toString(),
		}));
}

export function getProduct(db: Reader, productId: string): ProductDetail {
	const row = readProduct(db, productId);
	if (!row) {
		throw new ORPCError("NOT_FOUND", {
			message: commandMessages.productNotFound,
		});
	}
	const variants = listProductVariants(db, productId);
	const items = citedItems(row.sheet, variants);
	const variantIds = [
		...new Set(
			items.flatMap((item) =>
				item.kind === "material" ? [item.materialVariantId] : []
			)
		),
	];
	const serviceIds = [
		...new Set(
			items.flatMap((item) => (item.kind === "service" ? [item.serviceId] : []))
		),
	];
	return {
		product: {
			...productSnapshot(row),
			updatedAt: row.updatedAt.toISOString(),
		},
		references: {
			materialVariants: materialReferences(db, variantIds),
			services: serviceReferences(db, serviceIds),
		},
		variants: variants.map((variant) => ({
			...productVariantSnapshot(variant),
			updatedAt: variant.updatedAt.toISOString(),
		})),
	};
}

export function findProductVariantsByCode(db: Reader, code: string) {
	return {
		items: db
			.select({
				code: productVariant.code,
				id: productVariant.id,
				name: productVariant.name,
				productId: product.id,
				productName: product.name,
			})
			.from(productVariant)
			.innerJoin(product, eq(product.id, productVariant.productId))
			.where(
				and(
					isNull(productVariant.archivedAt),
					sql`lower(${productVariant.code}) = lower(${code})`
				)
			)
			.orderBy(asc(productVariant.searchText), asc(productVariant.id))
			.limit(10)
			.all(),
	};
}

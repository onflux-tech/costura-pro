import type { Database } from "@costura-pro/db";
import {
	type ProductPhotoRow,
	product,
	productVariant,
	type SheetChangeRow,
	type SheetItemRow,
} from "@costura-pro/db/schema/products";
import {
	productSearchKey,
	productVariantSearchKey,
} from "@costura-pro/domain/product";
import { ORPCError } from "@orpc/server";
import { and, asc, eq } from "drizzle-orm";

import { appendChange } from "../change-log";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";

export type ProductRow = typeof product.$inferSelect;
export type ProductVariantRow = typeof productVariant.$inferSelect;

export type ProductFields = {
	category: string | null;
	name: string;
	notes: string | null;
	photos: ProductPhotoRow[];
	sheet: SheetItemRow[];
	targetMarginBasisPoints: number | null;
};

export type ProductPatch = Partial<ProductFields> & {
	archivedAt?: Date | null;
};

export type ProductSnapshot = ProductFields & {
	archivedAt: string | null;
	createdAt: string;
	id: string;
	version: number;
};

export type ProductVariantFields = {
	code: string | null;
	coverPhotoHash: string | null;
	name: string;
	priceCents: string;
	productId: string;
	sheetChanges: SheetChangeRow[];
};

export type ProductVariantPatch = Partial<
	Omit<ProductVariantFields, "productId">
> & { archivedAt?: Date | null };

export type ProductVariantSnapshot = ProductVariantFields & {
	archivedAt: string | null;
	createdAt: string;
	id: string;
	version: number;
};

type Reader = Pick<Database, "select">;

const isoOrNull = (value: Date | null) => value?.toISOString() ?? null;

export function productSnapshot(row: ProductRow): ProductSnapshot {
	return {
		archivedAt: isoOrNull(row.archivedAt),
		category: row.category,
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		name: row.name,
		notes: row.notes,
		photos: row.photos,
		sheet: row.sheet,
		targetMarginBasisPoints: row.targetMarginBasisPoints,
		version: row.version,
	};
}

export function productVariantSnapshot(
	row: ProductVariantRow
): ProductVariantSnapshot {
	return {
		archivedAt: isoOrNull(row.archivedAt),
		code: row.code,
		coverPhotoHash: row.coverPhotoHash,
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		name: row.name,
		priceCents: row.priceCents.toString(),
		productId: row.productId,
		sheetChanges: row.sheetChanges,
		version: row.version,
	};
}

export function readProduct(db: Reader, id: string): ProductRow | undefined {
	return db.select().from(product).where(eq(product.id, id)).get();
}

export function readProductVariant(
	db: Reader,
	id: string
): ProductVariantRow | undefined {
	return db
		.select()
		.from(productVariant)
		.where(eq(productVariant.id, id))
		.get();
}

export function listProductVariants(
	db: Reader,
	productId: string
): ProductVariantRow[] {
	return db
		.select()
		.from(productVariant)
		.where(eq(productVariant.productId, productId))
		.orderBy(asc(productVariant.createdAt), asc(productVariant.id))
		.all();
}

function recordProduct(db: Executor, row: ProductRow, stamp: ChangeStamp) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "product",
		data: productSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

function recordVariant(
	db: Executor,
	row: ProductVariantRow,
	stamp: ChangeStamp
) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "productVariant",
		data: productVariantSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

export function insertProduct(
	db: Executor,
	id: string,
	fields: ProductFields,
	stamp: ChangeStamp
): ProductRow {
	const row = db
		.insert(product)
		.values({
			...fields,
			createdAt: stamp.now,
			id,
			searchText: productSearchKey(fields),
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordProduct(db, row, stamp);
	return row;
}

export function updateProduct(
	db: Executor,
	current: ProductRow,
	patch: ProductPatch,
	stamp: ChangeStamp
): ProductRow {
	const next = db
		.update(product)
		.set({
			...patch,
			searchText: productSearchKey({
				category:
					patch.category === undefined ? current.category : patch.category,
				name: patch.name ?? current.name,
			}),
			updatedAt: stamp.now,
			version: current.version + 1,
		})
		.where(
			and(eq(product.id, current.id), eq(product.version, current.version))
		)
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Produto mudou durante a operação",
		});
	}
	recordProduct(db, next, stamp);
	return next;
}

function variantColumns(patch: ProductVariantPatch) {
	const { priceCents, ...rest } = patch;
	return {
		...rest,
		...(priceCents === undefined ? {} : { priceCents: BigInt(priceCents) }),
	};
}

export function insertProductVariant(
	db: Executor,
	id: string,
	fields: ProductVariantFields,
	stamp: ChangeStamp
): ProductVariantRow {
	const row = db
		.insert(productVariant)
		.values({
			...fields,
			createdAt: stamp.now,
			id,
			priceCents: BigInt(fields.priceCents),
			searchText: productVariantSearchKey(fields),
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordVariant(db, row, stamp);
	return row;
}

export function updateProductVariant(
	db: Executor,
	current: ProductVariantRow,
	patch: ProductVariantPatch,
	stamp: ChangeStamp
): ProductVariantRow {
	const next = db
		.update(productVariant)
		.set({
			...variantColumns(patch),
			searchText: productVariantSearchKey({
				code: patch.code === undefined ? current.code : patch.code,
				name: patch.name ?? current.name,
			}),
			updatedAt: stamp.now,
			version: current.version + 1,
		})
		.where(
			and(
				eq(productVariant.id, current.id),
				eq(productVariant.version, current.version)
			)
		)
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Variante mudou durante a operação",
		});
	}
	recordVariant(db, next, stamp);
	return next;
}

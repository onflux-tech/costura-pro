import type { Database } from "@costura-pro/db";
import {
	type MaterialVariantPhotoRow,
	material,
	materialVariant,
} from "@costura-pro/db/schema/materials";
import {
	materialSearchKey,
	variantSearchKey,
} from "@costura-pro/domain/material";
import type { BaseUnitCode } from "@costura-pro/domain/unit";
import { ORPCError } from "@orpc/server";
import { and, asc, eq } from "drizzle-orm";

import { appendChange } from "../change-log";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";

export type MaterialRow = typeof material.$inferSelect;
export type MaterialVariantRow = typeof materialVariant.$inferSelect;

export type MaterialFields = Pick<MaterialRow, "category" | "name" | "notes">;

export type MaterialPatch = Partial<
	MaterialFields & Pick<MaterialRow, "archivedAt">
>;

export type VariantPackaging = { label: string; quantityMicros: string };

export type MaterialVariantFields = {
	baseUnit: BaseUnitCode;
	code: string | null;
	displayPrecision: number;
	materialId: string;
	minQuantityMicros: string | null;
	name: string;
	packaging: VariantPackaging | null;
	photo: MaterialVariantPhotoRow | null;
	referenceCostCents: string | null;
	targetQuantityMicros: string | null;
	tracksLots: boolean;
};

export type MaterialVariantPatch = Partial<
	Omit<MaterialVariantFields, "baseUnit" | "materialId" | "tracksLots">
> & { archivedAt?: Date | null };

export type MaterialSnapshot = {
	archivedAt: string | null;
	category: string | null;
	createdAt: string;
	id: string;
	name: string;
	notes: string | null;
	version: number;
};

export type MaterialVariantSnapshot = {
	archivedAt: string | null;
	baseUnit: BaseUnitCode;
	code: string | null;
	createdAt: string;
	displayPrecision: number;
	id: string;
	materialId: string;
	minQuantityMicros: string | null;
	name: string;
	packaging: VariantPackaging | null;
	photo: MaterialVariantPhotoRow | null;
	referenceCostCents: string | null;
	targetQuantityMicros: string | null;
	tracksLots: boolean;
	version: number;
};

type Reader = Pick<Database, "select">;

const isoOrNull = (value: Date | null) => value?.toISOString() ?? null;

const textOrNull = (value: bigint | null) => value?.toString() ?? null;

const bigintOrNull = (value: string | null) =>
	value === null ? null : BigInt(value);

export function materialSnapshot(row: MaterialRow): MaterialSnapshot {
	return {
		archivedAt: isoOrNull(row.archivedAt),
		category: row.category,
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		name: row.name,
		notes: row.notes,
		version: row.version,
	};
}

export function materialVariantSnapshot(
	row: MaterialVariantRow
): MaterialVariantSnapshot {
	return {
		archivedAt: isoOrNull(row.archivedAt),
		baseUnit: row.baseUnit,
		code: row.code,
		createdAt: row.createdAt.toISOString(),
		displayPrecision: row.displayPrecision,
		id: row.id,
		materialId: row.materialId,
		minQuantityMicros: textOrNull(row.minQuantityMicros),
		name: row.name,
		packaging:
			row.packagingLabel === null || row.packagingQuantityMicros === null
				? null
				: {
						label: row.packagingLabel,
						quantityMicros: row.packagingQuantityMicros.toString(),
					},
		photo: row.photo,
		referenceCostCents: textOrNull(row.referenceCostCents),
		targetQuantityMicros: textOrNull(row.targetQuantityMicros),
		tracksLots: row.tracksLots,
		version: row.version,
	};
}

export function readMaterial(db: Reader, id: string): MaterialRow | undefined {
	return db.select().from(material).where(eq(material.id, id)).get();
}

export function readMaterialVariant(
	db: Reader,
	id: string
): MaterialVariantRow | undefined {
	return db
		.select()
		.from(materialVariant)
		.where(eq(materialVariant.id, id))
		.get();
}

export function listMaterialVariants(
	db: Reader,
	materialId: string
): MaterialVariantRow[] {
	return db
		.select()
		.from(materialVariant)
		.where(eq(materialVariant.materialId, materialId))
		.orderBy(asc(materialVariant.searchText), asc(materialVariant.id))
		.all();
}

function variantColumns(patch: MaterialVariantPatch) {
	const {
		minQuantityMicros,
		packaging,
		referenceCostCents,
		targetQuantityMicros,
		...rest
	} = patch;
	return {
		...rest,
		...(minQuantityMicros === undefined
			? {}
			: { minQuantityMicros: bigintOrNull(minQuantityMicros) }),
		...(referenceCostCents === undefined
			? {}
			: { referenceCostCents: bigintOrNull(referenceCostCents) }),
		...(targetQuantityMicros === undefined
			? {}
			: { targetQuantityMicros: bigintOrNull(targetQuantityMicros) }),
		...(packaging === undefined
			? {}
			: {
					packagingLabel: packaging === null ? null : packaging.label,
					packagingQuantityMicros:
						packaging === null ? null : BigInt(packaging.quantityMicros),
				}),
	};
}

function recordMaterial(db: Executor, row: MaterialRow, stamp: ChangeStamp) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "material",
		data: materialSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

function recordVariant(
	db: Executor,
	row: MaterialVariantRow,
	stamp: ChangeStamp
) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "materialVariant",
		data: materialVariantSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

export function insertMaterial(
	db: Executor,
	id: string,
	fields: MaterialFields,
	stamp: ChangeStamp
): MaterialRow {
	const row = db
		.insert(material)
		.values({
			...fields,
			createdAt: stamp.now,
			id,
			searchText: materialSearchKey(fields),
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordMaterial(db, row, stamp);
	return row;
}

export function updateMaterial(
	db: Executor,
	current: MaterialRow,
	patch: MaterialPatch,
	stamp: ChangeStamp
): MaterialRow {
	const merged = { ...current, ...patch };
	const next = db
		.update(material)
		.set({
			...patch,
			searchText: materialSearchKey(merged),
			updatedAt: stamp.now,
			version: current.version + 1,
		})
		.where(
			and(eq(material.id, current.id), eq(material.version, current.version))
		)
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Material mudou durante a operação",
		});
	}
	recordMaterial(db, next, stamp);
	return next;
}

export function insertMaterialVariant(
	db: Executor,
	id: string,
	fields: MaterialVariantFields,
	stamp: ChangeStamp
): MaterialVariantRow {
	const row = db
		.insert(materialVariant)
		.values({
			...variantColumns(fields),
			baseUnit: fields.baseUnit,
			createdAt: stamp.now,
			displayPrecision: fields.displayPrecision,
			id,
			materialId: fields.materialId,
			name: fields.name,
			searchText: variantSearchKey(fields),
			tracksLots: fields.tracksLots,
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordVariant(db, row, stamp);
	return row;
}

export function updateMaterialVariant(
	db: Executor,
	current: MaterialVariantRow,
	patch: MaterialVariantPatch,
	stamp: ChangeStamp
): MaterialVariantRow {
	const next = db
		.update(materialVariant)
		.set({
			...variantColumns(patch),
			searchText: variantSearchKey({
				code: patch.code === undefined ? current.code : patch.code,
				name: patch.name ?? current.name,
			}),
			updatedAt: stamp.now,
			version: current.version + 1,
		})
		.where(
			and(
				eq(materialVariant.id, current.id),
				eq(materialVariant.version, current.version)
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

import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { bigintInteger } from "../columns";

export const baseUnitValues = [
	"m",
	"cm",
	"m2",
	"un",
	"par",
	"g",
	"kg",
	"ml",
	"l",
] as const;

export type MaterialVariantPhotoRow = {
	photoHash: string;
	thumbnailHash: string;
};

export const material = sqliteTable("material", {
	archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
	category: text("category"),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	notes: text("notes"),
	searchText: text("search_text").notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	version: integer("version").notNull(),
});

export const materialVariant = sqliteTable(
	"material_variant",
	{
		archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
		baseUnit: text("base_unit", { enum: baseUnitValues }).notNull(),
		code: text("code"),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		displayPrecision: integer("display_precision").notNull(),
		id: text("id").primaryKey(),
		materialId: text("material_id")
			.notNull()
			.references(() => material.id),
		minQuantityMicros: bigintInteger("min_quantity_micros"),
		name: text("name").notNull(),
		packagingLabel: text("packaging_label"),
		packagingQuantityMicros: bigintInteger("packaging_quantity_micros"),
		photo: text("photo", { mode: "json" }).$type<MaterialVariantPhotoRow>(),
		referenceCostCents: bigintInteger("reference_cost_cents"),
		searchText: text("search_text").notNull(),
		targetQuantityMicros: bigintInteger("target_quantity_micros"),
		tracksLots: integer("tracks_lots", { mode: "boolean" })
			.notNull()
			.default(false),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
		version: integer("version").notNull(),
	},
	(table) => [
		index("material_variant_material_idx").on(table.materialId),
		index("material_variant_code_idx").on(table.code),
	]
);

import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { bigintInteger } from "../columns";

export type ProductPhotoRow = {
	caption: string | null;
	photoHash: string;
	thumbnailHash: string;
};

export type SheetLossRow =
	| { kind: "fixed"; quantityMicros: string }
	| { basisPoints: number; kind: "percent" };

export type SheetItemRow =
	| {
			id: string;
			kind: "material";
			loss: SheetLossRow | null;
			materialVariantId: string;
			note: string | null;
			quantityMicros: string;
	  }
	| {
			count: number;
			id: string;
			kind: "service";
			note: string | null;
			serviceId: string;
	  };

export type SheetChangeRow =
	| { item: SheetItemRow; kind: "add" }
	| { item: SheetItemRow; kind: "replace" }
	| { itemId: string; kind: "remove" };

export const product = sqliteTable("product", {
	archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
	category: text("category"),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	notes: text("notes"),
	photos: text("photos", { mode: "json" }).$type<ProductPhotoRow[]>().notNull(),
	searchText: text("search_text").notNull(),
	sheet: text("sheet", { mode: "json" }).$type<SheetItemRow[]>().notNull(),
	targetMarginBasisPoints: integer("target_margin_basis_points"),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	version: integer("version").notNull(),
});

export const productVariant = sqliteTable(
	"product_variant",
	{
		archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
		code: text("code"),
		coverPhotoHash: text("cover_photo_hash"),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		priceCents: bigintInteger("price_cents").notNull(),
		productId: text("product_id")
			.notNull()
			.references(() => product.id),
		searchText: text("search_text").notNull(),
		sheetChanges: text("sheet_changes", { mode: "json" })
			.$type<SheetChangeRow[]>()
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
		version: integer("version").notNull(),
	},
	(table) => [
		index("product_variant_product_idx").on(table.productId),
		index("product_variant_code_idx").on(table.code),
	]
);

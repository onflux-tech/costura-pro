import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { bigintInteger } from "../columns";

export const service = sqliteTable("service", {
	archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
	category: text("category"),
	costCents: bigintInteger("cost_cents").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	estimatedMinutes: integer("estimated_minutes"),
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	notes: text("notes"),
	outsourced: integer("outsourced", { mode: "boolean" }).notNull(),
	priceCents: bigintInteger("price_cents").notNull(),
	searchText: text("search_text").notNull(),
	suggestedStageIds: text("suggested_stage_ids", { mode: "json" })
		.$type<string[]>()
		.notNull()
		.default([]),
	targetMarginBasisPoints: integer("target_margin_basis_points"),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	version: integer("version").notNull(),
});

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const productionStatusValues = [
	"notStarted",
	"inProgress",
	"ready",
] as const;

export type FlowStageRow = { active: boolean; id: string; name: string };

export const productionFlow = sqliteTable("production_flow", {
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	id: text("id").primaryKey(),
	stages: text("stages", { mode: "json" }).$type<FlowStageRow[]>().notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	version: integer("version").notNull(),
});

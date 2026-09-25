import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { serviceOrderItem } from "./service-orders";

export type ReconciliationPartRow = {
	locationId: string;
	lotId: string | null;
	movementId: string;
	provisionalCents: string;
	provisionalMicros: string;
	quantityMicros: string;
	valueCents: string;
};

export type ReconciliationLineRow = {
	consumedMicros: string;
	lostMicros: string;
	parts: ReconciliationPartRow[];
	plannedMicros: string;
	plannedVariantId: string;
	swapReason: string | null;
	variantId: string;
};

export const materialReconciliation = sqliteTable(
	"material_reconciliation",
	{
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		id: text("id").primaryKey(),
		lines: text("lines", { mode: "json" })
			.$type<ReconciliationLineRow[]>()
			.notNull(),
		note: text("note"),
		occurredOn: text("occurred_on").notNull(),
		serviceOrderItemId: text("service_order_item_id")
			.notNull()
			.references(() => serviceOrderItem.id),
		version: integer("version").notNull(),
	},
	(table) => [
		index("material_reconciliation_item_idx").on(table.serviceOrderItemId),
	]
);

export const materialReconciliationReversal = sqliteTable(
	"material_reconciliation_reversal",
	{
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		id: text("id").primaryKey(),
		occurredOn: text("occurred_on").notNull(),
		reason: text("reason").notNull(),
		reconciliationId: text("reconciliation_id")
			.notNull()
			.references(() => materialReconciliation.id),
		version: integer("version").notNull(),
	},
	(table) => [
		uniqueIndex("material_reconciliation_reversal_idx").on(
			table.reconciliationId
		),
	]
);

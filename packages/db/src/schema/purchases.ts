import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { bigintInteger } from "../columns";

export const obligationKindValues = ["purchase"] as const;

export type PurchaseItemRecord = {
	discountCents: string;
	freightCents: string;
	grossCents: string;
	locationId: string;
	lotId: string | null;
	movementId: string;
	packageCountMicros: string;
	packagingLabel: string;
	packagingQuantityMicros: string;
	quantityMicros: string;
	unitPriceCents: string;
	valueCents: string;
	variantId: string;
};

export const supplier = sqliteTable("supplier", {
	archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	email: text("email"),
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	notes: text("notes"),
	phone: text("phone"),
	searchText: text("search_text").notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	version: integer("version").notNull(),
});

export const purchase = sqliteTable(
	"purchase",
	{
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		discountCents: bigintInteger("discount_cents").notNull(),
		freightCents: bigintInteger("freight_cents").notNull(),
		grossCents: bigintInteger("gross_cents").notNull(),
		id: text("id").primaryKey(),
		items: text("items", { mode: "json" })
			.$type<PurchaseItemRecord[]>()
			.notNull(),
		notes: text("notes"),
		occurredOn: text("occurred_on").notNull(),
		reference: text("reference"),
		supplierId: text("supplier_id")
			.notNull()
			.references(() => supplier.id),
		totalCents: bigintInteger("total_cents").notNull(),
		version: integer("version").notNull(),
	},
	(table) => [index("purchase_supplier_idx").on(table.supplierId)]
);

export const obligation = sqliteTable(
	"obligation",
	{
		amountCents: bigintInteger("amount_cents").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		dueOn: text("due_on").notNull(),
		id: text("id").primaryKey(),
		kind: text("kind", { enum: obligationKindValues }).notNull(),
		purchaseId: text("purchase_id")
			.notNull()
			.references(() => purchase.id),
		version: integer("version").notNull(),
	},
	(table) => [
		uniqueIndex("obligation_purchase_idx").on(table.purchaseId),
		index("obligation_due_idx").on(table.dueOn),
	]
);

export const purchaseReversal = sqliteTable(
	"purchase_reversal",
	{
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		id: text("id").primaryKey(),
		occurredOn: text("occurred_on").notNull(),
		purchaseId: text("purchase_id")
			.notNull()
			.references(() => purchase.id),
		reason: text("reason").notNull(),
		version: integer("version").notNull(),
	},
	(table) => [
		uniqueIndex("purchase_reversal_purchase_idx").on(table.purchaseId),
	]
);

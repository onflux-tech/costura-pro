import {
	type AnySQLiteColumn,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { bigintInteger } from "../columns";
import { materialVariant } from "./materials";
import { purchase } from "./purchases";

export const stockMovementKindValues = [
	"opening",
	"adjustment",
	"transferOut",
	"transferIn",
	"reversal",
	"purchase",
	"inventory",
] as const;

export type InventoryLineRecord = {
	countedMicros: string;
	expectedMicros: string;
	locationId: string;
	lotId: string | null;
	movementId: string | null;
	valueCents: string | null;
	variantId: string;
};

export const inventorySession = sqliteTable("inventory_session", {
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	id: text("id").primaryKey(),
	lines: text("lines", { mode: "json" })
		.$type<InventoryLineRecord[]>()
		.notNull(),
	notes: text("notes"),
	occurredOn: text("occurred_on").notNull(),
	reason: text("reason").notNull(),
	version: integer("version").notNull(),
});

export const stockLocation = sqliteTable("stock_location", {
	archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	notes: text("notes"),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	version: integer("version").notNull(),
});

export const stockLot = sqliteTable(
	"stock_lot",
	{
		archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		id: text("id").primaryKey(),
		label: text("label").notNull(),
		notes: text("notes"),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
		variantId: text("variant_id")
			.notNull()
			.references(() => materialVariant.id),
		version: integer("version").notNull(),
	},
	(table) => [index("stock_lot_variant_idx").on(table.variantId)]
);

export const stockMovement = sqliteTable(
	"stock_movement",
	{
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		id: text("id").primaryKey(),
		inventorySessionId: text("inventory_session_id").references(
			() => inventorySession.id
		),
		kind: text("kind", { enum: stockMovementKindValues }).notNull(),
		locationId: text("location_id")
			.notNull()
			.references(() => stockLocation.id),
		lotId: text("lot_id").references(() => stockLot.id),
		occurredOn: text("occurred_on").notNull(),
		purchaseId: text("purchase_id").references(() => purchase.id),
		quantityMicros: bigintInteger("quantity_micros").notNull(),
		reason: text("reason"),
		reversesMovementId: text("reverses_movement_id").references(
			(): AnySQLiteColumn => stockMovement.id
		),
		transferId: text("transfer_id"),
		valueCents: bigintInteger("value_cents").notNull(),
		variantId: text("variant_id")
			.notNull()
			.references(() => materialVariant.id),
		version: integer("version").notNull(),
	},
	(table) => [
		index("stock_movement_point_idx").on(
			table.variantId,
			table.locationId,
			table.lotId
		),
		index("stock_movement_transfer_idx").on(table.transferId),
		index("stock_movement_purchase_idx").on(table.purchaseId),
		index("stock_movement_inventory_session_idx").on(table.inventorySessionId),
		uniqueIndex("stock_movement_reverses_idx").on(table.reversesMovementId),
	]
);

export const stockBalance = sqliteTable(
	"stock_balance",
	{
		id: text("id").primaryKey(),
		locationId: text("location_id")
			.notNull()
			.references(() => stockLocation.id),
		lotId: text("lot_id").references(() => stockLot.id),
		quantityMicros: bigintInteger("quantity_micros").notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
		valueCents: bigintInteger("value_cents").notNull(),
		variantId: text("variant_id")
			.notNull()
			.references(() => materialVariant.id),
	},
	(table) => [index("stock_balance_variant_idx").on(table.variantId)]
);

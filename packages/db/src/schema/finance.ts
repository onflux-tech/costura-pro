import {
	type AnySQLiteColumn,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { bigintInteger } from "../columns";
import { obligation } from "./purchases";

export const financialAccountKindValues = [
	"cash",
	"bank",
	"pix",
	"other",
] as const;

export const financialMovementKindValues = [
	"opening",
	"transferOut",
	"transferIn",
	"obligationPayment",
	"reversal",
] as const;

export const financialAccount = sqliteTable("financial_account", {
	archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	id: text("id").primaryKey(),
	kind: text("kind", { enum: financialAccountKindValues }).notNull(),
	name: text("name").notNull(),
	notes: text("notes"),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	version: integer("version").notNull(),
});

export const financialMovement = sqliteTable(
	"financial_movement",
	{
		accountId: text("account_id")
			.notNull()
			.references(() => financialAccount.id),
		amountCents: bigintInteger("amount_cents").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		id: text("id").primaryKey(),
		kind: text("kind", { enum: financialMovementKindValues }).notNull(),
		obligationId: text("obligation_id").references(() => obligation.id),
		occurredOn: text("occurred_on").notNull(),
		reason: text("reason"),
		reversesMovementId: text("reverses_movement_id").references(
			(): AnySQLiteColumn => financialMovement.id
		),
		transferId: text("transfer_id"),
		version: integer("version").notNull(),
	},
	(table) => [
		index("financial_movement_account_idx").on(table.accountId),
		index("financial_movement_transfer_idx").on(table.transferId),
		index("financial_movement_obligation_idx").on(table.obligationId),
		uniqueIndex("financial_movement_reverses_idx").on(table.reversesMovementId),
	]
);

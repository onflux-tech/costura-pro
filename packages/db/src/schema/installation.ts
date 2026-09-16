import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const installationStateValues = [
	"empty",
	"atelier",
	"account",
	"recovery",
	"backup",
	"ready",
] as const;

export const accessValues = ["local", "remote"] as const;

export const installation = sqliteTable(
	"installation",
	{
		atelierName: text("atelier_name"),
		backupFolder: text("backup_folder"),
		backupTestedAt: integer("backup_tested_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		epoch: text("epoch").notNull(),
		id: text("id").primaryKey(),
		ownerUserId: text("owner_user_id").references(() => user.id),
		singleton: integer("singleton").notNull().unique(),
		state: text("state", { enum: installationStateValues }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
		version: integer("version").notNull(),
	},
	(table) => [
		check("installation_singleton_check", sql`${table.singleton} = 1`),
	]
);

export const signInGuard = sqliteTable(
	"sign_in_guard",
	{
		remoteFailures: integer("remote_failures").notNull().default(0),
		remoteLockedUntil: integer("remote_locked_until", {
			mode: "timestamp_ms",
		}),
		singleton: integer("singleton").primaryKey(),
	},
	(table) => [
		check("sign_in_guard_singleton_check", sql`${table.singleton} = 1`),
	]
);

export const recoveryCode = sqliteTable("recovery_code", {
	codeHash: text("code_hash").notNull().unique(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	id: text("id").primaryKey(),
	usedAt: integer("used_at", { mode: "timestamp_ms" }),
});

export const auditEvent = sqliteTable(
	"audit_event",
	{
		access: text("access", { enum: accessValues }).notNull(),
		details: text("details", { mode: "json" })
			.$type<Record<string, unknown>>()
			.notNull(),
		deviceId: text("device_id"),
		id: text("id").primaryKey(),
		ip: text("ip"),
		occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
		outcome: text("outcome").notNull(),
		type: text("type").notNull(),
	},
	(table) => [index("audit_event_occurred_at_idx").on(table.occurredAt)]
);

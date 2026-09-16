import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const deviceStatusValues = ["pending", "approved", "revoked"] as const;
export const operationStatusValues = [
	"accepted",
	"conflict",
	"quarantined",
] as const;
export const conflictStatusValues = ["open", "resolved"] as const;

export const device = sqliteTable("device", {
	approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	id: text("id").primaryKey(),
	lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
	name: text("name").notNull(),
	revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
	secretHash: text("secret_hash").notNull().unique(),
	status: text("status", { enum: deviceStatusValues }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	version: integer("version").notNull(),
});

export const deviceActivationCode = sqliteTable("device_activation_code", {
	codeHash: text("code_hash").notNull().unique(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	deviceId: text("device_id").references(() => device.id),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	id: text("id").primaryKey(),
	usedAt: integer("used_at", { mode: "timestamp_ms" }),
});

export const operation = sqliteTable(
	"operation",
	{
		aggregateId: text("aggregate_id"),
		aggregateType: text("aggregate_type"),
		baseVersion: integer("base_version"),
		command: text("command").notNull(),
		deviceId: text("device_id").references(() => device.id),
		epoch: text("epoch").notNull(),
		occurredAt: integer("occurred_at", { mode: "timestamp_ms" }),
		opHash: text("op_hash").notNull(),
		opId: text("op_id").primaryKey(),
		receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
		result: text("result", { mode: "json" }).notNull(),
		status: text("status", { enum: operationStatusValues }).notNull(),
	},
	(table) => [index("operation_status_idx").on(table.status)]
);

export const changeLog = sqliteTable("change_log", {
	aggregateId: text("aggregate_id").notNull(),
	aggregateType: text("aggregate_type").notNull(),
	changedAt: integer("changed_at", { mode: "timestamp_ms" }).notNull(),
	cursor: integer("cursor").primaryKey({ autoIncrement: true }),
	data: text("data", { mode: "json" }).notNull(),
	epoch: text("epoch").notNull(),
	opId: text("op_id"),
	version: integer("version").notNull(),
});

export const syncConflict = sqliteTable(
	"sync_conflict",
	{
		aggregateId: text("aggregate_id").notNull(),
		aggregateType: text("aggregate_type").notNull(),
		baseVersion: integer("base_version"),
		choice: text("choice"),
		command: text("command").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		currentValues: text("current_values", { mode: "json" }).notNull(),
		currentVersion: integer("current_version").notNull(),
		id: text("id").primaryKey(),
		localValues: text("local_values", { mode: "json" }).notNull(),
		opId: text("op_id").notNull().unique(),
		reason: text("reason"),
		resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
		resolvedByOpId: text("resolved_by_op_id"),
		status: text("status", { enum: conflictStatusValues }).notNull(),
	},
	(table) => [index("sync_conflict_status_idx").on(table.status)]
);

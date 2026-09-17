import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export const clientKindValues = ["person", "organization"] as const;

export const client = sqliteTable("client", {
	address: text("address"),
	anonymizedAt: integer("anonymized_at", { mode: "timestamp_ms" }),
	archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	email: text("email"),
	id: text("id").primaryKey(),
	kind: text("kind", { enum: clientKindValues }).notNull(),
	name: text("name").notNull(),
	notes: text("notes"),
	phone: text("phone"),
	searchText: text("search_text").notNull(),
	secondaryPhone: text("secondary_phone"),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	version: integer("version").notNull(),
});

export const clientProfile = sqliteTable(
	"client_profile",
	{
		archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
		clientId: text("client_id")
			.notNull()
			.references(() => client.id),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		notes: text("notes"),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
		version: integer("version").notNull(),
	},
	(table) => [index("client_profile_client_idx").on(table.clientId)]
);

export const redactedAggregate = sqliteTable(
	"redacted_aggregate",
	{
		aggregateId: text("aggregate_id").notNull(),
		aggregateType: text("aggregate_type").notNull(),
		opId: text("op_id").notNull(),
		redactedAt: integer("redacted_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [primaryKey({ columns: [table.aggregateType, table.aggregateId] })]
);

import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { clientProfile } from "./clients";

export type MeasurementTemplateFieldRow = {
	active: boolean;
	id: string;
	label: string;
};

export type MeasurementFieldRow = {
	fieldId: string;
	label: string;
	valueMm: number | null;
};

export const measurementTemplate = sqliteTable("measurement_template", {
	archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	fields: text("fields", { mode: "json" })
		.$type<MeasurementTemplateFieldRow[]>()
		.notNull(),
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	version: integer("version").notNull(),
});

export const measurement = sqliteTable(
	"measurement",
	{
		archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		fields: text("fields", { mode: "json" })
			.$type<MeasurementFieldRow[]>()
			.notNull(),
		id: text("id").primaryKey(),
		notes: text("notes"),
		profileId: text("profile_id")
			.notNull()
			.references(() => clientProfile.id),
		takenOn: text("taken_on").notNull(),
		templateId: text("template_id")
			.notNull()
			.references(() => measurementTemplate.id),
		templateName: text("template_name").notNull(),
		templateVersion: integer("template_version").notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
		version: integer("version").notNull(),
	},
	(table) => [index("measurement_profile_idx").on(table.profileId)]
);

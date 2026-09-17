import type { Database } from "@costura-pro/db";
import { client, clientProfile } from "@costura-pro/db/schema/clients";
import {
	type MeasurementFieldRow,
	type MeasurementTemplateFieldRow,
	measurement,
	measurementTemplate,
} from "@costura-pro/db/schema/measurements";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { appendChange } from "../change-log";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";

export type TemplateRow = typeof measurementTemplate.$inferSelect;
export type TemplateFields = Pick<TemplateRow, "fields" | "name">;
export type TemplatePatch = Partial<
	Pick<TemplateRow, "archivedAt" | "fields" | "name">
>;

export type TemplateSnapshot = {
	archivedAt: string | null;
	createdAt: string;
	fields: MeasurementTemplateFieldRow[];
	id: string;
	name: string;
	version: number;
};

type Reader = Pick<Database, "select">;

const isoOrNull = (value: Date | null) => value?.toISOString() ?? null;

export function templateSnapshot(row: TemplateRow): TemplateSnapshot {
	return {
		archivedAt: isoOrNull(row.archivedAt),
		createdAt: row.createdAt.toISOString(),
		fields: row.fields,
		id: row.id,
		name: row.name,
		version: row.version,
	};
}

export function readTemplate(db: Reader, id: string): TemplateRow | undefined {
	return db
		.select()
		.from(measurementTemplate)
		.where(eq(measurementTemplate.id, id))
		.get();
}

export function listTemplates(db: Reader): TemplateRow[] {
	return db
		.select()
		.from(measurementTemplate)
		.orderBy(asc(measurementTemplate.name), asc(measurementTemplate.id))
		.all();
}

function recordTemplate(db: Executor, row: TemplateRow, stamp: ChangeStamp) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "measurementTemplate",
		data: templateSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

export function insertTemplate(
	db: Executor,
	id: string,
	fields: TemplateFields,
	stamp: ChangeStamp
): TemplateRow {
	const row = db
		.insert(measurementTemplate)
		.values({
			...fields,
			createdAt: stamp.now,
			id,
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordTemplate(db, row, stamp);
	return row;
}

export function updateTemplate(
	db: Executor,
	current: TemplateRow,
	patch: TemplatePatch,
	stamp: ChangeStamp
): TemplateRow {
	const next = db
		.update(measurementTemplate)
		.set({ ...patch, updatedAt: stamp.now, version: current.version + 1 })
		.where(
			and(
				eq(measurementTemplate.id, current.id),
				eq(measurementTemplate.version, current.version)
			)
		)
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Modelo mudou durante a operação",
		});
	}
	recordTemplate(db, next, stamp);
	return next;
}

export type MeasurementRow = typeof measurement.$inferSelect;
export type MeasurementFields = Pick<
	MeasurementRow,
	| "fields"
	| "notes"
	| "profileId"
	| "takenOn"
	| "templateId"
	| "templateName"
	| "templateVersion"
>;
export type MeasurementPatch = Partial<
	Pick<MeasurementRow, "archivedAt" | "fields" | "notes" | "takenOn">
>;

export type MeasurementSnapshot = {
	archivedAt: string | null;
	createdAt: string;
	fields: MeasurementFieldRow[];
	id: string;
	notes: string | null;
	profileId: string;
	takenOn: string;
	templateId: string;
	templateName: string;
	templateVersion: number;
	version: number;
};

export function measurementSnapshot(row: MeasurementRow): MeasurementSnapshot {
	return {
		archivedAt: isoOrNull(row.archivedAt),
		createdAt: row.createdAt.toISOString(),
		fields: row.fields,
		id: row.id,
		notes: row.notes,
		profileId: row.profileId,
		takenOn: row.takenOn,
		templateId: row.templateId,
		templateName: row.templateName,
		templateVersion: row.templateVersion,
		version: row.version,
	};
}

export function readMeasurement(
	db: Reader,
	id: string
): MeasurementRow | undefined {
	return db.select().from(measurement).where(eq(measurement.id, id)).get();
}

export function listMeasurementsOfProfiles(
	db: Reader,
	profileIds: readonly string[]
): MeasurementRow[] {
	if (profileIds.length === 0) {
		return [];
	}
	return db
		.select()
		.from(measurement)
		.where(inArray(measurement.profileId, [...profileIds]))
		.orderBy(
			desc(measurement.takenOn),
			desc(measurement.createdAt),
			desc(measurement.id)
		)
		.all();
}

export function isMeasurementAnonymized(
	db: Reader,
	row: MeasurementRow
): boolean {
	const owner = db
		.select({ anonymizedAt: client.anonymizedAt })
		.from(clientProfile)
		.innerJoin(client, eq(client.id, clientProfile.clientId))
		.where(eq(clientProfile.id, row.profileId))
		.get();
	return (owner?.anonymizedAt ?? null) !== null;
}

function recordMeasurement(
	db: Executor,
	row: MeasurementRow,
	stamp: ChangeStamp
) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "measurement",
		data: measurementSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

export function insertMeasurement(
	db: Executor,
	id: string,
	fields: MeasurementFields,
	stamp: ChangeStamp
): MeasurementRow {
	const row = db
		.insert(measurement)
		.values({
			...fields,
			createdAt: stamp.now,
			id,
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordMeasurement(db, row, stamp);
	return row;
}

export function updateMeasurement(
	db: Executor,
	current: MeasurementRow,
	patch: MeasurementPatch,
	stamp: ChangeStamp
): MeasurementRow {
	const next = db
		.update(measurement)
		.set({ ...patch, updatedAt: stamp.now, version: current.version + 1 })
		.where(
			and(
				eq(measurement.id, current.id),
				eq(measurement.version, current.version)
			)
		)
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Medição mudou durante a operação",
		});
	}
	recordMeasurement(db, next, stamp);
	return next;
}

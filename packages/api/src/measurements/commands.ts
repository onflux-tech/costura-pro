import { mergeTemplateFields } from "@costura-pro/domain/measurement";

import { isProfileAnonymized, readProfile } from "../clients/store";
import { commandMessages } from "../command-messages";
import { emptyPayload } from "../schemas";
import type { CreateDefinition } from "../sync/commands";
import {
	archivePatch,
	definedFields,
	unarchivePatch,
	updateCommands,
} from "../update-command";
import {
	measurementCreatePayload,
	measurementPatchPayload,
	templateCreatePayload,
	templatePatchPayload,
} from "./schemas";
import {
	insertMeasurement,
	insertTemplate,
	isMeasurementAnonymized,
	type MeasurementPatch,
	type MeasurementRow,
	measurementSnapshot,
	readMeasurement,
	readTemplate,
	type TemplatePatch,
	type TemplateRow,
	templateSnapshot,
	updateMeasurement,
	updateTemplate,
} from "./store";

const templateCommand = updateCommands<TemplateRow, TemplatePatch>({
	aggregateType: "measurementTemplate",
	anonymized: () => false,
	read: readTemplate,
	snapshot: templateSnapshot,
	update: updateTemplate,
});

const measurementCommand = updateCommands<MeasurementRow, MeasurementPatch>({
	aggregateType: "measurement",
	anonymized: isMeasurementAnonymized,
	read: readMeasurement,
	snapshot: measurementSnapshot,
	update: updateMeasurement,
});

const createTemplate: CreateDefinition = {
	aggregateType: "measurementTemplate",
	create: (db, id, values, stamp) => {
		const { fields, name } = templateCreatePayload.parse(values);
		return insertTemplate(
			db,
			id,
			{ fields: mergeTemplateFields([], fields), name },
			stamp
		).version;
	},
	exists: (db, id) => readTemplate(db, id) !== undefined,
	kind: "create",
	payload: templateCreatePayload,
};

const createMeasurement: CreateDefinition = {
	aggregateType: "measurement",
	create: (db, id, values, stamp) => {
		const fields = measurementCreatePayload.parse(values);
		const profile = readProfile(db, fields.profileId);
		if (!profile) {
			return {
				message: commandMessages.profileNotFound,
				reason: "aggregateNotFound",
			};
		}
		if (isProfileAnonymized(db, profile)) {
			return { reason: "aggregateAnonymized" };
		}
		if (!readTemplate(db, fields.templateId)) {
			return {
				message: commandMessages.measurementTemplateNotFound,
				reason: "aggregateNotFound",
			};
		}
		return insertMeasurement(db, id, fields, stamp).version;
	},
	exists: (db, id) => readMeasurement(db, id) !== undefined,
	kind: "create",
	payload: measurementCreatePayload,
};

export const measurementCommands = {
	"measurement.archive": measurementCommand(emptyPayload, archivePatch),
	"measurement.create": createMeasurement,
	"measurement.unarchive": measurementCommand(emptyPayload, unarchivePatch),
	"measurement.update": measurementCommand(
		measurementPatchPayload,
		(_row, values) => definedFields(values)
	),
	"measurementTemplate.archive": templateCommand(emptyPayload, archivePatch),
	"measurementTemplate.create": createTemplate,
	"measurementTemplate.unarchive": templateCommand(
		emptyPayload,
		unarchivePatch
	),
	"measurementTemplate.update": templateCommand(
		templatePatchPayload,
		(row, { fields, name }) =>
			definedFields({
				fields: fields ? mergeTemplateFields(row.fields, fields) : undefined,
				name,
			})
	),
};

import {
	duplicateLabelIndex,
	measurementLimits,
} from "@costura-pro/domain/measurement";
import z from "zod";

import { hasChange, optionalText } from "../schemas";

const labelField = z
	.string()
	.trim()
	.min(measurementLimits.fieldLabel.min)
	.max(measurementLimits.fieldLabel.max);

export const templateNameField = z
	.string()
	.trim()
	.min(measurementLimits.templateName.min)
	.max(measurementLimits.templateName.max);

const allDistinct = (ids: readonly string[]) =>
	new Set(ids).size === ids.length;

export const templateFieldsPayload = z
	.array(z.object({ id: z.uuid(), label: labelField }))
	.min(measurementLimits.fields.min)
	.max(measurementLimits.fields.max)
	.refine(
		(fields) => allDistinct(fields.map((field) => field.id)),
		"Campo repetido"
	)
	.refine(
		(fields) =>
			duplicateLabelIndex(fields.map((field) => field.label)) === null,
		"Rótulo repetido"
	);

export const templateCreatePayload = z.object({
	fields: templateFieldsPayload,
	name: templateNameField,
});

export const templatePatchPayload = z
	.object({
		fields: templateFieldsPayload.optional(),
		name: templateNameField.optional(),
	})
	.refine(hasChange, "Nada para alterar");

export const measurementFieldsPayload = z
	.array(
		z.object({
			fieldId: z.uuid(),
			label: labelField,
			valueMm: z
				.number()
				.int()
				.min(measurementLimits.valueMm.min)
				.max(measurementLimits.valueMm.max)
				.nullable(),
		})
	)
	.min(measurementLimits.fields.min)
	.max(measurementLimits.fields.max)
	.refine(
		(fields) => allDistinct(fields.map((field) => field.fieldId)),
		"Campo repetido"
	)
	.refine(
		(fields) => fields.some((field) => field.valueMm !== null),
		"Preencha pelo menos uma medida"
	);

const takenOnField = z.iso.date();

const measurementNotesField = optionalText(measurementLimits.notes);

export const measurementCreatePayload = z.object({
	fields: measurementFieldsPayload,
	notes: measurementNotesField.default(null),
	profileId: z.uuid(),
	takenOn: takenOnField,
	templateId: z.uuid(),
	templateName: templateNameField,
	templateVersion: z.number().int().positive(),
});

export const measurementPatchPayload = z
	.object({
		fields: measurementFieldsPayload.optional(),
		notes: measurementNotesField.optional(),
		takenOn: takenOnField.optional(),
	})
	.refine(hasChange, "Nada para alterar");

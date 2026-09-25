import { marginLimits } from "@costura-pro/domain/pricing";
import { serviceLimits } from "@costura-pro/domain/service";
import z from "zod";

import {
	hasChange,
	moneyCentsSchema,
	optionalText,
	whenShapeIsValid,
} from "../schemas";

const nameField = z
	.string()
	.trim()
	.min(serviceLimits.name.min)
	.max(serviceLimits.name.max);

const categoryField = optionalText(serviceLimits.category);

const notesField = optionalText(serviceLimits.notes);

const minutesField = z
	.number()
	.int()
	.min(serviceLimits.estimatedMinutes.min)
	.max(serviceLimits.estimatedMinutes.max)
	.nullable();

const suggestedStagesField = z
	.array(z.uuid())
	.max(serviceLimits.suggestedStages)
	.refine((ids) => new Set(ids).size === ids.length, {
		...whenShapeIsValid,
		message: "Etapa repetida",
	});

const marginField = z
	.number()
	.int()
	.min(marginLimits.min)
	.max(marginLimits.max);

export const serviceCreatePayload = z.object({
	category: categoryField.default(null),
	costCents: moneyCentsSchema,
	estimatedMinutes: minutesField.default(null),
	name: nameField,
	notes: notesField.default(null),
	outsourced: z.boolean().default(false),
	priceCents: moneyCentsSchema,
	suggestedStageIds: suggestedStagesField.default([]),
	targetMarginBasisPoints: marginField.nullable().default(null),
});

export const servicePatchPayload = z
	.object({
		category: categoryField.optional(),
		costCents: moneyCentsSchema.optional(),
		estimatedMinutes: minutesField.optional(),
		name: nameField.optional(),
		notes: notesField.optional(),
		outsourced: z.boolean().optional(),
		priceCents: moneyCentsSchema.optional(),
		suggestedStageIds: suggestedStagesField.optional(),
		targetMarginBasisPoints: marginField.nullable().optional(),
	})
	.refine(hasChange, "Nada para alterar");

export const targetMarginPayload = z.object({
	targetMarginBasisPoints: marginField,
});

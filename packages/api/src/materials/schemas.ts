import { materialLimits } from "@costura-pro/domain/material";
import { mediaHashPattern } from "@costura-pro/domain/media";
import { displayPrecision } from "@costura-pro/domain/quantity";
import { baseUnitCodes } from "@costura-pro/domain/unit";
import z from "zod";

import {
	hasChange,
	moneyCentsSchema,
	optionalText,
	quantityMicrosSchema,
} from "../schemas";

const nameField = z
	.string()
	.trim()
	.min(materialLimits.name.min)
	.max(materialLimits.name.max);

const categoryField = optionalText(materialLimits.category);

const notesField = optionalText(materialLimits.notes);

export const materialCreatePayload = z.object({
	category: categoryField.default(null),
	name: nameField,
	notes: notesField.default(null),
});

export const materialPatchPayload = z
	.object({
		category: categoryField.optional(),
		name: nameField.optional(),
		notes: notesField.optional(),
	})
	.refine(hasChange, "Nada para alterar");

const variantNameField = z
	.string()
	.trim()
	.min(materialLimits.variantName.min)
	.max(materialLimits.variantName.max);

const codeField = optionalText(materialLimits.code);

const baseUnitField = z.enum(baseUnitCodes);

const precisionField = z
	.number()
	.int()
	.min(displayPrecision.min)
	.max(displayPrecision.max);

const costField = moneyCentsSchema.nullable();

const quantityField = quantityMicrosSchema.nullable();

const hashField = z.string().regex(mediaHashPattern);

const photoField = z
	.object({ photoHash: hashField, thumbnailHash: hashField })
	.nullable();

const packagingField = z
	.object({
		label: z
			.string()
			.trim()
			.min(materialLimits.packagingLabel.min)
			.max(materialLimits.packagingLabel.max),
		quantityMicros: quantityMicrosSchema,
	})
	.nullable();

export const materialVariantCreatePayload = z.object({
	baseUnit: baseUnitField,
	code: codeField.default(null),
	displayPrecision: precisionField,
	materialId: z.uuid(),
	minQuantityMicros: quantityField.default(null),
	name: variantNameField,
	packaging: packagingField.default(null),
	photo: photoField.default(null),
	referenceCostCents: costField.default(null),
	targetQuantityMicros: quantityField.default(null),
	tracksLots: z.boolean().default(false),
});

export const materialVariantPatchPayload = z
	.object({
		code: codeField.optional(),
		displayPrecision: precisionField.optional(),
		minQuantityMicros: quantityField.optional(),
		name: variantNameField.optional(),
		packaging: packagingField.optional(),
		photo: photoField.optional(),
		referenceCostCents: costField.optional(),
		targetQuantityMicros: quantityField.optional(),
	})
	.refine(hasChange, "Nada para alterar");

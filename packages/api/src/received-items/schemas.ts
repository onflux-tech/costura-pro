import { mediaHashPattern } from "@costura-pro/domain/media";
import {
	receivedItemConditions,
	receivedItemLimits,
} from "@costura-pro/domain/received-item";
import z from "zod";

import { hasChange, optionalText } from "../schemas";

const hashField = z.string().regex(mediaHashPattern);

const photoPayload = z.object({
	caption: optionalText(receivedItemLimits.caption).default(null),
	photoHash: hashField,
	thumbnailHash: hashField,
});

const photosPayload = z
	.array(photoPayload)
	.max(receivedItemLimits.photos)
	.refine(
		(photos) =>
			new Set(photos.map((photo) => photo.photoHash)).size === photos.length,
		"Foto repetida"
	);

const dayField = z.iso.date();

const descriptionField = z
	.string()
	.trim()
	.min(receivedItemLimits.description.min)
	.max(receivedItemLimits.description.max);

const quantityField = z
	.number()
	.int()
	.min(receivedItemLimits.quantity.min)
	.max(receivedItemLimits.quantity.max);

const conditionField = z.enum(receivedItemConditions);

const accessoriesField = optionalText(receivedItemLimits.accessories);

const notesField = optionalText(receivedItemLimits.notes);

export const receivedItemCreatePayload = z.object({
	accessories: accessoriesField.default(null),
	clientId: z.uuid(),
	condition: conditionField,
	description: descriptionField,
	expectedReturnOn: dayField.nullable().default(null),
	notes: notesField.default(null),
	photos: photosPayload.default([]),
	quantity: quantityField,
	receivedOn: dayField,
});

export const receivedItemPatchPayload = z
	.object({
		accessories: accessoriesField.optional(),
		condition: conditionField.optional(),
		description: descriptionField.optional(),
		expectedReturnOn: dayField.nullable().optional(),
		notes: notesField.optional(),
		photos: photosPayload.optional(),
		quantity: quantityField.optional(),
		receivedOn: dayField.optional(),
		returnedOn: dayField.nullable().optional(),
	})
	.refine(hasChange, "Nada para alterar");

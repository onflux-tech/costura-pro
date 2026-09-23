import { mediaHashPattern } from "@costura-pro/domain/media";
import { marginLimits } from "@costura-pro/domain/pricing";
import { productLimits } from "@costura-pro/domain/product";
import z from "zod";

import {
	hasChange,
	moneyCentsSchema,
	optionalText,
	quantityMicrosSchema,
	whenShapeIsValid,
} from "../schemas";

const positiveQuantity = quantityMicrosSchema.refine(
	(value) => BigInt(value) > 0n,
	"Quantidade precisa ser maior que zero"
);

const hashField = z.string().regex(mediaHashPattern);

const noteField = optionalText(productLimits.itemNote).default(null);

const nameField = z
	.string()
	.trim()
	.min(productLimits.name.min)
	.max(productLimits.name.max);

const categoryField = optionalText(productLimits.category);

const notesField = optionalText(productLimits.notes);

const marginField = z
	.number()
	.int()
	.min(marginLimits.min)
	.max(marginLimits.max)
	.nullable();

const variantNameField = z
	.string()
	.trim()
	.min(productLimits.variantName.min)
	.max(productLimits.variantName.max);

const codeField = optionalText(productLimits.code);

const lossPayload = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("fixed"), quantityMicros: positiveQuantity }),
	z.object({
		basisPoints: z
			.number()
			.int()
			.min(productLimits.lossBasisPoints.min)
			.max(productLimits.lossBasisPoints.max),
		kind: z.literal("percent"),
	}),
]);

export const sheetItemPayload = z.discriminatedUnion("kind", [
	z.object({
		id: z.uuid(),
		kind: z.literal("material"),
		loss: lossPayload.nullable().default(null),
		materialVariantId: z.uuid(),
		note: noteField,
		quantityMicros: positiveQuantity,
	}),
	z.object({
		count: z
			.number()
			.int()
			.min(productLimits.serviceCount.min)
			.max(productLimits.serviceCount.max),
		id: z.uuid(),
		kind: z.literal("service"),
		note: noteField,
		serviceId: z.uuid(),
	}),
]);

const distinct = (ids: readonly string[]) => new Set(ids).size === ids.length;

export const sheetPayload = z
	.array(sheetItemPayload)
	.max(productLimits.sheetItems)
	.refine((items) => distinct(items.map((item) => item.id)), {
		...whenShapeIsValid,
		message: "Item repetido na ficha",
	});

const sheetChangePayload = z.discriminatedUnion("kind", [
	z.object({ item: sheetItemPayload, kind: z.literal("add") }),
	z.object({ item: sheetItemPayload, kind: z.literal("replace") }),
	z.object({ itemId: z.uuid(), kind: z.literal("remove") }),
]);

function changedId(change: z.output<typeof sheetChangePayload>): string {
	return change.kind === "remove" ? change.itemId : change.item.id;
}

export const sheetChangesPayload = z
	.array(sheetChangePayload)
	.max(productLimits.sheetChanges)
	.refine((changes) => distinct(changes.map(changedId)), {
		...whenShapeIsValid,
		message: "Ajuste repetido",
	});

const photosPayload = z
	.array(
		z.object({
			caption: optionalText(productLimits.caption).default(null),
			photoHash: hashField,
			thumbnailHash: hashField,
		})
	)
	.max(productLimits.photos)
	.refine((photos) => distinct(photos.map((photo) => photo.photoHash)), {
		...whenShapeIsValid,
		message: "Foto repetida",
	});

export const productCreatePayload = z.object({
	category: categoryField.default(null),
	name: nameField,
	notes: notesField.default(null),
	photos: photosPayload.default([]),
	sheet: sheetPayload.default([]),
	targetMarginBasisPoints: marginField.default(null),
});

export const productPatchPayload = z
	.object({
		category: categoryField.optional(),
		name: nameField.optional(),
		notes: notesField.optional(),
		photos: photosPayload.optional(),
		sheet: sheetPayload.optional(),
		targetMarginBasisPoints: marginField.optional(),
	})
	.refine(hasChange, "Nada para alterar");

export const productVariantCreatePayload = z.object({
	code: codeField.default(null),
	coverPhotoHash: hashField.nullable().default(null),
	name: variantNameField,
	priceCents: moneyCentsSchema,
	productId: z.uuid(),
	sheetChanges: sheetChangesPayload.default([]),
});

export const productVariantPatchPayload = z
	.object({
		code: codeField.optional(),
		coverPhotoHash: hashField.nullable().optional(),
		name: variantNameField.optional(),
		priceCents: moneyCentsSchema.optional(),
		sheetChanges: sheetChangesPayload.optional(),
	})
	.refine(hasChange, "Nada para alterar");

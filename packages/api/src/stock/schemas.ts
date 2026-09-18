import { stockLimits } from "@costura-pro/domain/stock";
import z from "zod";

import {
	hasChange,
	moneyCentsSchema,
	optionalText,
	quantityMicrosSchema,
	signedQuantityMicrosSchema,
	whenShapeIsValid,
} from "../schemas";

const locationNameField = z
	.string()
	.trim()
	.min(stockLimits.locationName.min)
	.max(stockLimits.locationName.max);

const lotLabelField = z
	.string()
	.trim()
	.min(stockLimits.lotLabel.min)
	.max(stockLimits.lotLabel.max);

const notesField = optionalText(stockLimits.notes);

const reasonField = z
	.string()
	.trim()
	.min(stockLimits.reason.min)
	.max(stockLimits.reason.max);

const occurredOnField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const positiveQuantity = quantityMicrosSchema.refine(
	(value) => BigInt(value) > 0n,
	"Quantidade precisa ser maior que zero"
);

const nonZeroQuantity = signedQuantityMicrosSchema.refine(
	(value) => BigInt(value) !== 0n,
	"Quantidade precisa ser diferente de zero"
);

export const stockLocationCreatePayload = z.object({
	name: locationNameField,
	notes: notesField.default(null),
});

export const stockLocationPatchPayload = z
	.object({
		name: locationNameField.optional(),
		notes: notesField.optional(),
	})
	.refine(hasChange, "Nada para alterar");

export const stockLotCreatePayload = z.object({
	label: lotLabelField,
	notes: notesField.default(null),
	variantId: z.uuid(),
});

export const stockLotPatchPayload = z
	.object({
		label: lotLabelField.optional(),
		notes: notesField.optional(),
	})
	.refine(hasChange, "Nada para alterar");

const movementPlace = {
	locationId: z.uuid(),
	lotId: z.uuid().nullable().default(null),
	occurredOn: occurredOnField,
	variantId: z.uuid(),
};

const openingPayload = z.object({
	...movementPlace,
	kind: z.literal("opening"),
	quantityMicros: positiveQuantity,
	reason: notesField.default(null),
	valueCents: moneyCentsSchema,
});

const adjustmentPayload = z
	.object({
		...movementPlace,
		kind: z.literal("adjustment"),
		quantityMicros: nonZeroQuantity,
		reason: reasonField,
		valueCents: moneyCentsSchema.optional(),
	})
	.refine(
		(values) =>
			BigInt(values.quantityMicros) > 0n
				? values.valueCents !== undefined
				: values.valueCents === undefined,
		{
			...whenShapeIsValid,
			message: "Entrada precisa de valor e saída toma a média do saldo",
		}
	);

export const stockMovementCreatePayload = z.discriminatedUnion("kind", [
	openingPayload,
	adjustmentPayload,
]);

export const stockMovementTransferPayload = z
	.object({
		fromLocationId: z.uuid(),
		inboundId: z.uuid(),
		lotId: z.uuid().nullable().default(null),
		occurredOn: occurredOnField,
		quantityMicros: positiveQuantity,
		reason: notesField.default(null),
		toLocationId: z.uuid(),
		variantId: z.uuid(),
	})
	.refine(
		(values) => values.fromLocationId !== values.toLocationId,
		"Origem e destino precisam ser diferentes"
	);

export const stockMovementReversePayload = z.object({
	counterpartId: z.uuid().nullable().default(null),
	occurredOn: occurredOnField,
	reason: reasonField,
	reversesMovementId: z.uuid(),
});

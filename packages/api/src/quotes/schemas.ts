import { maxExactInteger } from "@costura-pro/domain/quantity";
import {
	defaultQuoteValidityDays,
	discountCents,
	lineTotals,
	quoteDiscountOfText,
	quoteLimits,
	quoteLineOfText,
	quoteTotalsOfText,
} from "@costura-pro/domain/quote";
import { baseUnitCodes } from "@costura-pro/domain/unit";
import z from "zod";

import {
	moneyCentsSchema,
	optionalText,
	quantityMicrosSchema,
	whenShapeIsValid,
} from "../schemas";

const dayField = z.iso.date();

const positiveQuantity = quantityMicrosSchema.refine(
	(value) => BigInt(value) > 0n,
	"Quantidade precisa ser maior que zero"
);

const quantityField = z
	.number()
	.int()
	.min(quoteLimits.quantity.min)
	.max(quoteLimits.quantity.max);

const minutesField = z.number().int().min(1).max(9999).nullable().default(null);

const versionField = z.number().int().positive();

const copiedName = (max: number) => z.string().trim().min(1).max(max);

const descriptionField = z
	.string()
	.trim()
	.min(quoteLimits.description.min)
	.max(quoteLimits.description.max);

const noteField = optionalText(quoteLimits.lineNote).default(null);

const reasonField = optionalText(quoteLimits.discountReason).default(null);

export const quoteDiscountPayload = z.discriminatedUnion("kind", [
	z.object({
		amountCents: moneyCentsSchema,
		kind: z.literal("amount"),
		reason: reasonField,
	}),
	z.object({
		basisPoints: z
			.number()
			.int()
			.min(quoteLimits.percentDiscount.min)
			.max(quoteLimits.percentDiscount.max),
		kind: z.literal("percent"),
		reason: reasonField,
	}),
]);

const discountField = quoteDiscountPayload.nullable().default(null);

const materialComponent = z.object({
	baseUnit: z.enum(baseUnitCodes),
	code: optionalText(40).default(null),
	displayPrecision: z.number().int().min(0).max(6),
	id: z.uuid(),
	kind: z.literal("material"),
	materialName: copiedName(120),
	materialVariantId: z.uuid(),
	quantityMicros: positiveQuantity,
	unitCostCents: moneyCentsSchema.nullable().default(null),
	variantName: copiedName(80),
});

const serviceComponent = z.object({
	count: z
		.number()
		.int()
		.min(quoteLimits.componentCount.min)
		.max(quoteLimits.componentCount.max),
	estimatedMinutes: minutesField,
	id: z.uuid(),
	kind: z.literal("service"),
	outsourced: z.boolean(),
	serviceId: z.uuid(),
	serviceName: copiedName(120),
	serviceVersion: versionField,
	unitCostCents: moneyCentsSchema,
});

const distinct = (ids: readonly string[]) => new Set(ids).size === ids.length;

const componentsPayload = z
	.array(z.discriminatedUnion("kind", [materialComponent, serviceComponent]))
	.max(quoteLimits.components)
	.refine((components) => distinct(components.map((item) => item.id)), {
		...whenShapeIsValid,
		message: "Componente repetido",
	});

const sourcePayload = z.object({
	productId: z.uuid(),
	productName: copiedName(120),
	productVersion: versionField,
	variantId: z.uuid().nullable().default(null),
	variantName: copiedName(80).nullable().default(null),
});

const serviceLine = z.object({
	catalogPriceCents: moneyCentsSchema,
	discount: discountField,
	estimatedMinutes: minutesField,
	id: z.uuid(),
	kind: z.literal("service"),
	note: noteField,
	outsourced: z.boolean(),
	profileId: z.uuid().nullable().default(null),
	quantity: quantityField,
	receivedItemId: z.uuid().nullable().default(null),
	serviceId: z.uuid(),
	serviceName: copiedName(120),
	serviceVersion: versionField,
	unitCostCents: moneyCentsSchema,
	unitPriceCents: moneyCentsSchema,
});

const customLine = z.object({
	components: componentsPayload,
	description: descriptionField,
	discount: discountField,
	id: z.uuid(),
	kind: z.literal("custom"),
	note: noteField,
	profileId: z.uuid().nullable().default(null),
	quantity: quantityField,
	source: sourcePayload.nullable().default(null),
	unitPriceCents: moneyCentsSchema,
});

const materialLine = z.object({
	baseUnit: z.enum(baseUnitCodes),
	code: optionalText(40).default(null),
	discount: discountField,
	displayPrecision: z.number().int().min(0).max(6),
	id: z.uuid(),
	kind: z.literal("material"),
	materialName: copiedName(120),
	materialVariantId: z.uuid(),
	note: noteField,
	quantityMicros: positiveQuantity,
	unitCostCents: moneyCentsSchema.nullable().default(null),
	unitPriceCents: moneyCentsSchema,
	variantName: copiedName(80),
});

const freeLine = z.object({
	description: descriptionField,
	discount: discountField,
	id: z.uuid(),
	kind: z.literal("free"),
	note: noteField,
	quantity: quantityField,
	unitCostCents: moneyCentsSchema.nullable().default(null),
	unitPriceCents: moneyCentsSchema,
});

export const quoteLinePayload = z
	.discriminatedUnion("kind", [serviceLine, customLine, materialLine, freeLine])
	.refine(
		(line) => {
			const { grossCents } = lineTotals(quoteLineOfText(line));
			return (
				discountCents(grossCents, quoteDiscountOfText(line.discount)) <=
				grossCents
			);
		},
		{ ...whenShapeIsValid, message: "Desconto maior que o valor" }
	);

function linesOf(min: number) {
	return z
		.array(quoteLinePayload)
		.min(min)
		.max(quoteLimits.lines)
		.refine((lines) => distinct(lines.map((line) => line.id)), {
			...whenShapeIsValid,
			message: "Linha repetida",
		});
}

const contentFields = {
	discount: discountField,
	leadTimeDays: z
		.number()
		.int()
		.min(quoteLimits.leadTimeDays.min)
		.max(quoteLimits.leadTimeDays.max)
		.nullable()
		.default(null),
	lines: linesOf(0).default([]),
	notes: optionalText(quoteLimits.notes).default(null),
	validityDays: z
		.number()
		.int()
		.min(quoteLimits.validityDays.min)
		.max(quoteLimits.validityDays.max)
		.default(defaultQuoteValidityDays),
};

type ContentValues = {
	discount: z.output<typeof discountField>;
	lines: z.output<typeof quoteLinePayload>[];
};

function discountFits({ discount, lines }: ContentValues): boolean {
	const totals = quoteTotalsOfText(lines, discount);
	return totals.documentDiscountCents <= totals.subtotalCents;
}

function withinExactRange({ discount, lines }: ContentValues): boolean {
	const totals = quoteTotalsOfText(lines, discount);
	return [
		totals.grossCents,
		totals.subtotalCents,
		totals.costCents ?? 0n,
	].every((value) => value <= maxExactInteger);
}

const discountCheck = {
	...whenShapeIsValid,
	message: "Desconto maior que o valor",
};

const rangeCheck = { ...whenShapeIsValid, message: "Valor acima do limite" };

export const quoteContentPayload = z
	.object(contentFields)
	.refine(withinExactRange, rangeCheck)
	.refine(discountFits, discountCheck);

export const quoteCreatePayload = z
	.object({ ...contentFields, clientId: z.uuid(), createdOn: dayField })
	.refine(withinExactRange, rangeCheck)
	.refine(discountFits, discountCheck);

export const quoteRefusePayload = z.object({
	reason: optionalText(quoteLimits.refusalReason).default(null),
	refusedOn: dayField,
});

export const quoteEmitPayload = z.object({
	content: z
		.object({ ...contentFields, lines: linesOf(1) })
		.refine(withinExactRange, rangeCheck)
		.refine(discountFits, discountCheck),
	emittedOn: dayField,
	quoteId: z.uuid(),
	reason: optionalText(quoteLimits.revisionReason).default(null),
});

export type QuoteContentValues = z.output<typeof quoteContentPayload>;

export type QuoteEmitValues = z.output<typeof quoteEmitPayload>;

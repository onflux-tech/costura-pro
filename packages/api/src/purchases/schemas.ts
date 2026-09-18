import { materialLimits } from "@costura-pro/domain/material";
import {
	type PurchaseTotals,
	purchaseLimits,
	purchaseTotals,
} from "@costura-pro/domain/purchase";
import { supplierLimits } from "@costura-pro/domain/supplier";
import z from "zod";

import { phoneField } from "../clients/schemas";
import { occurredOnField } from "../finance/schemas";
import {
	hasChange,
	moneyCentsSchema,
	optionalText,
	quantityMicrosSchema,
	whenShapeIsValid,
} from "../schemas";

const supplierNameField = z
	.string()
	.trim()
	.min(supplierLimits.name.min)
	.max(supplierLimits.name.max);

const supplierNotesField = optionalText(supplierLimits.notes);

const supplierEmailField = optionalText(supplierLimits.email).pipe(
	z.email().nullable()
);

export const supplierCreatePayload = z.object({
	email: supplierEmailField.default(null),
	name: supplierNameField,
	notes: supplierNotesField.default(null),
	phone: phoneField.default(null),
});

export const supplierPatchPayload = z
	.object({
		email: supplierEmailField.optional(),
		name: supplierNameField.optional(),
		notes: supplierNotesField.optional(),
		phone: phoneField.optional(),
	})
	.refine(hasChange, "Nada para alterar");

const positiveQuantity = quantityMicrosSchema.refine(
	(value) => BigInt(value) > 0n,
	"Quantidade precisa ser maior que zero"
);

const packagingLabelField = z
	.string()
	.trim()
	.min(materialLimits.packagingLabel.min)
	.max(materialLimits.packagingLabel.max);

const purchaseReasonField = z
	.string()
	.trim()
	.min(purchaseLimits.reason.min)
	.max(purchaseLimits.reason.max);

const purchaseItemPayload = z.object({
	locationId: z.uuid(),
	lotId: z.uuid().nullable().default(null),
	movementId: z.uuid(),
	packageCountMicros: positiveQuantity,
	packagingLabel: packagingLabelField,
	packagingQuantityMicros: positiveQuantity,
	unitPriceCents: moneyCentsSchema,
	variantId: z.uuid(),
});

const purchasePaymentPayload = z.discriminatedUnion("kind", [
	z.object({
		accountId: z.uuid(),
		kind: z.literal("now"),
		movementId: z.uuid(),
	}),
	z.object({ dueOn: occurredOnField, kind: z.literal("later") }),
]);

const purchaseShape = z.object({
	discountCents: moneyCentsSchema.default("0"),
	freightCents: moneyCentsSchema.default("0"),
	items: z
		.array(purchaseItemPayload)
		.min(purchaseLimits.items.min)
		.max(purchaseLimits.items.max),
	notes: optionalText(purchaseLimits.notes).default(null),
	obligationId: z.uuid(),
	occurredOn: occurredOnField,
	payment: purchasePaymentPayload,
	reference: optionalText(purchaseLimits.reference).default(null),
	supplierId: z.uuid(),
});

export type PurchaseCreateValues = z.output<typeof purchaseShape>;

function idsOf(values: PurchaseCreateValues): string[] {
	return [
		...values.items.map((item) => item.movementId),
		values.obligationId,
		...(values.payment.kind === "now" ? [values.payment.movementId] : []),
	];
}

export function computePurchase(values: PurchaseCreateValues) {
	return purchaseTotals(
		values.items.map((item) => ({
			packageCountMicros: BigInt(item.packageCountMicros),
			packagingQuantityMicros: BigInt(item.packagingQuantityMicros),
			unitPriceCents: BigInt(item.unitPriceCents),
		})),
		BigInt(values.freightCents),
		BigInt(values.discountCents)
	);
}

export const purchaseCreatePayload = purchaseShape
	.refine((values) => new Set(idsOf(values)).size === idsOf(values).length, {
		...whenShapeIsValid,
		message: "Ids repetidos na compra",
	})
	.refine((values) => computePurchase(values).ok, {
		...whenShapeIsValid,
		message: "Valores da compra inválidos",
	});

export function purchaseTotalsOf(values: PurchaseCreateValues): PurchaseTotals {
	const result = computePurchase(values);
	if (!result.ok) {
		throw new Error(result.problem);
	}
	return result.totals;
}

export const purchaseReversePayload = z
	.object({
		movementIds: z
			.array(z.uuid())
			.min(purchaseLimits.items.min)
			.max(purchaseLimits.items.max),
		occurredOn: occurredOnField,
		paymentReversalId: z.uuid(),
		purchaseId: z.uuid(),
		reason: purchaseReasonField,
	})
	.refine(
		(values) => {
			const ids = [...values.movementIds, values.paymentReversalId];
			return new Set(ids).size === ids.length;
		},
		{ ...whenShapeIsValid, message: "Ids repetidos no estorno" }
	);

export const obligationPayPayload = z.object({
	accountId: z.uuid(),
	obligationId: z.uuid(),
	occurredOn: occurredOnField,
});

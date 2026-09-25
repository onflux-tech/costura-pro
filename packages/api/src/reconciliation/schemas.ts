import { reconciliationLimits } from "@costura-pro/domain/reconciliation";
import z from "zod";

import { occurredOnField } from "../finance/schemas";
import {
	optionalText,
	quantityMicrosSchema,
	whenShapeIsValid,
} from "../schemas";

const positiveQuantity = quantityMicrosSchema.refine(
	(value) => BigInt(value) > 0n,
	"Quantidade precisa ser maior que zero"
);

export const reconciliationPartPayload = z.object({
	locationId: z.uuid(),
	lotId: z.uuid().nullable(),
	movementId: z.uuid(),
	quantityMicros: positiveQuantity,
});

export const reconciliationLinePayload = z.object({
	consumedMicros: quantityMicrosSchema,
	lostMicros: quantityMicrosSchema,
	parts: z.array(reconciliationPartPayload).max(reconciliationLimits.parts.max),
	plannedVariantId: z.uuid(),
	swapReason: z
		.string()
		.trim()
		.min(reconciliationLimits.reason.min)
		.max(reconciliationLimits.reason.max)
		.nullable(),
	variantId: z.uuid(),
});

type ReconciliationLineValues = z.output<typeof reconciliationLinePayload>;

function partsAddUp(line: ReconciliationLineValues): boolean {
	const parts = line.parts.reduce(
		(total, part) => total + BigInt(part.quantityMicros),
		0n
	);
	return parts === BigInt(line.consumedMicros) + BigInt(line.lostMicros);
}

function distinctPoints(line: ReconciliationLineValues): boolean {
	const points = line.parts.map(
		(part) => `${part.locationId}|${part.lotId ?? ""}`
	);
	return new Set(points).size === points.length;
}

function swapExplained(line: ReconciliationLineValues): boolean {
	return (
		(line.swapReason !== null) === (line.variantId !== line.plannedVariantId)
	);
}

export const reconciliationCreatePayload = z
	.object({
		itemId: z.uuid(),
		lines: z
			.array(reconciliationLinePayload)
			.min(reconciliationLimits.lines.min)
			.max(reconciliationLimits.lines.max),
		note: optionalText(reconciliationLimits.note).default(null),
		occurredOn: occurredOnField,
	})
	.refine((values) => values.lines.every(partsAddUp), {
		...whenShapeIsValid,
		message: "Partes não somam a saída",
	})
	.refine((values) => values.lines.every(distinctPoints), {
		...whenShapeIsValid,
		message: "Local e lote repetidos",
	})
	.refine((values) => values.lines.every(swapExplained), {
		...whenShapeIsValid,
		message: "Motivo da troca obrigatório",
	})
	.refine(
		(values) => {
			const ids = values.lines.flatMap((line) =>
				line.parts.map((part) => part.movementId)
			);
			return new Set(ids).size === ids.length;
		},
		{ ...whenShapeIsValid, message: "Id repetido" }
	);

export type ReconciliationCreateValues = z.infer<
	typeof reconciliationCreatePayload
>;

export const reconciliationReversePayload = z
	.object({
		movementIds: z
			.array(z.uuid())
			.max(reconciliationLimits.lines.max * reconciliationLimits.parts.max),
		occurredOn: occurredOnField,
		reason: z
			.string()
			.trim()
			.min(reconciliationLimits.reason.min)
			.max(reconciliationLimits.reason.max),
		reconciliationId: z.uuid(),
	})
	.refine(
		(values) => new Set(values.movementIds).size === values.movementIds.length,
		{ ...whenShapeIsValid, message: "Id repetido" }
	);

export type ReconciliationReverseValues = z.infer<
	typeof reconciliationReversePayload
>;

import { maxExactInteger } from "@costura-pro/domain/quantity";
import {
	balancePointId,
	countOutcome,
	inventoryLimits,
} from "@costura-pro/domain/stock";
import z from "zod";

import { occurredOnField } from "../finance/schemas";
import {
	moneyCentsSchema,
	optionalText,
	quantityMicrosSchema,
	signedQuantityMicrosSchema,
	whenShapeIsValid,
} from "../schemas";

const inventoryLinePayload = z.object({
	countedMicros: quantityMicrosSchema,
	expectedMicros: signedQuantityMicrosSchema,
	locationId: z.uuid(),
	lotId: z.uuid().nullable().default(null),
	movementId: z.uuid().nullable().default(null),
	valueCents: moneyCentsSchema.nullable().default(null),
	variantId: z.uuid(),
});

type InventoryLineValues = z.output<typeof inventoryLinePayload>;

type InventoryLines = { lines: InventoryLineValues[] };

function pointsAreUnique({ lines }: InventoryLines): boolean {
	const points = lines.map((line) =>
		balancePointId(line.variantId, line.locationId, line.lotId)
	);
	return new Set(points).size === points.length;
}

function movementIdsAreUnique({ lines }: InventoryLines): boolean {
	const ids = lines.flatMap((line) =>
		line.movementId === null ? [] : [line.movementId]
	);
	return new Set(ids).size === ids.length;
}

function lineIsConsistent(line: InventoryLineValues): boolean {
	const expected = BigInt(line.expectedMicros);
	const counted = BigInt(line.countedMicros);
	const difference = counted - expected;
	if (difference > maxExactInteger || difference < -maxExactInteger) {
		return false;
	}
	const outcome = countOutcome(expected, counted);
	if (outcome.kind === "match") {
		return line.movementId === null && line.valueCents === null;
	}
	if (outcome.kind === "surplus") {
		return line.movementId !== null && line.valueCents !== null;
	}
	return line.movementId !== null && line.valueCents === null;
}

export const inventorySessionCreatePayload = z
	.object({
		lines: z
			.array(inventoryLinePayload)
			.min(inventoryLimits.lines.min)
			.max(inventoryLimits.lines.max),
		notes: optionalText(inventoryLimits.notes).default(null),
		occurredOn: occurredOnField,
		reason: z
			.string()
			.trim()
			.min(inventoryLimits.reason.min)
			.max(inventoryLimits.reason.max),
	})
	.refine(pointsAreUnique, {
		...whenShapeIsValid,
		message: "Ponto repetido na contagem",
	})
	.refine(movementIdsAreUnique, {
		...whenShapeIsValid,
		message: "Ids repetidos na contagem",
	})
	.refine(({ lines }) => lines.every(lineIsConsistent), {
		...whenShapeIsValid,
		message: "Linha da contagem inconsistente",
	});

export type InventorySessionCreateValues = z.output<
	typeof inventorySessionCreatePayload
>;

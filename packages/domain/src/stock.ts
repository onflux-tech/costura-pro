export const stockMovementKinds = [
	"opening",
	"adjustment",
	"transferOut",
	"transferIn",
	"reversal",
	"purchase",
	"inventory",
	"consumption",
] as const;

export type StockMovementKind = (typeof stockMovementKinds)[number];

export const stockLimits = {
	locationName: { max: 60, min: 1 },
	lotLabel: { max: 60, min: 1 },
	notes: 2000,
	reason: { max: 200, min: 1 },
} as const;

export const inventoryLimits = {
	lines: { max: 500, min: 1 },
	locations: { max: 100, min: 1 },
	notes: 2000,
	reason: { max: 200, min: 1 },
} as const;

export type CountOutcome =
	| { kind: "match" }
	| { kind: "shortage"; quantityMicros: bigint }
	| { kind: "surplus"; quantityMicros: bigint };

export function countOutcome(
	expectedMicros: bigint,
	countedMicros: bigint
): CountOutcome {
	const difference = countedMicros - expectedMicros;
	if (difference === 0n) {
		return { kind: "match" };
	}
	return difference > 0n
		? { kind: "surplus", quantityMicros: difference }
		: { kind: "shortage", quantityMicros: difference };
}

export function balancePointId(
	variantId: string,
	locationId: string,
	lotId: string | null
): string {
	return `${variantId}|${locationId}|${lotId ?? "-"}`;
}

export function exitValueCents(
	pointQuantityMicros: bigint,
	pointValueCents: bigint,
	exitMicros: bigint
): bigint {
	if (pointQuantityMicros <= 0n) {
		return 0n;
	}
	return (
		(pointValueCents * exitMicros * 2n + pointQuantityMicros) /
		(pointQuantityMicros * 2n)
	);
}

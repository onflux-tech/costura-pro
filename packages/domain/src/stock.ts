export const stockMovementKinds = [
	"opening",
	"adjustment",
	"transferOut",
	"transferIn",
	"reversal",
	"purchase",
] as const;

export type StockMovementKind = (typeof stockMovementKinds)[number];

export const stockLimits = {
	locationName: { max: 60, min: 1 },
	lotLabel: { max: 60, min: 1 },
	notes: 2000,
	reason: { max: 200, min: 1 },
} as const;

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

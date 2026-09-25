import { multiplyHalfUp } from "./quantity";
import { exitValueCents } from "./stock";

export const reconciliationLimits = {
	lines: { max: 60, min: 1 },
	note: 200,
	parts: { max: 20 },
	reason: { max: 200, min: 1 },
} as const;

export type ConsumptionPoint = {
	locationId: string;
	locationName: string;
	lotCreatedAt: string | null;
	lotId: string | null;
	quantityMicros: bigint;
};

export type SuggestedPart = {
	locationId: string;
	lotId: string | null;
	quantityMicros: bigint;
};

export type PartValue = {
	provisionalCents: bigint;
	provisionalMicros: bigint;
	valueCents: bigint;
};

export type ReconciliationOutcome = {
	extraMicros: bigint;
	leftoverMicros: bigint;
	outMicros: bigint;
};

function compareNullFirst(a: string | null, b: string | null): number {
	if (a === b) {
		return 0;
	}
	if (a === null) {
		return -1;
	}
	if (b === null) {
		return 1;
	}
	return a < b ? -1 : 1;
}

function comparePoints(a: ConsumptionPoint, b: ConsumptionPoint): number {
	return (
		compareNullFirst(a.lotCreatedAt, b.lotCreatedAt) ||
		a.locationName.localeCompare(b.locationName, "pt-BR") ||
		compareNullFirst(a.locationId, b.locationId)
	);
}

export function suggestConsumptionParts(
	points: readonly ConsumptionPoint[],
	needMicros: bigint
): SuggestedPart[] {
	const available = points
		.filter((point) => point.quantityMicros > 0n)
		.sort(comparePoints);
	const parts: SuggestedPart[] = [];
	let missing = needMicros;
	for (const point of available) {
		if (missing <= 0n) {
			break;
		}
		const taken =
			point.quantityMicros < missing ? point.quantityMicros : missing;
		parts.push({
			locationId: point.locationId,
			lotId: point.lotId,
			quantityMicros: taken,
		});
		missing -= taken;
	}
	const last = parts.at(-1);
	if (last !== undefined && missing > 0n) {
		last.quantityMicros += missing;
	}
	return parts;
}

export function consumptionPartValue(
	pointQuantityMicros: bigint,
	pointValueCents: bigint,
	partMicros: bigint,
	referenceCostCents: bigint | null
): PartValue {
	const positive = pointQuantityMicros > 0n ? pointQuantityMicros : 0n;
	const covered = partMicros < positive ? partMicros : positive;
	const provisionalMicros = partMicros - covered;
	const coveredValue =
		covered > 0n
			? exitValueCents(pointQuantityMicros, pointValueCents, covered)
			: 0n;
	let provisionalCents = 0n;
	if (pointQuantityMicros > 0n) {
		provisionalCents = exitValueCents(
			pointQuantityMicros,
			pointValueCents,
			provisionalMicros
		);
	} else if (referenceCostCents !== null) {
		provisionalCents = multiplyHalfUp(provisionalMicros, referenceCostCents);
	}
	return {
		provisionalCents,
		provisionalMicros,
		valueCents: coveredValue + provisionalCents,
	};
}

export function reconciliationOutcome(
	plannedMicros: bigint,
	consumedMicros: bigint,
	lostMicros: bigint
): ReconciliationOutcome {
	const outMicros = consumedMicros + lostMicros;
	return {
		extraMicros: outMicros > plannedMicros ? outMicros - plannedMicros : 0n,
		leftoverMicros: plannedMicros > outMicros ? plannedMicros - outMicros : 0n,
		outMicros,
	};
}

import { maxExactInteger, quantityScale } from "./quantity";

export const purchaseLimits = {
	items: { max: 100, min: 1 },
	notes: 2000,
	reason: { max: 200, min: 1 },
	reference: 60,
} as const;

export type PurchaseLineInput = {
	packageCountMicros: bigint;
	packagingQuantityMicros: bigint;
	unitPriceCents: bigint;
};

export type PurchaseLine = {
	discountCents: bigint;
	freightCents: bigint;
	grossCents: bigint;
	quantityMicros: bigint;
	valueCents: bigint;
};

export type PurchaseTotals = {
	discountCents: bigint;
	freightCents: bigint;
	grossCents: bigint;
	lines: PurchaseLine[];
	totalCents: bigint;
};

export type PurchaseProblem =
	| "allocationWithoutGross"
	| "negativeLine"
	| "nonPositiveTotal"
	| "tooLarge"
	| "zeroQuantity";

export type PurchaseTotalsResult =
	| { ok: true; totals: PurchaseTotals }
	| { ok: false; problem: PurchaseProblem };

const sumOf = (values: readonly bigint[]) =>
	values.reduce((sum, value) => sum + value, 0n);

const scaledHalfUp = (left: bigint, right: bigint) =>
	(left * right * 2n + quantityScale) / (quantityScale * 2n);

export function allocateProportionally(
	total: bigint,
	weights: readonly bigint[]
): bigint[] {
	const weightSum = sumOf(weights);
	const weighted = weights.findLastIndex((weight) => weight > 0n);
	const last = weighted === -1 ? weights.length - 1 : weighted;
	const shares = weights.map((weight, index) =>
		index === last || weightSum === 0n ? 0n : (total * weight) / weightSum
	);
	const given = sumOf(shares);
	return shares.map((share, index) => (index === last ? total - given : share));
}

export function purchaseTotals(
	lines: readonly PurchaseLineInput[],
	freightCents: bigint,
	discountCents: bigint
): PurchaseTotalsResult {
	const gross = lines.map((line) =>
		scaledHalfUp(line.packageCountMicros, line.unitPriceCents)
	);
	const quantities = lines.map((line) =>
		scaledHalfUp(line.packageCountMicros, line.packagingQuantityMicros)
	);
	const grossCents = sumOf(gross);
	const totalCents = grossCents + freightCents - discountCents;
	if (
		[...gross, ...quantities, grossCents + freightCents].some(
			(value) => value > maxExactInteger
		)
	) {
		return { ok: false, problem: "tooLarge" };
	}
	if (quantities.some((quantity) => quantity <= 0n)) {
		return { ok: false, problem: "zeroQuantity" };
	}
	if (grossCents === 0n && (freightCents > 0n || discountCents > 0n)) {
		return { ok: false, problem: "allocationWithoutGross" };
	}
	if (totalCents <= 0n) {
		return { ok: false, problem: "nonPositiveTotal" };
	}
	const freight = allocateProportionally(freightCents, gross);
	const discount = allocateProportionally(discountCents, gross);
	const result = gross.map((grossLine, index) => {
		const lineFreight = freight[index] ?? 0n;
		const lineDiscount = discount[index] ?? 0n;
		return {
			discountCents: lineDiscount,
			freightCents: lineFreight,
			grossCents: grossLine,
			quantityMicros: quantities[index] ?? 0n,
			valueCents: grossLine + lineFreight - lineDiscount,
		};
	});
	if (result.some((line) => line.valueCents < 0n)) {
		return { ok: false, problem: "negativeLine" };
	}
	return {
		ok: true,
		totals: {
			discountCents,
			freightCents,
			grossCents,
			lines: result,
			totalCents,
		},
	};
}

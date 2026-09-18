export const marginLimits = { max: 9999, min: 0 } as const;

export const defaultTargetMarginBasisPoints = 4000;

export function suggestPrice(
	costCents: bigint,
	marginBasisPoints: number
): bigint {
	if (
		costCents < 0n ||
		!Number.isInteger(marginBasisPoints) ||
		marginBasisPoints < 0 ||
		marginBasisPoints >= 10_000
	) {
		throw new RangeError("Custo ou margem inválidos");
	}

	const denominator = BigInt(10_000 - marginBasisPoints);
	return (costCents * 10_000n + denominator - 1n) / denominator;
}

const percentInput = /^(?<whole>\d{1,2})(?:[.,](?<fraction>\d{1,2}))?$/;
const ignored = /[\s%]/g;
const trailingZeros = /0+$/;

export function parseMarginPercent(input: string): number | null {
	const groups = percentInput.exec(input.replace(ignored, ""))?.groups;
	if (!groups) {
		return null;
	}
	const { fraction = "", whole = "0" } = groups;
	const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
	return basisPoints > marginLimits.max ? null : basisPoints;
}

export function formatMarginInput(basisPoints: number): string {
	const sign = basisPoints < 0 ? "-" : "";
	const absolute = Math.abs(basisPoints);
	const fraction = String(absolute % 100)
		.padStart(2, "0")
		.replace(trailingZeros, "");
	const whole = `${sign}${Math.floor(absolute / 100)}`;
	return fraction === "" ? whole : `${whole},${fraction}`;
}

export function formatMarginPercent(basisPoints: number): string {
	return `${formatMarginInput(basisPoints)}%`;
}

export type Pricing = {
	belowCost: boolean;
	belowTarget: boolean;
	marginBasisPoints: number | null;
	suggestedCents: bigint;
};

function divideDown(numerator: bigint, denominator: bigint): bigint {
	const quotient = numerator / denominator;
	return numerator % denominator < 0n ? quotient - 1n : quotient;
}

export function marginOfPrice(
	costCents: bigint,
	priceCents: bigint
): number | null {
	return priceCents > 0n
		? Number(divideDown((priceCents - costCents) * 10_000n, priceCents))
		: null;
}

export function pricingOf({
	costCents,
	priceCents,
	targetMarginBasisPoints,
}: {
	costCents: bigint;
	priceCents: bigint;
	targetMarginBasisPoints: number;
}): Pricing {
	const suggestedCents = suggestPrice(costCents, targetMarginBasisPoints);
	return {
		belowCost: priceCents < costCents,
		belowTarget: priceCents < suggestedCents,
		marginBasisPoints: marginOfPrice(costCents, priceCents),
		suggestedCents,
	};
}

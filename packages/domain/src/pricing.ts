/** Calculates a target margin on the selling price, rounding up to cents. */
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

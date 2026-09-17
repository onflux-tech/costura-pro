export const quantityScale = 1_000_000n;

export const maxExactInteger = 9_007_199_254_740_991n;

export const displayPrecision = { max: 6, min: 0 } as const;

const decimalInput = /^(?<whole>\d{1,12})(?:[.,](?<fraction>\d{1,6}))?$/;
const thousands = /\B(?=(?:\d{3})+(?!\d))/g;
const trailingZeros = /0+$/;

function grouped(whole: string): string {
	return whole.replace(thousands, ".");
}

function fractionOf(micros: bigint, precision: number): string {
	const digits = (micros % quantityScale).toString().padStart(6, "0");
	const exact = digits.replace(trailingZeros, "");
	return exact.length > precision ? exact : digits.slice(0, precision);
}

function decimalOf(micros: bigint, precision: number): [string, string] {
	return [
		(micros / quantityScale).toString(),
		fractionOf(micros, Math.min(Math.max(precision, 0), 6)),
	];
}

export function parseQuantity(input: string, precision: number): bigint | null {
	const groups = decimalInput.exec(input.trim())?.groups;
	if (!groups) {
		return null;
	}
	const { fraction = "", whole = "0" } = groups;
	if (fraction.length > precision) {
		return null;
	}
	const micros =
		BigInt(whole) * quantityScale + BigInt(fraction.padEnd(6, "0"));
	return micros > maxExactInteger ? null : micros;
}

export function formatQuantity(micros: bigint, precision: number): string {
	const [whole, fraction] = decimalOf(micros, precision);
	return fraction ? `${grouped(whole)},${fraction}` : grouped(whole);
}

export function formatQuantityInput(micros: bigint, precision: number): string {
	const [whole, fraction] = decimalOf(micros, precision);
	return fraction ? `${whole},${fraction}` : whole;
}

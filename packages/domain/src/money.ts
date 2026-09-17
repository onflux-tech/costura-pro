import { maxExactInteger } from "./quantity";

const amountInput = /^(?<whole>\d{1,14})(?:[.,](?<fraction>\d{1,2}))?$/;
const spaces = /\s/g;
const thousands = /\B(?=(?:\d{3})+(?!\d))/g;

export function parseMoney(input: string): bigint | null {
	const groups = amountInput.exec(input.replace(spaces, ""))?.groups;
	if (!groups) {
		return null;
	}
	const { fraction = "", whole = "0" } = groups;
	const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
	return cents > maxExactInteger ? null : cents;
}

function partsOf(cents: bigint): [string, string, string] {
	const absolute = cents < 0n ? -cents : cents;
	return [
		cents < 0n ? "-" : "",
		(absolute / 100n).toString(),
		(absolute % 100n).toString().padStart(2, "0"),
	];
}

export function formatMoney(cents: bigint): string {
	const [sign, whole, fraction] = partsOf(cents);
	return `${sign}${whole.replace(thousands, ".")},${fraction}`;
}

export function formatMoneyInput(cents: bigint): string {
	const [sign, whole, fraction] = partsOf(cents);
	return `${sign}${whole},${fraction}`;
}

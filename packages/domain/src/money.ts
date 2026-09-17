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

export function formatMoney(cents: bigint): string {
	return `${(cents / 100n).toString().replace(thousands, ".")},${(cents % 100n).toString().padStart(2, "0")}`;
}

export function formatMoneyInput(cents: bigint): string {
	return `${cents / 100n},${(cents % 100n).toString().padStart(2, "0")}`;
}

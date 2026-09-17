import { expect, test } from "bun:test";

import { formatMoney, formatMoneyInput, parseMoney } from "./money";

test("parseMoney reads reais with up to two decimals", () => {
	expect(parseMoney("12")).toBe(1200n);
	expect(parseMoney("12,5")).toBe(1250n);
	expect(parseMoney("12,50")).toBe(1250n);
	expect(parseMoney("12.50")).toBe(1250n);
	expect(parseMoney(" 1234,56 ")).toBe(123_456n);
	expect(parseMoney("0")).toBe(0n);
});

test("parseMoney refuses grouping, three decimals and empty text", () => {
	expect(parseMoney("1.234,56")).toBeNull();
	expect(parseMoney("12,555")).toBeNull();
	expect(parseMoney("")).toBeNull();
	expect(parseMoney("abc")).toBeNull();
	expect(parseMoney("-5")).toBeNull();
});

test("formatMoney groups thousands and keeps two decimals", () => {
	expect(formatMoney(0n)).toBe("0,00");
	expect(formatMoney(1250n)).toBe("12,50");
	expect(formatMoney(5n)).toBe("0,05");
	expect(formatMoney(123_456_789n)).toBe("1.234.567,89");
});

test("formatMoneyInput drops the grouping", () => {
	expect(formatMoneyInput(123_456n)).toBe("1234,56");
	expect(formatMoneyInput(1200n)).toBe("12,00");
});

test("formatMoney keeps the sign in front of a negative amount", () => {
	expect(formatMoney(-1250n)).toBe("-12,50");
	expect(formatMoney(-2500n)).toBe("-25,00");
	expect(formatMoney(-5n)).toBe("-0,05");
	expect(formatMoney(-123_456_789n)).toBe("-1.234.567,89");
	expect(formatMoneyInput(-1250n)).toBe("-12,50");
	expect(formatMoneyInput(-5n)).toBe("-0,05");
});

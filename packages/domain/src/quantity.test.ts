import { expect, test } from "bun:test";

import {
	formatQuantity,
	formatQuantityInput,
	maxExactInteger,
	parseQuantity,
} from "./quantity";

test("parseQuantity reads decimals up to the precision", () => {
	expect(parseQuantity("1,5", 1)).toBe(1_500_000n);
	expect(parseQuantity("1.5", 1)).toBe(1_500_000n);
	expect(parseQuantity(" 12 ", 0)).toBe(12_000_000n);
	expect(parseQuantity("0,000001", 6)).toBe(1n);
	expect(parseQuantity("0", 2)).toBe(0n);
});

test("parseQuantity refuses more decimals than the precision", () => {
	expect(parseQuantity("1,55", 1)).toBeNull();
	expect(parseQuantity("1,5", 0)).toBeNull();
	expect(parseQuantity("", 2)).toBeNull();
	expect(parseQuantity("-1", 2)).toBeNull();
	expect(parseQuantity("1,5,5", 2)).toBeNull();
	expect(parseQuantity("abc", 2)).toBeNull();
});

test("parseQuantity refuses beyond the exact integer ceiling", () => {
	expect(parseQuantity("9007199254,740991", 6)).toBe(maxExactInteger);
	expect(parseQuantity("9007199254,740992", 6)).toBeNull();
	expect(parseQuantity("9007199255", 0)).toBeNull();
	expect(parseQuantity("9007199254740", 0)).toBeNull();
});

test("formatQuantity never rounds the stored value", () => {
	expect(formatQuantity(1_550_000n, 1)).toBe("1,55");
	expect(formatQuantity(1_500_000n, 1)).toBe("1,5");
	expect(formatQuantity(1_500_000n, 2)).toBe("1,50");
	expect(formatQuantity(12_000_000n, 0)).toBe("12");
	expect(formatQuantity(1_500_000n, 0)).toBe("1,5");
	expect(formatQuantity(1_500_500_000n, 1)).toBe("1.500,5");
	expect(formatQuantity(0n, 2)).toBe("0,00");
});

test("formatQuantityInput drops the grouping", () => {
	expect(formatQuantityInput(1_500_500_000n, 1)).toBe("1500,5");
	expect(formatQuantityInput(12_000_000n, 0)).toBe("12");
});

test("maxExactInteger is two to the fifty third minus one", () => {
	expect(maxExactInteger).toBe(9_007_199_254_740_991n);
});

test("formatQuantity keeps the sign in front of a negative balance", () => {
	expect(formatQuantity(-1_500_000n, 2)).toBe("-1,50");
	expect(formatQuantity(-500_000n, 2)).toBe("-0,50");
	expect(formatQuantity(-2_000_000n, 0)).toBe("-2");
	expect(formatQuantityInput(-1_500_000n, 2)).toBe("-1,50");
});

import { describe, expect, test } from "bun:test";

import { remoteLockDurationMs } from "./sign-in-lockout";

describe("remoteLockDurationMs", () => {
	test("does not lock before a multiple of five failures", () => {
		for (const failures of [0, 1, 4, 6, 9, 11]) {
			expect(remoteLockDurationMs(failures)).toBeNull();
		}
	});

	test("doubles from one minute at each multiple of five", () => {
		expect(remoteLockDurationMs(5)).toBe(60_000);
		expect(remoteLockDurationMs(10)).toBe(120_000);
		expect(remoteLockDurationMs(15)).toBe(240_000);
		expect(remoteLockDurationMs(25)).toBe(960_000);
	});

	test("caps at thirty minutes", () => {
		expect(remoteLockDurationMs(30)).toBe(1_800_000);
		expect(remoteLockDurationMs(500)).toBe(1_800_000);
		expect(remoteLockDurationMs(5_000_000)).toBe(1_800_000);
	});

	test("rejects negative or fractional counts", () => {
		expect(() => remoteLockDurationMs(-5)).toThrow(RangeError);
		expect(() => remoteLockDurationMs(2.5)).toThrow(RangeError);
		expect(() => remoteLockDurationMs(Number.NaN)).toThrow(RangeError);
	});
});

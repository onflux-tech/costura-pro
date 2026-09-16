import { describe, expect, test } from "bun:test";

import { encodeAccessCode, normalizeAccessCode } from "./access-code";

describe("encodeAccessCode", () => {
	test("encodes 16 Crockford characters grouped by four", () => {
		const random = Uint8Array.from({ length: 16 }, (_, index) => index * 2);
		expect(encodeAccessCode(random, 16)).toBe("0246-8ACE-GJMP-RTWY");
	});

	test("uses the low five bits of each byte", () => {
		const random = Uint8Array.from([255, 32, 33, 64, 95, 128, 160, 200]);
		expect(encodeAccessCode(random, 8)).toBe("Z010-Z008");
	});

	test("rejects fewer random bytes than characters", () => {
		expect(() => encodeAccessCode(new Uint8Array(7), 8)).toThrow(RangeError);
	});
});

describe("normalizeAccessCode", () => {
	test("normalizes case, spaces, hyphens and ambiguous letters", () => {
		expect(normalizeAccessCode(" o246-8ace-gjmp-rtwy ", 16)).toBe(
			"02468ACEGJMPRTWY"
		);
		expect(normalizeAccessCode("IL00 0000", 8)).toBe("11000000");
	});

	test("round-trips an encoded code", () => {
		const random = Uint8Array.from({ length: 8 }, (_, index) => index * 7);
		const code = encodeAccessCode(random, 8);
		expect(normalizeAccessCode(code, 8)).toBe(code.replace("-", ""));
	});

	test("rejects wrong length or characters outside the alphabet", () => {
		expect(normalizeAccessCode("0246-8ACE", 16)).toBeNull();
		expect(normalizeAccessCode("0246-8ACE-GJMP-RTWU", 16)).toBeNull();
		expect(normalizeAccessCode("", 8)).toBeNull();
	});
});

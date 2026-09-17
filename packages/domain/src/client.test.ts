import { describe, expect, test } from "bun:test";

import {
	formatPhone,
	normalizePhone,
	normalizeText,
	searchKey,
	searchTokens,
} from "./client";

describe("normalizePhone", () => {
	test("keeps only the digits of a masked mobile or landline", () => {
		expect(normalizePhone("(81) 99815-4402")).toBe("81998154402");
		expect(normalizePhone("81 3222.1234")).toBe("8132221234");
	});

	test("drops the country code only when it is in front of a full number", () => {
		expect(normalizePhone("+55 81 99815-4402")).toBe("81998154402");
		expect(normalizePhone("558132221234")).toBe("8132221234");
		expect(normalizePhone("(55) 99981-2345")).toBe("55999812345");
	});

	test("rejects a number without area code, too long, or with an invalid area code", () => {
		expect(normalizePhone("99815-4402")).toBeNull();
		expect(normalizePhone("819981544021")).toBeNull();
		expect(normalizePhone("(01) 99815-4402")).toBeNull();
		expect(normalizePhone("(10) 99815-4402")).toBeNull();
		expect(normalizePhone("")).toBeNull();
	});
});

describe("formatPhone", () => {
	test("formats mobile and landline numbers", () => {
		expect(formatPhone("81998154402")).toBe("(81) 99815-4402");
		expect(formatPhone("8132221234")).toBe("(81) 3222-1234");
	});
});

describe("search", () => {
	test("normalizes accents, case and spaces", () => {
		expect(normalizeText("  João   DA Silva ")).toBe("joao da silva");
	});

	test("builds the key from name, e-mail and phones", () => {
		expect(
			searchKey({
				email: "Maria.Alencar@Email.com",
				name: "Maria Beatriz Alencar",
				phone: "81998154402",
				secondaryPhone: null,
			})
		).toBe("maria beatriz alencar maria.alencar@email.com 81998154402");
	});

	test("turns masked phone pieces into digits and drops empty tokens", () => {
		expect(searchTokens("João (81) 99815-4402")).toEqual([
			"joao",
			"81",
			"998154402",
		]);
		expect(searchTokens("  . ")).toEqual([]);
		expect(searchTokens("50%")).toEqual(["50%"]);
	});
});

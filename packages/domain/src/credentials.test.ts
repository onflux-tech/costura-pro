import { expect, test } from "bun:test";

import {
	isValidUsername,
	normalizeUsername,
	passwordLength,
	usernameLength,
} from "./credentials";

test("normalizes the username to trimmed lowercase", () => {
	expect(normalizeUsername("  Dona.Atelie ")).toBe("dona.atelie");
});

test("accepts usernames within length using letters, digits, dot and underscore", () => {
	expect(isValidUsername("dona.atelie_1")).toBe(true);
	expect(isValidUsername("a".repeat(usernameLength.min))).toBe(true);
	expect(isValidUsername("a".repeat(usernameLength.max))).toBe(true);
});

test("rejects short, long or accented usernames and spaces", () => {
	for (const username of [
		"a".repeat(usernameLength.min - 1),
		"a".repeat(usernameLength.max + 1),
		"ateliê",
		"dona atelie",
		"dona-atelie",
	]) {
		expect(isValidUsername(username)).toBe(false);
	}
});

test("keeps the password policy between 10 and 128 characters", () => {
	expect(passwordLength).toEqual({ max: 128, min: 10 });
	expect(usernameLength).toEqual({ max: 30, min: 3 });
});

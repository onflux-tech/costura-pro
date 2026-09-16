import { expect, test } from "bun:test";

import { installationStates, isAtLeast } from "./installation-state";

test("lists wizard states in order", () => {
	expect(installationStates).toEqual([
		"empty",
		"atelier",
		"account",
		"recovery",
		"backup",
		"ready",
	]);
});

test("compares wizard progress", () => {
	expect(isAtLeast("recovery", "account")).toBe(true);
	expect(isAtLeast("account", "recovery")).toBe(false);
	expect(isAtLeast("ready", "ready")).toBe(true);
	expect(isAtLeast("empty", "atelier")).toBe(false);
});

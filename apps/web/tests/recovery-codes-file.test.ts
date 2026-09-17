import { expect, test } from "bun:test";

import {
	recoveryCodesFile,
	recoveryCodesFileName,
} from "../src/lib/recovery-codes-file";

const codes = Array.from(
	{ length: 10 },
	(_, index) => `7K2M-9QRT-X4VW-${String(index).padStart(4, "0")}`
);

test("arquivo traz ateliê, data no fuso de Recife, os 10 códigos numerados e as instruções", () => {
	const text = recoveryCodesFile({
		atelierName: "Ateliê Linha Fina",
		codes,
		generatedAt: new Date("2026-09-16T17:05:00Z"),
	});
	expect(text).toContain("Ateliê: Ateliê Linha Fina");
	expect(text).toContain("16/09/2026");
	expect(text).toContain("14:05");
	for (const [index, code] of codes.entries()) {
		expect(text).toContain(`${String(index + 1).padStart(2, " ")}. ${code}`);
	}
	expect(text).toContain("Cada código vale uma vez");
	expect(text).toContain("invalida");
	expect(recoveryCodesFileName).toBe("costura-pro-codigos-de-recuperacao.txt");
});

test("sem nome do ateliê, a linha do ateliê some", () => {
	const text = recoveryCodesFile({
		atelierName: null,
		codes,
		generatedAt: new Date("2026-09-16T17:05:00Z"),
	});
	expect(text).not.toContain("Ateliê:");
});

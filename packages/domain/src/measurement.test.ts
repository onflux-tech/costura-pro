import { describe, expect, test } from "bun:test";

import {
	duplicateLabelIndex,
	formatCentimeters,
	initialMeasurementTemplates,
	mergeTemplateFields,
	parseCentimeters,
} from "./measurement";

describe("parseCentimeters", () => {
	test("reads centimeters with comma or dot as whole millimeters", () => {
		expect(parseCentimeters("74,5")).toBe(745);
		expect(parseCentimeters(" 92 ")).toBe(920);
		expect(parseCentimeters("12.3")).toBe(123);
		expect(parseCentimeters("0,1")).toBe(1);
		expect(parseCentimeters("999,9")).toBe(9999);
	});

	test("rejects zero, sign, two decimals, four digits and loose separators", () => {
		const rejected = [
			"",
			"0",
			"0,0",
			"-1",
			"+1",
			"74,55",
			"1000",
			"74,",
			",5",
			"7 4",
			"abc",
		];
		expect(
			rejected.filter((input) => parseCentimeters(input) !== null)
		).toEqual([]);
	});
});

describe("formatCentimeters", () => {
	test("always shows one decimal with comma", () => {
		expect(formatCentimeters(920)).toBe("92,0");
		expect(formatCentimeters(745)).toBe("74,5");
		expect(formatCentimeters(1)).toBe("0,1");
		expect(formatCentimeters(9999)).toBe("999,9");
	});
});

describe("duplicateLabelIndex", () => {
	test("finds the first label repeated without accents, case or extra spaces", () => {
		expect(duplicateLabelIndex(["Busto", "Cintura", "cintura "])).toBe(2);
		expect(duplicateLabelIndex(["Braço", "braco"])).toBe(1);
		expect(duplicateLabelIndex(["Busto", "Cintura"])).toBeNull();
	});
});

describe("mergeTemplateFields", () => {
	const current = [
		{ active: true, id: "a", label: "Busto" },
		{ active: false, id: "b", label: "Cava antiga" },
		{ active: true, id: "c", label: "Cintura" },
	];

	test("keeps sent fields active in the sent order with the sent label", () => {
		expect(
			mergeTemplateFields(current, [
				{ id: "c", label: "Cintura alta" },
				{ id: "a", label: "Busto" },
				{ id: "b", label: "Cava" },
			])
		).toEqual([
			{ active: true, id: "c", label: "Cintura alta" },
			{ active: true, id: "a", label: "Busto" },
			{ active: true, id: "b", label: "Cava" },
		]);
	});

	test("appends the current fields left out, deactivated, with their current label", () => {
		expect(mergeTemplateFields(current, [{ id: "n", label: "Punho" }])).toEqual(
			[
				{ active: true, id: "n", label: "Punho" },
				{ active: false, id: "a", label: "Busto" },
				{ active: false, id: "b", label: "Cava antiga" },
				{ active: false, id: "c", label: "Cintura" },
			]
		);
	});
});

describe("initialMeasurementTemplates", () => {
	test("brings the five garment templates with unique labels", () => {
		expect(
			initialMeasurementTemplates.map((template) => [
				template.name,
				template.fields.length,
			])
		).toEqual([
			["Vestido", 16],
			["Saia", 4],
			["Calça", 9],
			["Blusa e camisa", 12],
			["Blazer e paletó", 11],
		]);
		expect(
			initialMeasurementTemplates.filter(
				(template) => duplicateLabelIndex(template.fields) !== null
			)
		).toEqual([]);
	});
});

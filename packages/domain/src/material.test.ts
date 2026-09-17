import { expect, test } from "bun:test";

import {
	materialCategorySuggestions,
	materialLimits,
	materialSearchKey,
	variantSearchKey,
} from "./material";

test("search key of a material joins name and category without accent", () => {
	expect(materialSearchKey({ category: "Tecido", name: "Gorgurão" })).toBe(
		"gorgurao tecido"
	);
	expect(materialSearchKey({ category: null, name: "Linha" })).toBe("linha");
});

test("search key of a variant joins name and code", () => {
	expect(variantSearchKey({ code: "GR-AZ", name: "Azul marinho" })).toBe(
		"azul marinho gr-az"
	);
	expect(variantSearchKey({ code: null, name: "Cru" })).toBe("cru");
});

test("limits and suggestions are declared", () => {
	expect(materialLimits.name).toEqual({ max: 120, min: 1 });
	expect(materialLimits.variantName.max).toBe(80);
	expect(materialLimits.code).toBe(40);
	expect(materialCategorySuggestions).toContain("Tecido");
});

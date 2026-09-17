import { expect, test } from "bun:test";

import { baseUnitByCode, baseUnitCodes, baseUnits } from "./unit";

test("every code has one unit, in the declared order", () => {
	expect(baseUnits.map((unit) => unit.code)).toEqual([...baseUnitCodes]);
});

test("unit carries abbreviation and suggested precision", () => {
	expect(baseUnitByCode("m")).toEqual({
		abbreviation: "m",
		code: "m",
		defaultPrecision: 2,
		label: "Metro",
	});
	expect(baseUnitByCode("kg")?.defaultPrecision).toBe(3);
	expect(baseUnitByCode("un")?.defaultPrecision).toBe(0);
	expect(baseUnitByCode("m2")?.abbreviation).toBe("m²");
});

test("unknown code has no unit", () => {
	expect(baseUnitByCode("rolo")).toBeUndefined();
});

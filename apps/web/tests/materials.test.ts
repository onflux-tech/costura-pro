import { describe, expect, test } from "bun:test";

import {
	changedMaterial,
	changedVariant,
	materialFields,
	materialFormErrors,
	materialFormValues,
	type VariantFormValues,
	type VariantView,
	variantFields,
	variantFormErrors,
	variantFormValues,
	variantSummary,
} from "../src/lib/materials";

const material = {
	archivedAt: null,
	category: "Tecido",
	createdAt: "2026-09-17T12:00:00.000Z",
	id: "11111111-1111-4111-8111-111111111111",
	name: "Gorgurão",
	notes: null,
	version: 1,
};

const variant: VariantView = {
	archivedAt: null,
	baseUnit: "m",
	code: "GR-AZ",
	createdAt: "2026-09-17T12:00:00.000Z",
	displayPrecision: 2,
	id: "22222222-2222-4222-8222-222222222222",
	materialId: material.id,
	minQuantityMicros: "1500000",
	name: "Azul marinho",
	packaging: { label: "Rolo", quantityMicros: "50000000" },
	photo: { photoHash: "a".repeat(64), thumbnailHash: "b".repeat(64) },
	referenceCostCents: "1250",
	targetQuantityMicros: "10000000",
	version: 3,
};

const values = (overrides: Partial<VariantFormValues> = {}) => ({
	...variantFormValues(variant),
	...overrides,
});

describe("material form", () => {
	test("reads and writes the material, with empty text as null", () => {
		expect(materialFormValues(material)).toEqual({
			category: "Tecido",
			name: "Gorgurão",
			notes: "",
		});
		expect(
			materialFields({ category: "  ", name: " Linha ", notes: "" })
		).toEqual({ category: null, name: "Linha", notes: null });
	});

	test("refuses an empty name", () => {
		expect(
			materialFormErrors({ category: "", name: "   ", notes: "" }).name
		).toBeString();
		expect(
			materialFormErrors({ category: "", name: "Linha", notes: "" })
		).toEqual({});
	});

	test("sends only what changed", () => {
		expect(
			changedMaterial(material, {
				category: "Tecido",
				name: "Gorgurão",
				notes: null,
			})
		).toBeNull();
		expect(
			changedMaterial(material, {
				category: null,
				name: "Gorgurão",
				notes: "Rolo 50 m",
			})
		).toEqual({ category: null, notes: "Rolo 50 m" });
	});
});

describe("variant form", () => {
	test("reads the variant into editable text", () => {
		expect(variantFormValues(variant)).toEqual({
			baseUnit: "m",
			code: "GR-AZ",
			displayPrecision: "2",
			minQuantity: "1,50",
			name: "Azul marinho",
			packagingLabel: "Rolo",
			packagingQuantity: "50,00",
			referenceCost: "12,50",
			targetQuantity: "10,00",
		});
	});

	test("refuses a name, a quantity beyond six decimals and a half packaging", () => {
		expect(variantFormErrors(values({ name: "  " })).name).toBeString();
		expect(
			variantFormErrors(values({ minQuantity: "1,5555555" })).minQuantity
		).toBe("Use no máximo 6 casas decimais");
		expect(
			variantFormErrors(values({ minQuantity: "um e meio" })).minQuantity
		).toBe("Use só número, com vírgula");
		expect(
			variantFormErrors(values({ referenceCost: "12,555" })).referenceCost
		).toBeString();
		expect(
			variantFormErrors(values({ packagingQuantity: "" })).packagingQuantity
		).toBeString();
		expect(
			variantFormErrors(values({ packagingLabel: "" })).packagingLabel
		).toBeString();
		expect(variantFormErrors(values())).toEqual({});
	});

	test("lowering the exhibited precision keeps the stored quantities editable", () => {
		const lowered = values({ displayPrecision: "0" });
		expect(variantFormErrors(lowered)).toEqual({});
		expect(variantFields(lowered, variant.photo)).toMatchObject({
			displayPrecision: 0,
			minQuantityMicros: "1500000",
			packaging: { label: "Rolo", quantityMicros: "50000000" },
			targetQuantityMicros: "10000000",
		});
	});

	test("writes integers as strings and clears optional values", () => {
		expect(variantFields(values(), variant.photo)).toEqual({
			baseUnit: "m",
			code: "GR-AZ",
			displayPrecision: 2,
			minQuantityMicros: "1500000",
			name: "Azul marinho",
			packaging: { label: "Rolo", quantityMicros: "50000000" },
			photo: variant.photo,
			referenceCostCents: "1250",
			targetQuantityMicros: "10000000",
		});
		expect(
			variantFields(
				values({
					minQuantity: "",
					packagingLabel: "",
					packagingQuantity: "",
					referenceCost: "",
				}),
				null
			)
		).toMatchObject({
			minQuantityMicros: null,
			packaging: null,
			photo: null,
			referenceCostCents: null,
		});
	});

	test("never sends the base unit in the patch", () => {
		expect(
			changedVariant(variant, variantFields(values(), variant.photo))
		).toBeNull();
		const patch = changedVariant(
			variant,
			variantFields(values({ baseUnit: "cm", name: "Azul royal" }), null)
		);
		expect(patch).toEqual({ name: "Azul royal", photo: null });
		expect(patch && "baseUnit" in patch).toBe(false);
	});

	test("summarizes the variant with its unit", () => {
		expect(variantSummary(variant)).toBe(
			"mínimo 1,50 m · alvo 10,00 m · R$ 12,50 por m · Rolo de 50,00 m"
		);
		expect(
			variantSummary({
				...variant,
				minQuantityMicros: null,
				packaging: null,
				referenceCostCents: null,
				targetQuantityMicros: null,
			})
		).toBe("Medido em m");
	});
});

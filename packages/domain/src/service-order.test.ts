import { describe, expect, test } from "bun:test";

import type { QuoteLine } from "./quote";
import {
	approvalChannels,
	approvalWindowError,
	isWorkLine,
	linePlannedMaterials,
	suggestedDueOn,
} from "./service-order";

const revision = { emittedOn: "2026-09-15", validUntil: "2026-09-30" };

describe("approvalWindowError", () => {
	test("aceita os dois extremos da janela", () => {
		expect(approvalWindowError("2026-09-15", revision)).toBeNull();
		expect(approvalWindowError("2026-09-30", revision)).toBeNull();
		expect(approvalWindowError("2026-09-22", revision)).toBeNull();
	});

	test("recusa antes da emissão e depois do válido até", () => {
		expect(approvalWindowError("2026-09-14", revision)).toBe("beforeEmission");
		expect(approvalWindowError("2026-10-01", revision)).toBe("afterValidity");
	});
});

describe("suggestedDueOn", () => {
	test("soma o prazo proposto à data do aceite", () => {
		expect(suggestedDueOn("2026-09-24", 10)).toBe("2026-10-04");
		expect(suggestedDueOn("2026-12-25", 15)).toBe("2027-01-09");
	});

	test("sem prazo proposto fica a combinar", () => {
		expect(suggestedDueOn("2026-09-24", null)).toBeNull();
	});
});

const service: QuoteLine = {
	discount: null,
	kind: "service",
	quantity: 1,
	unitCostCents: 6000n,
	unitPriceCents: 16_000n,
};

const free: QuoteLine = {
	discount: null,
	kind: "free",
	quantity: 1,
	unitCostCents: null,
	unitPriceCents: 5000n,
};

const material: QuoteLine = {
	discount: null,
	kind: "material",
	materialVariantId: "zipper",
	quantityMicros: 2_000_000n,
	unitCostCents: 370n,
	unitPriceCents: 800n,
};

const piece: QuoteLine = {
	components: [
		{
			kind: "material",
			materialVariantId: "crepe",
			quantityMicros: 1_400_000n,
			unitCostCents: 3800n,
		},
		{
			kind: "material",
			materialVariantId: "lining",
			quantityMicros: 1_000_000n,
			unitCostCents: 2200n,
		},
		{ count: 1, kind: "service", unitCostCents: 30_000n },
		{
			kind: "material",
			materialVariantId: "crepe",
			quantityMicros: 300_000n,
			unitCostCents: 3800n,
		},
	],
	discount: null,
	kind: "custom",
	quantity: 2,
	unitPriceCents: 98_000n,
};

describe("linhas de trabalho", () => {
	test("serviço, peça e material viram subitem; linha livre não", () => {
		expect([service, piece, material, free].map(isWorkLine)).toEqual([
			true,
			true,
			true,
			false,
		]);
	});

	test("canais na ordem da tela", () => {
		expect(approvalChannels).toEqual([
			"inPerson",
			"whatsapp",
			"phone",
			"email",
			"other",
		]);
	});
});

describe("linePlannedMaterials", () => {
	test("peça soma a mesma variante de dois componentes vezes as peças, na ordem da primeira aparição", () => {
		expect(linePlannedMaterials(piece)).toEqual([
			{ quantityMicros: 3_400_000n, variantId: "crepe" },
			{ quantityMicros: 2_000_000n, variantId: "lining" },
		]);
	});

	test("material prevê a própria quantidade", () => {
		expect(linePlannedMaterials(material)).toEqual([
			{ quantityMicros: 2_000_000n, variantId: "zipper" },
		]);
	});

	test("serviço e linha livre não preveem material", () => {
		expect(linePlannedMaterials(service)).toEqual([]);
		expect(linePlannedMaterials(free)).toEqual([]);
	});
});

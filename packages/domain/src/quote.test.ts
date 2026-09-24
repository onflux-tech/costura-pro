import { describe, expect, test } from "bun:test";

import { pricingOf } from "./pricing";
import {
	addDays,
	discountCents,
	documentCode,
	documentSearchKey,
	pieceCost,
	plannedMaterials,
	type QuoteComponent,
	type QuoteLineText,
	quoteLineOfText,
	quoteStatus,
	quoteTotalsOfText,
} from "./quote";

const tailoring: QuoteLineText = {
	discount: { basisPoints: 1000, kind: "percent" },
	kind: "service",
	quantity: 1,
	unitCostCents: "6000",
	unitPriceCents: "16000",
};

const gift: QuoteLineText = {
	discount: { basisPoints: 10_000, kind: "percent" },
	kind: "service",
	quantity: 1,
	unitCostCents: "6000",
	unitPriceCents: "16000",
};

const dressComponents = [
	{
		kind: "material",
		materialVariantId: "crepe",
		quantityMicros: "3400000",
		unitCostCents: "3800",
	},
	{
		kind: "material",
		materialVariantId: "forro",
		quantityMicros: "2800000",
		unitCostCents: "2200",
	},
	{
		kind: "material",
		materialVariantId: "ziper-60",
		quantityMicros: "1000000",
		unitCostCents: "900",
	},
	{ count: 1, kind: "service", unitCostCents: "30000" },
] as const;

function dress(quantity = 1): QuoteLineText {
	return {
		components: dressComponents,
		discount: null,
		kind: "custom",
		quantity,
		unitPriceCents: "98000",
	};
}

const zipper: QuoteLineText = {
	discount: null,
	kind: "material",
	materialVariantId: "ziper-20",
	quantityMicros: "1000000",
	unitCostCents: "370",
	unitPriceCents: "800",
};

function rushFee(unitCostCents: string | null): QuoteLineText {
	return {
		discount: null,
		kind: "free",
		quantity: 1,
		unitCostCents,
		unitPriceCents: "5000",
	};
}

const documentDiscount = { amountCents: "30000", kind: "amount" } as const;

describe("código e datas", () => {
	test("documentCode completa o número com quatro dígitos sem cortar", () => {
		const code = (number: number) =>
			documentCode({ device: "PC", number, prefix: "ORC", year: 2026 });
		expect(code(1)).toBe("ORC-2026-PC-0001");
		expect(code(42)).toBe("ORC-2026-PC-0042");
		expect(code(12_345)).toBe("ORC-2026-PC-12345");
	});

	test("addDays conta dias corridos na virada de mês, de ano e em ano bissexto", () => {
		expect(addDays("2026-09-24", 15)).toBe("2026-10-09");
		expect(addDays("2026-12-25", 15)).toBe("2027-01-09");
		expect(addDays("2028-02-20", 10)).toBe("2028-03-01");
		expect(addDays("2027-02-20", 10)).toBe("2027-03-02");
		expect(addDays("2026-09-20", 1)).toBe("2026-09-21");
	});
});

describe("descontos e custos", () => {
	test("discountCents arredonda o percentual meio para cima e usa o valor fixo como está", () => {
		expect(discountCents(999n, { basisPoints: 1500, kind: "percent" })).toBe(
			150n
		);
		expect(discountCents(5000n, { basisPoints: 1, kind: "percent" })).toBe(1n);
		expect(discountCents(4999n, { basisPoints: 1, kind: "percent" })).toBe(0n);
		expect(discountCents(16_000n, { basisPoints: 1000, kind: "percent" })).toBe(
			1600n
		);
		expect(discountCents(16_000n, { amountCents: 1600n, kind: "amount" })).toBe(
			1600n
		);
		expect(discountCents(16_000n, null)).toBe(0n);
	});

	test("pieceCost não existe sem componentes nem com componente sem custo", () => {
		const known: QuoteComponent[] = [
			{
				kind: "material",
				materialVariantId: "crepe",
				quantityMicros: 3_400_000n,
				unitCostCents: 3800n,
			},
			{ count: 1, kind: "service", unitCostCents: 30_000n },
		];
		expect(pieceCost(known)).toBe(42_920n);
		expect(pieceCost([])).toBeNull();
		expect(
			pieceCost([
				...known,
				{
					kind: "material",
					materialVariantId: "renda",
					quantityMicros: 1_000_000n,
					unitCostCents: null,
				},
			])
		).toBeNull();
	});

	test("bruto e custo do material arredondam meio para cima pela quantidade", () => {
		const totals = quoteTotalsOfText(
			[
				{
					discount: null,
					kind: "material",
					materialVariantId: "linha",
					quantityMicros: "1234567",
					unitCostCents: "1000",
					unitPriceCents: "1000",
				},
			],
			null
		);
		expect(totals.lines[0]).toEqual({
			costCents: 1235n,
			discountCents: 0n,
			grossCents: 1235n,
			totalCents: 1235n,
		});
	});

	test("o orçamento do exemplo soma os números da spec", () => {
		const totals = quoteTotalsOfText(
			[tailoring, dress(), zipper, rushFee("0")],
			documentDiscount
		);
		expect(totals.lines.map((line) => line.totalCents)).toEqual([
			14_400n,
			98_000n,
			800n,
			5000n,
		]);
		expect(totals.lines.map((line) => line.costCents)).toEqual([
			6000n,
			49_980n,
			370n,
			0n,
		]);
		expect(totals).toMatchObject({
			costCents: 56_350n,
			documentDiscountCents: 30_000n,
			grossCents: 119_800n,
			lineDiscountCents: 1600n,
			subtotalCents: 118_200n,
			totalCents: 88_200n,
		});
		expect(
			pricingOf({
				costCents: 56_350n,
				priceCents: totals.totalCents,
				targetMarginBasisPoints: 4000,
			})
		).toEqual({
			belowCost: false,
			belowTarget: true,
			marginBasisPoints: 3611,
			suggestedCents: 93_917n,
		});
	});

	test("linha livre sem custo deixa o custo desconhecido, e zero é custo informado", () => {
		expect(
			quoteTotalsOfText([tailoring, rushFee(null)], null).costCents
		).toBeNull();
		expect(quoteTotalsOfText([tailoring, rushFee("0")], null).costCents).toBe(
			6000n
		);
	});

	test("orçamento sem linhas não tem custo", () => {
		const totals = quoteTotalsOfText([], null);
		expect(totals.costCents).toBeNull();
		expect(totals.totalCents).toBe(0n);
	});

	test("o desconto do orçamento incide sobre o subtotal depois dos descontos das linhas", () => {
		const totals = quoteTotalsOfText([tailoring], {
			basisPoints: 1000,
			kind: "percent",
		});
		expect(totals.subtotalCents).toBe(14_400n);
		expect(totals.documentDiscountCents).toBe(1440n);
		expect(totals.totalCents).toBe(12_960n);
	});

	test("linha com 100% de desconto fica com total zero, e total zero não tem margem", () => {
		const totals = quoteTotalsOfText([gift], null);
		expect(totals.totalCents).toBe(0n);
		expect(
			pricingOf({
				costCents: totals.costCents ?? 0n,
				priceCents: totals.totalCents,
				targetMarginBasisPoints: 4000,
			})
		).toMatchObject({
			belowCost: true,
			belowTarget: true,
			marginBasisPoints: null,
		});
	});

	test("a peça multiplica custo e material previsto pelo número de peças", () => {
		expect(quoteTotalsOfText([dress(2)], null).lines[0]?.costCents).toBe(
			99_960n
		);
		expect(
			plannedMaterials([dress(2), zipper, zipper].map(quoteLineOfText))
		).toEqual(
			new Map([
				["crepe", 6_800_000n],
				["forro", 5_600_000n],
				["ziper-60", 2_000_000n],
				["ziper-20", 2_000_000n],
			])
		);
	});
});

describe("estado e busca", () => {
	test("recusado vem antes de tudo, sem revisão é rascunho e a validade vale até o próprio dia", () => {
		const status = (
			refused: boolean,
			today: string,
			validUntil: string | null
		) => quoteStatus({ approved: false, refused, today, validUntil });
		expect(status(true, "2026-09-24", "2026-10-09")).toBe("refused");
		expect(status(true, "2026-09-24", null)).toBe("refused");
		expect(status(false, "2026-09-24", null)).toBe("draft");
		expect(status(false, "2026-09-24", "2026-09-24")).toBe("emitted");
		expect(status(false, "2026-09-25", "2026-09-24")).toBe("expired");
	});

	test("aprovado vence recusa, vencimento e emissão", () => {
		expect(
			quoteStatus({
				approved: true,
				refused: true,
				today: "2026-10-10",
				validUntil: "2026-09-30",
			})
		).toBe("approved");
		expect(
			quoteStatus({
				approved: true,
				refused: false,
				today: "2026-09-20",
				validUntil: "2026-09-30",
			})
		).toBe("approved");
		expect(
			quoteStatus({
				approved: false,
				refused: true,
				today: "2026-09-20",
				validUntil: "2026-09-30",
			})
		).toBe("refused");
	});

	test("documentSearchKey guarda o código, os dígitos dele e os títulos sem acento", () => {
		expect(
			documentSearchKey({
				code: "ORC-2026-PC-0001",
				titles: ["Vestido de Festa", "Bainha à mão"],
			})
		).toBe("orc-2026-pc-0001 20260001 vestido de festa bainha a mao");
	});

	test("quoteLineOfText ignora as cópias e fica só com o que a conta usa", () => {
		const row = {
			...zipper,
			baseUnit: "un",
			code: "ZIP-20",
			displayPrecision: 0,
			id: "linha-1",
			materialName: "Zíper",
			note: null,
			variantName: "20 cm",
		};
		expect(quoteLineOfText(row)).toEqual({
			discount: null,
			kind: "material",
			materialVariantId: "ziper-20",
			quantityMicros: 1_000_000n,
			unitCostCents: 370n,
			unitPriceCents: 800n,
		});
	});
});

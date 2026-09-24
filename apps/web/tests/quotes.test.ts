import { describe, expect, test } from "bun:test";

import {
	discountLabel,
	emissionWarnings,
	latestRevisionOf,
	lineDetail,
	lineQuantityLabel,
	lineTitle,
	nextRevisionNumber,
	plannedMaterialsView,
	type QuoteContentView,
	type QuoteLineView,
	type QuoteRevisionView,
	quoteStatusOf,
	quoteSummary,
	revisionContent,
	revisionLabel,
	sameContent,
	statusLabels,
	statusTone,
} from "../src/lib/quotes";

const id = (n: number) =>
	`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const service: QuoteLineView = {
	catalogPriceCents: "16000",
	discount: { basisPoints: 1000, kind: "percent", reason: null },
	estimatedMinutes: 90,
	id: id(1),
	kind: "service",
	note: "Blazer de linho",
	outsourced: false,
	profileId: id(50),
	quantity: 1,
	receivedItemId: id(60),
	serviceId: id(70),
	serviceName: "Ajuste de cava",
	serviceVersion: 1,
	unitCostCents: "6000",
	unitPriceCents: "16000",
};

function fabric(
	n: number,
	materialName: string,
	quantityMicros: string,
	unitCostCents: string | null
) {
	return {
		baseUnit: "m" as const,
		code: `TEC-${n}`,
		displayPrecision: 2,
		id: id(10 + n),
		kind: "material" as const,
		materialName,
		materialVariantId: id(80 + n),
		quantityMicros,
		unitCostCents,
		variantName: "Verde musgo",
	};
}

const sewing = {
	count: 1,
	estimatedMinutes: 600,
	id: id(19),
	kind: "service" as const,
	outsourced: false,
	serviceId: id(71),
	serviceName: "Costura sob medida",
	serviceVersion: 3,
	unitCostCents: "30000",
};

const dress: QuoteLineView = {
	components: [
		fabric(1, "Crepe georgette", "3400000", "3800"),
		fabric(2, "Forro cetim", "2800000", "2200"),
		{
			...fabric(3, "Zíper invisível 60 cm", "1000000", "900"),
			baseUnit: "un",
			displayPrecision: 0,
		},
		sewing,
	],
	description: "Vestido de festa sob medida",
	discount: null,
	id: id(2),
	kind: "custom",
	note: null,
	profileId: id(50),
	quantity: 1,
	source: {
		productId: id(90),
		productName: "Vestido Midi",
		productVersion: 3,
		variantId: id(91),
		variantName: "M Cru",
	},
	unitPriceCents: "98000",
};

const zipper: QuoteLineView = {
	baseUnit: "un",
	code: "ZIP-20",
	discount: null,
	displayPrecision: 0,
	id: id(3),
	kind: "material",
	materialName: "Zíper invisível",
	materialVariantId: id(89),
	note: null,
	quantityMicros: "1000000",
	unitCostCents: "370",
	unitPriceCents: "800",
	variantName: "20 cm preto",
};

function rush(unitCostCents: string | null): QuoteLineView {
	return {
		description: "Taxa de urgência",
		discount: null,
		id: id(4),
		kind: "free",
		note: null,
		quantity: 1,
		unitCostCents,
		unitPriceCents: "5000",
	};
}

const example: QuoteContentView = {
	discount: { amountCents: "30000", kind: "amount", reason: null },
	leadTimeDays: 20,
	lines: [service, dress, zipper, rush("0")],
	notes: "Prova em 10 dias",
	validityDays: 15,
};

function revisionOf(
	content: QuoteContentView,
	number: number,
	validUntil: string
): QuoteRevisionView {
	return {
		content: {
			...content,
			lines: content.lines.map((line) => ({
				...line,
				costCents: null,
				discountCents: "0",
				grossCents: "0",
				totalCents: "0",
			})),
		},
		costCents: null,
		createdAt: "2026-09-24T12:00:00.000Z",
		discountCents: "0",
		emittedOn: "2026-09-24",
		grossCents: "0",
		id: id(100 + number),
		number,
		quoteId: id(99),
		reason: null,
		targetMarginBasisPoints: 4000,
		totalCents: "0",
		validUntil,
		version: 1,
	};
}

const people = {
	profiles: new Map([[id(50), "Maria"]]),
	receivedItems: new Map([[id(60), "Blazer de linho"]]),
};

const nobody = { profiles: new Map(), receivedItems: new Map() };

describe("resumo do orçamento", () => {
	test("o exemplo soma o total, o custo, a margem e o que falta para a meta", () => {
		const summary = quoteSummary(example, 4000);
		expect(summary.costStatus).toBe("complete");
		expect(summary.totals.totalCents).toBe(88_200n);
		expect(summary.totals.costCents).toBe(56_350n);
		expect(summary.pricing).toEqual({
			belowCost: false,
			belowTarget: true,
			marginBasisPoints: 3611,
			suggestedCents: 93_917n,
		});
		expect(summary.shortOfTargetCents).toBe(5717n);
		expect(summary.missing).toEqual([]);
	});

	test("custo incompleto não tem margem e lista o que falta", () => {
		const lace = fabric(4, "Renda", "500000", null);
		const summary = quoteSummary(
			{
				discount: null,
				lines: [
					service,
					rush(null),
					{ ...dress, components: [lace, sewing] },
					{ ...dress, components: [], id: id(5) },
					{ ...zipper, unitCostCents: null },
				],
			},
			4000
		);
		expect(summary.costStatus).toBe("incomplete");
		expect(summary.pricing).toBeNull();
		expect(summary.shortOfTargetCents).toBeNull();
		expect(summary.missing).toEqual([
			"Taxa de urgência",
			"Vestido de festa sob medida · Renda",
			"Vestido de festa sob medida · sem componentes",
			"Zíper invisível · 20 cm preto",
		]);
	});

	test("orçamento sem itens não tem custo", () => {
		const summary = quoteSummary({ discount: null, lines: [] }, 4000);
		expect(summary.costStatus).toBe("empty");
		expect(summary.pricing).toBeNull();
	});

	test("linha com 100% de desconto dá total zero, sem margem e abaixo da meta", () => {
		const summary = quoteSummary(
			{
				discount: null,
				lines: [
					{
						...service,
						discount: { basisPoints: 10_000, kind: "percent", reason: null },
					},
				],
			},
			4000
		);
		expect(summary.totals.totalCents).toBe(0n);
		expect(summary.pricing).toMatchObject({
			belowTarget: true,
			marginBasisPoints: null,
		});
	});
});

describe("linhas", () => {
	test("título e detalhe saem das cópias, sem consultar o catálogo", () => {
		expect([service, dress, zipper, rush(null)].map(lineTitle)).toEqual([
			"Ajuste de cava",
			"Vestido de festa sob medida",
			"Zíper invisível · 20 cm preto",
			"Taxa de urgência",
		]);
		expect(lineDetail(service, people)).toBe(
			"serviço · para Maria · peça Blazer de linho · 1 h 30 min"
		);
		expect(lineDetail(service, nobody)).toBe("serviço · 1 h 30 min");
		expect(lineDetail(dress, people)).toBe(
			"sob medida · para Maria · ficha Vestido Midi v3 · variante M Cru · 4 componentes"
		);
		expect(
			lineDetail(
				{ ...dress, components: [], profileId: null, source: null },
				people
			)
		).toBe("sob medida · montada no orçamento · sem componentes");
		expect(
			lineDetail({ ...dress, components: [sewing], source: null }, nobody)
		).toBe("sob medida · montada no orçamento · 1 componente");
		expect(lineDetail(zipper, people)).toBe("material · ZIP-20");
		expect(lineDetail({ ...zipper, code: null }, people)).toBe("material");
		expect(lineDetail(rush(null), people)).toBe("linha livre");
	});

	test("quantidade, desconto e revisão em texto", () => {
		expect(lineQuantityLabel({ ...service, quantity: 2 })).toBe("2 un");
		expect(
			lineQuantityLabel({
				...zipper,
				baseUnit: "m",
				displayPrecision: 2,
				quantityMicros: "2500000",
			})
		).toBe("2,50 m");
		expect(lineQuantityLabel(zipper)).toBe("1 un");
		expect(discountLabel(null)).toBeNull();
		expect(
			discountLabel({ basisPoints: 1000, kind: "percent", reason: null })
		).toBe("10%");
		expect(
			discountLabel({ amountCents: "1600", kind: "amount", reason: null })
		).toBe("R$ 16,00");
		expect(revisionLabel("ORC-2026-PC-0001", 2)).toBe(
			"ORC-2026-PC-0001 · rev. 2"
		);
	});
});

describe("estado e revisões", () => {
	const older = revisionOf(example, 1, "2026-10-01");
	const newer = revisionOf(example, 2, "2026-09-20");

	test("o estado segue a revisão de maior número", () => {
		expect(latestRevisionOf([older, newer])?.number).toBe(2);
		expect(latestRevisionOf([newer, older])?.number).toBe(2);
		expect(
			quoteStatusOf({ refusedOn: null }, [older, newer], "2026-09-24")
		).toBe("expired");
		expect(
			quoteStatusOf({ refusedOn: "2026-09-25" }, [older, newer], "2026-09-24")
		).toBe("refused");
		expect(quoteStatusOf({ refusedOn: null }, [], "2026-09-24")).toBe("draft");
		expect(quoteStatusOf({ refusedOn: null }, [older], "2026-10-01")).toBe(
			"emitted"
		);
		expect(nextRevisionNumber([])).toBe(1);
		expect(nextRevisionNumber([newer, older])).toBe(3);
		expect(statusLabels).toEqual({
			draft: "rascunho",
			emitted: "emitido",
			expired: "vencido",
			refused: "recusado",
		});
		expect(
			(["draft", "emitted", "expired", "refused"] as const).map(statusTone)
		).toEqual(["neutral", "success", "warning", "danger"]);
	});

	test("sameContent ignora os valores calculados e acusa qualquer mudança de entrada", () => {
		expect(sameContent(example, older)).toBe(true);
		expect(
			sameContent(
				{ ...example, lines: [{ ...service, quantity: 2 }, dress, zipper] },
				older
			)
		).toBe(false);
		expect(sameContent({ ...example, notes: "Outra" }, older)).toBe(false);
		expect(sameContent(example, undefined)).toBe(false);
	});

	test("revisionContent devolve as entradas da revisão, sem os valores calculados", () => {
		expect(revisionContent(older)).toEqual(example);
		expect(sameContent(revisionContent(newer), newer)).toBe(true);
	});
});

describe("materiais previstos e avisos", () => {
	test("soma por variante, compara com o saldo e mostra a falta", () => {
		const doubleDress: QuoteLineView = {
			...dress,
			components: [fabric(1, "Crepe georgette", "1400000", "3800")],
			quantity: 2,
		};
		const rows = plannedMaterialsView(
			[doubleDress, zipper, { ...zipper, id: id(6) }],
			[
				{ quantityMicros: "2000000", variantId: id(81) },
				{ quantityMicros: "5000000", variantId: id(89) },
			]
		);
		expect(rows).toEqual([
			{
				baseUnit: "m",
				code: "TEC-1",
				displayPrecision: 2,
				label: "Crepe georgette · Verde musgo",
				plannedMicros: 2_800_000n,
				shortageMicros: 800_000n,
				stockMicros: 2_000_000n,
				variantId: id(81),
			},
			{
				baseUnit: "un",
				code: "ZIP-20",
				displayPrecision: 0,
				label: "Zíper invisível · 20 cm preto",
				plannedMicros: 2_000_000n,
				shortageMicros: 0n,
				stockMicros: 5_000_000n,
				variantId: id(89),
			},
		]);
		expect(plannedMaterialsView([zipper], [])[0]).toMatchObject({
			shortageMicros: 1_000_000n,
			stockMicros: 0n,
		});
	});

	test("avisos da emissão pela margem e pelo custo", () => {
		expect(emissionWarnings(quoteSummary(example, 4000))).toEqual([
			"belowTarget",
		]);
		expect(
			emissionWarnings(
				quoteSummary(
					{ discount: null, lines: [{ ...service, unitPriceCents: "5000" }] },
					4000
				)
			)
		).toEqual(["belowCost", "belowTarget"]);
		expect(
			emissionWarnings(
				quoteSummary({ discount: null, lines: [rush(null)] }, 4000)
			)
		).toEqual(["incomplete"]);
		expect(
			emissionWarnings(
				quoteSummary(
					{ discount: null, lines: [{ ...service, discount: null }] },
					0
				)
			)
		).toEqual([]);
	});
});

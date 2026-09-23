import { describe, expect, test } from "bun:test";

import { suggestPrice } from "./pricing";
import {
	effectiveSheet,
	plannedQuantity,
	productSearchKey,
	productVariantSearchKey,
	type SheetItem,
	type SheetLoss,
	type SheetPrices,
	sheetCost,
} from "./product";

const percent = (basisPoints: number): SheetLoss => ({
	basisPoints,
	kind: "percent",
});

const material = (
	id: string,
	materialVariantId: string,
	quantityMicros: bigint,
	loss: SheetLoss | null = null
): SheetItem => ({
	id,
	kind: "material",
	loss,
	materialVariantId,
	note: null,
	quantityMicros,
});

const service = (id: string, serviceId: string, count: number): SheetItem => ({
	count,
	id,
	kind: "service",
	note: null,
	serviceId,
});

const prices: SheetPrices = {
	materials: new Map<string, bigint | null>([
		["oxford-azul", 2550n],
		["oxford-vermelho", 2700n],
		["linha-branca", 2n],
		["ziper", 350n],
		["botao", null],
	]),
	services: new Map([
		["costura", 4000n],
		["bordado", 1500n],
	]),
};

const base: SheetItem[] = [
	material("tecido", "oxford-azul", 1_200_000n, percent(1000)),
	material("linha", "linha-branca", 50_000_000n, {
		kind: "fixed",
		quantityMicros: 5_000_000n,
	}),
	material("ziper", "ziper", 1_000_000n),
	service("costura", "costura", 1),
	service("bordado", "bordado", 2),
];

const itemsOf = (entries: { item: SheetItem }[]) =>
	entries.map(({ item }) => item);

describe("quantidade planejada", () => {
	test("soma a perda fixa e o teto da perda percentual", () => {
		expect(plannedQuantity(1_200_000n, null)).toBe(1_200_000n);
		expect(
			plannedQuantity(1_000_000n, { kind: "fixed", quantityMicros: 100_000n })
		).toBe(1_100_000n);
		expect(plannedQuantity(1_200_000n, percent(1000))).toBe(1_320_000n);
		expect(plannedQuantity(333_333n, percent(1000))).toBe(366_667n);
		expect(plannedQuantity(1n, percent(1))).toBe(2n);
	});
});

describe("ficha efetiva", () => {
	const letters = [
		{ id: "a", label: "A" },
		{ id: "b", label: "B" },
		{ id: "c", label: "C" },
	];

	test("troca no lugar, tira e acrescenta no fim", () => {
		expect(
			effectiveSheet(letters, [
				{ item: { id: "d", label: "D" }, kind: "add" },
				{ item: { id: "b", label: "B2" }, kind: "replace" },
				{ itemId: "c", kind: "remove" },
			])
		).toEqual([
			{ item: { id: "a", label: "A" }, origin: "base" },
			{ item: { id: "b", label: "B2" }, origin: "replaced" },
			{ item: { id: "d", label: "D" }, origin: "added" },
		]);
	});

	test("ignora troca e retirada de item que saiu da base", () => {
		expect(
			effectiveSheet(letters.slice(0, 1), [
				{ item: { id: "x", label: "X" }, kind: "replace" },
				{ itemId: "y", kind: "remove" },
			])
		).toEqual([{ item: { id: "a", label: "A" }, origin: "base" }]);
	});

	test("sem ajuste devolve a base na ordem", () => {
		expect(itemsOf(effectiveSheet(base, []))).toEqual(base);
	});
});

describe("custo da ficha", () => {
	test("soma materiais pelo custo de referência e serviços pela quantidade", () => {
		expect(sheetCost(base, prices)).toEqual({
			complete: true,
			lines: [3366n, 110n, 350n, 4000n, 3000n],
			totalCents: 10_826n,
		});
		expect(suggestPrice(10_826n, 4000)).toBe(18_044n);
	});

	test("uma variante troca o tecido e outra tira o bordado", () => {
		const red = itemsOf(
			effectiveSheet(base, [
				{
					item: material(
						"tecido",
						"oxford-vermelho",
						1_400_000n,
						percent(1000)
					),
					kind: "replace",
				},
			])
		);
		expect(sheetCost(red, prices).totalCents).toBe(11_618n);
		expect(suggestPrice(11_618n, 4000)).toBe(19_364n);
		const plain = itemsOf(
			effectiveSheet(base, [{ itemId: "bordado", kind: "remove" }])
		);
		expect(sheetCost(plain, prices).totalCents).toBe(7826n);
		expect(suggestPrice(7826n, 4000)).toBe(13_044n);
	});

	test("material sem custo de referência, material e serviço fora do mapa deixam o custo incompleto", () => {
		const items = [
			...base,
			material("botao", "botao", 4_000_000n),
			material("sumido", "sem-cadastro", 1_000_000n),
			service("fora", "servico-sumido", 1),
		];
		expect(sheetCost(items, prices)).toEqual({
			complete: false,
			lines: [3366n, 110n, 350n, 4000n, 3000n, null, null, null],
			totalCents: 10_826n,
		});
	});

	test("cada material arredonda meio para cima ao centavo", () => {
		expect(
			sheetCost([material("m", "ziper", 1_234_567n)], {
				materials: new Map([["ziper", 1000n]]),
				services: new Map(),
			}).lines
		).toEqual([1235n]);
	});
});

test("chaves de busca juntam nome e categoria, e nome e código, sem acento", () => {
	expect(productSearchKey({ category: "Roupa", name: "Vestido Midí" })).toBe(
		"vestido midi roupa"
	);
	expect(productSearchKey({ category: null, name: "Nécessaire" })).toBe(
		"necessaire"
	);
	expect(productVariantSearchKey({ code: "VM-P-AZ", name: "P Azul" })).toBe(
		"p azul vm-p-az"
	);
	expect(productVariantSearchKey({ code: null, name: "Única" })).toBe("unica");
});

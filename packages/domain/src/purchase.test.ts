import { describe, expect, test } from "bun:test";
import {
	allocateProportionally,
	type PurchaseLineInput,
	purchaseLimits,
	purchaseTotals,
} from "./purchase";
import { maxExactInteger } from "./quantity";

const meter = 1_000_000n;

function line(
	packageCountMicros: bigint,
	packagingQuantityMicros: bigint,
	unitPriceCents: bigint
): PurchaseLineInput {
	return { packageCountMicros, packagingQuantityMicros, unitPriceCents };
}

function totalsOf(
	lines: PurchaseLineInput[],
	freightCents = 0n,
	discountCents = 0n
) {
	const result = purchaseTotals(lines, freightCents, discountCents);
	if (!result.ok) {
		throw new Error(`problema inesperado: ${result.problem}`);
	}
	return result.totals;
}

describe("allocateProportionally", () => {
	test("dá o piso a cada item e o resto ao último", () => {
		expect(allocateProportionally(2n, [1n, 1n, 1n, 1n])).toEqual([
			0n,
			0n,
			0n,
			2n,
		]);
		expect(allocateProportionally(1000n, [5n, 5n, 5n])).toEqual([
			333n,
			333n,
			334n,
		]);
	});

	test("divide na proporção dos pesos", () => {
		expect(allocateProportionally(100n, [1000n, 3000n])).toEqual([25n, 75n]);
	});

	test("peso único recebe tudo e total zero não distribui nada", () => {
		expect(allocateProportionally(937n, [42n])).toEqual([937n]);
		expect(allocateProportionally(0n, [3n, 7n])).toEqual([0n, 0n]);
	});

	test("o resto vai para o último item com peso, nunca para um peso zero", () => {
		expect(allocateProportionally(2000n, [12_000n, 8500n, 0n])).toEqual([
			1170n,
			830n,
			0n,
		]);
		expect(allocateProportionally(5n, [0n, 3n, 0n])).toEqual([0n, 5n, 0n]);
	});

	test("conserva o total", () => {
		const shares = allocateProportionally(1501n, [7n, 13n, 29n, 1n]);
		expect(shares.reduce((sum, share) => sum + share, 0n)).toBe(1501n);
	});
});

describe("purchaseTotals", () => {
	test("converte embalagens para a unidade base", () => {
		const totals = totalsOf([line(3n * meter, 50n * meter, 12_000n)]);
		expect(totals.lines[0]?.quantityMicros).toBe(150n * meter);
		expect(totals.lines[0]?.grossCents).toBe(36_000n);
		expect(totals.totalCents).toBe(36_000n);
	});

	test("arredonda o bruto da linha meio para cima", () => {
		const totals = totalsOf([line(2_500_000n, meter, 1233n)]);
		expect(totals.lines[0]?.grossCents).toBe(3083n);
		expect(totals.lines[0]?.quantityMicros).toBe(2_500_000n);
	});

	test("rateia frete e desconto pelo bruto e conserva o total (CA-03)", () => {
		const totals = totalsOf(
			[line(3n * meter, 50n * meter, 12_000n), line(10n * meter, meter, 850n)],
			1500n,
			2000n
		);
		expect(totals.lines.map((item) => item.grossCents)).toEqual([
			36_000n,
			8500n,
		]);
		expect(totals.lines.map((item) => item.freightCents)).toEqual([
			1213n,
			287n,
		]);
		expect(totals.lines.map((item) => item.discountCents)).toEqual([
			1617n,
			383n,
		]);
		expect(totals.lines.map((item) => item.valueCents)).toEqual([
			35_596n,
			8404n,
		]);
		expect(totals).toMatchObject({
			discountCents: 2000n,
			freightCents: 1500n,
			grossCents: 44_500n,
			totalCents: 44_000n,
		});
		expect(totals.lines.reduce((sum, item) => sum + item.valueCents, 0n)).toBe(
			totals.totalCents
		);
	});

	test("aceita item sem preço sem frete nem desconto", () => {
		const totals = totalsOf([line(meter, meter, 0n), line(meter, meter, 500n)]);
		expect(totals.lines.map((item) => item.valueCents)).toEqual([0n, 500n]);
	});

	test("aceita brinde no fim com frete e desconto, sem custo para ele", () => {
		const totals = totalsOf(
			[
				line(meter, meter, 12_000n),
				line(meter, meter, 8500n),
				line(meter, meter, 0n),
			],
			300n,
			2000n
		);
		expect(totals.lines.map((item) => item.valueCents)).toEqual([
			11_005n,
			7795n,
			0n,
		]);
		expect(totals.totalCents).toBe(18_800n);
	});

	test("recusa quantidade que arredonda para zero", () => {
		expect(purchaseTotals([line(1n, 400_000n, 100n)], 0n, 0n)).toEqual({
			ok: false,
			problem: "zeroQuantity",
		});
	});

	test("recusa frete ou desconto sem valor bruto", () => {
		expect(purchaseTotals([line(meter, meter, 0n)], 100n, 0n)).toEqual({
			ok: false,
			problem: "allocationWithoutGross",
		});
		expect(purchaseTotals([line(meter, meter, 0n)], 0n, 100n)).toEqual({
			ok: false,
			problem: "allocationWithoutGross",
		});
	});

	test("recusa total zero ou negativo", () => {
		expect(purchaseTotals([line(meter, meter, 500n)], 0n, 500n)).toEqual({
			ok: false,
			problem: "nonPositiveTotal",
		});
		expect(purchaseTotals([line(meter, meter, 0n)], 0n, 0n)).toEqual({
			ok: false,
			problem: "nonPositiveTotal",
		});
	});

	test("recusa item com custo negativo pelo resto do desconto", () => {
		expect(
			purchaseTotals(
				[
					line(meter, meter, 1n),
					line(meter, meter, 1n),
					line(meter, meter, 1n),
					line(meter, meter, 1n),
				],
				0n,
				3n
			)
		).toEqual({ ok: false, problem: "negativeLine" });
	});

	test("recusa valor acima do inteiro exato", () => {
		expect(
			purchaseTotals([line(2n * meter, meter, maxExactInteger)], 0n, 0n)
		).toEqual({ ok: false, problem: "tooLarge" });
		expect(
			purchaseTotals([line(meter, meter, maxExactInteger)], 1n, 0n)
		).toEqual({ ok: false, problem: "tooLarge" });
	});
});

describe("purchaseLimits", () => {
	test("de 1 a 100 itens e textos com teto", () => {
		expect(purchaseLimits).toEqual({
			items: { max: 100, min: 1 },
			notes: 2000,
			reason: { max: 200, min: 1 },
			reference: 60,
		});
	});
});

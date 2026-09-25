import { describe, expect, test } from "bun:test";

import {
	type ConsumptionPoint,
	consumptionPartValue,
	reconciliationLimits,
	reconciliationOutcome,
	suggestConsumptionParts,
	valueConsumptionParts,
} from "./reconciliation";

const cabinet = "d0000000-0000-4000-8000-000000000001";
const drawer = "d0000000-0000-4000-8000-000000000002";
const shelf = "d0000000-0000-4000-8000-000000000003";
const cabinetTwin = "d0000000-0000-4000-8000-000000000004";
const rollA = "e0000000-0000-4000-8000-000000000001";
const rollB = "e0000000-0000-4000-8000-000000000002";
const rollC = "e0000000-0000-4000-8000-000000000003";
const rollD = "e0000000-0000-4000-8000-000000000004";

function point(
	locationId: string,
	locationName: string,
	lotId: string | null,
	lotCreatedAt: string | null,
	quantityMicros: bigint
): ConsumptionPoint {
	return { locationId, locationName, lotCreatedAt, lotId, quantityMicros };
}

const lotPoints: ConsumptionPoint[] = [
	point(cabinet, "Armário", rollB, "2026-09-10", 2_000_000n),
	point(cabinet, "Armário", rollA, "2026-09-01", 1_000_000n),
	point(drawer, "Gaveta", rollC, "2026-09-05", 0n),
	point(shelf, "Prateleira", rollD, "2026-09-03", -500_000n),
];

describe("reconciliationLimits", () => {
	test("limites da reconciliação", () => {
		expect(reconciliationLimits).toEqual({
			lines: { max: 60, min: 1 },
			note: 200,
			parts: { max: 20 },
			reason: { max: 200, min: 1 },
		});
	});
});

describe("suggestConsumptionParts", () => {
	test("toma do lote mais antigo com saldo e pula ponto zerado ou negativo", () => {
		expect(suggestConsumptionParts(lotPoints, 2_500_000n)).toEqual([
			{ locationId: cabinet, lotId: rollA, quantityMicros: 1_000_000n },
			{ locationId: cabinet, lotId: rollB, quantityMicros: 1_500_000n },
		]);
	});

	test("o que falta além do saldo vai para a última parte", () => {
		expect(suggestConsumptionParts(lotPoints, 4_000_000n)).toEqual([
			{ locationId: cabinet, lotId: rollA, quantityMicros: 1_000_000n },
			{ locationId: cabinet, lotId: rollB, quantityMicros: 3_000_000n },
		]);
	});

	test("necessidade zero não sugere parte", () => {
		expect(suggestConsumptionParts(lotPoints, 0n)).toEqual([]);
	});

	test("sem lote ordena pelo nome do local", () => {
		expect(
			suggestConsumptionParts(
				[
					point(shelf, "Prateleira", null, null, 1_000_000n),
					point(cabinet, "Armário", null, null, 1_000_000n),
				],
				1_500_000n
			)
		).toEqual([
			{ locationId: cabinet, lotId: null, quantityMicros: 1_000_000n },
			{ locationId: shelf, lotId: null, quantityMicros: 500_000n },
		]);
	});

	test("ponto sem lote vem antes do ponto com lote", () => {
		expect(
			suggestConsumptionParts(
				[
					point(cabinet, "Armário", rollA, "2026-09-01", 1_000_000n),
					point(shelf, "Prateleira", null, null, 1_000_000n),
				],
				1_500_000n
			)
		).toEqual([
			{ locationId: shelf, lotId: null, quantityMicros: 1_000_000n },
			{ locationId: cabinet, lotId: rollA, quantityMicros: 500_000n },
		]);
	});

	test("só pontos zerados ou negativos não sugere parte", () => {
		expect(
			suggestConsumptionParts(
				[
					point(drawer, "Gaveta", null, null, 0n),
					point(shelf, "Prateleira", null, null, -1_000_000n),
				],
				1_000_000n
			)
		).toEqual([]);
	});

	test("o lote mais antigo vem primeiro mesmo com id maior", () => {
		expect(
			suggestConsumptionParts(
				[
					point(cabinet, "Armário", rollA, "2026-09-10", 1_000_000n),
					point(cabinet, "Armário", rollB, "2026-09-01", 1_000_000n),
				],
				1_500_000n
			)
		).toEqual([
			{ locationId: cabinet, lotId: rollB, quantityMicros: 1_000_000n },
			{ locationId: cabinet, lotId: rollA, quantityMicros: 500_000n },
		]);
	});

	test("para em 20 saídas e a última leva o resto", () => {
		const many = Array.from({ length: 25 }, (_, n) =>
			point(
				`d0000000-0000-4000-8000-${String(100 + n).padStart(12, "0")}`,
				`Local ${String(n).padStart(2, "0")}`,
				null,
				null,
				1_000_000n
			)
		);
		const parts = suggestConsumptionParts(many, 30_000_000n);
		expect(parts).toHaveLength(reconciliationLimits.parts.max);
		expect(parts.slice(0, 19).map((part) => part.quantityMicros)).toEqual(
			Array.from({ length: 19 }, () => 1_000_000n)
		);
		expect(parts.at(-1)).toEqual({
			locationId: "d0000000-0000-4000-8000-000000000119",
			lotId: null,
			quantityMicros: 11_000_000n,
		});
	});

	test("mesmo lote no tempo desempata pelo nome do local e depois pelo id", () => {
		expect(
			suggestConsumptionParts(
				[
					point(shelf, "Prateleira", rollC, "2026-09-05", 1_000_000n),
					point(cabinetTwin, "Armário", rollB, "2026-09-05", 1_000_000n),
					point(cabinet, "Armário", rollA, "2026-09-05", 1_000_000n),
				],
				2_500_000n
			)
		).toEqual([
			{ locationId: cabinet, lotId: rollA, quantityMicros: 1_000_000n },
			{ locationId: cabinetTwin, lotId: rollB, quantityMicros: 1_000_000n },
			{ locationId: shelf, lotId: rollC, quantityMicros: 500_000n },
		]);
	});
});

describe("consumptionPartValue", () => {
	test("parte coberta pelo saldo sai pela média do ponto", () => {
		expect(consumptionPartValue(2_500_000n, 7500n, 1_000_000n, 3000n)).toEqual({
			provisionalCents: 0n,
			provisionalMicros: 0n,
			valueCents: 3000n,
		});
	});

	test("o que passa do saldo positivo é provisório pela média", () => {
		expect(consumptionPartValue(1_500_000n, 3750n, 2_300_000n, null)).toEqual({
			provisionalCents: 2000n,
			provisionalMicros: 800_000n,
			valueCents: 5750n,
		});
	});

	test("ponto zerado usa a referência ou zero", () => {
		expect(consumptionPartValue(0n, 0n, 500_000n, 1200n)).toEqual({
			provisionalCents: 600n,
			provisionalMicros: 500_000n,
			valueCents: 600n,
		});
		expect(consumptionPartValue(0n, 0n, 500_000n, null)).toEqual({
			provisionalCents: 0n,
			provisionalMicros: 500_000n,
			valueCents: 0n,
		});
	});

	test("ponto já negativo usa a referência na parte inteira", () => {
		expect(consumptionPartValue(-200_000n, -500n, 1_000_000n, 1000n)).toEqual({
			provisionalCents: 1000n,
			provisionalMicros: 1_000_000n,
			valueCents: 1000n,
		});
	});

	test("ponto com quantidade e valor não positivo não tem média", () => {
		expect(consumptionPartValue(100_000n, -700n, 500_000n, 3000n)).toEqual({
			provisionalCents: 1500n,
			provisionalMicros: 500_000n,
			valueCents: 1500n,
		});
		expect(consumptionPartValue(100_000n, 0n, 50_000n, null)).toEqual({
			provisionalCents: 0n,
			provisionalMicros: 50_000n,
			valueCents: 0n,
		});
	});
});

describe("valueConsumptionParts", () => {
	test("cada parte sai do saldo que as anteriores deixaram no ponto", () => {
		const balances = new Map([
			["crepe|armario", { quantityMicros: 2_500_000n, valueCents: 7500n }],
			["crepe|gaveta", { quantityMicros: 1_000_000n, valueCents: 2000n }],
		]);
		const part = (
			line: number,
			pointKey: string,
			quantityMicros: bigint,
			referenceCostCents: bigint | null
		) => ({ line, pointKey, quantityMicros, referenceCostCents });
		const parts = [
			part(0, "crepe|armario", 2_000_000n, 3000n),
			part(0, "crepe|gaveta", 500_000n, 3000n),
			part(1, "crepe|armario", 1_000_000n, 3000n),
			part(2, "crepe|prateleira", 200_000n, null),
		];
		expect(valueConsumptionParts(balances, parts)).toEqual([
			{
				...part(0, "crepe|armario", 2_000_000n, 3000n),
				before: { quantityMicros: 2_500_000n, valueCents: 7500n },
				provisionalCents: 0n,
				provisionalMicros: 0n,
				valueCents: 6000n,
			},
			{
				...part(0, "crepe|gaveta", 500_000n, 3000n),
				before: { quantityMicros: 1_000_000n, valueCents: 2000n },
				provisionalCents: 0n,
				provisionalMicros: 0n,
				valueCents: 1000n,
			},
			{
				...part(1, "crepe|armario", 1_000_000n, 3000n),
				before: { quantityMicros: 500_000n, valueCents: 1500n },
				provisionalCents: 1500n,
				provisionalMicros: 500_000n,
				valueCents: 3000n,
			},
			{
				...part(2, "crepe|prateleira", 200_000n, null),
				before: { quantityMicros: 0n, valueCents: 0n },
				provisionalCents: 0n,
				provisionalMicros: 200_000n,
				valueCents: 0n,
			},
		]);
		expect(balances.get("crepe|armario")).toEqual({
			quantityMicros: 2_500_000n,
			valueCents: 7500n,
		});
	});
});

describe("reconciliationOutcome", () => {
	test("saída menor que o planejado deixa sobra", () => {
		expect(reconciliationOutcome(3_400_000n, 3_000_000n, 200_000n)).toEqual({
			extraMicros: 0n,
			leftoverMicros: 200_000n,
			outMicros: 3_200_000n,
		});
	});

	test("saída maior que o planejado é a mais", () => {
		expect(reconciliationOutcome(1_000_000n, 1_200_000n, 100_000n)).toEqual({
			extraMicros: 300_000n,
			leftoverMicros: 0n,
			outMicros: 1_300_000n,
		});
	});

	test("sem saída tudo é sobra", () => {
		expect(reconciliationOutcome(1_000_000n, 0n, 0n)).toEqual({
			extraMicros: 0n,
			leftoverMicros: 1_000_000n,
			outMicros: 0n,
		});
	});
});

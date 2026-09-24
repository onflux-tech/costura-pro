import { describe, expect, test } from "bun:test";

import { planReservation, planReservations } from "./reservation";

test("aprova 8 unidades com só 5 disponíveis e marca 3 pendentes", () => {
	expect(planReservation(5_000_000n, 0n, 8_000_000n)).toEqual({
		reservedMicros: 5_000_000n,
		shortageMicros: 3_000_000n,
	});
});

test("não reserva saldo físico negativo", () => {
	expect(planReservation(-1_000_000n, 0n, 2_000_000n)).toEqual({
		reservedMicros: 0n,
		shortageMicros: 2_000_000n,
	});
});

test("rejeita necessidade negativa", () => {
	expect(() => planReservation(1n, 0n, -1n)).toThrow();
});

describe("planReservations", () => {
	const physical = new Map([
		["crepe", 2_500_000n],
		["zipper", 5_000_000n],
	]);
	const reserved = new Map([["crepe", 1_000_000n]]);

	test("acumula na mesma variante e desconta as reservas de outras OS", () => {
		const outcomes = planReservations(
			[
				{ key: "piece", quantityMicros: 3_400_000n, variantId: "crepe" },
				{ key: "piece", quantityMicros: 1_000_000n, variantId: "zipper" },
				{ key: "material", quantityMicros: 2_000_000n, variantId: "zipper" },
				{ key: "other", quantityMicros: 1_000_000n, variantId: "crepe" },
			],
			physical,
			reserved
		);
		expect(
			outcomes.map((item) => [
				item.key,
				item.variantId,
				item.reservedMicros,
				item.shortageMicros,
			])
		).toEqual([
			["piece", "crepe", 1_500_000n, 1_900_000n],
			["piece", "zipper", 1_000_000n, 0n],
			["material", "zipper", 2_000_000n, 0n],
			["other", "crepe", 0n, 1_000_000n],
		]);
	});

	test("físico negativo, reservado acima do físico e variante ausente reservam zero", () => {
		const outcomes = planReservations(
			[
				{ key: "a", quantityMicros: 500_000n, variantId: "negative" },
				{ key: "b", quantityMicros: 500_000n, variantId: "over" },
				{ key: "c", quantityMicros: 500_000n, variantId: "unknown" },
			],
			new Map([
				["negative", -1_000_000n],
				["over", 1_000_000n],
			]),
			new Map([["over", 2_000_000n]])
		);
		expect(outcomes.map((item) => item.reservedMicros)).toEqual([0n, 0n, 0n]);
		expect(outcomes.map((item) => item.shortageMicros)).toEqual([
			500_000n,
			500_000n,
			500_000n,
		]);
	});

	test("carrega os campos a mais de cada necessidade", () => {
		const [outcome] = planReservations(
			[
				{
					key: "piece",
					quantityMicros: 1_000_000n,
					reservationId: "r1",
					variantId: "zipper",
				},
			],
			physical,
			new Map()
		);
		expect(outcome?.reservationId).toBe("r1");
	});
});

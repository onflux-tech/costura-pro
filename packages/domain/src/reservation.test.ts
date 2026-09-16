import { expect, test } from "bun:test";

import { planReservation } from "./reservation";

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

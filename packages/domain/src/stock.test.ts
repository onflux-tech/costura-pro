import { describe, expect, test } from "bun:test";

import { balancePointId, exitValueCents, stockMovementKinds } from "./stock";

describe("stockMovementKinds", () => {
	test("é a lista fechada na ordem de leitura", () => {
		expect([...stockMovementKinds]).toEqual([
			"opening",
			"adjustment",
			"transferOut",
			"transferIn",
			"reversal",
		]);
	});
});

describe("balancePointId", () => {
	test("distingue ponto sem lote de ponto com lote", () => {
		expect(balancePointId("v", "l", null)).toBe("v|l|-");
		expect(balancePointId("v", "l", "lot")).toBe("v|l|lot");
	});

	test("não confunde variantes e locais diferentes", () => {
		expect(balancePointId("v1", "l1", null)).not.toBe(
			balancePointId("v1", "l2", null)
		);
		expect(balancePointId("v1", "l1", null)).not.toBe(
			balancePointId("v2", "l1", null)
		);
	});
});

describe("exitValueCents", () => {
	test("tira a média do ponto arredondada meio para cima", () => {
		expect(exitValueCents(3_000_000n, 10n, 1_000_000n)).toBe(3n);
		expect(exitValueCents(3_000_000n, 20n, 1_000_000n)).toBe(7n);
	});

	test("arredonda a metade exata para cima", () => {
		expect(exitValueCents(2_000_000n, 7n, 1_000_000n)).toBe(4n);
	});

	test("não divide por zero num ponto zerado ou negativo", () => {
		expect(exitValueCents(0n, 500n, 1_000_000n)).toBe(0n);
		expect(exitValueCents(-1_000_000n, 500n, 1_000_000n)).toBe(0n);
	});

	test("saída além do saldo leva o valor proporcional à média", () => {
		expect(exitValueCents(1_000_000n, 100n, 3_000_000n)).toBe(300n);
	});

	test("saída de tudo leva todo o valor do ponto", () => {
		expect(exitValueCents(2_500_000n, 999n, 2_500_000n)).toBe(999n);
	});

	test("ponto sem valor não inventa custo", () => {
		expect(exitValueCents(5_000_000n, 0n, 1_000_000n)).toBe(0n);
	});
});

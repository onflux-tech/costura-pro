import { describe, expect, test } from "bun:test";

import {
	financialAccountKinds,
	financialMovementKinds,
	obligationStatus,
	obligationStatuses,
} from "./finance";

describe("listas fechadas de finanças", () => {
	test("tipos de conta na ordem de exibição", () => {
		expect([...financialAccountKinds]).toEqual([
			"cash",
			"bank",
			"pix",
			"other",
		]);
	});

	test("tipos de movimento financeiro", () => {
		expect([...financialMovementKinds]).toEqual([
			"opening",
			"transferOut",
			"transferIn",
			"obligationPayment",
			"reversal",
		]);
	});

	test("estados da obrigação", () => {
		expect([...obligationStatuses]).toEqual(["open", "paid", "cancelled"]);
	});
});

describe("obligationStatus", () => {
	test("sem pagamento nem estorno fica aberta", () => {
		expect(obligationStatus({ paid: false, reversed: false })).toBe("open");
	});

	test("com pagamento ativo fica paga", () => {
		expect(obligationStatus({ paid: true, reversed: false })).toBe("paid");
	});

	test("compra estornada cancela, mesmo que ainda houvesse pagamento", () => {
		expect(obligationStatus({ paid: false, reversed: true })).toBe("cancelled");
		expect(obligationStatus({ paid: true, reversed: true })).toBe("cancelled");
	});
});

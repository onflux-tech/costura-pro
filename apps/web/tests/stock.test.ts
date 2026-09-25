import { describe, expect, test } from "bun:test";
import { sectionTabs } from "../src/lib/section-tabs";
import {
	type AdjustmentFormValues,
	adjustmentFields,
	adjustmentFormErrors,
	availabilityOf,
	balanceValue,
	locationFormErrors,
	lotFormErrors,
	movementAction,
	movementKindLabel,
	movementQuantity,
	openingValueCents,
	pointQuantity,
	reservationNote,
	type TransferFormValues,
	transferFormErrors,
} from "../src/lib/stock";

const adjustment: AdjustmentFormValues = {
	direction: "out",
	locationId: "local-1",
	lotId: null,
	occurredOn: "2026-09-17",
	quantity: "1",
	reason: "Perda no corte",
	value: "",
};

const transfer: TransferFormValues = {
	fromLocationId: "local-1",
	lotId: null,
	occurredOn: "2026-09-17",
	quantity: "2",
	reason: "",
	toLocationId: "local-2",
};

describe("sectionTabs", () => {
	test("gives Estoque the balances, inventory and locations tabs", () => {
		expect(sectionTabs.estoque.map((tab) => tab.href)).toEqual([
			"/estoque/saldos",
			"/estoque/inventario",
			"/estoque/locais",
		]);
	});
});

describe("openingValueCents", () => {
	test("multiplies the reference cost by the quantity, to the cent", () => {
		expect(openingValueCents("1250", 5_000_000n)).toBe(6250n);
		expect(openingValueCents("999", 1_500_000n)).toBe(1499n);
	});

	test("rounds the exact half up", () => {
		expect(openingValueCents("1", 500_000n)).toBe(1n);
	});

	test("gives zero without a reference cost", () => {
		expect(openingValueCents(null, 5_000_000n)).toBe(0n);
	});
});

describe("locationFormErrors", () => {
	test("demands a name and limits the text", () => {
		expect(locationFormErrors({ name: "  ", notes: "" }).name).toBe(
			"Informe o nome do local"
		);
		expect(locationFormErrors({ name: "a".repeat(61), notes: "" }).name).toBe(
			"Use até 60 caracteres"
		);
		expect(locationFormErrors({ name: "Armário 1", notes: "" })).toEqual({});
	});
});

describe("lotFormErrors", () => {
	test("demands a label", () => {
		expect(lotFormErrors({ label: "", notes: "" }).label).toBe(
			"Informe o nome do lote"
		);
		expect(lotFormErrors({ label: "Rolo 1", notes: "" })).toEqual({});
	});
});

describe("adjustmentFormErrors", () => {
	test("demands a reason, a location and a quantity above zero", () => {
		expect(adjustmentFormErrors({ ...adjustment, reason: " " }).reason).toBe(
			"Diga o motivo do ajuste"
		);
		expect(
			adjustmentFormErrors({ ...adjustment, quantity: "0" }).quantity
		).toBe("Informe uma quantidade maior que zero");
		expect(
			adjustmentFormErrors({ ...adjustment, locationId: "" }).locationId
		).toBe("Escolha o local");
		expect(adjustmentFormErrors(adjustment)).toEqual({});
	});

	test("refuses more decimals than the column keeps", () => {
		expect(
			adjustmentFormErrors({ ...adjustment, quantity: "1,1234567" }).quantity
		).toBe("Use no máximo 6 casas decimais");
	});

	test("demands a value when the quantity goes in", () => {
		expect(adjustmentFormErrors({ ...adjustment, direction: "in" }).value).toBe(
			"Informe o valor que entra"
		);
		expect(
			adjustmentFormErrors({ ...adjustment, direction: "in", value: "10,00" })
		).toEqual({});
	});
});

describe("adjustmentFields", () => {
	test("signs the quantity by the direction and omits the value on the way out", () => {
		expect(adjustmentFields(adjustment)).toMatchObject({
			quantityMicros: "-1000000",
		});
		expect(adjustmentFields(adjustment).valueCents).toBeUndefined();
		expect(
			adjustmentFields({ ...adjustment, direction: "in", value: "10,00" })
		).toMatchObject({ quantityMicros: "1000000", valueCents: "1000" });
	});
});

describe("transferFormErrors", () => {
	test("refuses the same location on both sides", () => {
		expect(
			transferFormErrors({ ...transfer, toLocationId: "local-1" }).toLocationId
		).toBe("Escolha um local diferente da origem");
		expect(transferFormErrors(transfer)).toEqual({});
	});

	test("demands both locations and a quantity", () => {
		expect(transferFormErrors({ ...transfer, quantity: "" }).quantity).toBe(
			"Informe uma quantidade maior que zero"
		);
		expect(
			transferFormErrors({ ...transfer, toLocationId: "" }).toLocationId
		).toBe("Escolha o local de destino");
	});
});

describe("movementKindLabel", () => {
	test("names every kind in the history", () => {
		expect(movementKindLabel("opening")).toBe("Saldo de abertura");
		expect(movementKindLabel("adjustment")).toBe("Ajuste");
		expect(movementKindLabel("transferOut")).toBe("Transferência (saída)");
		expect(movementKindLabel("transferIn")).toBe("Transferência (entrada)");
		expect(movementKindLabel("reversal")).toBe("Estorno");
		expect(movementKindLabel("inventory")).toBe("Inventário");
		expect(movementKindLabel("consumption")).toBe("Consumo");
	});
});

describe("balanceValue and movementQuantity", () => {
	test("keep the sign readable on a negative movement", () => {
		expect(balanceValue("-1250")).toBe("R$ -12,50");
		expect(movementQuantity("-1000000", "m", 2)).toBe("-1,00 m");
		expect(movementQuantity("1000000", "m", 2)).toBe("+1,00 m");
		expect(pointQuantity("-1000000", "m", 2)).toBe("-1,00 m");
	});
});

describe("reservado e disponível", () => {
	test("disponível é o físico menos o reservado e pode ficar negativo", () => {
		expect(
			availabilityOf({ quantityMicros: "2500000", reservedMicros: "1500000" })
		).toEqual({ availableMicros: 1_000_000n, reservedMicros: 1_500_000n });
		expect(
			availabilityOf({ quantityMicros: "1000000", reservedMicros: "1500000" })
				.availableMicros
		).toBe(-500_000n);
	});

	test("nota do saldo com reserva, com filtro de local e sem reserva", () => {
		const crepe = {
			baseUnit: "m" as const,
			displayPrecision: 2,
			quantityMicros: "2500000",
			reservedMicros: "1500000",
		};
		expect(reservationNote(crepe, true)).toEqual({
			available: "disponível 1,00 m",
			reserved: "reservado 1,50 m",
			short: false,
		});
		expect(
			reservationNote({ ...crepe, quantityMicros: "1000000" }, true)
		).toEqual({
			available: "disponível -0,50 m",
			reserved: "reservado 1,50 m",
			short: true,
		});
		expect(reservationNote(crepe, false)).toEqual({
			available: null,
			reserved: "reservado 1,50 m em todos os locais",
			short: false,
		});
		expect(reservationNote({ ...crepe, reservedMicros: "0" }, true)).toBeNull();
	});
});

describe("movementAction", () => {
	const plain = {
		kind: "adjustment" as const,
		purchaseId: null,
		reversedByMovementId: null,
		serviceOrderId: null,
	};

	test("compra e reconciliação levam à origem, mesmo estornadas", () => {
		expect(
			movementAction({ ...plain, kind: "purchase", purchaseId: "c1" })
		).toEqual({ id: "c1", kind: "purchase" });
		expect(
			movementAction({ ...plain, kind: "consumption", serviceOrderId: "os1" })
		).toEqual({ id: "os1", kind: "serviceOrder" });
		expect(
			movementAction({
				...plain,
				kind: "consumption",
				reversedByMovementId: "m2",
				serviceOrderId: "os1",
			})
		).toEqual({ id: "os1", kind: "serviceOrder" });
		expect(
			movementAction({ ...plain, kind: "reversal", serviceOrderId: "os1" })
		).toEqual({ id: "os1", kind: "serviceOrder" });
	});

	test("estornado e estorno não têm ação, o ajuste se estorna", () => {
		expect(movementAction({ ...plain, reversedByMovementId: "m2" })).toEqual({
			kind: "none",
		});
		expect(movementAction({ ...plain, kind: "reversal" })).toEqual({
			kind: "none",
		});
		expect(movementAction(plain)).toEqual({ kind: "reverse" });
	});
});

import { describe, expect, test } from "bun:test";
import {
	financialMovementCreatePayload,
	financialMovementTransferPayload,
} from "@costura-pro/api/finance/schemas";
import { purchaseCreatePayload } from "@costura-pro/api/purchases/schemas";
import {
	serviceCreatePayload,
	servicePatchPayload,
	targetMarginPayload,
} from "@costura-pro/api/services/schemas";

import {
	accountOpeningFields,
	accountTransferFields,
} from "../src/lib/finance";
import {
	type PurchaseFormValues,
	purchaseFields,
	type VariantOptionView,
} from "../src/lib/purchases";
import {
	emptyServiceValues,
	type ServiceView,
	serviceFields,
	servicePatch,
	targetMarginFields,
} from "../src/lib/services";

const uuid = () => crypto.randomUUID();

const fabric: VariantOptionView = {
	baseUnit: "m",
	code: null,
	displayPrecision: 2,
	id: uuid(),
	materialId: uuid(),
	materialName: "Gorgurão",
	name: "Azul marinho",
	packaging: { label: "Rolo 50 m", quantityMicros: "50000000" },
	tracksLots: false,
};

function form(overrides: Partial<PurchaseFormValues> = {}): PurchaseFormValues {
	return {
		accountId: uuid(),
		discount: "20,00",
		dueOn: "2026-10-17",
		freight: "15,00",
		items: [
			{
				key: uuid(),
				locationId: uuid(),
				lotId: null,
				movementId: uuid(),
				packageCount: "3",
				packagingLabel: "Rolo 50 m",
				packagingQuantity: "50",
				unitPrice: "120,00",
				variant: fabric,
			},
		],
		notes: "",
		occurredOn: "2026-09-17",
		paymentKind: "now",
		reference: "NF 4521",
		supplierId: uuid(),
		...overrides,
	};
}

describe("payload da web contra o schema do servidor", () => {
	test("a compra paga na hora e a prazo passam no schema da compra", () => {
		const ids = { obligationId: uuid(), paymentMovementId: uuid() };
		for (const values of [form(), form({ paymentKind: "later" })]) {
			const fields = purchaseFields(values, ids);
			expect(purchaseCreatePayload.parse(fields)).toEqual({
				...fields,
				notes: null,
			});
		}
	});

	test("abertura e transferência de conta passam nos schemas de finanças", () => {
		const opening = accountOpeningFields({
			amount: "80,50",
			direction: "out",
			occurredOn: "2026-09-17",
			reason: "",
		});
		expect(
			financialMovementCreatePayload.parse({ ...opening, accountId: uuid() })
		).toMatchObject({ amountCents: "-8050", kind: "opening" });
		const transfer = accountTransferFields(
			{
				amount: "40",
				occurredOn: "2026-09-17",
				reason: "",
				toAccountId: uuid(),
			},
			uuid()
		);
		expect(
			financialMovementTransferPayload.parse({ ...transfer, inboundId: uuid() })
		).toMatchObject({ amountCents: "4000" });
	});

	test("serviço, edição e meta do ateliê passam nos schemas de serviço", () => {
		const fields = serviceFields({
			...emptyServiceValues,
			category: "Barra",
			cost: "60",
			estimatedMinutes: "30",
			kind: "outsourced",
			name: "Barra de calça",
			price: "100,00",
			targetMargin: "37,5",
		});
		expect(serviceCreatePayload.parse(fields)).toEqual(fields);
		const opened: ServiceView = {
			...fields,
			archivedAt: null,
			createdAt: "2026-09-18T12:00:00.000Z",
			id: uuid(),
			version: 1,
		};
		const patch = servicePatch(opened, {
			...fields,
			category: null,
			notes: "Com overloque",
			targetMarginBasisPoints: null,
		});
		expect(servicePatchPayload.parse(patch)).toEqual({
			category: null,
			notes: "Com overloque",
			targetMarginBasisPoints: null,
		});
		const everything = servicePatch(opened, {
			category: "Ajuste",
			costCents: "7000",
			estimatedMinutes: 45,
			name: "Barra italiana",
			notes: "Com overloque",
			outsourced: false,
			priceCents: "12000",
			targetMarginBasisPoints: 2500,
		});
		expect(Object.keys(servicePatchPayload.parse(everything)).sort()).toEqual([
			"category",
			"costCents",
			"estimatedMinutes",
			"name",
			"notes",
			"outsourced",
			"priceCents",
			"targetMarginBasisPoints",
		]);
		expect(targetMarginPayload.parse(targetMarginFields("40"))).toEqual({
			targetMarginBasisPoints: 4000,
		});
	});
});

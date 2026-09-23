import { describe, expect, test } from "bun:test";
import {
	financialMovementCreatePayload,
	financialMovementTransferPayload,
} from "@costura-pro/api/finance/schemas";
import {
	productCreatePayload,
	productPatchPayload,
	productVariantCreatePayload,
	productVariantPatchPayload,
	sheetPayload,
} from "@costura-pro/api/products/schemas";
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
	emptyProductValues,
	emptyProductVariantValues,
	type MaterialVariantReference,
	materialDraft,
	type ProductVariantView,
	type ProductView,
	productFields,
	productPatch,
	productVariantFields,
	productVariantPatch,
	serviceDraft,
	sheetItemOf,
} from "../src/lib/products";
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
	referenceCostCents: null,
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

describe("produto e variante", () => {
	const blue: MaterialVariantReference = {
		archived: false,
		baseUnit: "m",
		code: "OX-AZ",
		displayPrecision: 2,
		id: uuid(),
		materialId: uuid(),
		materialName: "Tecido Oxford",
		name: "Azul",
		referenceCostCents: "2550",
	};
	const sewing = {
		archived: false,
		costCents: "4000",
		id: uuid(),
		name: "Costura",
		outsourced: false,
	};
	const photo = {
		caption: "Frente",
		photoHash: "a".repeat(64),
		thumbnailHash: "b".repeat(64),
	};

	test("a ficha montada pela tela passa pelo schema real", () => {
		const fabricItem = sheetItemOf(
			{
				...materialDraft(blue),
				loss: "10",
				lossKind: "percent",
				quantity: "1,2",
			},
			uuid()
		);
		const service = sheetItemOf(
			{ ...serviceDraft(sewing), count: "2" },
			uuid()
		);
		expect(sheetPayload.parse([fabricItem, service])).toEqual([
			fabricItem,
			service,
		]);
	});

	test("o produto montado pela tela passa pelos schemas de criação e edição", () => {
		const fields = productFields(
			{
				...emptyProductValues,
				category: "Roupa",
				name: "Vestido Midi",
				targetMargin: "30",
			},
			[photo]
		);
		expect(productCreatePayload.parse(fields)).toEqual({
			...fields,
			sheet: [],
		});
		const opened: ProductView = {
			...fields,
			archivedAt: null,
			createdAt: "2026-09-23T12:00:00.000Z",
			id: uuid(),
			sheet: [],
			version: 1,
		};
		expect(
			productPatchPayload.parse(
				productPatch(opened, { ...fields, name: "Vestido Longo", photos: [] })
			)
		).toEqual({ name: "Vestido Longo", photos: [] });
	});

	test("a variante montada pela tela passa pelos schemas de criação e edição", () => {
		const fabricItem = sheetItemOf(
			{ ...materialDraft(blue), quantity: "1,2" },
			uuid()
		);
		const fields = productVariantFields(
			{
				...emptyProductVariantValues,
				code: "VM-P",
				coverPhotoHash: photo.photoHash,
				name: "P Azul",
				price: "170,00",
			},
			[
				{
					item: sheetItemOf(
						{ ...materialDraft(blue), quantity: "1,4" },
						fabricItem.id
					),
					kind: "replace",
				},
			],
			[fabricItem]
		);
		const productId = uuid();
		expect(productVariantCreatePayload.parse({ ...fields, productId })).toEqual(
			{
				...fields,
				productId,
			}
		);
		const opened: ProductVariantView = {
			...fields,
			archivedAt: null,
			createdAt: "2026-09-23T12:00:00.000Z",
			id: uuid(),
			productId,
			version: 1,
		};
		expect(
			productVariantPatchPayload.parse(
				productVariantPatch(opened, {
					...fields,
					code: null,
					coverPhotoHash: null,
					sheetChanges: [],
				})
			)
		).toEqual({ code: null, coverPhotoHash: null, sheetChanges: [] });
	});
});

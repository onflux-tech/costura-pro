import { describe, expect, test } from "bun:test";
import {
	financialMovementCreatePayload,
	financialMovementTransferPayload,
} from "@costura-pro/api/finance/schemas";
import { inventorySessionCreatePayload } from "@costura-pro/api/inventory/schemas";
import { productionFlowUpdatePayload } from "@costura-pro/api/production/schemas";
import {
	productCreatePayload,
	productPatchPayload,
	productVariantCreatePayload,
	productVariantPatchPayload,
	sheetPayload,
} from "@costura-pro/api/products/schemas";
import { purchaseCreatePayload } from "@costura-pro/api/purchases/schemas";
import {
	quoteContentPayload,
	quoteCreatePayload,
	quoteEmitPayload,
	quoteRefusePayload,
} from "@costura-pro/api/quotes/schemas";
import {
	reconciliationCreatePayload,
	reconciliationReversePayload,
} from "@costura-pro/api/reconciliation/schemas";
import {
	productionStartPayload,
	quoteApprovePayload,
} from "@costura-pro/api/service-orders/schemas";
import {
	serviceCreatePayload,
	servicePatchPayload,
	targetMarginPayload,
} from "@costura-pro/api/services/schemas";
import { mergeFlowStages } from "@costura-pro/domain/production";
import {
	accountOpeningFields,
	accountTransferFields,
} from "../src/lib/finance";
import {
	draftPointOf,
	type InventoryPointView,
	inventoryFields,
	reviewOf,
	startDraft,
	withCount,
	withDetails,
} from "../src/lib/inventory";
import type { MeasurementView } from "../src/lib/measurements";
import {
	addStage,
	flowDraftOf,
	flowPayload,
	hideStage,
	productionStartInput,
	renameStage,
	startStageIds,
} from "../src/lib/production";
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
	componentOf,
	contentWithConditions,
	contentWithLines,
	createQuoteFields,
	emissionFields,
	emptyFreeLine,
	emptyPiece,
	freeLineOf,
	materialComponentDraft,
	materialLineDraft,
	materialLineOf,
	pieceLineOf,
	refusalFields,
	serviceComponentDraft,
	serviceCopyOf,
	serviceLineDraft,
	serviceLineOf,
} from "../src/lib/quote-drafts";
import type { QuoteLineView, QuoteRevisionView } from "../src/lib/quotes";
import {
	reconciliationDraftOf,
	reconciliationFields,
	reverseReconciliationFields,
	withSwap,
	withSwapReason,
} from "../src/lib/reconciliation";
import {
	approvalFields,
	approvalIds,
	approvalPreview,
} from "../src/lib/service-orders";
import {
	emptyServiceValues,
	type ServiceView,
	serviceFields,
	servicePatch,
	targetMarginFields,
} from "../src/lib/services";

const uuid = () => crypto.randomUUID();

const cut = "c0000000-0000-4000-8000-000000000001";
const assembly = "c0000000-0000-4000-8000-000000000002";
const fitting = "c0000000-0000-4000-8000-000000000003";
const finishing = "c0000000-0000-4000-8000-000000000004";
const pressing = "c0000000-0000-4000-8000-000000000005";

const uuidPattern = /^[0-9a-f-]{36}$/;

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
			suggestedStageIds: [fitting, finishing],
			targetMargin: "37,5",
		});
		expect(serviceCreatePayload.parse(fields)).toEqual(fields);
		expect(
			serviceCreatePayload.parse(
				serviceFields({
					...emptyServiceValues,
					cost: "60",
					name: "Barra de calça",
					price: "100",
				})
			)
		).toMatchObject({ suggestedStageIds: [] });
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
			suggestedStageIds: [finishing],
			targetMarginBasisPoints: null,
		});
		expect(servicePatchPayload.parse(patch)).toEqual({
			category: null,
			notes: "Com overloque",
			suggestedStageIds: [finishing],
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
			suggestedStageIds: [],
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
			"suggestedStageIds",
			"targetMarginBasisPoints",
		]);
		expect(targetMarginPayload.parse(targetMarginFields("40"))).toEqual({
			targetMarginBasisPoints: 4000,
		});
	});

	test("fluxo editado e início de produção passam nos schemas de produção", () => {
		const saved = [
			{ active: true, id: cut, name: "Corte" },
			{ active: true, id: assembly, name: "Montagem" },
			{ active: true, id: fitting, name: "Prova" },
			{ active: true, id: finishing, name: "Acabamento" },
		];
		const edited = addStage(
			renameStage(hideStage(flowDraftOf(saved), 2, saved), 1, " Costura  "),
			pressing
		);
		const payload = flowPayload(renameStage(edited, 3, "Passadoria "));
		expect(payload).toEqual({
			stages: [
				{ id: cut, name: "Corte" },
				{ id: assembly, name: "Costura" },
				{ id: finishing, name: "Acabamento" },
				{ id: pressing, name: "Passadoria" },
			],
		});
		expect(productionFlowUpdatePayload.parse(payload)).toEqual(payload);
		const flowOfOrder = mergeFlowStages(saved, payload.stages);
		const input = productionStartInput(
			{ id: uuid(), version: 1 },
			startStageIds(flowOfOrder, [pressing, fitting, uuid(), finishing, cut]),
			() => uuid()
		);
		expect(input.stageIds).toEqual([cut, finishing, pressing]);
		expect(productionStartPayload.parse(input)).toEqual({
			stageIds: input.stageIds,
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
		estimatedMinutes: 60,
		id: uuid(),
		name: "Costura",
		outsourced: false,
		version: 1,
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

describe("contagem de inventário", () => {
	test("a contagem montada pela tela passa pelo schema real", () => {
		const location = uuid();
		const view = (
			variantId: string,
			overrides: Partial<InventoryPointView> = {}
		): InventoryPointView => ({
			archived: false,
			baseUnit: "m",
			code: null,
			displayPrecision: 2,
			locationId: location,
			locationName: "Armário 1",
			lotId: null,
			lotLabel: null,
			materialId: uuid(),
			materialName: "Oxford",
			quantityMicros: "10000000",
			referenceCostCents: "2500",
			tracksLots: false,
			valueCents: "25000",
			variantId,
			variantName: "Azul",
			...overrides,
		});
		const surplus = view(uuid());
		const shortage = view(uuid(), { materialName: "Linha" });
		const matched = view(uuid(), { lotId: uuid(), materialName: "Tricoline" });
		const draft = withDetails(
			withCount(
				withCount(
					withCount(
						startDraft({
							locationIds: [location],
							now: new Date(),
							sessionId: uuid(),
							today: "2026-09-23",
						}),
						draftPointOf(surplus),
						"12,5",
						surplus.quantityMicros,
						uuid()
					),
					draftPointOf(shortage),
					"3",
					shortage.quantityMicros,
					uuid()
				),
				draftPointOf(matched),
				"10",
				matched.quantityMicros,
				uuid()
			),
			{ reason: "Inventário anual" }
		);
		const fields = inventoryFields(
			draft,
			reviewOf(draft, [surplus, shortage, matched])
		);
		expect(inventorySessionCreatePayload.parse(fields)).toEqual(fields);
		expect(fields.lines.map((line) => line.valueCents)).toEqual([
			null,
			"6250",
			null,
		]);
	});
});

describe("orçamento", () => {
	const service: ServiceView = {
		archivedAt: null,
		category: null,
		costCents: "6000",
		createdAt: "2026-09-18T12:00:00.000Z",
		estimatedMinutes: 90,
		id: uuid(),
		name: "Ajuste de cava",
		notes: null,
		outsourced: false,
		priceCents: "16000",
		suggestedStageIds: [],
		targetMarginBasisPoints: null,
		version: 3,
	};

	function lines() {
		const copy = serviceCopyOf(service);
		return [
			serviceLineOf(
				{
					...serviceLineDraft(copy),
					discount: {
						kind: "percent",
						reason: " Cliente antigo ",
						value: "10",
					},
					note: " Barra italiana ",
					quantity: "2",
				},
				uuid()
			),
			pieceLineOf(
				{
					...emptyPiece,
					components: [
						componentOf(
							{
								...materialComponentDraft(fabric),
								cost: "38,00",
								quantity: "2,4",
							},
							uuid()
						),
						componentOf(serviceComponentDraft(copy), uuid()),
					],
					description: "Vestido sob medida",
					discount: { kind: "amount", reason: "", value: "80,00" },
					price: "980,00",
				},
				uuid()
			),
			materialLineOf(
				{ ...materialLineDraft(fabric), price: "45,00", quantity: "1,5" },
				uuid()
			),
			freeLineOf(
				{ ...emptyFreeLine, description: "Taxa de urgência", price: "50,00" },
				uuid()
			),
		];
	}

	test("criação, conteúdo, emissão e recusa montados pela tela passam nos schemas reais", () => {
		const clientId = uuid();
		expect(
			quoteCreatePayload.parse(createQuoteFields(clientId, "2026-09-24"))
		).toEqual({
			clientId,
			createdOn: "2026-09-24",
			discount: null,
			leadTimeDays: null,
			lines: [],
			notes: null,
			validityDays: 15,
		});
		const empty = {
			discount: null,
			leadTimeDays: null,
			lines: [],
			notes: null,
			validityDays: 15,
		};
		const content = contentWithConditions(contentWithLines(empty, lines()), {
			discount: { kind: "amount", reason: "Pacote", value: "300,00" },
			leadTime: "20",
			notes: "Prova em 10 dias",
			validity: "15",
		});
		const parsedContent: unknown = quoteContentPayload.parse(content);
		expect(parsedContent).toEqual(content);
		const emission = emissionFields(content, "2026-09-24", " ");
		const quoteId = uuid();
		const parsedEmission: unknown = quoteEmitPayload.parse({
			...emission,
			quoteId,
		});
		expect(parsedEmission).toEqual({ ...emission, quoteId });
		expect(quoteRefusePayload.parse(refusalFields("2026-09-24", " "))).toEqual({
			reason: null,
			refusedOn: "2026-09-24",
		});
	});

	function revisionOf(content: QuoteLineView[]): QuoteRevisionView {
		return {
			content: {
				discount: null,
				leadTimeDays: 20,
				lines: content.map((line) => ({
					...line,
					costCents: null,
					discountCents: "0",
					grossCents: "0",
					totalCents: "0",
				})),
				notes: null,
				validityDays: 15,
			},
			costCents: null,
			createdAt: "2026-09-20T12:00:00.000Z",
			discountCents: "0",
			emittedOn: "2026-09-20",
			grossCents: "0",
			id: uuid(),
			number: 1,
			quoteId: uuid(),
			reason: null,
			targetMarginBasisPoints: 4000,
			totalCents: "0",
			validUntil: "2026-10-05",
			version: 1,
		};
	}

	function approvalOf(
		revision: QuoteRevisionView,
		measurements: MeasurementView[]
	) {
		return approvalFields({
			draft: {
				approvedOn: "2026-09-22",
				channel: "inPerson",
				dueOn: "2026-10-12",
				note: " Aceitou na prova ",
			},
			ids: approvalIds(revision, uuid),
			preview: approvalPreview(revision, measurements, []),
			quoteId: revision.quoteId,
			revisionId: revision.id,
		});
	}

	test("aprovação montada pela tela passa no schema real", () => {
		const { approvalId, ...payload } = approvalOf(revisionOf(lines()), []);
		const parsed: unknown = quoteApprovePayload.parse(payload);
		expect(parsed).toEqual(payload);
		expect(approvalId).toMatch(uuidPattern);
	});

	test("aprovação com as medidas congeladas do perfil passa no schema real", () => {
		const profileId = uuid();
		const measurement: MeasurementView = {
			archivedAt: null,
			createdAt: "2026-09-01T12:00:00.000Z",
			fields: [
				{ fieldId: uuid(), label: "Busto", valueMm: 880 },
				{ fieldId: uuid(), label: "Cintura", valueMm: null },
			],
			id: uuid(),
			notes: "Prova com salto",
			profileId,
			takenOn: "2026-09-01",
			templateId: uuid(),
			templateName: "Vestido",
			templateVersion: 2,
			version: 1,
		};
		const revision = revisionOf(
			lines().map((line) =>
				line.kind === "service" || line.kind === "custom"
					? { ...line, profileId }
					: line
			)
		);
		const { approvalId, ...payload } = approvalOf(revision, [measurement]);
		expect(
			payload.items.filter((item) => item.measurements.length > 0).length
		).toBeGreaterThan(0);
		const parsed: unknown = quoteApprovePayload.parse(payload);
		expect(parsed).toEqual(payload);
		expect(approvalId).toMatch(uuidPattern);
	});
});

describe("reconciliação de materiais", () => {
	const crepe = uuid();
	const lining = uuid();
	const closet = uuid();
	const shelf = uuid();
	const lot = uuid();
	const itemId = uuid();
	const draft = reconciliationDraftOf(
		[
			{
				baseUnit: "m",
				displayPrecision: 2,
				label: "Crepe · Preto",
				plannedMicros: 3_400_000n,
				reservedMicros: 2_500_000n,
				shortageMicros: 900_000n,
				variantId: crepe,
			},
		],
		[
			{
				baseUnit: "m",
				displayPrecision: 2,
				points: [
					{
						locationId: closet,
						locationName: "Armário",
						lotCreatedAt: null,
						lotId: null,
						lotLabel: null,
						quantityMicros: "2500000",
						valueCents: "7500",
					},
				],
				referenceCostCents: "3000",
				tracksLots: false,
				variantId: crepe,
			},
			{
				baseUnit: "m",
				displayPrecision: 2,
				points: [
					{
						locationId: shelf,
						locationName: "Prateleira",
						lotCreatedAt: "2026-09-01T12:00:00.000Z",
						lotId: lot,
						lotLabel: "Rolo 1",
						quantityMicros: "5000000",
						valueCents: "10000",
					},
				],
				referenceCostCents: null,
				tracksLots: true,
				variantId: lining,
			},
		],
		"2026-09-25",
		uuid
	);

	test("reconciliação sem troca passa no schema, com motivo e lote nulos", () => {
		const fields = reconciliationFields(draft, itemId);
		expect(fields.lines[0]).toMatchObject({
			parts: [{ lotId: null }],
			swapReason: null,
		});
		expect(reconciliationCreatePayload.parse(fields)).toEqual(fields);
	});

	test("reconciliação com troca e lote passa no schema", () => {
		const withLot = reconciliationFields(
			withSwapReason(
				withSwap(
					draft,
					0,
					{
						baseUnit: "m",
						displayPrecision: 2,
						id: lining,
						label: "Forro · Bege",
						tracksLots: true,
					},
					[
						{
							baseUnit: "m",
							displayPrecision: 2,
							points: [
								{
									locationId: shelf,
									locationName: "Prateleira",
									lotCreatedAt: "2026-09-01T12:00:00.000Z",
									lotId: lot,
									lotLabel: "Rolo 1",
									quantityMicros: "5000000",
									valueCents: "10000",
								},
							],
							referenceCostCents: null,
							tracksLots: true,
							variantId: lining,
						},
					],
					uuid
				),
				0,
				"Crepe acabou"
			),
			itemId
		);
		expect(withLot.lines[0]).toMatchObject({
			parts: [{ locationId: shelf, lotId: lot, quantityMicros: "3400000" }],
			swapReason: "Crepe acabou",
			variantId: lining,
		});
		expect(reconciliationCreatePayload.parse(withLot)).toEqual(withLot);
	});

	test("estorno da reconciliação passa no schema", () => {
		const fields = reverseReconciliationFields({
			movementIds: [uuid(), uuid()],
			occurredOn: "2026-09-25",
			reason: " Lançado errado ",
			reconciliationId: uuid(),
		});
		expect(reconciliationReversePayload.parse(fields)).toEqual(fields);
	});
});

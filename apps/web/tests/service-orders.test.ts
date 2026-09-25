import { describe, expect, test } from "bun:test";

import type { MeasurementView } from "../src/lib/measurements";
import type {
	FrozenLineView,
	QuoteLineView,
	QuoteRevisionView,
} from "../src/lib/quotes";
import {
	acceptanceHint,
	approvalBlocker,
	approvalChannelLabels,
	approvalDraft,
	approvalErrors,
	approvalFields,
	approvalIds,
	approvalPreview,
	closingSteps,
	costDifferenceText,
	deliverySummary,
	dueLabel,
	estimatedMargin,
	financialSummary,
	itemMaterials,
	listProductionSummary,
	materialCostRows,
	materialCostText,
	materialCostTotalText,
	productionSummary,
	type ReconciliationView,
	receivableLabel,
	reconciledRows,
	type ServiceOrderDetailView,
	type ServiceOrderItemView,
	type ServiceOrderListItemView,
	subitemsLabel,
} from "../src/lib/service-orders";

const id = (n: number) =>
	`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function sequence(start: number): () => string {
	let next = start;
	return () => {
		next += 1;
		return id(next);
	};
}

const maria = id(50);
const crepe = id(81);
const zipper = id(89);
const lining = id(90);

const cut = "c0000000-0000-4000-8000-000000000001";
const assembly = "c0000000-0000-4000-8000-000000000002";
const fitting = "c0000000-0000-4000-8000-000000000003";
const finishing = "c0000000-0000-4000-8000-000000000004";

function frozen(line: QuoteLineView, totalCents = "0"): FrozenLineView {
	return {
		...line,
		costCents: null,
		discountCents: "0",
		grossCents: totalCents,
		totalCents,
	};
}

const service = frozen({
	catalogPriceCents: "16000",
	discount: null,
	estimatedMinutes: 90,
	id: id(1),
	kind: "service",
	note: null,
	outsourced: false,
	profileId: maria,
	quantity: 1,
	receivedItemId: id(60),
	serviceId: id(70),
	serviceName: "Ajuste de cava",
	serviceVersion: 1,
	unitCostCents: "6000",
	unitPriceCents: "16000",
});

const piece = frozen({
	components: [
		{
			baseUnit: "m",
			code: "CRP-PT",
			displayPrecision: 2,
			id: id(11),
			kind: "material",
			materialName: "Crepe",
			materialVariantId: crepe,
			quantityMicros: "3400000",
			unitCostCents: "3000",
			variantName: "Preto",
		},
		{
			baseUnit: "un",
			code: null,
			displayPrecision: 0,
			id: id(12),
			kind: "material",
			materialName: "Zíper",
			materialVariantId: zipper,
			quantityMicros: "1000000",
			unitCostCents: "370",
			variantName: "20 cm",
		},
	],
	description: "Vestido de festa",
	discount: null,
	id: id(2),
	kind: "custom",
	note: null,
	profileId: maria,
	quantity: 1,
	source: null,
	unitPriceCents: "98000",
});

const material = frozen({
	baseUnit: "un",
	code: null,
	discount: null,
	displayPrecision: 0,
	id: id(3),
	kind: "material",
	materialName: "Zíper",
	materialVariantId: zipper,
	note: null,
	quantityMicros: "2000000",
	unitCostCents: "370",
	unitPriceCents: "800",
	variantName: "20 cm",
});

const rush = frozen({
	description: "Taxa de urgência",
	discount: null,
	id: id(4),
	kind: "free",
	note: null,
	quantity: 1,
	unitCostCents: "0",
	unitPriceCents: "5000",
});

const revision: QuoteRevisionView = {
	content: {
		discount: null,
		leadTimeDays: 20,
		lines: [service, piece, material, rush],
		notes: null,
		validityDays: 15,
	},
	costCents: "62350",
	createdAt: "2026-09-20T12:00:00.000Z",
	discountCents: "0",
	emittedOn: "2026-09-20",
	grossCents: "120600",
	id: id(100),
	number: 1,
	quoteId: id(99),
	reason: null,
	targetMarginBasisPoints: 4000,
	totalCents: "120600",
	validUntil: "2026-10-05",
	version: 1,
};

function measurement(
	n: number,
	templateName: string,
	takenOn: string,
	overrides: Partial<MeasurementView> = {}
): MeasurementView {
	return {
		archivedAt: null,
		createdAt: `${takenOn}T12:00:00.000Z`,
		fields: [{ fieldId: id(200 + n), label: "Busto", valueMm: 880 }],
		id: id(300 + n),
		notes: null,
		profileId: maria,
		takenOn,
		templateId: id(400 + n),
		templateName,
		templateVersion: 1,
		version: 1,
		...overrides,
	};
}

const measurements = [
	measurement(1, "Vestido", "2026-09-01"),
	measurement(2, "Blazer e paletó", "2026-09-10"),
	measurement(3, "Vestido", "2026-08-01", { templateId: id(401) }),
];

const stock = [
	{ quantityMicros: "2500000", reservedMicros: "1000000", variantId: crepe },
	{ quantityMicros: "5000000", reservedMicros: "0", variantId: zipper },
];

describe("prévia da aprovação", () => {
	const preview = approvalPreview(revision, measurements, stock);

	test("lista as linhas de trabalho com as medidas atuais e deixa a livre só no valor", () => {
		expect(preview.items.map((item) => [item.kind, item.title])).toEqual([
			["service", "Ajuste de cava"],
			["custom", "Vestido de festa"],
			["material", "Zíper · 20 cm"],
		]);
		expect(preview.freeLines).toEqual(["Taxa de urgência"]);
		expect(
			preview.items.map((item) =>
				item.measurements.map((snapshot) => snapshot.templateName)
			)
		).toEqual([
			["Blazer e paletó", "Vestido"],
			["Blazer e paletó", "Vestido"],
			[],
		]);
		expect(preview.items[0]?.measurements[1]).toEqual({
			fields: [{ fieldId: id(201), label: "Busto", valueMm: 880 }],
			measurementId: id(301),
			notes: null,
			takenOn: "2026-09-01",
			templateId: id(401),
			templateName: "Vestido",
			templateVersion: 1,
		});
		expect(preview.items.map((item) => item.missingMeasurements)).toEqual([
			false,
			false,
			false,
		]);
	});

	test("reserva pelo disponível e mostra a falta, com o total a receber", () => {
		expect(
			preview.items.map((item) =>
				item.reservations.map((reservation) => [
					reservation.label,
					reservation.plannedMicros,
					reservation.reservedMicros,
					reservation.shortageMicros,
				])
			)
		).toEqual([
			[],
			[
				["Crepe · Preto", 3_400_000n, 1_500_000n, 1_900_000n],
				["Zíper · 20 cm", 1_000_000n, 1_000_000n, 0n],
			],
			[["Zíper · 20 cm", 2_000_000n, 2_000_000n, 0n]],
		]);
		expect(preview.shortage).toBe(true);
		expect(preview.receivableCents).toBe(120_600n);
	});

	test("avisa o perfil sem medida e ignora medição arquivada", () => {
		const archived = measurements.map((item) => ({
			...item,
			archivedAt: "2026-09-20T12:00:00.000Z",
		}));
		const lonely = approvalPreview(revision, archived, stock);
		expect(lonely.items.map((item) => item.missingMeasurements)).toEqual([
			true,
			true,
			false,
		]);
		expect(lonely.items[0]?.measurements).toEqual([]);
	});

	test("sem a leitura das medidas não afirma que o perfil está sem medida", () => {
		const unknown = approvalPreview(revision, null, stock);
		expect(unknown.items.map((item) => item.missingMeasurements)).toEqual([
			false,
			false,
			false,
		]);
		expect(unknown.items.map((item) => item.measurements)).toEqual([
			[],
			[],
			[],
		]);
	});
});

describe("leitura das medidas para aprovar", () => {
	test("só libera com as medidas lidas depois de abrir o diálogo", () => {
		expect(approvalBlocker({ failed: false, fresh: false })).toBe(
			"Conferindo as medidas atuais do cliente."
		);
		expect(approvalBlocker({ failed: true, fresh: false })).toBe(
			"Não foi possível ler as medidas atuais do cliente. Tente de novo."
		);
		expect(approvalBlocker({ failed: false, fresh: true })).toBeNull();
	});
});

describe("rascunho e erros da aprovação", () => {
	test("a dica da data diz a janela do aceite, ou o dia único", () => {
		expect(acceptanceHint(revision, "2026-09-24")).toBe(
			"Entre 20/09/2026 e 24/09/2026."
		);
		expect(acceptanceHint(revision, "2026-10-20")).toBe(
			"Entre 20/09/2026 e 05/10/2026."
		);
		expect(acceptanceHint(revision, "2026-09-20")).toBe(
			"Só 20/09/2026, o dia da emissão."
		);
	});

	test("sugere o aceite de hoje limitado à validade e o prazo pela revisão", () => {
		expect(approvalDraft(revision, "2026-09-22")).toEqual({
			approvedOn: "2026-09-22",
			channel: null,
			dueOn: "2026-10-12",
			note: "",
		});
		expect(approvalDraft(revision, "2026-10-20").approvedOn).toBe("2026-10-05");
		expect(
			approvalDraft(
				{ ...revision, content: { ...revision.content, leadTimeDays: null } },
				"2026-09-22"
			).dueOn
		).toBe("");
	});

	test("explica cada campo errado", () => {
		const ok = {
			approvedOn: "2026-09-22",
			channel: "whatsapp" as const,
			dueOn: "2026-10-12",
			note: "",
		};
		expect(approvalErrors(ok, revision, "2026-09-24")).toEqual({});
		expect(
			approvalErrors(
				{ ...ok, approvedOn: "2026-02-30" },
				revision,
				"2026-09-24"
			).approvedOn
		).toBe("Data inválida");
		expect(
			approvalErrors(
				{ ...ok, approvedOn: "2026-09-25" },
				revision,
				"2026-09-24"
			).approvedOn
		).toBe("Use uma data até hoje");
		expect(
			approvalErrors(
				{ ...ok, approvedOn: "2026-09-19" },
				revision,
				"2026-09-24"
			).approvedOn
		).toBe("O aceite não pode ser antes da emissão da revisão");
		expect(
			approvalErrors(
				{ ...ok, approvedOn: "2026-10-06" },
				revision,
				"2026-10-10"
			).approvedOn
		).toBe(
			"A revisão valia até 05/10/2026. Emita uma revisão nova para registrar este aceite."
		);
		expect(
			approvalErrors({ ...ok, channel: null }, revision, "2026-09-24").channel
		).toBe("Escolha o canal");
		expect(
			approvalErrors({ ...ok, note: "a".repeat(201) }, revision, "2026-09-24")
				.note
		).toBe("Use até 200 caracteres");
		expect(
			approvalErrors({ ...ok, dueOn: "2026-09-21" }, revision, "2026-09-24")
				.dueOn
		).toBe("O prazo não pode ser antes do aceite");
		expect(
			approvalErrors({ ...ok, dueOn: "12/10/2026" }, revision, "2026-09-24")
				.dueOn
		).toBe("Data inválida");
		expect(
			approvalErrors({ ...ok, dueOn: " " }, revision, "2026-09-24").dueOn
		).toBeUndefined();
	});
});

describe("ids e payload da aprovação", () => {
	test("sorteia um id por subitem e por reserva prevista", () => {
		const ids = approvalIds(revision, sequence(1000));
		expect([...ids.items.keys()]).toEqual([id(1), id(2), id(3)]);
		expect([...(ids.items.get(id(2))?.reservations.keys() ?? [])]).toEqual([
			crepe,
			zipper,
		]);
		expect(ids.items.get(id(1))?.reservations.size).toBe(0);
		const all = [
			ids.approvalId,
			ids.receivableId,
			ids.serviceOrderId,
			...[...ids.items.values()].flatMap((item) => [
				item.itemId,
				...item.reservations.values(),
			]),
		];
		expect(new Set(all).size).toBe(all.length);
	});

	test("monta o payload com a nota aparada, o prazo vazio como nulo e os subitens na ordem", () => {
		const ids = approvalIds(revision, sequence(1000));
		const preview = approvalPreview(revision, measurements, stock);
		const fields = approvalFields({
			draft: {
				approvedOn: "2026-09-22",
				channel: "phone",
				dueOn: "",
				note: "   ",
			},
			ids,
			preview,
			quoteId: revision.quoteId,
			revisionId: revision.id,
		});
		expect(fields).toMatchObject({
			approvalId: ids.approvalId,
			approvedOn: "2026-09-22",
			channel: "phone",
			dueOn: null,
			note: null,
			quoteId: revision.quoteId,
			receivableId: ids.receivableId,
			revisionId: revision.id,
			serviceOrderId: ids.serviceOrderId,
		});
		expect(fields.items.map((item) => item.lineId)).toEqual([
			id(1),
			id(2),
			id(3),
		]);
		expect(fields.items[1]?.reservations).toEqual([
			{
				reservationId: ids.items.get(id(2))?.reservations.get(crepe) ?? "",
				variantId: crepe,
			},
			{
				reservationId: ids.items.get(id(2))?.reservations.get(zipper) ?? "",
				variantId: zipper,
			},
		]);
		expect(
			approvalFields({
				draft: {
					approvedOn: "2026-09-22",
					channel: "phone",
					dueOn: "2026-10-12",
					note: " Aceitou ",
				},
				ids,
				preview,
				quoteId: revision.quoteId,
				revisionId: revision.id,
			})
		).toMatchObject({ dueOn: "2026-10-12", note: "Aceitou" });
	});

	test("rótulos dos canais", () => {
		expect(approvalChannelLabels).toEqual({
			email: "E-mail",
			inPerson: "Presencial",
			other: "Outro",
			phone: "Telefone",
			whatsapp: "WhatsApp",
		});
	});
});

function detailOf(
	overrides: Partial<ServiceOrderDetailView> = {}
): ServiceOrderDetailView {
	return {
		approval: {
			approvedOn: "2026-09-22",
			channel: "whatsapp",
			createdAt: "2026-09-22T12:00:00.000Z",
			id: id(500),
			note: null,
			quoteId: revision.quoteId,
			revisionId: revision.id,
			serviceOrderId: id(600),
			version: 1,
		},
		client: { anonymized: false, archived: false, id: id(700), name: "Maria" },
		currentFlowVersion: 1,
		items: [service, piece, material].map((line, position) => ({
			createdAt: "2026-09-22T12:00:00.000Z",
			dueOn: "2026-10-12",
			id: id(800 + position),
			kind: line.kind === "free" ? "service" : line.kind,
			line: line as ServiceOrderDetailView["items"][number]["line"],
			lineId: line.id,
			measurements: [],
			position,
			productionStatus: "notStarted",
			reconciled: false,
			reconciliation: null,
			reservations:
				position === 1
					? [
							{ reservedMicros: "1500000", variantId: crepe },
							{ reservedMicros: "1000000", variantId: zipper },
						]
					: [],
			serviceOrderId: id(600),
			stageId: null,
			stageIds: null,
			suggestedStageIds:
				line.kind === "material" ? [] : [cut, assembly, fitting, finishing],
			version: 1,
		})),
		quote: { code: "ORC-2026-PC-0001", id: revision.quoteId },
		receivable: {
			amountCents: "120600",
			clientId: id(700),
			createdAt: "2026-09-22T12:00:00.000Z",
			id: id(900),
			kind: "serviceOrder",
			occurredOn: "2026-09-22",
			serviceOrderId: id(600),
			version: 1,
		},
		revision: {
			costCents: "62350",
			discountCents: "0",
			emittedOn: "2026-09-20",
			grossCents: "120600",
			id: revision.id,
			number: 1,
			targetMarginBasisPoints: 4000,
			totalCents: "120600",
			validUntil: "2026-10-05",
		},
		serviceOrder: {
			clientId: id(700),
			code: "OS-2026-PC-0001",
			createdAt: "2026-09-22T12:00:00.000Z",
			flowStages: [
				{ active: true, id: cut, name: "Corte" },
				{ active: true, id: assembly, name: "Montagem" },
				{ active: true, id: fitting, name: "Prova" },
				{ active: true, id: finishing, name: "Acabamento" },
			],
			flowVersion: 1,
			id: id(600),
			openedOn: "2026-09-22",
			quoteId: revision.quoteId,
			updatedAt: "2026-09-22T12:00:00.000Z",
			version: 1,
		},
		...overrides,
	};
}

describe("estados e valores da OS", () => {
	test("materiais de cada subitem com o reservado e a falta", () => {
		const detail = detailOf();
		expect(
			detail.items.map((item) =>
				itemMaterials(item).map((row) => [
					row.label,
					row.plannedMicros,
					row.reservedMicros,
					row.shortageMicros,
				])
			)
		).toEqual([
			[],
			[
				["Crepe · Preto", 3_400_000n, 1_500_000n, 1_900_000n],
				["Zíper · 20 cm", 1_000_000n, 1_000_000n, 0n],
			],
			[["Zíper · 20 cm", 2_000_000n, 0n, 2_000_000n]],
		]);
	});

	test("resume entrega e financeiro", () => {
		const detail = detailOf();
		expect(deliverySummary(detail.items)).toBe("0 de 3 entregues");
		expect(deliverySummary(detail.items.slice(0, 1))).toBe("0 de 1 entregue");
		expect(deliverySummary([])).toBe("nada a entregar");
		expect(financialSummary(detail.receivable)).toBe("a receber · R$ 1.206,00");
		expect(financialSummary(null)).toBe("sem cobrança");
	});

	test("prazo a combinar, no dia e vencido", () => {
		expect(dueLabel(null, "2026-09-24")).toEqual({
			late: false,
			text: "a combinar",
		});
		expect(dueLabel("2026-10-12", "2026-10-12")).toEqual({
			late: false,
			text: "12/10/2026",
		});
		expect(dueLabel("2026-10-12", "2026-10-13")).toEqual({
			late: true,
			text: "12/10/2026",
		});
	});

	test("margem estimada na aprovação, sem margem com custo incompleto", () => {
		const detail = detailOf();
		expect(estimatedMargin(detail.revision)).toMatchObject({
			belowCost: false,
			marginBasisPoints: 4830,
		});
		expect(estimatedMargin({ ...detail.revision, costCents: null })).toBeNull();
	});
});

describe("textos da lista e do encerramento da OS", () => {
	test("conta os subitens e mostra a cobrança", () => {
		expect(subitemsLabel(0)).toBe("sem subitens");
		expect(subitemsLabel(1)).toBe("1 subitem");
		expect(subitemsLabel(3)).toBe("3 subitens");
		expect(receivableLabel("120600")).toBe("R$ 1.206,00");
		expect(receivableLabel("0")).toBe("sem cobrança");
	});

	test("encerramento pendente, com o que não existe já resolvido", () => {
		expect(closingSteps(detailOf())).toEqual([
			{ label: "Todos os subitens reconciliados", state: "pending" },
			{ label: "Todos entregues ou cancelados", state: "pending" },
			{ label: "Financeiro resolvido", state: "pending" },
		]);
		expect(
			closingSteps({ items: [], receivable: null }).map((step) => step.state)
		).toEqual(["done", "done", "done"]);
	});
});

describe("resumo de produção da OS", () => {
	const today = "2026-10-01";
	const [serviceItem, pieceItem, materialItem] = detailOf().items as [
		ServiceOrderItemView,
		ServiceOrderItemView,
		ServiceOrderItemView,
	];
	const stocked = {
		...pieceItem,
		reservations: [
			{ reservedMicros: "3400000", variantId: crepe },
			{ reservedMicros: "1000000", variantId: zipper },
		],
	};
	const ready = (item: ServiceOrderItemView): ServiceOrderItemView => ({
		...item,
		productionStatus: "ready",
		stageIds: [finishing],
	});
	const cutting = (item: ServiceOrderItemView): ServiceOrderItemView => ({
		...item,
		productionStatus: "inProgress",
		stageId: cut,
		stageIds: [cut, finishing],
	});

	test("não iniciada, em produção e pronta pelos subitens de produção", () => {
		expect(
			productionSummary([serviceItem, stocked, materialItem], today)
		).toEqual({ text: "não iniciada", tone: "default" });
		expect(
			productionSummary([ready(serviceItem), stocked, materialItem], today)
		).toEqual({ text: "em produção", tone: "default" });
		expect(productionSummary([serviceItem, cutting(stocked)], today)).toEqual({
			text: "em produção",
			tone: "default",
		});
		expect(
			productionSummary(
				[ready(serviceItem), ready(stocked), materialItem],
				today
			)
		).toEqual({ text: "pronta", tone: "success" });
	});

	test("só material ou nada fica sem produção", () => {
		expect(productionSummary([materialItem], today)).toEqual({
			text: "sem produção",
			tone: "default",
		});
		expect(productionSummary([], today)).toEqual({
			text: "sem produção",
			tone: "default",
		});
		expect(
			productionSummary([{ ...materialItem, dueOn: "2026-09-01" }], today)
		).toEqual({ text: "sem produção", tone: "default" });
	});

	test("acrescenta os atrasados e o bloqueio com tom de perigo", () => {
		const late = { dueOn: "2026-09-30" };
		expect(
			productionSummary(
				[ready({ ...serviceItem, ...late }), cutting({ ...stocked, ...late })],
				today
			)
		).toEqual({ text: "em produção · 1 atrasado", tone: "danger" });
		expect(
			productionSummary(
				[{ ...serviceItem, ...late }, cutting({ ...stocked, ...late })],
				today
			)
		).toEqual({ text: "em produção · 2 atrasados", tone: "danger" });
		expect(
			productionSummary([serviceItem, pieceItem, materialItem], today)
		).toEqual({ text: "não iniciada · bloqueado", tone: "danger" });
		expect(
			productionSummary(
				[serviceItem, cutting({ ...pieceItem, ...late })],
				today
			)
		).toEqual({ text: "em produção · 1 atrasado · bloqueado", tone: "danger" });
		expect(
			productionSummary(
				[serviceItem, { ...pieceItem, reconciled: true }, materialItem],
				today
			)
		).toEqual({ text: "não iniciada", tone: "default" });
		expect(
			productionSummary(
				[ready({ ...serviceItem, ...late }), ready(pieceItem)],
				today
			)
		).toEqual({ text: "pronta", tone: "success" });
	});
});

describe("resumo de produção na lista de OS", () => {
	const order: ServiceOrderListItemView = {
		clientId: id(700),
		clientName: "Maria",
		code: "OS-2026-PC-0001",
		dueOn: "2026-10-12",
		id: id(600),
		itemCount: 3,
		openedOn: "2026-09-22",
		productionCount: 2,
		readyCount: 0,
		shortage: false,
		startedCount: 0,
		totalCents: "120600",
	};

	test("usa as contagens de produção", () => {
		expect(listProductionSummary(order)).toBe("não iniciada");
		expect(listProductionSummary({ ...order, startedCount: 1 })).toBe(
			"em produção"
		);
		expect(listProductionSummary({ ...order, readyCount: 1 })).toBe(
			"em produção"
		);
		expect(listProductionSummary({ ...order, readyCount: 2 })).toBe("pronta");
		expect(
			listProductionSummary({ ...order, itemCount: 1, productionCount: 0 })
		).toBe("sem produção");
	});
});

function part(
	n: number,
	quantityMicros: string,
	valueCents: string,
	provisional: [string, string] = ["0", "0"]
): ReconciliationView["lines"][number]["parts"][number] {
	return {
		locationId: id(30 + n),
		locationName: `Local ${n}`,
		lotId: null,
		lotLabel: null,
		movementId: id(1000 + n),
		provisionalCents: provisional[1],
		provisionalMicros: provisional[0],
		quantityMicros,
		valueCents,
	};
}

const swapped: ReconciliationView = {
	id: id(950),
	lines: [
		{
			baseUnit: "m",
			consumedMicros: "3000000",
			displayPrecision: 2,
			lostMicros: "200000",
			materialName: "Forro",
			parts: [part(1, "1000000", "2000"), part(2, "2200000", "4400")],
			plannedCostCents: "10200",
			plannedMicros: "3400000",
			plannedVariantId: crepe,
			swapReason: "Crepe acabou",
			variantId: lining,
			variantName: "Bege",
		},
		{
			baseUnit: "un",
			consumedMicros: "2000000",
			displayPrecision: 0,
			lostMicros: "0",
			materialName: "Zíper",
			parts: [part(3, "2000000", "740")],
			plannedCostCents: "370",
			plannedMicros: "1000000",
			plannedVariantId: zipper,
			swapReason: null,
			variantId: zipper,
			variantName: "20 cm",
		},
	],
	note: null,
	occurredOn: "2026-09-25",
};

const withProvisional: ReconciliationView = {
	id: id(951),
	lines: [
		{
			baseUnit: "m",
			consumedMicros: "3400000",
			displayPrecision: 2,
			lostMicros: "0",
			materialName: "Crepe",
			parts: [part(4, "3400000", "10200", ["900000", "2700"])],
			plannedCostCents: null,
			plannedMicros: "3400000",
			plannedVariantId: crepe,
			swapReason: null,
			variantId: crepe,
			variantName: "Preto",
		},
		{
			baseUnit: "un",
			consumedMicros: "1000000",
			displayPrecision: 0,
			lostMicros: "0",
			materialName: "Zíper",
			parts: [part(5, "1000000", "370")],
			plannedCostCents: "370",
			plannedMicros: "1000000",
			plannedVariantId: zipper,
			swapReason: null,
			variantId: zipper,
			variantName: "20 cm",
		},
	],
	note: null,
	occurredOn: "2026-09-25",
};

describe("subitem reconciliado", () => {
	const [serviceItem, pieceItem] = detailOf().items as [
		ServiceOrderItemView,
		ServiceOrderItemView,
	];
	const reconciled: ServiceOrderItemView = {
		...pieceItem,
		productionStatus: "ready",
		reconciled: true,
		reconciliation: swapped,
		stageIds: [finishing],
	};

	test("materiais do reconciliado sem falta, com o reservado", () => {
		expect(
			itemMaterials({ ...pieceItem, reconciled: true }).map((row) => [
				row.label,
				row.reservedMicros,
				row.shortageMicros,
			])
		).toEqual([
			["Crepe · Preto", 1_500_000n, 0n],
			["Zíper · 20 cm", 1_000_000n, 0n],
		]);
	});

	test("linhas com sobra, a mais e troca", () => {
		expect(reconciledRows(reconciled)).toEqual([
			{
				consumed: "3,00 m",
				extra: null,
				label: "Forro · Bege",
				leftover: "0,20 m",
				lost: "0,20 m",
				planned: "3,40 m",
				swap: "Crepe Preto → Forro Bege · Crepe acabou",
			},
			{
				consumed: "2 un",
				extra: "1 un",
				label: "Zíper · 20 cm",
				leftover: "0 un",
				lost: "0 un",
				planned: "1 un",
				swap: null,
			},
		]);
		expect(reconciledRows(pieceItem)).toEqual([]);
	});

	test("custo previsto contra o real por material, com provisório", () => {
		expect(materialCostRows([serviceItem, reconciled])).toEqual({
			plannedTotal: 10_570n,
			realTotal: 7140n,
			rows: [
				{
					label: "Forro · Bege",
					plannedCents: 10_200n,
					provisional: false,
					realCents: 6400n,
				},
				{
					label: "Zíper · 20 cm",
					plannedCents: 370n,
					provisional: false,
					realCents: 740n,
				},
			],
		});
		expect(
			materialCostRows([
				reconciled,
				{ ...pieceItem, reconciled: true, reconciliation: withProvisional },
			])
		).toEqual({
			plannedTotal: null,
			realTotal: 17_710n,
			rows: [
				{
					label: "Forro · Bege",
					plannedCents: 10_200n,
					provisional: false,
					realCents: 6400n,
				},
				{
					label: "Zíper · 20 cm",
					plannedCents: 740n,
					provisional: false,
					realCents: 1110n,
				},
				{
					label: "Crepe · Preto",
					plannedCents: null,
					provisional: true,
					realCents: 10_200n,
				},
			],
		});
		expect(materialCostRows([serviceItem, pieceItem])).toEqual({
			plannedTotal: 0n,
			realTotal: 0n,
			rows: [],
		});
	});

	test("texto do custo por material, total e diferença", () => {
		const costs = materialCostRows([serviceItem, reconciled]);
		expect(costs.rows.map(materialCostText)).toEqual([
			"Forro · Bege: previsto R$ 102,00 · real R$ 64,00",
			"Zíper · 20 cm: previsto R$ 3,70 · real R$ 7,40",
		]);
		expect(materialCostTotalText(costs)).toBe(
			"Total: previsto R$ 105,70 · real R$ 71,40"
		);
		expect(costDifferenceText(costs)).toBe("−R$ 34,30");
		expect(
			costDifferenceText({ plannedTotal: 100n, realTotal: 250n, rows: [] })
		).toBe("+R$ 1,50");
		expect(
			costDifferenceText({ plannedTotal: 250n, realTotal: 250n, rows: [] })
		).toBe("R$ 0,00");
	});

	test("sem custo previsto não calcula a diferença", () => {
		const costs = materialCostRows([
			reconciled,
			{ ...pieceItem, reconciled: true, reconciliation: withProvisional },
		]);
		expect(costs.rows.map(materialCostText).at(-1)).toBe(
			"Crepe · Preto: sem custo previsto · real R$ 102,00"
		);
		expect(materialCostTotalText(costs)).toBe(
			"Total: sem custo previsto · real R$ 177,10"
		);
		expect(costDifferenceText(costs)).toBeNull();
	});
});

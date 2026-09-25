import { describe, expect, test } from "bun:test";

import type {
	MaterialVariantReference,
	ProductDetailView,
	ServiceReference,
	SheetItemView,
	SheetMaterialView,
} from "../src/lib/products";
import type { VariantOptionView } from "../src/lib/purchases";
import {
	componentDraftOf,
	componentErrors,
	componentOf,
	conditionsDraftOf,
	conditionsErrors,
	contentWithConditions,
	contentWithLines,
	copyFromProduct,
	createQuoteFields,
	dayError,
	discountDraftOf,
	discountErrors,
	discountOf,
	documentDiscountFits,
	emissionFields,
	emptyFreeLine,
	emptyPiece,
	freeLineDraftOf,
	freeLineErrors,
	freeLineOf,
	type MaterialComponentDraft,
	materialComponentDraft,
	materialLineDraft,
	materialLineDraftOf,
	materialLineErrors,
	materialLineOf,
	noDiscount,
	parseDiscountPercent,
	pieceCostOf,
	pieceDraftOf,
	pieceErrors,
	pieceLineOf,
	refusalFields,
	type ServiceComponentDraft,
	serviceComponentDraft,
	serviceCopyOf,
	serviceLineDraft,
	serviceLineDraftOf,
	serviceLineErrors,
	serviceLineOf,
	withItem,
	withoutItem,
} from "../src/lib/quote-drafts";
import type {
	CustomLineView,
	FreeLineView,
	MaterialLineView,
	QuoteContentView,
	QuoteLineView,
	ServiceLineView,
} from "../src/lib/quotes";
import type { ServiceView } from "../src/lib/services";

const id = (n: number) =>
	`22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;

const serviceLine: ServiceLineView = {
	catalogPriceCents: "16000",
	discount: { basisPoints: 1250, kind: "percent", reason: "Cliente antigo" },
	estimatedMinutes: 90,
	id: id(1),
	kind: "service",
	note: "Blazer de linho",
	outsourced: false,
	profileId: id(50),
	quantity: 2,
	receivedItemId: id(60),
	serviceId: id(70),
	serviceName: "Ajuste de cava",
	serviceVersion: 3,
	unitCostCents: "6000",
	unitPriceCents: "15000",
};

const materialLine: MaterialLineView = {
	baseUnit: "m",
	code: "CR-VM",
	discount: { amountCents: "500", kind: "amount", reason: null },
	displayPrecision: 2,
	id: id(2),
	kind: "material",
	materialName: "Crepe georgette",
	materialVariantId: id(80),
	note: null,
	quantityMicros: "1250000",
	unitCostCents: null,
	unitPriceCents: "6000",
	variantName: "Verde musgo",
};

const freeLine: FreeLineView = {
	description: "Taxa de urgência",
	discount: null,
	id: id(3),
	kind: "free",
	note: null,
	quantity: 1,
	unitCostCents: "0",
	unitPriceCents: "5000",
};

const lace = {
	baseUnit: "m" as const,
	code: null,
	displayPrecision: 3,
	id: id(11),
	kind: "material" as const,
	materialName: "Renda",
	materialVariantId: id(81),
	quantityMicros: "1234567",
	unitCostCents: "4990",
	variantName: "Off-white",
};

const embroideryComponent = {
	count: 2,
	estimatedMinutes: 600,
	id: id(12),
	kind: "service" as const,
	outsourced: true,
	serviceId: id(71),
	serviceName: "Bordado",
	serviceVersion: 1,
	unitCostCents: "1500",
};

const pieceLine: CustomLineView = {
	components: [lace, embroideryComponent],
	description: "Vestido de festa sob medida",
	discount: null,
	id: id(4),
	kind: "custom",
	note: "Prova em 10 dias",
	profileId: id(50),
	quantity: 1,
	source: {
		productId: id(90),
		productName: "Vestido Midi",
		productVersion: 3,
		variantId: null,
		variantName: null,
	},
	unitPriceCents: "98000",
};

const catalogService: ServiceView = {
	archivedAt: null,
	category: null,
	costCents: "6000",
	createdAt: "2026-09-18T12:00:00.000Z",
	estimatedMinutes: 90,
	id: id(70),
	name: "Ajuste de cava",
	notes: null,
	outsourced: false,
	priceCents: "16000",
	suggestedStageIds: [],
	targetMarginBasisPoints: null,
	version: 3,
};

const crepe: VariantOptionView = {
	baseUnit: "m",
	code: "CR-VM",
	displayPrecision: 2,
	id: id(80),
	materialId: id(180),
	materialName: "Crepe georgette",
	name: "Verde musgo",
	packaging: null,
	referenceCostCents: "3800",
	tracksLots: false,
};

describe("ida e volta dos rascunhos", () => {
	test("cada linha volta igual pelo seu rascunho", () => {
		expect(
			serviceLineOf(serviceLineDraftOf(serviceLine), serviceLine.id)
		).toEqual(serviceLine);
		expect(
			materialLineOf(materialLineDraftOf(materialLine), materialLine.id)
		).toEqual(materialLine);
		expect(freeLineOf(freeLineDraftOf(freeLine), freeLine.id)).toEqual(
			freeLine
		);
		expect(pieceLineOf(pieceDraftOf(pieceLine), pieceLine.id)).toEqual(
			pieceLine
		);
	});

	test("cada componente volta igual pelo seu rascunho", () => {
		const laceDraft: MaterialComponentDraft = {
			cost: "49,90",
			kind: "material",
			material: {
				baseUnit: "m",
				code: null,
				displayPrecision: 3,
				materialName: "Renda",
				materialVariantId: id(81),
				variantName: "Off-white",
			},
			quantity: "1,234567",
		};
		expect(componentDraftOf(lace)).toEqual(laceDraft);
		expect(componentOf(laceDraft, lace.id)).toEqual(lace);
		expect(
			componentOf(componentDraftOf(embroideryComponent), embroideryComponent.id)
		).toEqual(embroideryComponent);
	});

	test("desconto em texto e de volta", () => {
		expect(discountDraftOf(serviceLine.discount)).toEqual({
			kind: "percent",
			reason: "Cliente antigo",
			value: "12,5",
		});
		expect(discountOf(discountDraftOf(serviceLine.discount))).toEqual(
			serviceLine.discount
		);
		expect(discountOf(discountDraftOf(materialLine.discount))).toEqual(
			materialLine.discount
		);
		expect(discountDraftOf(null)).toEqual(noDiscount);
		expect(discountOf(noDiscount)).toBeNull();
		expect(discountOf({ kind: "amount", reason: "  ", value: "16" })).toEqual({
			amountCents: "1600",
			kind: "amount",
			reason: null,
		});
	});
});

describe("rascunhos novos", () => {
	test("serviço parte do preço do catálogo com quantidade 1", () => {
		const draft = serviceLineDraft(serviceCopyOf(catalogService));
		expect(draft).toMatchObject({
			discount: noDiscount,
			note: "",
			price: "160,00",
			profileId: null,
			quantity: "1",
			receivedItemId: null,
		});
		expect(serviceLineOf(draft, id(5))).toEqual({
			catalogPriceCents: "16000",
			discount: null,
			estimatedMinutes: 90,
			id: id(5),
			kind: "service",
			note: null,
			outsourced: false,
			profileId: null,
			quantity: 1,
			receivedItemId: null,
			serviceId: id(70),
			serviceName: "Ajuste de cava",
			serviceVersion: 3,
			unitCostCents: "6000",
			unitPriceCents: "16000",
		});
	});

	test("material parte do custo de referência, vazio quando não há", () => {
		expect(materialLineDraft(crepe)).toMatchObject({
			cost: "38,00",
			price: "",
			quantity: "",
		});
		expect(materialLineDraft({ ...crepe, referenceCostCents: null }).cost).toBe(
			""
		);
		expect(materialComponentDraft(crepe)).toEqual({
			cost: "38,00",
			kind: "material",
			material: {
				baseUnit: "m",
				code: "CR-VM",
				displayPrecision: 2,
				materialName: "Crepe georgette",
				materialVariantId: id(80),
				variantName: "Verde musgo",
			},
			quantity: "",
		});
	});

	test("componente de serviço copia o catálogo com uma vez", () => {
		const draft: ServiceComponentDraft = serviceComponentDraft(
			serviceCopyOf(catalogService)
		);
		expect(componentOf(draft, id(13))).toEqual({
			count: 1,
			estimatedMinutes: 90,
			id: id(13),
			kind: "service",
			outsourced: false,
			serviceId: id(70),
			serviceName: "Ajuste de cava",
			serviceVersion: 3,
			unitCostCents: "6000",
		});
	});

	test("linha livre e peça vazias começam com quantidade 1", () => {
		expect(emptyFreeLine).toEqual({
			cost: "",
			description: "",
			discount: noDiscount,
			note: "",
			price: "",
			quantity: "1",
		});
		expect(emptyPiece).toEqual({
			components: [],
			description: "",
			discount: noDiscount,
			note: "",
			price: "",
			profileId: null,
			quantity: "1",
			source: null,
		});
	});
});

describe("erros dos rascunhos", () => {
	const service = serviceLineDraftOf(serviceLine);
	const amount = (value: string) => ({
		kind: "amount" as const,
		reason: "",
		value,
	});
	const percent = (value: string) => ({
		kind: "percent" as const,
		reason: "",
		value,
	});

	test("preço, quantidade e nota do serviço", () => {
		expect(serviceLineErrors(service)).toEqual({});
		expect(serviceLineErrors({ ...service, price: "" })).toEqual({
			price: "Informe o preço",
		});
		expect(serviceLineErrors({ ...service, price: "12,345" })).toEqual({
			price: "Use valor com até 2 casas",
		});
		for (const quantity of ["0", "10000", "1,5", ""]) {
			expect(serviceLineErrors({ ...service, quantity })).toEqual({
				quantity: "Use de 1 a 9999",
			});
		}
		expect(serviceLineErrors({ ...service, note: "a".repeat(200) })).toEqual(
			{}
		);
		expect(serviceLineErrors({ ...service, note: "a".repeat(201) })).toEqual({
			note: "Use até 200 caracteres",
		});
	});

	test("desconto fixo não passa do valor da linha", () => {
		expect(
			serviceLineErrors({ ...service, discount: amount("300,00") })
		).toEqual({});
		expect(
			serviceLineErrors({ ...service, discount: amount("300,01") })
		).toEqual({ discount: "O desconto passa do valor da linha" });
		expect(
			serviceLineErrors({ ...service, discount: amount("999"), price: "" })
		).toEqual({ price: "Informe o preço" });
		expect(
			serviceLineErrors({
				...service,
				discount: { ...percent("10"), reason: "a".repeat(121) },
			})
		).toEqual({ reason: "Use até 120 caracteres" });
	});

	test("percentual de 0,01 a 100 e valor fixo maior que zero", () => {
		expect(parseDiscountPercent("0,01")).toBe(1);
		expect(parseDiscountPercent("12,5")).toBe(1250);
		expect(parseDiscountPercent("100")).toBe(10_000);
		expect(parseDiscountPercent("10 %")).toBe(1000);
		expect(parseDiscountPercent("0")).toBeNull();
		expect(parseDiscountPercent("100,01")).toBeNull();
		expect(parseDiscountPercent("1,234")).toBeNull();
		expect(discountErrors(percent("0"), 30_000n)).toEqual({
			discount: "Use de 0,01 a 100%",
		});
		expect(discountErrors(percent("100,01"), 30_000n)).toEqual({
			discount: "Use de 0,01 a 100%",
		});
		expect(discountErrors(percent("100"), 30_000n)).toEqual({});
		expect(discountErrors(amount(""), 30_000n)).toEqual({
			discount: "Informe o desconto",
		});
		expect(discountErrors(amount("0"), 30_000n)).toEqual({
			discount: "Use um desconto maior que zero",
		});
		expect(discountErrors(amount("1,234"), 30_000n)).toEqual({
			discount: "Use valor com até 2 casas",
		});
		expect(
			discountErrors({ kind: "none", reason: "a".repeat(121), value: "x" }, 0n)
		).toEqual({});
	});

	test("material aceita até 6 casas e custo vazio", () => {
		const material = materialLineDraftOf(materialLine);
		expect(materialLineErrors(material)).toEqual({});
		for (const quantity of ["0", "1,1234567", ""]) {
			expect(materialLineErrors({ ...material, quantity })).toEqual({
				quantity: "Use quantidade maior que zero, com até 6 casas",
			});
		}
		expect(materialLineErrors({ ...material, quantity: "1,123456" })).toEqual(
			{}
		);
		expect(materialLineErrors({ ...material, cost: "" })).toEqual({});
		expect(materialLineErrors({ ...material, cost: "1,234" })).toEqual({
			cost: "Use valor com até 2 casas",
		});
		expect(
			materialLineErrors({ ...material, discount: amount("75,01") })
		).toEqual({ discount: "O desconto passa do valor da linha" });
	});

	test("linha livre e peça pedem descrição", () => {
		const free = freeLineDraftOf(freeLine);
		expect(freeLineErrors(free)).toEqual({});
		expect(freeLineErrors({ ...free, description: " " })).toEqual({
			description: "Informe a descrição",
		});
		expect(freeLineErrors({ ...free, description: "a".repeat(120) })).toEqual(
			{}
		);
		expect(freeLineErrors({ ...free, description: "a".repeat(121) })).toEqual({
			description: "Use até 120 caracteres",
		});
		expect(freeLineErrors({ ...free, cost: "abc" })).toEqual({
			cost: "Use valor com até 2 casas",
		});
		const piece = pieceDraftOf(pieceLine);
		expect(pieceErrors(piece)).toEqual({});
		expect(
			pieceErrors({ ...piece, description: "", price: "", quantity: "0" })
		).toEqual({
			description: "Informe a descrição",
			price: "Informe o preço",
			quantity: "Use de 1 a 9999",
		});
		expect(
			pieceErrors({
				...piece,
				components: Array.from({ length: 61 }, (_, index) => ({
					...lace,
					id: id(200 + index),
				})),
			})
		).toEqual({ components: "Use até 60 componentes" });
	});

	test("componentes: quantidade, custo e vezes", () => {
		const laceDraft = materialComponentDraft(crepe);
		expect(componentErrors({ ...laceDraft, quantity: "2,4" })).toEqual({});
		expect(componentErrors(laceDraft)).toEqual({
			quantity: "Use quantidade maior que zero, com até 6 casas",
		});
		expect(
			componentErrors({ ...laceDraft, cost: "1,234", quantity: "1" })
		).toEqual({ cost: "Use valor com até 2 casas" });
		const sewing = serviceComponentDraft(serviceCopyOf(catalogService));
		expect(componentErrors(sewing)).toEqual({});
		for (const count of ["0", "100", "1,5"]) {
			expect(componentErrors({ ...sewing, count })).toEqual({
				count: "Use de 1 a 99",
			});
		}
	});
});

describe("condições e conteúdo do orçamento", () => {
	const content: QuoteContentView = {
		discount: { amountCents: "30000", kind: "amount", reason: "Pacote" },
		leadTimeDays: 20,
		lines: [freeLine, pieceLine],
		notes: "Prova em 10 dias",
		validityDays: 15,
	};

	test("condições vão e voltam e têm as faixas certas", () => {
		const draft = conditionsDraftOf(content);
		expect(draft).toEqual({
			discount: { kind: "amount", reason: "Pacote", value: "300,00" },
			leadTime: "20",
			notes: "Prova em 10 dias",
			validity: "15",
		});
		expect(contentWithConditions(content, draft)).toEqual(content);
		expect(conditionsErrors(draft, 30_000n)).toEqual({});
		expect(conditionsErrors(draft, 29_999n)).toEqual({
			discount: "O desconto passa do subtotal",
		});
		expect(
			conditionsErrors({ ...draft, leadTime: "", validity: "0" }, 30_000n)
		).toEqual({ validity: "Use de 1 a 365 dias" });
		expect(
			conditionsErrors({ ...draft, leadTime: "366", validity: "365" }, 30_000n)
		).toEqual({ leadTime: "Use de 1 a 365 dias" });
		expect(
			conditionsErrors({ ...draft, notes: "a".repeat(2001) }, 30_000n)
		).toEqual({ notes: "Use até 2000 caracteres" });
		expect(
			contentWithConditions(content, {
				...draft,
				discount: noDiscount,
				leadTime: " ",
				notes: "  ",
			})
		).toEqual({ ...content, discount: null, leadTimeDays: null, notes: null });
	});

	test("tirar a linha grande deixa o desconto do orçamento maior que o subtotal", () => {
		expect(documentDiscountFits(content)).toBe(true);
		expect(
			documentDiscountFits(
				contentWithLines(content, withoutItem(content.lines, pieceLine.id))
			)
		).toBe(false);
	});

	test("conteúdo montado leva só os campos do conteúdo", () => {
		const quote = {
			...content,
			code: "ORC-2026-PC-0001",
			id: id(99),
			version: 4,
		};
		expect(contentWithLines(quote, [freeLine])).toEqual({
			...content,
			lines: [freeLine],
		});
		expect(emissionFields(quote, "2026-09-24", "   ")).toEqual({
			content,
			emittedOn: "2026-09-24",
			reason: null,
		});
		expect(
			emissionFields(content, "2026-09-24", " Cliente pediu desconto ").reason
		).toBe("Cliente pediu desconto");
		expect(refusalFields("2026-09-24", " Achou caro ")).toEqual({
			reason: "Achou caro",
			refusedOn: "2026-09-24",
		});
		expect(refusalFields("2026-09-24", " ").reason).toBeNull();
		expect(createQuoteFields(id(40), "2026-09-24")).toEqual({
			clientId: id(40),
			createdOn: "2026-09-24",
		});
	});

	test("listas trocam e tiram itens pelo id", () => {
		const changed = { ...freeLine, quantity: 3 };
		expect(withItem([serviceLine, freeLine], changed)).toEqual([
			serviceLine,
			changed,
		]);
		expect(withItem<QuoteLineView>([serviceLine], freeLine)).toEqual([
			serviceLine,
			freeLine,
		]);
		expect(withoutItem([serviceLine, freeLine], serviceLine.id)).toEqual([
			freeLine,
		]);
	});

	test("data da emissão e da recusa", () => {
		expect(dayError("2026-09-24", "2026-09-24")).toBeNull();
		expect(dayError("2024-02-29", "2026-09-24")).toBeNull();
		expect(dayError("2026-02-30", "2026-09-24")).toBe("Data inválida");
		expect(dayError("26-09-24", "2026-09-24")).toBe("Data inválida");
		expect(dayError("2026-09-25", "2026-09-24")).toBe("Use uma data até hoje");
	});
});

describe("peça copiada de um produto", () => {
	const blue: MaterialVariantReference = {
		archived: false,
		baseUnit: "m",
		code: "OX-AZ",
		displayPrecision: 2,
		id: id(101),
		materialId: id(111),
		materialName: "Tecido Oxford",
		name: "Azul",
		referenceCostCents: "2550",
	};
	const red: MaterialVariantReference = {
		...blue,
		code: "OX-VM",
		id: id(102),
		name: "Vermelho",
		referenceCostCents: "2700",
	};
	const thread: MaterialVariantReference = {
		archived: false,
		baseUnit: "m",
		code: null,
		displayPrecision: 0,
		id: id(103),
		materialId: id(113),
		materialName: "Linha",
		name: "Branca",
		referenceCostCents: "2",
	};
	const zipper: MaterialVariantReference = {
		archived: false,
		baseUnit: "un",
		code: null,
		displayPrecision: 0,
		id: id(104),
		materialId: id(114),
		materialName: "Zíper invisível",
		name: "20 cm",
		referenceCostCents: "350",
	};
	const button: MaterialVariantReference = {
		archived: true,
		baseUnit: "un",
		code: null,
		displayPrecision: 0,
		id: id(105),
		materialId: id(115),
		materialName: "Botão",
		name: "Madrepérola",
		referenceCostCents: null,
	};
	const sewing: ServiceReference = {
		archived: false,
		costCents: "4000",
		estimatedMinutes: null,
		id: id(106),
		name: "Costura",
		outsourced: false,
		version: 1,
	};
	const embroidery: ServiceReference = {
		archived: false,
		costCents: "1500",
		estimatedMinutes: 45,
		id: id(107),
		name: "Bordado",
		outsourced: true,
		version: 2,
	};
	const fabricItem: SheetMaterialView = {
		id: id(121),
		kind: "material",
		loss: { basisPoints: 1000, kind: "percent" },
		materialVariantId: blue.id,
		note: "Tecido principal",
		quantityMicros: "1200000",
	};
	const sheet: SheetItemView[] = [
		fabricItem,
		{
			id: id(122),
			kind: "material",
			loss: { kind: "fixed", quantityMicros: "5000000" },
			materialVariantId: thread.id,
			note: null,
			quantityMicros: "50000000",
		},
		{
			id: id(123),
			kind: "material",
			loss: null,
			materialVariantId: zipper.id,
			note: null,
			quantityMicros: "1000000",
		},
		{
			id: id(124),
			kind: "material",
			loss: null,
			materialVariantId: button.id,
			note: null,
			quantityMicros: "4000000",
		},
		{
			count: 1,
			id: id(125),
			kind: "service",
			note: null,
			serviceId: sewing.id,
		},
		{
			count: 2,
			id: id(126),
			kind: "service",
			note: "Gola",
			serviceId: embroidery.id,
		},
	];
	const detail: ProductDetailView = {
		product: {
			archivedAt: null,
			category: "Roupa",
			createdAt: "2026-09-23T12:00:00.000Z",
			id: id(130),
			name: "Vestido Midi",
			notes: null,
			photos: [],
			sheet,
			targetMarginBasisPoints: null,
			version: 3,
		},
		references: {
			materialVariants: [blue, red, thread, zipper, button],
			services: [sewing, embroidery],
		},
		variants: [
			{
				archivedAt: null,
				code: "VM-M",
				coverPhotoHash: null,
				createdAt: "2026-09-23T12:00:00.000Z",
				id: id(131),
				name: "M Vermelho",
				priceCents: "21000",
				productId: id(130),
				sheetChanges: [
					{
						item: {
							...fabricItem,
							materialVariantId: red.id,
							quantityMicros: "1400000",
						},
						kind: "replace",
					},
				],
				version: 2,
			},
		],
	};

	function sequence() {
		let count = 0;
		return () => {
			count += 1;
			return id(500 + count);
		};
	}

	test("a ficha base vira componentes com a quantidade planejada e o custo de referência", () => {
		const copy = copyFromProduct(detail, null, sequence());
		expect(copy.priceCents).toBeNull();
		expect(copy.skipped).toBe(0);
		expect(copy.source).toEqual({
			productId: id(130),
			productName: "Vestido Midi",
			productVersion: 3,
			variantId: null,
			variantName: null,
		});
		expect(copy.components).toEqual([
			{
				baseUnit: "m",
				code: "OX-AZ",
				displayPrecision: 2,
				id: id(501),
				kind: "material",
				materialName: "Tecido Oxford",
				materialVariantId: blue.id,
				quantityMicros: "1320000",
				unitCostCents: "2550",
				variantName: "Azul",
			},
			{
				baseUnit: "m",
				code: null,
				displayPrecision: 0,
				id: id(502),
				kind: "material",
				materialName: "Linha",
				materialVariantId: thread.id,
				quantityMicros: "55000000",
				unitCostCents: "2",
				variantName: "Branca",
			},
			{
				baseUnit: "un",
				code: null,
				displayPrecision: 0,
				id: id(503),
				kind: "material",
				materialName: "Zíper invisível",
				materialVariantId: zipper.id,
				quantityMicros: "1000000",
				unitCostCents: "350",
				variantName: "20 cm",
			},
			{
				baseUnit: "un",
				code: null,
				displayPrecision: 0,
				id: id(504),
				kind: "material",
				materialName: "Botão",
				materialVariantId: button.id,
				quantityMicros: "4000000",
				unitCostCents: null,
				variantName: "Madrepérola",
			},
			{
				count: 1,
				estimatedMinutes: null,
				id: id(505),
				kind: "service",
				outsourced: false,
				serviceId: sewing.id,
				serviceName: "Costura",
				serviceVersion: 1,
				unitCostCents: "4000",
			},
			{
				count: 2,
				estimatedMinutes: 45,
				id: id(506),
				kind: "service",
				outsourced: true,
				serviceId: embroidery.id,
				serviceName: "Bordado",
				serviceVersion: 2,
				unitCostCents: "1500",
			},
		]);
		expect(pieceCostOf(copy.components)).toBeNull();
		expect(
			pieceCostOf(
				copy.components.filter((component) => component.id !== id(504))
			)
		).toBe(10_826n);
		expect(pieceCostOf([])).toBeNull();
	});

	test("a variante troca o tecido e traz o próprio preço", () => {
		const copy = copyFromProduct(detail, id(131), sequence());
		expect(copy.priceCents).toBe("21000");
		expect(copy.source).toMatchObject({
			variantId: id(131),
			variantName: "M Vermelho",
		});
		expect(copy.components[0]).toMatchObject({
			code: "OX-VM",
			materialVariantId: red.id,
			quantityMicros: "1540000",
			unitCostCents: "2700",
			variantName: "Vermelho",
		});
		expect(copy.components).toHaveLength(6);
	});

	test("item sem referência fica fora e é contado", () => {
		const copy = copyFromProduct(
			{ ...detail, references: { ...detail.references, services: [sewing] } },
			null,
			sequence()
		);
		expect(copy.skipped).toBe(1);
		expect(
			copy.components.map((component) =>
				component.kind === "material"
					? component.materialName
					: component.serviceName
			)
		).toEqual([
			"Tecido Oxford",
			"Linha",
			"Zíper invisível",
			"Botão",
			"Costura",
		]);
	});
});

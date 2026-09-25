import { describe, expect, test } from "bun:test";

import {
	baseEstimate,
	changesFull,
	coverOf,
	displayPhotoOf,
	draftOf,
	emptyProductValues,
	emptyProductVariantValues,
	itemTitle,
	liveChanges,
	lossLabel,
	type MaterialVariantReference,
	materialDraft,
	materialReferenceOf,
	type ProductFormValues,
	type ProductReferences,
	type ProductVariantFormValues,
	type ProductVariantView,
	type ProductView,
	priceRangeLabel,
	productFields,
	productFormErrors,
	productFormValues,
	productPatch,
	productVariantFields,
	productVariantFormErrors,
	productVariantFormValues,
	productVariantPatch,
	quantityLabel,
	type ServiceReference,
	type SheetChangeView,
	type SheetItemView,
	type SheetMaterialView,
	serviceDraft,
	serviceReferenceOf,
	sheetItemErrors,
	sheetItemOf,
	upsertItem,
	variantEstimate,
	variantPricing,
	variantSheetRows,
	withAdded,
	withMaterial,
	withoutChange,
	withoutItem,
	withRemoval,
	withReplacement,
	withService,
} from "../src/lib/products";

const id = (suffix: number) =>
	`11111111-1111-4111-8111-${String(suffix).padStart(12, "0")}`;

const blue: MaterialVariantReference = {
	archived: false,
	baseUnit: "m",
	code: "OX-AZ",
	displayPrecision: 2,
	id: id(1),
	materialId: id(101),
	materialName: "Tecido Oxford",
	name: "Azul",
	referenceCostCents: "2550",
};

const red: MaterialVariantReference = {
	...blue,
	code: "OX-VM",
	id: id(2),
	name: "Vermelho",
	referenceCostCents: "2700",
};

const thread: MaterialVariantReference = {
	archived: false,
	baseUnit: "m",
	code: null,
	displayPrecision: 0,
	id: id(3),
	materialId: id(103),
	materialName: "Linha",
	name: "Branca",
	referenceCostCents: "2",
};

const zipper: MaterialVariantReference = {
	archived: false,
	baseUnit: "un",
	code: null,
	displayPrecision: 0,
	id: id(4),
	materialId: id(104),
	materialName: "Zíper invisível",
	name: "20 cm",
	referenceCostCents: "350",
};

const button: MaterialVariantReference = {
	archived: true,
	baseUnit: "un",
	code: null,
	displayPrecision: 0,
	id: id(5),
	materialId: id(105),
	materialName: "Botão",
	name: "Madrepérola",
	referenceCostCents: null,
};

const sewing: ServiceReference = {
	archived: false,
	costCents: "4000",
	estimatedMinutes: null,
	id: id(6),
	name: "Costura",
	outsourced: false,
	version: 1,
};

const embroidery: ServiceReference = {
	archived: false,
	costCents: "1500",
	estimatedMinutes: null,
	id: id(7),
	name: "Bordado",
	outsourced: true,
	version: 1,
};

const references: ProductReferences = {
	materialVariants: [blue, red, thread, zipper, button],
	services: [sewing, embroidery],
};

const fabricItem: SheetMaterialView = {
	id: id(11),
	kind: "material",
	loss: { basisPoints: 1000, kind: "percent" },
	materialVariantId: blue.id,
	note: "Tecido principal",
	quantityMicros: "1200000",
};

const threadItem: SheetMaterialView = {
	id: id(12),
	kind: "material",
	loss: { kind: "fixed", quantityMicros: "5000000" },
	materialVariantId: thread.id,
	note: null,
	quantityMicros: "50000000",
};

const zipperItem: SheetMaterialView = {
	id: id(13),
	kind: "material",
	loss: null,
	materialVariantId: zipper.id,
	note: null,
	quantityMicros: "1000000",
};

const sewingItem: SheetItemView = {
	count: 1,
	id: id(14),
	kind: "service",
	note: null,
	serviceId: sewing.id,
};

const embroideryItem: SheetItemView = {
	count: 2,
	id: id(15),
	kind: "service",
	note: "Gola",
	serviceId: embroidery.id,
};

const buttonItem: SheetMaterialView = {
	id: id(16),
	kind: "material",
	loss: null,
	materialVariantId: button.id,
	note: null,
	quantityMicros: "4000000",
};

const sheet: SheetItemView[] = [
	fabricItem,
	threadItem,
	zipperItem,
	sewingItem,
	embroideryItem,
];

const redFabric: SheetMaterialView = {
	...fabricItem,
	materialVariantId: red.id,
	quantityMicros: "1400000",
};

const photoA = {
	caption: "Frente",
	photoHash: "a".repeat(64),
	thumbnailHash: "b".repeat(64),
};
const photoC = {
	caption: null,
	photoHash: "c".repeat(64),
	thumbnailHash: "d".repeat(64),
};

const product: ProductView = {
	archivedAt: null,
	category: "Roupa",
	createdAt: "2026-09-23T12:00:00.000Z",
	id: id(21),
	name: "Vestido Midi",
	notes: null,
	photos: [photoA, photoC],
	sheet,
	targetMarginBasisPoints: null,
	version: 3,
};

const variant: ProductVariantView = {
	archivedAt: null,
	code: "VM-P",
	coverPhotoHash: photoC.photoHash,
	createdAt: "2026-09-23T12:00:00.000Z",
	id: id(31),
	name: "P Azul",
	priceCents: "17000",
	productId: product.id,
	sheetChanges: [],
	version: 2,
};

describe("custo da ficha na tela", () => {
	test("a base soma cada linha pela função do domínio", () => {
		const estimate = baseEstimate(sheet, references);
		expect(estimate.status).toBe("complete");
		expect(estimate.totalCents).toBe(10_826n);
		expect(estimate.lines.map((line) => line.cost)).toEqual([
			3366n,
			110n,
			350n,
			4000n,
			3000n,
		]);
		expect(estimate.missing).toEqual([]);
	});

	test("a variante troca o tecido ou tira o bordado", () => {
		expect(
			variantEstimate(sheet, [{ item: redFabric, kind: "replace" }], references)
				.totalCents
		).toBe(11_618n);
		expect(
			variantEstimate(
				sheet,
				[{ itemId: embroideryItem.id, kind: "remove" }],
				references
			).totalCents
		).toBe(7826n);
	});

	test("material sem custo de referência deixa o custo incompleto e sem sugestão", () => {
		const estimate = baseEstimate([...sheet, buttonItem], references);
		expect(estimate.status).toBe("incomplete");
		expect(estimate.totalCents).toBe(10_826n);
		expect(estimate.missing.map((line) => line.item)).toEqual([buttonItem]);
		expect(variantPricing(product, estimate, "17000", 4000)).toBeNull();
	});

	test("ficha vazia não tem custo, sugestão nem margem", () => {
		const empty = baseEstimate([], references);
		expect(empty).toEqual({
			lines: [],
			missing: [],
			status: "empty",
			totalCents: 0n,
		});
		expect(variantPricing(product, empty, "17000", 4000)).toBeNull();
		expect(
			variantEstimate(
				[sewingItem],
				[{ itemId: sewingItem.id, kind: "remove" }],
				references
			).status
		).toBe("empty");
		expect(
			variantEstimate([], [{ item: sewingItem, kind: "add" }], references)
				.status
		).toBe("complete");
	});

	test("preço, meta própria do produto e preço zero", () => {
		const estimate = baseEstimate(sheet, references);
		expect(variantPricing(product, estimate, "17000", 4000)).toEqual({
			ownTarget: false,
			pricing: {
				belowCost: false,
				belowTarget: true,
				marginBasisPoints: 3631,
				suggestedCents: 18_044n,
			},
			suggestedCents: 18_044n,
			targetMarginBasisPoints: 4000,
		});
		expect(
			variantPricing(
				{ ...product, targetMarginBasisPoints: 3000 },
				estimate,
				"17000",
				4000
			)
		).toMatchObject({
			ownTarget: true,
			suggestedCents: 15_466n,
			targetMarginBasisPoints: 3000,
		});
		expect(variantPricing(product, estimate, "0", 4000)?.pricing).toMatchObject(
			{
				belowTarget: true,
				marginBasisPoints: null,
			}
		);
	});
});

describe("rótulos da ficha", () => {
	test("quantidade planejada e perda na unidade da variante", () => {
		expect(quantityLabel(fabricItem, blue)).toBe("1,32 m");
		expect(lossLabel(fabricItem, blue)).toBe("1,20 m mais 10% de perda");
		expect(quantityLabel(threadItem, thread)).toBe("55 m");
		expect(lossLabel(threadItem, thread)).toBe("50 m mais 5 m de perda");
		const halfZipper = { ...zipperItem, quantityMicros: "1500000" };
		expect(quantityLabel(halfZipper, zipper)).toBe("1,5 un");
		expect(lossLabel(halfZipper, zipper)).toBeNull();
		expect(quantityLabel(fabricItem, undefined)).toBe("1,32");
	});

	test("título do item pelas referências", () => {
		expect(itemTitle(fabricItem, references)).toBe("Tecido Oxford · Azul");
		expect(itemTitle(embroideryItem, references)).toBe("Bordado × 2");
		expect(itemTitle(sewingItem, references)).toBe("Costura");
		expect(
			itemTitle({ ...fabricItem, materialVariantId: id(99) }, references)
		).toBe("Material não encontrado");
		expect(itemTitle({ ...sewingItem, serviceId: id(98) }, references)).toBe(
			"Serviço não encontrado"
		);
	});

	test("faixa de preço da lista", () => {
		expect(priceRangeLabel(null, null)).toBe("Sem variante");
		expect(priceRangeLabel("17000", "17000")).toBe("R$ 170,00");
		expect(priceRangeLabel("17000", "19990")).toBe("R$ 170,00 a R$ 199,90");
	});

	test("capa da galeria e imagem principal", () => {
		expect(coverOf(product.photos, photoC.photoHash)).toEqual(photoC);
		expect(coverOf(product.photos, "e".repeat(64))).toBeNull();
		expect(coverOf(product.photos, null)).toBeNull();
		expect(displayPhotoOf(product.photos, "e".repeat(64))).toEqual(photoA);
		expect(displayPhotoOf([], null)).toBeNull();
	});
});

describe("item da ficha", () => {
	test("quantidade, perda, serviço e observação validados", () => {
		const draft = materialDraft(blue);
		for (const quantity of ["0", "1,1234567", "abc", ""]) {
			expect(sheetItemErrors({ ...draft, quantity }).quantity).toBe(
				"Use quantidade maior que zero, com até 6 casas"
			);
		}
		expect(
			sheetItemErrors({ ...materialDraft(zipper), quantity: "1,5" })
		).toEqual({});
		for (const loss of ["0", "100", "abc"]) {
			expect(
				sheetItemErrors({ ...draft, loss, lossKind: "percent", quantity: "1" })
					.loss
			).toBe("Use de 0,01 a 99,99%");
		}
		for (const loss of ["0,01", "99,99"]) {
			expect(
				sheetItemErrors({ ...draft, loss, lossKind: "percent", quantity: "1" })
			).toEqual({});
		}
		expect(
			sheetItemErrors({ ...draft, loss: "0", lossKind: "fixed", quantity: "1" })
				.loss
		).toBe("Use quantidade maior que zero, com até 6 casas");
		for (const count of ["0", "100", "1,5", ""]) {
			expect(sheetItemErrors({ ...serviceDraft(sewing), count }).count).toBe(
				"Use de 1 a 99"
			);
		}
		expect(
			sheetItemErrors({ ...draft, note: "x".repeat(61), quantity: "1" }).note
		).toBe("Use até 60 caracteres");
	});

	test("rascunho vira item e volta", () => {
		const materialItem = sheetItemOf(
			{
				...materialDraft(thread),
				loss: "5",
				lossKind: "fixed",
				note: "  Pesponto ",
				quantity: "50",
			},
			id(41)
		);
		expect(materialItem).toEqual({
			id: id(41),
			kind: "material",
			loss: { kind: "fixed", quantityMicros: "5000000" },
			materialVariantId: thread.id,
			note: "Pesponto",
			quantityMicros: "50000000",
		});
		expect(draftOf(materialItem, references)).toEqual({
			kind: "material",
			loss: "5",
			lossKind: "fixed",
			note: "Pesponto",
			quantity: "50",
			variant: thread,
		});
		const serviceItem = sheetItemOf(
			{ ...serviceDraft(embroidery), count: "2" },
			id(42)
		);
		expect(serviceItem).toEqual({
			count: 2,
			id: id(42),
			kind: "service",
			note: null,
			serviceId: embroidery.id,
		});
		expect(draftOf(serviceItem, references)).toEqual({
			count: "2",
			kind: "service",
			note: "",
			service: embroidery,
		});
		expect(draftOf(fabricItem, references)).toMatchObject({
			loss: "10",
			lossKind: "percent",
			quantity: "1,20",
		});
		expect(
			draftOf({ ...fabricItem, materialVariantId: id(99) }, references)
		).toBeNull();
	});

	test("edição da base troca no lugar, acrescenta no fim e tira", () => {
		const edited = { ...zipperItem, quantityMicros: "2000000" };
		expect(upsertItem(sheet, edited).map((item) => item.id)).toEqual(
			sheet.map((item) => item.id)
		);
		expect(upsertItem(sheet, edited)[2]).toEqual(edited);
		expect(upsertItem(sheet, buttonItem).at(-1)).toEqual(buttonItem);
		expect(withoutItem(sheet, zipperItem.id)).toHaveLength(4);
	});

	test("referências novas entram sem repetir", () => {
		const option = {
			baseUnit: "m" as const,
			code: "OX-VD",
			displayPrecision: 2,
			id: id(8),
			materialId: id(101),
			materialName: "Tecido Oxford",
			name: "Verde",
			packaging: null,
			referenceCostCents: "2600",
			tracksLots: false,
		};
		const withGreen = withMaterial(references, materialReferenceOf(option));
		expect(withGreen.materialVariants.at(-1)).toEqual({
			archived: false,
			baseUnit: "m",
			code: "OX-VD",
			displayPrecision: 2,
			id: id(8),
			materialId: id(101),
			materialName: "Tecido Oxford",
			name: "Verde",
			referenceCostCents: "2600",
		});
		expect(
			withMaterial(withGreen, materialReferenceOf(option)).materialVariants
		).toHaveLength(6);
		const reference = serviceReferenceOf({
			archivedAt: null,
			category: null,
			costCents: "900",
			createdAt: "2026-09-23T12:00:00.000Z",
			estimatedMinutes: null,
			id: id(9),
			name: "Aplicação",
			notes: null,
			outsourced: false,
			priceCents: "2000",
			suggestedStageIds: [],
			targetMarginBasisPoints: null,
			version: 1,
		});
		expect(withService(references, reference).services.at(-1)).toEqual({
			archived: false,
			costCents: "900",
			estimatedMinutes: null,
			id: id(9),
			name: "Aplicação",
			outsourced: false,
			version: 1,
		});
	});
});

describe("ajustes da variante", () => {
	const letters = [fabricItem, threadItem, zipperItem];

	test("linhas mostram base, trocado, tirado e acrescentado", () => {
		const changes: SheetChangeView[] = [
			{ item: redFabric, kind: "replace" },
			{ itemId: zipperItem.id, kind: "remove" },
			{ item: sewingItem, kind: "add" },
		];
		expect(variantSheetRows(letters, changes)).toEqual([
			{ item: redFabric, original: fabricItem, state: "replaced" },
			{ item: threadItem, state: "base" },
			{ item: zipperItem, state: "removed" },
			{ item: sewingItem, state: "added" },
		]);
	});

	test("cada item tem no máximo um ajuste, e desfazer volta à base", () => {
		const removed = withRemoval([], fabricItem.id);
		const replaced = withReplacement(removed, redFabric);
		expect(replaced).toEqual([{ item: redFabric, kind: "replace" }]);
		expect(withoutChange(replaced, fabricItem.id)).toEqual([]);
		const added = withAdded([], sewingItem);
		const edited = withAdded(added, { ...sewingItem, count: 3 });
		expect(edited).toEqual([
			{ item: { ...sewingItem, count: 3 }, kind: "add" },
		]);
		expect(withoutChange(edited, sewingItem.id)).toEqual([]);
	});

	test("ajuste de item que saiu da base é descartado", () => {
		const orphan: SheetChangeView = { itemId: id(90), kind: "remove" };
		const kept: SheetChangeView = { item: sewingItem, kind: "add" };
		expect(liveChanges(letters, [orphan, kept])).toEqual([kept]);
	});

	test("o teto de 60 ajustes conta só os que ainda valem", () => {
		const added = Array.from(
			{ length: 59 },
			(_, index): SheetChangeView => ({
				item: { ...sewingItem, id: id(200 + index) },
				kind: "add",
			})
		);
		const orphan: SheetChangeView = { itemId: id(90), kind: "remove" };
		expect(changesFull(letters, [...added, orphan])).toBe(false);
		expect(
			changesFull(letters, [
				...added,
				{ itemId: fabricItem.id, kind: "remove" },
			])
		).toBe(true);
	});
});

describe("formulário do produto", () => {
	test("lê o produto e grava de volta os mesmos campos", () => {
		const values = productFormValues({
			...product,
			targetMarginBasisPoints: 3750,
		});
		expect(values).toEqual({
			category: "Roupa",
			name: "Vestido Midi",
			notes: "",
			targetMargin: "37,5",
		});
		expect(productFields(values, product.photos)).toEqual({
			category: "Roupa",
			name: "Vestido Midi",
			notes: null,
			photos: [photoA, photoC],
			targetMarginBasisPoints: 3750,
		});
	});

	test("recusa nome vazio ou longo e meta fora da faixa", () => {
		expect(productFormErrors(emptyProductValues).name).toBe(
			"Informe o nome do produto"
		);
		expect(
			productFormErrors({ ...emptyProductValues, name: "x".repeat(121) }).name
		).toBe("Use até 120 caracteres");
		expect(
			productFormErrors({
				...emptyProductValues,
				name: "Vestido",
				targetMargin: "100",
			}).targetMargin
		).toBe("Use de 0 a 99,99%");
	});

	test("o patch leva só o que mudou, com a galeria reordenada como mudança", () => {
		const fields = productFields(productFormValues(product), product.photos);
		expect(productPatch(product, fields)).toBeNull();
		expect(productPatch(product, { ...fields, name: "Vestido Longo" })).toEqual(
			{
				name: "Vestido Longo",
			}
		);
		expect(
			productPatch(product, { ...fields, photos: [photoC, photoA] })
		).toEqual({ photos: [photoC, photoA] });
	});

	test("o patch leva categoria, notas e meta, e limpa cada uma com null", () => {
		const opened: ProductView = {
			...product,
			notes: "Midi com zíper",
			targetMarginBasisPoints: 3000,
		};
		const values = productFormValues(opened);
		const patchOf = (next: Partial<ProductFormValues>) =>
			productPatch(
				opened,
				productFields({ ...values, ...next }, opened.photos)
			);
		expect(patchOf({ category: "Kit" })).toEqual({ category: "Kit" });
		expect(patchOf({ category: "" })).toEqual({ category: null });
		expect(patchOf({ notes: "Com forro" })).toEqual({ notes: "Com forro" });
		expect(patchOf({ notes: " " })).toEqual({ notes: null });
		expect(patchOf({ targetMargin: "45" })).toEqual({
			targetMarginBasisPoints: 4500,
		});
		expect(patchOf({ targetMargin: "" })).toEqual({
			targetMarginBasisPoints: null,
		});
	});
});

describe("formulário da variante", () => {
	test("recusa nome vazio, código longo e preço inválido", () => {
		expect(productVariantFormErrors(emptyProductVariantValues)).toEqual({
			name: "Informe o nome da variante",
			price: "Informe o preço praticado",
		});
		expect(
			productVariantFormErrors({
				...emptyProductVariantValues,
				code: "x".repeat(41),
				name: "P",
				price: "12,345",
			})
		).toEqual({
			code: "Use até 40 caracteres",
			price: "Use valor com até 2 casas",
		});
	});

	test("o patch limpa a capa e descarta o ajuste órfão", () => {
		const orphan: SheetChangeView = { itemId: id(90), kind: "remove" };
		const opened = { ...variant, sheetChanges: [orphan] };
		const values = productVariantFormValues(opened);
		expect(values).toEqual({
			code: "VM-P",
			coverPhotoHash: photoC.photoHash,
			name: "P Azul",
			price: "170,00",
		});
		const fields = productVariantFields(
			{ ...values, coverPhotoHash: null },
			opened.sheetChanges,
			sheet
		);
		expect(productVariantPatch(opened, fields)).toEqual({
			coverPhotoHash: null,
			sheetChanges: [],
		});
		expect(
			productVariantPatch(
				variant,
				productVariantFields(productVariantFormValues(variant), [], sheet)
			)
		).toBeNull();
	});

	test("o patch leva nome, código, preço e capa que mudaram", () => {
		const values = productVariantFormValues(variant);
		const patchOf = (next: Partial<ProductVariantFormValues>) =>
			productVariantPatch(
				variant,
				productVariantFields({ ...values, ...next }, [], sheet)
			);
		expect(patchOf({ name: "P Azul marinho" })).toEqual({
			name: "P Azul marinho",
		});
		expect(patchOf({ code: "VM-P-AZ" })).toEqual({ code: "VM-P-AZ" });
		expect(patchOf({ code: "" })).toEqual({ code: null });
		expect(patchOf({ price: "189,90" })).toEqual({ priceCents: "18990" });
		expect(patchOf({ price: "170" })).toBeNull();
		expect(patchOf({ coverPhotoHash: photoA.photoHash })).toEqual({
			coverPhotoHash: photoA.photoHash,
		});
	});
});

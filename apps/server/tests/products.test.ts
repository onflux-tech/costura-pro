import { afterEach, describe, expect, test } from "bun:test";

import {
	completeWizard,
	inSequence,
	manualClock,
	newOpId,
	rpc,
	type ServerOptions,
	startTestServer,
	type TestServer,
	times,
} from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

type Owner = ReturnType<typeof rpc>;

async function ownerSetup(options: ServerOptions = {}) {
	const server = await startTestServer(options);
	servers.push(server);
	const { cookie } = await completeWizard(server);
	return { owner: rpc(server, { cookie }), server };
}

const hash = (seed: string) => seed.repeat(64).slice(0, 64);

type Catalog = {
	blue: string;
	button: string;
	buttonMaterial: string;
	embroidery: string;
	fabric: string;
	red: string;
	sewing: string;
};

async function catalogSetup(owner: Owner): Promise<Catalog> {
	const fabric = crypto.randomUUID();
	await owner.materials.create({
		category: "Tecido",
		materialId: fabric,
		name: "Tecido Oxford",
		opId: newOpId(),
	});
	const blue = crypto.randomUUID();
	await owner.materialVariants.create({
		baseUnit: "m",
		code: "OX-AZ",
		displayPrecision: 2,
		materialId: fabric,
		name: "Azul",
		opId: newOpId(),
		referenceCostCents: "2550",
		variantId: blue,
	});
	const red = crypto.randomUUID();
	await owner.materialVariants.create({
		baseUnit: "m",
		displayPrecision: 2,
		materialId: fabric,
		name: "Vermelho",
		opId: newOpId(),
		referenceCostCents: "2700",
		variantId: red,
	});
	const buttonMaterial = crypto.randomUUID();
	await owner.materials.create({
		category: "Botão",
		materialId: buttonMaterial,
		name: "Botão",
		opId: newOpId(),
	});
	const button = crypto.randomUUID();
	await owner.materialVariants.create({
		baseUnit: "un",
		displayPrecision: 0,
		materialId: buttonMaterial,
		name: "Madrepérola",
		opId: newOpId(),
		variantId: button,
	});
	const sewing = crypto.randomUUID();
	await owner.services.create({
		costCents: "4000",
		name: "Costura",
		opId: newOpId(),
		priceCents: "8000",
		serviceId: sewing,
	});
	const embroidery = crypto.randomUUID();
	await owner.services.create({
		costCents: "1500",
		name: "Bordado",
		opId: newOpId(),
		outsourced: true,
		priceCents: "3000",
		serviceId: embroidery,
	});
	return { blue, button, buttonMaterial, embroidery, fabric, red, sewing };
}

function fabricItem(catalog: Catalog, overrides: Record<string, unknown> = {}) {
	return {
		id: crypto.randomUUID(),
		kind: "material" as const,
		loss: { basisPoints: 1000, kind: "percent" as const },
		materialVariantId: catalog.blue,
		note: "  Tecido principal ",
		quantityMicros: "1200000",
		...overrides,
	};
}

function serviceItem(
	serviceId: string,
	overrides: Record<string, unknown> = {}
) {
	return {
		count: 1,
		id: crypto.randomUUID(),
		kind: "service" as const,
		note: "",
		serviceId,
		...overrides,
	};
}

function createProduct(owner: Owner, overrides: Record<string, unknown> = {}) {
	return owner.products.create({
		category: "Roupa",
		name: "Vestido Midi",
		opId: newOpId(),
		productId: crypto.randomUUID(),
		...overrides,
	});
}

function createVariant(
	owner: Owner,
	productId: string,
	overrides: Record<string, unknown> = {}
) {
	return owner.productVariants.create({
		name: "P Azul",
		opId: newOpId(),
		priceCents: "17000",
		productId,
		variantId: crypto.randomUUID(),
		...overrides,
	});
}

const outcome = (promise: Promise<unknown>) =>
	promise.then(
		() => "accepted",
		(error: { code?: string }) => error.code
	);

describe("products", () => {
	test("creates, reads and edits a product with its sheet and gallery", async () => {
		const { owner } = await ownerSetup({ now: manualClock().now });
		const catalog = await catalogSetup(owner);
		const fabric = fabricItem(catalog);
		const sewing = serviceItem(catalog.sewing);
		const created = await createProduct(owner, {
			notes: "  Midi com zíper ",
			photos: [
				{ caption: " Frente ", photoHash: hash("a"), thumbnailHash: hash("b") },
				{ caption: "", photoHash: hash("c"), thumbnailHash: hash("d") },
			],
			productId: "00000000-0000-4000-8000-000000000001",
			sheet: [fabric, sewing],
			targetMarginBasisPoints: 3000,
		});
		expect(created).toEqual({
			id: "00000000-0000-4000-8000-000000000001",
			version: 1,
		});
		const read = await owner.products.get({ productId: created.id });
		expect(read.product).toEqual({
			archivedAt: null,
			category: "Roupa",
			createdAt: "2026-09-16T12:00:00.000Z",
			id: created.id,
			name: "Vestido Midi",
			notes: "Midi com zíper",
			photos: [
				{ caption: "Frente", photoHash: hash("a"), thumbnailHash: hash("b") },
				{ caption: null, photoHash: hash("c"), thumbnailHash: hash("d") },
			],
			sheet: [
				{ ...fabric, note: "Tecido principal" },
				{ ...sewing, note: null },
			],
			targetMarginBasisPoints: 3000,
			updatedAt: "2026-09-16T12:00:00.000Z",
			version: 1,
		});
		expect(read.variants).toEqual([]);
		expect(
			await owner.products.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: {
					photos: [
						{ caption: null, photoHash: hash("c"), thumbnailHash: hash("d") },
					],
					sheet: [sewing],
					targetMarginBasisPoints: null,
				},
				productId: created.id,
			})
		).toEqual({ version: 2 });
		const edited = await owner.products.get({ productId: created.id });
		expect(edited.product).toMatchObject({
			photos: [
				{ caption: null, photoHash: hash("c"), thumbnailHash: hash("d") },
			],
			sheet: [{ ...sewing, note: null }],
			targetMarginBasisPoints: null,
			version: 2,
		});
		expect((await owner.products.list({})).items).toEqual([
			{
				archivedAt: null,
				category: "Roupa",
				id: created.id,
				mainPhoto: { photoHash: hash("c"), thumbnailHash: hash("d") },
				maxPriceCents: null,
				minPriceCents: null,
				name: "Vestido Midi",
				updatedAt: "2026-09-16T12:00:00.000Z",
				variantCount: 0,
				version: 2,
			},
		]);
	});

	test("returns the references cited by the base and by the variant changes", async () => {
		const { owner } = await ownerSetup();
		const catalog = await catalogSetup(owner);
		const embroidery = serviceItem(catalog.embroidery, { count: 2 });
		const { id } = await createProduct(owner, {
			sheet: [fabricItem(catalog), embroidery],
		});
		await createVariant(owner, id, {
			sheetChanges: [
				{
					item: fabricItem(catalog, {
						loss: null,
						materialVariantId: catalog.button,
						quantityMicros: "4000000",
					}),
					kind: "add",
				},
			],
		});
		await createVariant(owner, id, {
			name: "M Azul",
			sheetChanges: [
				{
					item: serviceItem(catalog.sewing, { id: embroidery.id }),
					kind: "replace",
				},
			],
		});
		const { references } = await owner.products.get({ productId: id });
		expect(references.materialVariants.map((item) => item.id).sort()).toEqual(
			[catalog.blue, catalog.button].sort()
		);
		expect(
			references.materialVariants.find((item) => item.id === catalog.blue)
		).toEqual({
			archived: false,
			baseUnit: "m",
			code: "OX-AZ",
			displayPrecision: 2,
			id: catalog.blue,
			materialId: catalog.fabric,
			materialName: "Tecido Oxford",
			name: "Azul",
			referenceCostCents: "2550",
		});
		expect(
			references.materialVariants.find((item) => item.id === catalog.button)
		).toMatchObject({ archived: false, referenceCostCents: null });
		expect(references.services.map((item) => item.id).sort()).toEqual(
			[catalog.embroidery, catalog.sewing].sort()
		);
		expect(
			references.services.find((item) => item.id === catalog.embroidery)
		).toEqual({
			archived: false,
			costCents: "1500",
			id: catalog.embroidery,
			name: "Bordado",
			outsourced: true,
		});
		await owner.materials.archive({
			baseVersion: 1,
			materialId: catalog.buttonMaterial,
			opId: newOpId(),
		});
		const after = await owner.products.get({ productId: id });
		expect(
			after.references.materialVariants.find(
				(item) => item.id === catalog.button
			)?.archived
		).toBe(true);
	});

	test("keeps the variants in creation order and counts only the active ones in the list", async () => {
		const clock = manualClock();
		const { owner } = await ownerSetup({ now: clock.now });
		const { id } = await createProduct(owner);
		const variants = await inSequence(["P", "M", "G"], (name, index) => {
			clock.advance(1000);
			return createVariant(owner, id, {
				code: `VM-${name}`,
				name,
				priceCents: String(17_000 + index * 1000),
			});
		});
		const read = await owner.products.get({ productId: id });
		expect(read.variants.map((variant) => variant.name)).toEqual([
			"P",
			"M",
			"G",
		]);
		expect(read.variants[0]).toEqual({
			archivedAt: null,
			code: "VM-P",
			coverPhotoHash: null,
			createdAt: "2026-09-16T12:00:01.000Z",
			id: variants[0]?.id ?? "",
			name: "P",
			priceCents: "17000",
			productId: id,
			sheetChanges: [],
			updatedAt: "2026-09-16T12:00:01.000Z",
			version: 1,
		});
		expect((await owner.products.list({})).items[0]).toMatchObject({
			maxPriceCents: "19000",
			minPriceCents: "17000",
			variantCount: 3,
		});
		await owner.productVariants.archive({
			baseVersion: 1,
			opId: newOpId(),
			variantId: variants[2]?.id ?? "",
		});
		expect((await owner.products.list({})).items[0]).toMatchObject({
			maxPriceCents: "18000",
			minPriceCents: "17000",
			variantCount: 2,
		});
		await owner.productVariants.archive({
			baseVersion: 1,
			opId: newOpId(),
			variantId: variants[0]?.id ?? "",
		});
		expect((await owner.products.list({})).items[0]).toMatchObject({
			maxPriceCents: "18000",
			minPriceCents: "18000",
			variantCount: 1,
		});
	});

	test("finds products by the variant code, filters by category and lists the archived", async () => {
		const { owner } = await ownerSetup();
		const dress = await createProduct(owner);
		const coded = await createVariant(owner, dress.id, { code: "VM-P-AZ" });
		await createProduct(owner, { category: "Kit", name: "Kit Toalhas" });
		await createProduct(owner, { category: null, name: "Nécessaire" });
		const archived = await createProduct(owner, {
			category: "Bolsa",
			name: "Bolsa de praia",
		});
		await owner.products.archive({
			baseVersion: 1,
			opId: newOpId(),
			productId: archived.id,
		});
		const names = async (input: Parameters<Owner["products"]["list"]>[0]) =>
			(await owner.products.list(input)).items.map((item) => item.name);
		expect(await names({})).toEqual([
			"Kit Toalhas",
			"Nécessaire",
			"Vestido Midi",
		]);
		expect(await names({ query: "vm-p" })).toEqual(["Vestido Midi"]);
		expect(await names({ query: "necessaire" })).toEqual(["Nécessaire"]);
		expect(await names({ query: "100%" })).toEqual([]);
		expect(await names({ category: "Kit" })).toEqual(["Kit Toalhas"]);
		expect(await names({ category: "" })).toEqual(["Nécessaire"]);
		expect(await names({ archived: true })).toEqual(["Bolsa de praia"]);
		expect(await owner.products.categories({})).toEqual({
			categories: ["Kit", "Roupa"],
		});
		await owner.productVariants.archive({
			baseVersion: 1,
			opId: newOpId(),
			variantId: coded.id,
		});
		expect(await names({ query: "vm-p" })).toEqual(["Vestido Midi"]);
	});

	test("edits the name, code, price, cover and changes of a variant", async () => {
		const clock = manualClock();
		const { owner } = await ownerSetup({ now: clock.now });
		const catalog = await catalogSetup(owner);
		const fabric = fabricItem(catalog);
		const { id } = await createProduct(owner, {
			photos: [
				{ caption: null, photoHash: hash("a"), thumbnailHash: hash("b") },
				{ caption: null, photoHash: hash("c"), thumbnailHash: hash("d") },
			],
			sheet: [fabric],
		});
		const variant = await createVariant(owner, id, {
			code: "VM-P",
			coverPhotoHash: hash("a"),
		});
		clock.advance(60_000);
		const redFabric = fabricItem(catalog, {
			id: fabric.id,
			materialVariantId: catalog.red,
			quantityMicros: "1400000",
		});
		expect(
			await owner.productVariants.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: {
					code: "VM-P-VM",
					coverPhotoHash: hash("c"),
					name: "P Vermelho",
					priceCents: "18990",
					sheetChanges: [{ item: redFabric, kind: "replace" }],
				},
				variantId: variant.id,
			})
		).toEqual({ version: 2 });
		expect((await owner.products.get({ productId: id })).variants).toEqual([
			{
				archivedAt: null,
				code: "VM-P-VM",
				coverPhotoHash: hash("c"),
				createdAt: "2026-09-16T12:00:00.000Z",
				id: variant.id,
				name: "P Vermelho",
				priceCents: "18990",
				productId: id,
				sheetChanges: [
					{ item: { ...redFabric, note: "Tecido principal" }, kind: "replace" },
				],
				updatedAt: "2026-09-16T12:01:00.000Z",
				version: 2,
			},
		]);
		const found = async (query: string) =>
			(await owner.products.list({ query })).items.map((item) => item.id);
		expect(await found("vm-p-vm")).toEqual([id]);
		expect(await found("vermelho")).toEqual([id]);
		expect((await owner.products.list({})).items[0]).toMatchObject({
			maxPriceCents: "18990",
			minPriceCents: "18990",
		});
		expect(
			(await owner.productVariants.byCode({ code: "vm-p-vm" })).items.map(
				(item) => item.id
			)
		).toEqual([variant.id]);
		expect(
			(await owner.productVariants.byCode({ code: "VM-P" })).items
		).toEqual([]);
	});

	test("changes and clears the category and the notes of a product", async () => {
		const { owner } = await ownerSetup();
		const { id } = await createProduct(owner, { notes: "Midi" });
		await owner.products.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: { category: "Kit", name: "Kit Vestido", notes: "Com bolsa" },
			productId: id,
		});
		expect((await owner.products.get({ productId: id })).product).toMatchObject(
			{
				category: "Kit",
				name: "Kit Vestido",
				notes: "Com bolsa",
				version: 2,
			}
		);
		const found = async (query: string) =>
			(await owner.products.list({ query })).items.map((item) => item.id);
		expect(await found("kit vestido")).toEqual([id]);
		expect(await found("roupa")).toEqual([]);
		await owner.products.update({
			baseVersion: 2,
			opId: newOpId(),
			patch: { category: null, notes: null },
			productId: id,
		});
		expect((await owner.products.get({ productId: id })).product).toMatchObject(
			{ category: null, notes: null, version: 3 }
		);
		expect(
			(await owner.products.list({ category: "" })).items.map((item) => item.id)
		).toEqual([id]);
	});

	test("pages the list 50 at a time", async () => {
		const { owner } = await ownerSetup();
		await inSequence(times(51), (index) =>
			createProduct(owner, {
				name: `Produto ${String(index).padStart(2, "0")}`,
			})
		);
		const first = await owner.products.list({});
		expect(first.items).toHaveLength(50);
		expect(first.nextOffset).toBe(50);
		const second = await owner.products.list({ offset: 50 });
		expect(second.items.map((item) => item.name)).toEqual(["Produto 51"]);
		expect(second.nextOffset).toBeNull();
	});

	test("finds a variant by code without case and ignores the archived", async () => {
		const { owner } = await ownerSetup();
		const { id } = await createProduct(owner);
		const found = await createVariant(owner, id, { code: "VM-P-AZ" });
		const old = await createVariant(owner, id, {
			code: "vm-p-az",
			name: "Antiga",
		});
		await owner.productVariants.archive({
			baseVersion: 1,
			opId: newOpId(),
			variantId: old.id,
		});
		expect(await owner.productVariants.byCode({ code: "vm-p-az" })).toEqual({
			items: [
				{
					code: "VM-P-AZ",
					id: found.id,
					name: "P Azul",
					productId: id,
					productName: "Vestido Midi",
				},
			],
		});
	});

	test("clears the cover and the code of a variant", async () => {
		const { owner } = await ownerSetup();
		const { id } = await createProduct(owner, {
			photos: [
				{ caption: null, photoHash: hash("a"), thumbnailHash: hash("b") },
			],
		});
		const variant = await createVariant(owner, id, {
			code: "VM-P",
			coverPhotoHash: hash("a"),
		});
		await owner.productVariants.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: { code: "", coverPhotoHash: null },
			variantId: variant.id,
		});
		expect(
			(await owner.products.get({ productId: id })).variants[0]
		).toMatchObject({
			code: null,
			coverPhotoHash: null,
			version: 2,
		});
	});

	test("archives, archives again without effect and unarchives the product and the variant", async () => {
		const { owner } = await ownerSetup();
		const { id } = await createProduct(owner);
		const variant = await createVariant(owner, id);
		expect(
			await owner.products.archive({
				baseVersion: 1,
				opId: newOpId(),
				productId: id,
			})
		).toEqual({ version: 2 });
		expect(
			await owner.products.archive({
				baseVersion: 2,
				opId: newOpId(),
				productId: id,
			})
		).toEqual({ version: 2 });
		expect((await owner.products.list({})).items).toHaveLength(0);
		expect(
			await owner.products.unarchive({
				baseVersion: 2,
				opId: newOpId(),
				productId: id,
			})
		).toEqual({ version: 3 });
		expect(
			await owner.productVariants.archive({
				baseVersion: 1,
				opId: newOpId(),
				variantId: variant.id,
			})
		).toEqual({ version: 2 });
		expect(
			await owner.productVariants.archive({
				baseVersion: 2,
				opId: newOpId(),
				variantId: variant.id,
			})
		).toEqual({ version: 2 });
		expect(
			await owner.productVariants.unarchive({
				baseVersion: 2,
				opId: newOpId(),
				variantId: variant.id,
			})
		).toEqual({ version: 3 });
	});

	test("repeats by opId and refuses a stale version, a repeated id, a missing product or variant and an empty patch", async () => {
		const { owner } = await ownerSetup();
		const productId = crypto.randomUUID();
		const opId = newOpId();
		const first = await createProduct(owner, { opId, productId });
		expect(await createProduct(owner, { opId, productId })).toEqual(first);
		await expect(createProduct(owner, { productId })).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		await expect(
			owner.products.update({
				baseVersion: 4,
				opId: newOpId(),
				patch: { name: "Outro" },
				productId,
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: { currentVersion: 1 },
			message: "Versão desatualizada",
		});
		await expect(
			owner.products.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: { name: "Outro" },
				productId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Produto não encontrado",
		});
		await expect(
			owner.products.get({ productId: crypto.randomUUID() })
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Produto não encontrado",
		});
		await expect(
			owner.products.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: {},
				productId,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			createVariant(owner, crypto.randomUUID())
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Produto não encontrado",
		});
		const variant = await createVariant(owner, productId);
		await expect(
			owner.productVariants.update({
				baseVersion: 3,
				opId: newOpId(),
				patch: { priceCents: "18000" },
				variantId: variant.id,
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Versão desatualizada",
		});
		await expect(
			owner.productVariants.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: { priceCents: "18000" },
				variantId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Variante do produto não encontrada",
		});
		await expect(
			owner.productVariants.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: {},
				variantId: variant.id,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("refuses a sheet, a gallery, a price or a cover out of shape", async () => {
		const { owner } = await ownerSetup();
		const catalog = await catalogSetup(owner);
		const fabric = fabricItem(catalog);
		const sewing = serviceItem(catalog.sewing);
		const photo = {
			caption: null,
			photoHash: hash("a"),
			thumbnailHash: hash("b"),
		};
		const outcomes = await inSequence(
			[
				{ sheet: [fabric, serviceItem(catalog.sewing, { id: fabric.id })] },
				{ sheet: [{ ...fabric, loss: { basisPoints: 0, kind: "percent" } }] },
				{
					sheet: [
						{ ...fabric, loss: { basisPoints: 10_000, kind: "percent" } },
					],
				},
				{
					sheet: [{ ...fabric, loss: { kind: "fixed", quantityMicros: "0" } }],
				},
				{ sheet: [{ ...fabric, quantityMicros: "0" }] },
				{ sheet: [{ ...fabric, quantityMicros: "1,5" }] },
				{ sheet: [{ ...sewing, count: 0 }] },
				{ sheet: [{ ...sewing, count: 100 }] },
				{ sheet: [{ ...fabric, note: "x".repeat(61) }] },
				{ sheet: times(61).map(() => serviceItem(catalog.sewing)) },
				{ sheet: [fabric, null] },
				{ photos: [photo, photo] },
				{ name: "  " },
			],
			(overrides) => outcome(createProduct(owner, overrides))
		);
		expect(outcomes).toEqual(Array.from({ length: 13 }, () => "BAD_REQUEST"));
		expect(
			await outcome(
				createProduct(owner, {
					sheet: [fabric, fabricItem(catalog), sewing],
				})
			)
		).toBe("accepted");
		const { id } = await createProduct(owner, {
			sheet: [fabric, sewing],
		});
		const variantOutcomes = await inSequence(
			[
				{ priceCents: "12,50" },
				{ priceCents: "9007199254740992" },
				{ coverPhotoHash: "nao-e-hash" },
				{
					sheetChanges: [
						{ item: fabricItem(catalog, { id: fabric.id }), kind: "replace" },
						{ itemId: fabric.id, kind: "remove" },
					],
				},
				{
					sheetChanges: [
						{ item: sewing, kind: "add" },
						{ item: sewing, kind: "add" },
					],
				},
				{ sheetChanges: [null] },
			],
			(overrides) => outcome(createVariant(owner, id, overrides))
		);
		expect(variantOutcomes).toEqual(
			Array.from({ length: 6 }, () => "BAD_REQUEST")
		);
		expect(
			await outcome(
				createVariant(owner, id, {
					sheetChanges: [
						{
							item: fabricItem(catalog, {
								id: fabric.id,
								materialVariantId: catalog.red,
							}),
							kind: "replace",
						},
						{ itemId: sewing.id, kind: "remove" },
					],
				})
			)
		).toBe("accepted");
	});
});

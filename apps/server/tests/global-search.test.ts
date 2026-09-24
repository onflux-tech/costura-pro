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

const empty = { items: [], total: 0 };

async function ownerSetup(options: ServerOptions = {}) {
	const server = await startTestServer(options);
	servers.push(server);
	const { cookie } = await completeWizard(server);
	return { owner: rpc(server, { cookie }), server };
}

async function createClient(
	owner: Owner,
	name: string,
	contact: { email?: string; phone?: string } = {}
): Promise<string> {
	const clientId = crypto.randomUUID();
	await owner.clients.create({
		clientId,
		kind: "person",
		name,
		opId: newOpId(),
		...contact,
	});
	return clientId;
}

async function createProfile(
	owner: Owner,
	clientId: string,
	name: string
): Promise<string> {
	const profileId = crypto.randomUUID();
	await owner.profiles.create({ clientId, name, opId: newOpId(), profileId });
	return profileId;
}

async function createProduct(
	owner: Owner,
	name: string,
	category: string | null = null
): Promise<string> {
	const productId = crypto.randomUUID();
	await owner.products.create({ category, name, opId: newOpId(), productId });
	return productId;
}

async function createProductVariant(
	owner: Owner,
	productId: string,
	fields: { code: string; name: string; priceCents: string }
): Promise<string> {
	const variantId = crypto.randomUUID();
	await owner.productVariants.create({
		...fields,
		opId: newOpId(),
		productId,
		variantId,
	});
	return variantId;
}

async function createMaterial(
	owner: Owner,
	name: string,
	category: string | null = null
): Promise<string> {
	const materialId = crypto.randomUUID();
	await owner.materials.create({ category, materialId, name, opId: newOpId() });
	return materialId;
}

async function createMaterialVariant(
	owner: Owner,
	materialId: string,
	fields: { code: string; name: string; referenceCostCents?: string }
): Promise<string> {
	const variantId = crypto.randomUUID();
	await owner.materialVariants.create({
		...fields,
		baseUnit: "m",
		displayPrecision: 2,
		materialId,
		opId: newOpId(),
		variantId,
	});
	return variantId;
}

async function createService(
	owner: Owner,
	fields: { category?: string; name: string; outsourced?: boolean }
): Promise<string> {
	const serviceId = crypto.randomUUID();
	await owner.services.create({
		costCents: "2000",
		opId: newOpId(),
		priceCents: "3500",
		serviceId,
		...fields,
	});
	return serviceId;
}

async function createLocation(owner: Owner, name: string): Promise<string> {
	const locationId = crypto.randomUUID();
	await owner.stockLocations.create({
		locationId,
		name,
		notes: null,
		opId: newOpId(),
	});
	return locationId;
}

async function openBalance(
	owner: Owner,
	input: {
		locationId: string;
		quantityMicros: string;
		valueCents: string;
		variantId: string;
	}
) {
	await owner.stockMovements.create({
		...input,
		kind: "opening",
		lotId: null,
		movementId: crypto.randomUUID(),
		occurredOn: "2026-09-20",
		opId: newOpId(),
		reason: null,
	});
}

describe("search.global", () => {
	test("finds clients by name without accents, e-mail and a piece of the phone", async () => {
		const { owner } = await ownerSetup();
		const ana = await createClient(owner, "Ana Souza", {
			email: "ana@exemplo.com",
			phone: "(11) 98765-4321",
		});
		const conceicao = await createClient(owner, "Conceição Lima");
		const ids = async (query: string) =>
			(await owner.search.global({ query })).clients.items.map(
				(item) => item.id
			);
		expect(await ids("CONCEICAO")).toEqual([conceicao]);
		expect(await ids("ana@exemplo")).toEqual([ana]);
		expect(await ids("98765")).toEqual([ana]);
		expect(await ids("(11) 98765-4321")).toEqual([ana]);
		expect((await owner.search.global({ query: "souza" })).clients).toEqual({
			items: [
				{
					archived: false,
					email: "ana@exemplo.com",
					id: ana,
					kind: "person",
					name: "Ana Souza",
					phone: "11987654321",
					secondaryPhone: null,
				},
			],
			total: 1,
		});
	});

	test("finds a profile by its name without accents and points to the client", async () => {
		const { owner } = await ownerSetup();
		const ana = await createClient(owner, "Ana Souza");
		const ina = await createProfile(owner, ana, "Iná Costa");
		expect((await owner.search.global({ query: "ina" })).profiles).toEqual({
			items: [
				{
					archived: false,
					clientId: ana,
					clientName: "Ana Souza",
					id: ina,
					name: "Iná Costa",
				},
			],
			total: 1,
		});
		expect((await owner.search.global({ query: "ina lima" })).profiles).toEqual(
			empty
		);
	});

	test("takes a typed percent or underscore literally", async () => {
		const { owner } = await ownerSetup();
		await createClient(owner, "Ana Souza");
		await createProfile(
			owner,
			await createClient(owner, "Bruno Lima"),
			"Ana Clara"
		);
		const found = async (query: string) => {
			const result = await owner.search.global({ query });
			return [result.clients.items.length, result.profiles.items.length];
		};
		expect(await found("a_a")).toEqual([0, 0]);
		expect(await found("a%a")).toEqual([0, 0]);
		expect(await found("ana")).toEqual([1, 1]);
	});

	test("finds products, materials and services by name and category, and a parent through a variant code", async () => {
		const { owner } = await ownerSetup();
		const vestido = await createProduct(owner, "Vestido Midi", "Vestidos");
		await createProductVariant(owner, vestido, {
			code: "VM-M",
			name: "M",
			priceCents: "28990",
		});
		const avental = await createProduct(owner, "Avental de Linho");
		const linho = await createMaterial(owner, "Linho", "Tecidos");
		await createMaterialVariant(owner, linho, { code: "LIN-CRU", name: "Cru" });
		const barra = await createService(owner, {
			category: "Ajustes",
			name: "Barra de calça",
			outsourced: true,
		});
		expect(
			(await owner.search.global({ query: "vm-m" })).products.items.map(
				(item) => item.id
			)
		).toEqual([vestido]);
		expect(
			(await owner.search.global({ query: "lin-cru" })).materials.items.map(
				(item) => item.id
			)
		).toEqual([linho]);
		expect(
			(await owner.search.global({ query: "tecidos" })).materials.items.map(
				(item) => [item.name, item.category, item.variantCount]
			)
		).toEqual([["Linho", "Tecidos", 1]]);
		expect((await owner.search.global({ query: "ajustes" })).services).toEqual({
			items: [
				{
					archived: false,
					category: "Ajustes",
					id: barra,
					name: "Barra de calça",
					outsourced: true,
					priceCents: "3500",
				},
			],
			total: 1,
		});
		expect(
			(await owner.search.global({ query: "avental" })).products.items
		).toEqual([
			{
				archived: false,
				category: null,
				id: avental,
				matchedCount: 0,
				name: "Avental de Linho",
				variantCount: 0,
				variants: [],
			},
		]);
	});

	test("never shows an anonymized client or its profiles, not even with archived ones", async () => {
		const { owner } = await ownerSetup();
		const paula = await createClient(owner, "Paula Antiga");
		await createProfile(owner, paula, "Lia");
		await owner.clients.anonymize({
			baseVersion: 1,
			clientId: paula,
			opId: newOpId(),
		});
		const cases = [false, true].flatMap((archived) =>
			["paula", "lia", "anonimizado"].map((query) => ({ archived, query }))
		);
		const results = await inSequence(cases, (input) =>
			owner.search.global(input)
		);
		expect(results.map((result) => [result.clients, result.profiles])).toEqual(
			cases.map(() => [empty, empty])
		);
	});

	test("leaves archived records out unless asked, and then lists active ones first", async () => {
		const { owner } = await ownerSetup();
		await createClient(owner, "Ana Souza");
		const arquivada = await createClient(owner, "Ana Arquivada");
		await createProfile(owner, arquivada, "Bia");
		await owner.clients.archive({
			baseVersion: 1,
			clientId: arquivada,
			opId: newOpId(),
		});
		const lia = await createProfile(
			owner,
			await createClient(owner, "Carla Lima"),
			"Lia"
		);
		await owner.profiles.archive({
			baseVersion: 1,
			opId: newOpId(),
			profileId: lia,
		});
		const bainha = await createService(owner, { name: "Bainha italiana" });
		await owner.services.archive({
			baseVersion: 1,
			opId: newOpId(),
			serviceId: bainha,
		});
		const saia = await createProduct(owner, "Saia Reta");
		await owner.products.archive({
			baseVersion: 1,
			opId: newOpId(),
			productId: saia,
		});
		const names = (group: { items: { archived: boolean; name: string }[] }) =>
			group.items.map((item) => [item.name, item.archived]);
		const search = (query: string, archived = false) =>
			owner.search.global({ archived, query });
		expect(names((await search("ana")).clients)).toEqual([
			["Ana Souza", false],
		]);
		expect(names((await search("ana", true)).clients)).toEqual([
			["Ana Souza", false],
			["Ana Arquivada", true],
		]);
		expect((await search("bia")).profiles).toEqual(empty);
		expect(names((await search("bia", true)).profiles)).toEqual([
			["Bia", true],
		]);
		expect((await search("lia")).profiles).toEqual(empty);
		expect(names((await search("lia", true)).profiles)).toEqual([
			["Lia", true],
		]);
		expect((await search("bainha")).services).toEqual(empty);
		expect(names((await search("bainha", true)).services)).toEqual([
			["Bainha italiana", true],
		]);
		expect((await search("saia")).products).toEqual(empty);
		expect(names((await search("saia", true)).products)).toEqual([
			["Saia Reta", true],
		]);
	});

	test("shows five per group and counts every match", async () => {
		const { owner } = await ownerSetup();
		await inSequence(times(5), (index) =>
			createClient(owner, `Silva ${index}`)
		);
		const five = (await owner.search.global({ query: "silva" })).clients;
		expect([five.items.length, five.total]).toEqual([5, 5]);
		await createClient(owner, "Silva 6");
		const six = (await owner.search.global({ query: "silva" })).clients;
		expect([six.total, six.items.map((item) => item.name)]).toEqual([
			6,
			["Silva 1", "Silva 2", "Silva 3", "Silva 4", "Silva 5"],
		]);
	});

	test("keeps five items and the whole count in every group", async () => {
		const { owner } = await ownerSetup();
		const ana = await createClient(owner, "Ana Souza");
		await inSequence(times(6), async (index) => {
			await createClient(owner, `Renda ${index}`);
			await createProfile(owner, ana, `Renda ${index}`);
			await createProduct(owner, `Renda ${index}`);
			await createMaterial(owner, `Renda ${index}`);
			await createService(owner, { name: `Renda ${index}` });
		});
		const result = await owner.search.global({ query: "renda" });
		expect(
			[
				result.clients,
				result.profiles,
				result.products,
				result.materials,
				result.services,
			].map((group) => [group.items.length, group.total])
		).toEqual([
			[5, 6],
			[5, 6],
			[5, 6],
			[5, 6],
			[5, 6],
		]);
	});

	test("shows the same first records as the list of each area", async () => {
		const { owner } = await ownerSetup();
		const names = ["Gil", "Eva", "Ana", "Flor", "Bruno", "Dora", "Caio"];
		await inSequence(names, (name) => createClient(owner, `${name} Silva`));
		await inSequence(names, (name) => createProduct(owner, `Vestido ${name}`));
		await inSequence(names, (name) => createMaterial(owner, `Linho ${name}`));
		await inSequence(names, (name) =>
			createService(owner, { name: `Barra ${name}` })
		);
		const first = (items: { id: string }[]) =>
			items.slice(0, 5).map((item) => item.id);
		const search = (query: string) => owner.search.global({ query });
		expect(first((await search("silva")).clients.items)).toEqual(
			first((await owner.clients.list({ query: "silva" })).items)
		);
		expect(first((await search("vestido")).products.items)).toEqual(
			first((await owner.products.list({ query: "vestido" })).items)
		);
		expect(first((await search("linho")).materials.items)).toEqual(
			first((await owner.materials.list({ query: "linho" })).items)
		);
		expect(first((await search("barra")).services.items)).toEqual(
			first((await owner.services.list({ query: "barra" })).items)
		);
	});

	test("refuses a one-letter or too long query, answers nothing for punctuation only and needs a session in both reads", async () => {
		const { owner, server } = await ownerSetup();
		await createClient(owner, "Ana Souza");
		await expect(owner.search.global({ query: "a" })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		await expect(owner.search.global({ query: "  a  " })).rejects.toMatchObject(
			{ code: "BAD_REQUEST" }
		);
		await expect(
			owner.search.global({ query: "a".repeat(101) })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(
			(await owner.search.global({ query: "an" })).clients.items.length
		).toBe(1);
		expect(await owner.search.global({ query: "--" })).toEqual({
			clients: empty,
			materials: empty,
			products: empty,
			profiles: empty,
			services: empty,
		});
		expect(await owner.search.group({ group: "clients", query: "--" })).toEqual(
			{ group: "clients", items: [], nextOffset: null, total: 0 }
		);
		await expect(
			owner.search.group({ group: "clients", offset: -50, query: "ana" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			owner.search.group({ group: "clients", offset: 1.5, query: "ana" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(
			(await owner.search.group({ group: "clients", offset: 0, query: "ana" }))
				.items.length
		).toBe(1);
		await expect(
			rpc(server).search.global({ query: "ana" })
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		await expect(
			rpc(server).search.group({ group: "clients", query: "ana" })
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	test("highlights the variants that matched, with the price or the summed balance", async () => {
		const { owner } = await ownerSetup();
		const vestido = await createProduct(owner, "Vestido Midi", "Vestidos");
		await createProductVariant(owner, vestido, {
			code: "VM-P",
			name: "P",
			priceCents: "25990",
		});
		const m = await createProductVariant(owner, vestido, {
			code: "VM-M",
			name: "M",
			priceCents: "28990",
		});
		const linho = await createMaterial(owner, "Linho", "Tecidos");
		const cru = await createMaterialVariant(owner, linho, {
			code: "LIN-CRU",
			name: "Cru",
		});
		await createMaterialVariant(owner, linho, {
			code: "LIN-MIX",
			name: "Linho misto",
		});
		await openBalance(owner, {
			locationId: await createLocation(owner, "Prateleira"),
			quantityMicros: "20000000",
			valueCents: "80000",
			variantId: cru,
		});
		await openBalance(owner, {
			locationId: await createLocation(owner, "Gaveta"),
			quantityMicros: "11000000",
			valueCents: "44000",
			variantId: cru,
		});
		expect(
			(await owner.search.global({ query: "vm-m" })).products.items
		).toEqual([
			{
				archived: false,
				category: "Vestidos",
				id: vestido,
				matchedCount: 1,
				name: "Vestido Midi",
				variantCount: 2,
				variants: [
					{
						archived: false,
						code: "VM-M",
						id: m,
						name: "M",
						priceCents: "28990",
					},
				],
			},
		]);
		expect(
			(await owner.search.global({ query: "linho cru" })).materials.items
		).toEqual([
			{
				archived: false,
				category: "Tecidos",
				id: linho,
				matchedCount: 1,
				name: "Linho",
				variantCount: 2,
				variants: [
					{
						archived: false,
						baseUnit: "m",
						code: "LIN-CRU",
						displayPrecision: 2,
						id: cru,
						name: "Cru",
						quantityMicros: "31000000",
					},
				],
			},
		]);
		expect(
			(await owner.search.global({ query: "linho" })).materials.items.map(
				(item) => item.variants
			)
		).toEqual([[]]);
	});

	test("shows three highlighted variants in page order and counts the rest", async () => {
		const clock = manualClock();
		const { owner } = await ownerSetup({ now: clock.now });
		const kit = await createProduct(owner, "Kit Nécessaires", "Kit");
		await inSequence([3, 1, 2, 5, 4], async (index) => {
			clock.advance(1000);
			return await createProductVariant(owner, kit, {
				code: `KN-${index}`,
				name: `Estampa ${index}`,
				priceCents: "4990",
			});
		});
		const [hit] = (await owner.search.global({ query: "estampa" })).products
			.items;
		expect([
			hit?.matchedCount,
			hit?.variants.map((variant) => variant.name),
		]).toEqual([5, ["Estampa 3", "Estampa 1", "Estampa 2"]]);
	});

	test("flags an archived variant among the highlights", async () => {
		const { owner } = await ownerSetup();
		const linho = await createMaterial(owner, "Linho", "Tecidos");
		const antiga = await createMaterialVariant(owner, linho, {
			code: "LIN-OLD",
			name: "Antiga",
		});
		await owner.materialVariants.archive({
			baseVersion: 1,
			opId: newOpId(),
			variantId: antiga,
		});
		expect(
			(await owner.search.global({ query: "lin-old" })).materials.items
		).toEqual([
			{
				archived: false,
				category: "Tecidos",
				id: linho,
				matchedCount: 1,
				name: "Linho",
				variantCount: 0,
				variants: [
					{
						archived: true,
						baseUnit: "m",
						code: "LIN-OLD",
						displayPrecision: 2,
						id: antiga,
						name: "Antiga",
						quantityMicros: "0",
					},
				],
			},
		]);
	});

	test("never returns costs, stock values or margins", async () => {
		const { owner } = await ownerSetup();
		const linho = await createMaterial(owner, "Linho", "Tecidos");
		const cru = await createMaterialVariant(owner, linho, {
			code: "LIN-CRU",
			name: "Cru",
			referenceCostCents: "4000",
		});
		await openBalance(owner, {
			locationId: await createLocation(owner, "Prateleira"),
			quantityMicros: "1000000",
			valueCents: "4000",
			variantId: cru,
		});
		const vestido = await createProduct(owner, "Vestido Midi", "Vestidos");
		await createProductVariant(owner, vestido, {
			code: "VM-P",
			name: "P",
			priceCents: "25990",
		});
		await createService(owner, { name: "Barra de calça" });
		const body = JSON.stringify(
			await inSequence(["lin-cru", "vm-p", "barra"], (query) =>
				owner.search.global({ query })
			)
		);
		expect(
			[
				"costCents",
				"referenceCostCents",
				"valueCents",
				"targetMarginBasisPoints",
			].filter((key) => body.includes(`"${key}"`))
		).toEqual([]);
		expect(body).toContain('"priceCents":"25990"');
		expect(body).toContain('"quantityMicros":"1000000"');
	});

	test("pages a whole group fifty at a time, starting with the same five", async () => {
		const { owner } = await ownerSetup();
		await inSequence(times(55), (index) =>
			createClient(owner, `Lima ${String(index).padStart(2, "0")}`)
		);
		const first = await owner.search.group({ group: "clients", query: "lima" });
		expect([
			first.group,
			first.items.length,
			first.nextOffset,
			first.total,
		]).toEqual(["clients", 50, 50, 55]);
		const global = await owner.search.global({ query: "lima" });
		expect(first.items.slice(0, 5)).toEqual(global.clients.items);
		const second = await owner.search.group({
			group: "clients",
			offset: 50,
			query: "lima",
		});
		if (second.group !== "clients") {
			throw new Error(`grupo inesperado: ${second.group}`);
		}
		expect([
			second.items.map((item) => item.name),
			second.nextOffset,
			second.total,
		]).toEqual([
			["Lima 51", "Lima 52", "Lima 53", "Lima 54", "Lima 55"],
			null,
			55,
		]);
	});

	test("gives a group page the same items as the global search and refuses an unknown group", async () => {
		const { owner } = await ownerSetup();
		const ana = await createClient(owner, "Ana Souza");
		await createProfile(owner, ana, "Bia Costa");
		const vestido = await createProduct(owner, "Vestido Midi", "Vestidos");
		await createProductVariant(owner, vestido, {
			code: "VM-M",
			name: "M",
			priceCents: "28990",
		});
		const products = await owner.search.group({
			group: "products",
			query: "vm-m",
		});
		expect([products.items, products.nextOffset, products.total]).toEqual([
			(await owner.search.global({ query: "vm-m" })).products.items,
			null,
			1,
		]);
		const profiles = await owner.search.group({
			group: "profiles",
			query: "bia",
		});
		expect([profiles.items, profiles.nextOffset, profiles.total]).toEqual([
			(await owner.search.global({ query: "bia" })).profiles.items,
			null,
			1,
		]);
		await expect(
			owner.search.group({ group: "suppliers" as never, query: "ana" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("lists active records first in every group, with archived ones in name order", async () => {
		const clock = manualClock();
		const { owner } = await ownerSetup({ now: clock.now });
		await createClient(owner, "Bruna Renda");
		const zilda = await createClient(owner, "Ana Zilda Renda");
		const beatriz = await createClient(owner, "Ana Beatriz Renda");
		clock.advance(1000);
		await owner.clients.archive({
			baseVersion: 1,
			clientId: zilda,
			opId: newOpId(),
		});
		clock.advance(1000);
		await owner.clients.archive({
			baseVersion: 1,
			clientId: beatriz,
			opId: newOpId(),
		});
		const holder = await createClient(owner, "Titular");
		await createProfile(owner, holder, "Bruna Renda");
		const oldProfile = await createProfile(owner, holder, "Ana Renda");
		await owner.profiles.archive({
			baseVersion: 1,
			opId: newOpId(),
			profileId: oldProfile,
		});
		await createProduct(owner, "Bruna Renda");
		const oldProduct = await createProduct(owner, "Ana Renda");
		await owner.products.archive({
			baseVersion: 1,
			opId: newOpId(),
			productId: oldProduct,
		});
		await createMaterial(owner, "Bruna Renda");
		const oldMaterial = await createMaterial(owner, "Ana Renda");
		await owner.materials.archive({
			baseVersion: 1,
			materialId: oldMaterial,
			opId: newOpId(),
		});
		await createService(owner, { name: "Bruna Renda" });
		const oldService = await createService(owner, { name: "Ana Renda" });
		await owner.services.archive({
			baseVersion: 1,
			opId: newOpId(),
			serviceId: oldService,
		});
		const result = await owner.search.global({
			archived: true,
			query: "renda",
		});
		const names = (group: { items: { archived: boolean; name: string }[] }) =>
			group.items.map((item) => [item.name, item.archived]);
		expect(names(result.clients)).toEqual([
			["Bruna Renda", false],
			["Ana Beatriz Renda", true],
			["Ana Zilda Renda", true],
		]);
		const activeThenArchived = [
			["Bruna Renda", false],
			["Ana Renda", true],
		];
		expect([
			names(result.profiles),
			names(result.products),
			names(result.materials),
			names(result.services),
		]).toEqual([
			activeThenArchived,
			activeThenArchived,
			activeThenArchived,
			activeThenArchived,
		]);
		expect(
			(await owner.search.global({ query: "renda" })).materials.items.map(
				(item) => item.name
			)
		).toEqual(["Bruna Renda"]);
	});

	test("needs every word in every group", async () => {
		const { owner } = await ownerSetup();
		const holder = await createClient(owner, "Titular");
		await inSequence(["Grossa", "Fina"], async (word) => {
			await createClient(owner, `Renda ${word}`);
			await createProfile(owner, holder, `Renda ${word}`);
			await createProduct(owner, `Renda ${word}`);
			await createMaterial(owner, `Renda ${word}`);
			await createService(owner, { name: `Renda ${word}` });
		});
		const result = await owner.search.global({ query: "renda grossa" });
		expect(
			[
				result.clients,
				result.profiles,
				result.products,
				result.materials,
				result.services,
			].map((group) => group.items.map((item) => item.name))
		).toEqual([
			["Renda Grossa"],
			["Renda Grossa"],
			["Renda Grossa"],
			["Renda Grossa"],
			["Renda Grossa"],
		]);
	});

	test("finds a product by its category and through an archived variant only", async () => {
		const { owner } = await ownerSetup();
		const vestido = await createProduct(owner, "Vestido Midi", "Festa");
		const blusa = await createProduct(owner, "Blusa Solta");
		const antiga = await createProductVariant(owner, blusa, {
			code: "BL-OLD",
			name: "Antiga",
			priceCents: "9990",
		});
		await owner.productVariants.archive({
			baseVersion: 1,
			opId: newOpId(),
			variantId: antiga,
		});
		expect(
			(await owner.search.global({ query: "festa" })).products.items.map(
				(item) => item.id
			)
		).toEqual([vestido]);
		expect(
			(await owner.search.global({ query: "bl-old" })).products.items
		).toEqual([
			{
				archived: false,
				category: null,
				id: blusa,
				matchedCount: 1,
				name: "Blusa Solta",
				variantCount: 0,
				variants: [
					{
						archived: true,
						code: "BL-OLD",
						id: antiga,
						name: "Antiga",
						priceCents: "9990",
					},
				],
			},
		]);
	});

	test("takes an underscore literally in codes and service names", async () => {
		const { owner } = await ownerSetup();
		const exact = await createProduct(owner, "Vestido Um");
		await createProductVariant(owner, exact, {
			code: "VM_M",
			name: "M",
			priceCents: "1000",
		});
		const other = await createProduct(owner, "Vestido Dois");
		await createProductVariant(owner, other, {
			code: "VMXM",
			name: "M",
			priceCents: "1000",
		});
		const linho = await createMaterial(owner, "Linho Um");
		await createMaterialVariant(owner, linho, { code: "LN_1", name: "Cru" });
		const linhoDois = await createMaterial(owner, "Linho Dois");
		await createMaterialVariant(owner, linhoDois, {
			code: "LNX1",
			name: "Cru",
		});
		const barra = await createService(owner, { name: "Barra_A" });
		await createService(owner, { name: "BarraXA" });
		const ids = async (query: string) => {
			const result = await owner.search.global({ query });
			return [
				result.products.items.map((item) => item.id),
				result.materials.items.map((item) => item.id),
				result.services.items.map((item) => item.id),
			];
		};
		expect(await ids("vm_m")).toEqual([[exact], [], []]);
		expect(await ids("ln_1")).toEqual([[], [linho], []]);
		expect(await ids("barra_a")).toEqual([[], [], [barra]]);
	});

	test("shows the secondary phone and finds a client by it", async () => {
		const { owner } = await ownerSetup();
		const clientId = crypto.randomUUID();
		await owner.clients.create({
			clientId,
			kind: "person",
			name: "Dora Lins",
			opId: newOpId(),
			secondaryPhone: "(81) 99888-7766",
		});
		expect(
			(await owner.search.global({ query: "99888" })).clients.items
		).toEqual([
			{
				archived: false,
				email: null,
				id: clientId,
				kind: "person",
				name: "Dora Lins",
				phone: null,
				secondaryPhone: "81998887766",
			},
		]);
	});
});

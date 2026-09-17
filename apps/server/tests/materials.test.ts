import { afterEach, describe, expect, test } from "bun:test";
import { maxExactInteger as columnCeiling } from "@costura-pro/db/columns";
import { baseUnitValues } from "@costura-pro/db/schema/materials";
import { maxExactInteger } from "@costura-pro/domain/quantity";
import { baseUnitCodes } from "@costura-pro/domain/unit";

import {
	completeWizard,
	manualClock,
	newOpId,
	rpc,
	type ServerOptions,
	startTestServer,
	type TestServer,
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

function createMaterial(owner: Owner, overrides: Record<string, unknown> = {}) {
	return owner.materials.create({
		category: "Tecido",
		materialId: crypto.randomUUID(),
		name: "Gorgurão",
		notes: null,
		opId: newOpId(),
		...overrides,
	});
}

function hash(seed: string) {
	return seed.repeat(64).slice(0, 64);
}

function createVariant(
	owner: Owner,
	materialId: string,
	overrides: Record<string, unknown> = {}
) {
	return owner.materialVariants.create({
		baseUnit: "m",
		code: "GR-AZ",
		displayPrecision: 2,
		materialId,
		minQuantityMicros: "1500000",
		name: "Azul marinho",
		opId: newOpId(),
		packaging: { label: "Rolo", quantityMicros: "50000000" },
		photo: { photoHash: hash("a"), thumbnailHash: hash("b") },
		referenceCostCents: "1250",
		targetQuantityMicros: "10000000",
		variantId: crypto.randomUUID(),
		...overrides,
	});
}

describe("materials", () => {
	test("keeps the base unit list and the ceiling of the database equal to the domain", () => {
		expect([...baseUnitValues]).toEqual([...baseUnitCodes]);
		expect(columnCeiling).toBe(maxExactInteger);
	});

	test("creates, reads and edits a material", async () => {
		const { owner } = await ownerSetup({ now: manualClock().now });
		const created = await createMaterial(owner, {
			materialId: "00000000-0000-4000-8000-000000000001",
		});
		expect(created).toEqual({
			id: "00000000-0000-4000-8000-000000000001",
			version: 1,
		});
		const { material } = await owner.materials.get({
			materialId: created.id,
		});
		expect(material).toMatchObject({
			archivedAt: null,
			category: "Tecido",
			id: created.id,
			name: "Gorgurão",
			notes: null,
			version: 1,
		});
		expect(typeof material.updatedAt).toBe("string");
		expect(
			await owner.materials.update({
				baseVersion: 1,
				materialId: created.id,
				opId: newOpId(),
				patch: { category: null, name: "Gorgurão premium", notes: "Rolo 50 m" },
			})
		).toEqual({ version: 2 });
		const edited = await owner.materials.get({ materialId: created.id });
		expect(edited.material).toMatchObject({
			category: null,
			name: "Gorgurão premium",
			notes: "Rolo 50 m",
			version: 2,
		});
	});

	test("archives without effect twice and unarchives", async () => {
		const { owner, server } = await ownerSetup();
		const { id } = await createMaterial(owner);
		const changes = () =>
			server
				.native()
				.query<{ total: number }, []>(
					"SELECT count(*) AS total FROM change_log WHERE aggregate_type = 'material'"
				)
				.get()?.total ?? 0;
		expect(
			await owner.materials.archive({
				baseVersion: 1,
				materialId: id,
				opId: newOpId(),
			})
		).toEqual({ version: 2 });
		const after = changes();
		expect(
			await owner.materials.archive({
				baseVersion: 2,
				materialId: id,
				opId: newOpId(),
			})
		).toEqual({ version: 2 });
		expect(changes()).toBe(after);
		expect(
			await owner.materials.unarchive({
				baseVersion: 2,
				materialId: id,
				opId: newOpId(),
			})
		).toEqual({ version: 3 });
	});

	test("creates a variant with money and quantity as integer strings", async () => {
		const { owner } = await ownerSetup();
		const { id: materialId } = await createMaterial(owner);
		const created = await createVariant(owner, materialId, {
			variantId: "00000000-0000-4000-8000-0000000000a1",
		});
		expect(created).toEqual({
			id: "00000000-0000-4000-8000-0000000000a1",
			version: 1,
		});
		const { variants } = await owner.materials.get({ materialId });
		expect(variants).toHaveLength(1);
		expect(variants[0]).toMatchObject({
			archivedAt: null,
			baseUnit: "m",
			code: "GR-AZ",
			displayPrecision: 2,
			id: created.id,
			materialId,
			minQuantityMicros: "1500000",
			name: "Azul marinho",
			packaging: { label: "Rolo", quantityMicros: "50000000" },
			photo: { photoHash: hash("a"), thumbnailHash: hash("b") },
			referenceCostCents: "1250",
			targetQuantityMicros: "10000000",
			version: 1,
		});
	});

	test("canonicalizes an integer with leading zeros", async () => {
		const { owner } = await ownerSetup();
		const { id: materialId } = await createMaterial(owner);
		await createVariant(owner, materialId, {
			minQuantityMicros: "0001500000",
			referenceCostCents: "0012",
		});
		const { variants } = await owner.materials.get({ materialId });
		expect(variants[0]).toMatchObject({
			minQuantityMicros: "1500000",
			referenceCostCents: "12",
		});
	});

	test("edits the variant, clears optional values and refuses the base unit", async () => {
		const { owner } = await ownerSetup();
		const { id: materialId } = await createMaterial(owner);
		const { id: variantId } = await createVariant(owner, materialId);
		expect(
			await owner.materialVariants.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: {
					displayPrecision: 1,
					minQuantityMicros: null,
					packaging: null,
					referenceCostCents: "990",
				},
				variantId,
			})
		).toEqual({ version: 2 });
		const { variants } = await owner.materials.get({ materialId });
		expect(variants[0]).toMatchObject({
			baseUnit: "m",
			displayPrecision: 1,
			minQuantityMicros: null,
			packaging: null,
			referenceCostCents: "990",
			version: 2,
		});
		await expect(
			owner.materialVariants.update({
				baseVersion: 2,
				opId: newOpId(),
				patch: {},
				variantId,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("the direct procedure refuses the base unit in the patch", async () => {
		const { owner } = await ownerSetup();
		const { id: materialId } = await createMaterial(owner);
		const { id: variantId } = await createVariant(owner, materialId);
		const loose = owner.materialVariants.update as unknown as (input: {
			baseVersion: number;
			opId: string;
			patch: Record<string, unknown>;
			variantId: string;
		}) => Promise<{ version: number }>;
		await expect(
			loose({
				baseVersion: 1,
				opId: newOpId(),
				patch: { baseUnit: "cm" },
				variantId,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(
			await loose({
				baseVersion: 1,
				opId: newOpId(),
				patch: { baseUnit: "cm", name: "Azul royal" },
				variantId,
			})
		).toEqual({ version: 2 });
		const { variants } = await owner.materials.get({ materialId });
		expect(variants[0]).toMatchObject({
			baseUnit: "m",
			name: "Azul royal",
			version: 2,
		});
	});

	test("the direct procedure refuses lot tracking in the patch", async () => {
		const { owner } = await ownerSetup();
		const { id: materialId } = await createMaterial(owner);
		const { id: variantId } = await createVariant(owner, materialId, {
			tracksLots: true,
		});
		const loose = owner.materialVariants.update as unknown as (input: {
			baseVersion: number;
			opId: string;
			patch: Record<string, unknown>;
			variantId: string;
		}) => Promise<{ version: number }>;
		await expect(
			loose({
				baseVersion: 1,
				opId: newOpId(),
				patch: { tracksLots: false },
				variantId,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(
			await loose({
				baseVersion: 1,
				opId: newOpId(),
				patch: { name: "Azul royal", tracksLots: false },
				variantId,
			})
		).toEqual({ version: 2 });
		const { variants } = await owner.materials.get({ materialId });
		expect(variants[0]).toMatchObject({
			name: "Azul royal",
			tracksLots: true,
			version: 2,
		});
	});

	test("repeats by opId and refuses a stale version and a repeated id", async () => {
		const { owner } = await ownerSetup();
		const { id: materialId } = await createMaterial(owner);
		const variantId = crypto.randomUUID();
		const opId = newOpId();
		const first = await createVariant(owner, materialId, { opId, variantId });
		expect(await createVariant(owner, materialId, { opId, variantId })).toEqual(
			first
		);
		await expect(
			createVariant(owner, materialId, { variantId })
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		await owner.materialVariants.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: { name: "Azul royal" },
			variantId,
		});
		await expect(
			owner.materialVariants.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: { name: "Azul bebê" },
				variantId,
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: { currentVersion: 2 },
			message: "Versão desatualizada",
		});
	});

	test("refuses a missing material, a missing variant and invalid values", async () => {
		const { owner } = await ownerSetup();
		const { id: materialId } = await createMaterial(owner);
		await expect(
			createVariant(owner, crypto.randomUUID())
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Material não encontrado",
		});
		await expect(
			owner.materials.get({ materialId: crypto.randomUUID() })
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Material não encontrado",
		});
		await expect(
			owner.materialVariants.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: { name: "Cru" },
				variantId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Variante não encontrada",
		});
		await expect(
			createVariant(owner, materialId, { baseUnit: "rolo" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			createVariant(owner, materialId, { displayPrecision: 7 })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			createVariant(owner, materialId, {
				referenceCostCents: (maxExactInteger + 1n).toString(),
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			createVariant(owner, materialId, { referenceCostCents: "12,50" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			createVariant(owner, materialId, {
				packaging: { label: "Rolo", quantityMicros: null },
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			createVariant(owner, materialId, { name: "" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("lists with search over material and variant, filter and variant count", async () => {
		const { owner } = await ownerSetup();
		const { id: fabric } = await createMaterial(owner);
		const { id: thread } = await createMaterial(owner, {
			category: "Linha",
			name: "Linha de algodão",
		});
		await createMaterial(owner, { category: null, name: "Retalho antigo" });
		const { id: variantId } = await createVariant(owner, fabric);
		await createVariant(owner, fabric, {
			code: "GR-VD",
			name: "Verde musgo",
			variantId: crypto.randomUUID(),
		});
		await createVariant(owner, thread, {
			baseUnit: "un",
			code: "LN-100",
			displayPrecision: 0,
			name: "Branca 100",
			variantId: crypto.randomUUID(),
		});
		const all = await owner.materials.list({});
		expect(all.items.map((item) => item.name)).toEqual([
			"Gorgurão",
			"Linha de algodão",
			"Retalho antigo",
		]);
		expect(all.items[0]).toMatchObject({ variantCount: 2, version: 1 });
		expect(all.nextOffset).toBeNull();
		expect(
			(await owner.materials.list({ query: "gorgurao" })).items.map(
				(item) => item.id
			)
		).toEqual([fabric]);
		expect(
			(await owner.materials.list({ query: "musgo" })).items.map(
				(item) => item.id
			)
		).toEqual([fabric]);
		expect(
			(await owner.materials.list({ query: "ln-100" })).items.map(
				(item) => item.id
			)
		).toEqual([thread]);
		expect(
			(await owner.materials.list({ category: "Linha" })).items.map(
				(item) => item.id
			)
		).toEqual([thread]);
		expect(
			(await owner.materials.list({ category: "" })).items.map(
				(item) => item.name
			)
		).toEqual(["Retalho antigo"]);
		await owner.materialVariants.archive({
			baseVersion: 1,
			opId: newOpId(),
			variantId,
		});
		expect(
			(await owner.materials.list({ query: "gorgurao" })).items[0]
		).toMatchObject({ variantCount: 1 });
		const { variants } = await owner.materials.get({ materialId: fabric });
		expect(variants).toHaveLength(2);
		await owner.materials.archive({
			baseVersion: 1,
			materialId: thread,
			opId: newOpId(),
		});
		expect(
			(await owner.materials.list({})).items.map((item) => item.id)
		).not.toContain(thread);
		expect(
			(await owner.materials.list({ archived: true })).items.map(
				(item) => item.id
			)
		).toEqual([thread]);
	});

	test("lists categories and finds variants by code", async () => {
		const { owner } = await ownerSetup();
		const { id: fabric } = await createMaterial(owner);
		const { id: thread } = await createMaterial(owner, {
			category: "Linha",
			name: "Linha de algodão",
		});
		await createMaterial(owner, { category: null, name: "Retalho antigo" });
		expect(await owner.materials.categories({})).toEqual({
			categories: ["Linha", "Tecido"],
		});
		const variant = await createVariant(owner, fabric);
		await createVariant(owner, thread, {
			code: "gr-az",
			name: "Branca 100",
			variantId: crypto.randomUUID(),
		});
		const found = await owner.materialVariants.byCode({ code: "GR-AZ" });
		expect(found.items).toHaveLength(2);
		expect(found.items.map((item) => item.materialName).sort()).toEqual([
			"Gorgurão",
			"Linha de algodão",
		]);
		expect(found.items.find((item) => item.id === variant.id)).toMatchObject({
			code: "GR-AZ",
			materialId: fabric,
		});
		expect(
			(await owner.materialVariants.byCode({ code: "GR-VD" })).items
		).toEqual([]);
	});
});

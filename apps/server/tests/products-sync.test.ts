import { afterEach, describe, expect, test } from "bun:test";

import { newOpId, type SyncSetup, syncSetup, type TestServer } from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

function envelope(
	setup: SyncSetup,
	input: {
		aggregateId: string;
		aggregateType: "product" | "productVariant";
		baseVersion: number | null;
		command: string;
		payload: unknown;
	}
) {
	return {
		...input,
		deviceId: setup.device.id,
		epoch: setup.epoch,
		occurredAt: "2026-09-23T12:00:00.000Z",
		opId: newOpId(),
	};
}

const hash = (seed: string) => seed.repeat(64).slice(0, 64);

const fabric = {
	id: crypto.randomUUID(),
	kind: "material" as const,
	loss: { basisPoints: 1000, kind: "percent" as const },
	materialVariantId: crypto.randomUUID(),
	note: null,
	quantityMicros: "1200000",
};

const embroidery = {
	count: 2,
	id: crypto.randomUUID(),
	kind: "service" as const,
	note: "Bordado da gola",
	serviceId: crypto.randomUUID(),
};

const photo = {
	caption: "Frente",
	photoHash: hash("a"),
	thumbnailHash: hash("b"),
};

describe("product sync", () => {
	test("creates and edits a product over push and reads both versions on pull", async () => {
		const setup = await syncSetup(servers);
		const productId = crypto.randomUUID();
		const create = envelope(setup, {
			aggregateId: productId,
			aggregateType: "product",
			baseVersion: null,
			command: "product.create",
			payload: { name: "Vestido Midi", photos: [photo], sheet: [fabric] },
		});
		const created = await setup.sync.sync.push({ operations: [create] });
		expect(created.accepted).toEqual([{ newVersion: 1, opId: create.opId }]);
		const edit = envelope(setup, {
			aggregateId: productId,
			aggregateType: "product",
			baseVersion: 1,
			command: "product.update",
			payload: { sheet: [fabric, embroidery] },
		});
		const invalid = [
			{ sheet: [fabric, { ...embroidery, id: fabric.id }] },
			{ sheet: [{ ...fabric, loss: { basisPoints: 0, kind: "percent" } }] },
			{
				sheet: [{ ...fabric, loss: { basisPoints: 10_000, kind: "percent" } }],
			},
			{ sheet: [{ ...fabric, quantityMicros: "0" }] },
			{ sheet: [{ ...embroidery, count: 100 }] },
			{ sheet: [fabric, null] },
			{ photos: [photo, photo] },
			{},
		].map((payload) =>
			envelope(setup, {
				aggregateId: productId,
				aggregateType: "product",
				baseVersion: 2,
				command: "product.update",
				payload,
			})
		);
		const pushed = await setup.sync.sync.push({
			operations: [edit, ...invalid],
		});
		expect(pushed.accepted).toEqual([{ newVersion: 2, opId: edit.opId }]);
		expect(pushed.quarantined).toEqual(
			invalid.map((operation) => ({
				opId: operation.opId,
				reason: "invalidPayload",
			}))
		);
		const { changes } = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		const productChanges = changes.filter(
			(change) => change.aggregateType === "product"
		);
		expect(productChanges.map((change) => change.version)).toEqual([1, 2]);
		expect(productChanges[0]?.data).toMatchObject({
			photos: [photo],
			sheet: [fabric],
			version: 1,
		});
		expect(productChanges.at(-1)?.data).toEqual({
			archivedAt: null,
			category: null,
			createdAt: expect.any(String),
			id: productId,
			name: "Vestido Midi",
			notes: null,
			photos: [photo],
			sheet: [fabric, embroidery],
			targetMarginBasisPoints: null,
			version: 2,
		});
	});

	test("creates a variant over push and refuses a missing product and changes out of shape", async () => {
		const setup = await syncSetup(servers);
		const { id: productId } = await setup.local.products.create({
			name: "Vestido Midi",
			opId: newOpId(),
			productId: crypto.randomUUID(),
			sheet: [fabric],
		});
		const variantId = crypto.randomUUID();
		const orphan = envelope(setup, {
			aggregateId: crypto.randomUUID(),
			aggregateType: "productVariant",
			baseVersion: null,
			command: "productVariant.create",
			payload: {
				name: "P",
				priceCents: "17000",
				productId: crypto.randomUUID(),
			},
		});
		const create = envelope(setup, {
			aggregateId: variantId,
			aggregateType: "productVariant",
			baseVersion: null,
			command: "productVariant.create",
			payload: {
				code: "VM-P",
				name: "P Azul",
				priceCents: "17000",
				productId,
				sheetChanges: [{ itemId: fabric.id, kind: "remove" }],
			},
		});
		const invalid = [
			{
				sheetChanges: [
					{ item: fabric, kind: "replace" },
					{ itemId: fabric.id, kind: "remove" },
				],
			},
			{ priceCents: "12,50" },
			{ sheetChanges: [null] },
		].map((payload) =>
			envelope(setup, {
				aggregateId: variantId,
				aggregateType: "productVariant",
				baseVersion: 1,
				command: "productVariant.update",
				payload,
			})
		);
		const edit = envelope(setup, {
			aggregateId: variantId,
			aggregateType: "productVariant",
			baseVersion: 1,
			command: "productVariant.update",
			payload: { name: "P Azul marinho", priceCents: "18000" },
		});
		const pushed = await setup.sync.sync.push({
			operations: [orphan, create, ...invalid, edit],
		});
		expect(pushed.accepted).toEqual([
			{ newVersion: 1, opId: create.opId },
			{ newVersion: 2, opId: edit.opId },
		]);
		expect(pushed.quarantined).toEqual([
			{ opId: orphan.opId, reason: "aggregateNotFound" },
			...invalid.map((operation) => ({
				opId: operation.opId,
				reason: "invalidPayload" as const,
			})),
		]);
		const { changes } = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		const variantChanges = changes.filter(
			(change) => change.aggregateType === "productVariant"
		);
		expect(variantChanges.map((change) => change.version)).toEqual([1, 2]);
		expect(variantChanges[0]?.data).toEqual({
			archivedAt: null,
			code: "VM-P",
			coverPhotoHash: null,
			createdAt: expect.any(String),
			id: variantId,
			name: "P Azul",
			priceCents: "17000",
			productId,
			sheetChanges: [{ itemId: fabric.id, kind: "remove" }],
			version: 1,
		});
		expect(variantChanges.at(-1)?.data).toMatchObject({
			name: "P Azul marinho",
			priceCents: "18000",
			sheetChanges: [{ itemId: fabric.id, kind: "remove" }],
			version: 2,
		});
	});

	test("resolves a stale sheet edit with keepLocal and keeps the name changed on the PC", async () => {
		const setup = await syncSetup(servers);
		const { id } = await setup.local.products.create({
			name: "Vestido Midi",
			opId: newOpId(),
			productId: crypto.randomUUID(),
			sheet: [fabric],
		});
		await setup.local.products.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: { name: "Vestido Midi Linho" },
			productId: id,
		});
		const stale = envelope(setup, {
			aggregateId: id,
			aggregateType: "product",
			baseVersion: 1,
			command: "product.update",
			payload: { sheet: [fabric, embroidery] },
		});
		const pushed = await setup.sync.sync.push({ operations: [stale] });
		expect(pushed.conflicts).toHaveLength(1);
		const resolved = await setup.local.sync.resolve({
			choice: "keepLocal",
			conflictId: pushed.conflicts[0]?.conflictId ?? "",
			opId: newOpId(),
			reason: "A ficha do celular vale",
		});
		expect(resolved.version).toBe(3);
		expect(
			(await setup.local.products.get({ productId: id })).product
		).toMatchObject({
			name: "Vestido Midi Linho",
			sheet: [fabric, embroidery],
			version: 3,
		});
	});

	test("resolves a stale variant edit with keepLocal over the changes and clears the code and the cover", async () => {
		const setup = await syncSetup(servers);
		const { id: productId } = await setup.local.products.create({
			name: "Vestido Midi",
			opId: newOpId(),
			photos: [photo],
			productId: crypto.randomUUID(),
			sheet: [fabric, embroidery],
		});
		const { id: variantId } = await setup.local.productVariants.create({
			code: "VM-P",
			coverPhotoHash: photo.photoHash,
			name: "P Azul",
			opId: newOpId(),
			priceCents: "17000",
			productId,
			variantId: crypto.randomUUID(),
		});
		await setup.local.productVariants.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: { priceCents: "17500" },
			variantId,
		});
		const stale = envelope(setup, {
			aggregateId: variantId,
			aggregateType: "productVariant",
			baseVersion: 1,
			command: "productVariant.update",
			payload: {
				code: null,
				coverPhotoHash: null,
				sheetChanges: [{ itemId: embroidery.id, kind: "remove" }],
			},
		});
		const pushed = await setup.sync.sync.push({ operations: [stale] });
		expect(pushed.conflicts).toHaveLength(1);
		const resolved = await setup.local.sync.resolve({
			choice: "keepLocal",
			conflictId: pushed.conflicts[0]?.conflictId ?? "",
			opId: newOpId(),
			reason: "O ajuste do celular vale",
		});
		expect(resolved.version).toBe(3);
		expect(
			(await setup.local.products.get({ productId })).variants
		).toMatchObject([
			{
				code: null,
				coverPhotoHash: null,
				priceCents: "17500",
				sheetChanges: [{ itemId: embroidery.id, kind: "remove" }],
				version: 3,
			},
		]);
	});
});

import { afterEach, describe, expect, test } from "bun:test";

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

async function createClient(owner: Owner, name = "Maria Beatriz Alencar") {
	const clientId = crypto.randomUUID();
	await owner.clients.create({
		clientId,
		kind: "person",
		name,
		opId: newOpId(),
	});
	return clientId;
}

function hash(seed: string) {
	return seed.repeat(64).slice(0, 64);
}

function photo(seed: string, caption: string | null = null) {
	return { caption, photoHash: hash(seed), thumbnailHash: hash(`${seed}f`) };
}

function receive(
	owner: Owner,
	clientId: string,
	overrides: Record<string, unknown> = {}
) {
	return owner.receivedItems.create({
		accessories: "Cinto de tecido",
		clientId,
		condition: "good",
		description: "Vestido longo verde",
		expectedReturnOn: "2026-09-26",
		notes: null,
		opId: newOpId(),
		photos: [photo("a", "frente")],
		quantity: 1,
		receivedItemId: crypto.randomUUID(),
		receivedOn: "2026-09-17",
		...overrides,
	});
}

describe("received items", () => {
	test("receives, lists in total order and reads the snapshot", async () => {
		const { owner } = await ownerSetup({ now: manualClock().now });
		const clientId = await createClient(owner);
		const first = await receive(owner, clientId, {
			receivedItemId: "00000000-0000-4000-8000-000000000001",
		});
		const second = await receive(owner, clientId, {
			description: "Blazer de linho",
			receivedItemId: "00000000-0000-4000-8000-000000000002",
		});
		const older = await receive(owner, clientId, {
			description: "Saia plissada",
			receivedOn: "2026-09-01",
		});
		expect(first).toEqual({
			id: "00000000-0000-4000-8000-000000000001",
			version: 1,
		});
		const { items } = await owner.receivedItems.list({ clientId });
		expect(items.map((item) => item.id)).toEqual([
			second.id,
			first.id,
			older.id,
		]);
		expect(items[1]).toMatchObject({
			accessories: "Cinto de tecido",
			archivedAt: null,
			clientId,
			condition: "good",
			description: "Vestido longo verde",
			expectedReturnOn: "2026-09-26",
			notes: null,
			photos: [photo("a", "frente")],
			quantity: 1,
			receivedOn: "2026-09-17",
			returnedOn: null,
			version: 1,
		});
		expect(typeof items[1]?.updatedAt).toBe("string");
	});

	test("corrects, registers and undoes the return, archives without effect twice", async () => {
		const { owner } = await ownerSetup();
		const clientId = await createClient(owner);
		const { id } = await receive(owner, clientId);
		const corrected = await owner.receivedItems.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: {
				condition: "damaged",
				notes: "Forro descosturado",
				photos: [photo("a", null), photo("b", "barra")],
				quantity: 2,
			},
			receivedItemId: id,
		});
		expect(corrected).toEqual({ version: 2 });
		expect(
			await owner.receivedItems.update({
				baseVersion: 2,
				opId: newOpId(),
				patch: { returnedOn: "2026-09-20" },
				receivedItemId: id,
			})
		).toEqual({ version: 3 });
		await owner.receivedItems.update({
			baseVersion: 3,
			opId: newOpId(),
			patch: { returnedOn: null },
			receivedItemId: id,
		});
		const archive = { baseVersion: 4, opId: newOpId(), receivedItemId: id };
		expect(await owner.receivedItems.archive(archive)).toEqual({ version: 5 });
		expect(
			await owner.receivedItems.archive({
				...archive,
				baseVersion: 5,
				opId: newOpId(),
			})
		).toEqual({ version: 5 });
		const [archived] = (await owner.receivedItems.list({ clientId })).items;
		expect(archived).toMatchObject({
			condition: "damaged",
			notes: "Forro descosturado",
			photos: [photo("a", null), photo("b", "barra")],
			quantity: 2,
			returnedOn: null,
			version: 5,
		});
		expect(archived?.archivedAt).not.toBeNull();
		const unarchive = { baseVersion: 5, opId: newOpId(), receivedItemId: id };
		expect(await owner.receivedItems.unarchive(unarchive)).toEqual({
			version: 6,
		});
		expect(
			await owner.receivedItems.unarchive({
				...unarchive,
				baseVersion: 6,
				opId: newOpId(),
			})
		).toEqual({ version: 6 });
		expect(
			await owner.receivedItems.update({
				baseVersion: 6,
				opId: newOpId(),
				patch: { expectedReturnOn: null },
				receivedItemId: id,
			})
		).toEqual({ version: 7 });
		const [item] = (await owner.receivedItems.list({ clientId })).items;
		expect(item).toMatchObject({
			archivedAt: null,
			expectedReturnOn: null,
			version: 7,
		});
	});

	test("repeats by opId, refuses a stale version, a repeated id and an empty patch", async () => {
		const { owner } = await ownerSetup();
		const clientId = await createClient(owner);
		const receivedItemId = crypto.randomUUID();
		const opId = newOpId();
		const first = await receive(owner, clientId, { opId, receivedItemId });
		expect(await receive(owner, clientId, { opId, receivedItemId })).toEqual(
			first
		);
		await expect(
			receive(owner, clientId, { receivedItemId })
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		await owner.receivedItems.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: { description: "Vestido longo verde-escuro" },
			receivedItemId,
		});
		await expect(
			owner.receivedItems.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: { quantity: 3 },
				receivedItemId,
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: { currentVersion: 2 },
			message: "Versão desatualizada",
		});
		await expect(
			owner.receivedItems.update({
				baseVersion: 2,
				opId: newOpId(),
				patch: {},
				receivedItemId,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("validates photos, caption and quantity", async () => {
		const { owner } = await ownerSetup();
		const clientId = await createClient(owner);
		const twelve = "0123456789ab".split("").map((seed) => photo(seed));
		await expect(
			receive(owner, clientId, { photos: [...twelve, photo("c")] })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect((await receive(owner, clientId, { photos: twelve })).version).toBe(
			1
		);
		await expect(
			receive(owner, clientId, { photos: [photo("d"), photo("d")] })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			receive(owner, clientId, { photos: [photo("e", "x".repeat(41))] })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			receive(owner, clientId, { quantity: 0 })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			receive(owner, clientId, { condition: "rasgada" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("answers the client and item messages and refuses an anonymized client", async () => {
		const { owner } = await ownerSetup();
		await expect(receive(owner, crypto.randomUUID())).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Cliente não encontrado",
		});
		await expect(
			owner.receivedItems.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: { quantity: 2 },
				receivedItemId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Peça recebida não encontrada",
		});
		await expect(
			owner.receivedItems.list({ clientId: crypto.randomUUID() })
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Cliente não encontrado",
		});
		const clientId = await createClient(owner);
		const { id } = await receive(owner, clientId);
		await owner.clients.anonymize({
			baseVersion: 1,
			clientId,
			opId: newOpId(),
		});
		await expect(receive(owner, clientId)).rejects.toMatchObject({
			code: "PRECONDITION_FAILED",
			message: "Cliente anonimizado",
		});
		await expect(
			owner.receivedItems.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: { quantity: 2 },
				receivedItemId: id,
			})
		).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
	});

	test("receives for an archived client", async () => {
		const { owner } = await ownerSetup();
		const clientId = await createClient(owner);
		await owner.clients.archive({ baseVersion: 1, clientId, opId: newOpId() });
		expect((await receive(owner, clientId)).version).toBe(1);
	});
});

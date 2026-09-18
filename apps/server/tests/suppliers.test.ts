import { afterEach, describe, expect, test } from "bun:test";

import {
	completeWizard,
	manualClock,
	newOpId,
	rpc,
	type ServerOptions,
	type SyncSetup,
	startTestServer,
	syncSetup,
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

function createSupplier(owner: Owner, overrides: Record<string, unknown> = {}) {
	return owner.suppliers.create({
		email: null,
		name: "Tecidos São José",
		notes: null,
		opId: newOpId(),
		phone: null,
		supplierId: crypto.randomUUID(),
		...overrides,
	});
}

function envelope(
	setup: SyncSetup,
	input: {
		aggregateId: string;
		baseVersion: number | null;
		command: string;
		payload: unknown;
	}
) {
	return {
		...input,
		aggregateType: "supplier",
		deviceId: setup.device.id,
		epoch: setup.epoch,
		occurredAt: "2026-09-17T12:00:00.000Z",
		opId: newOpId(),
	};
}

describe("suppliers", () => {
	test("creates, reads and edits a supplier with normalized contacts", async () => {
		const { owner } = await ownerSetup({ now: manualClock().now });
		const created = await createSupplier(owner, {
			email: "  vendas@tecidos.com ",
			phone: "+55 (11) 98765-4321",
			supplierId: "00000000-0000-4000-8000-000000000001",
		});
		expect(created).toEqual({
			id: "00000000-0000-4000-8000-000000000001",
			version: 1,
		});
		const { items } = await owner.suppliers.list({});
		expect(items).toEqual([
			{
				archivedAt: null,
				createdAt: "2026-09-16T12:00:00.000Z",
				email: "vendas@tecidos.com",
				id: created.id,
				name: "Tecidos São José",
				notes: null,
				phone: "11987654321",
				updatedAt: "2026-09-16T12:00:00.000Z",
				version: 1,
			},
		]);
		expect(
			await owner.suppliers.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: { name: "Tecidos Santa Rita", notes: "Entrega às terças" },
				supplierId: created.id,
			})
		).toEqual({ version: 2 });
		const edited = await owner.suppliers.list({});
		expect(edited.items[0]).toMatchObject({
			name: "Tecidos Santa Rita",
			notes: "Entrega às terças",
			phone: "11987654321",
			version: 2,
		});
	});

	test("refuses an invalid phone and an invalid e-mail", async () => {
		const { owner } = await ownerSetup();
		await expect(
			createSupplier(owner, { phone: "1234" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			createSupplier(owner, { email: "sem-arroba" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("finds a supplier without accents and by a piece of the phone", async () => {
		const { owner } = await ownerSetup();
		await createSupplier(owner, { phone: "11987654321" });
		await createSupplier(owner, { name: "Aviamentos Ltda" });
		const byName = await owner.suppliers.list({ query: "sao jose" });
		expect(byName.items.map((item) => item.name)).toEqual(["Tecidos São José"]);
		const byPhone = await owner.suppliers.list({ query: "98765-4321" });
		expect(byPhone.items.map((item) => item.name)).toEqual([
			"Tecidos São José",
		]);
		const escaped = await owner.suppliers.list({ query: "100%" });
		expect(escaped.items).toEqual([]);
	});

	test("archives, unarchives and filters the list", async () => {
		const { owner } = await ownerSetup();
		const { id } = await createSupplier(owner);
		expect(
			await owner.suppliers.archive({
				baseVersion: 1,
				opId: newOpId(),
				supplierId: id,
			})
		).toEqual({ version: 2 });
		expect((await owner.suppliers.list({})).items).toHaveLength(0);
		expect((await owner.suppliers.list({ archived: true })).items).toHaveLength(
			1
		);
		expect(
			await owner.suppliers.unarchive({
				baseVersion: 2,
				opId: newOpId(),
				supplierId: id,
			})
		).toEqual({ version: 3 });
	});

	test("repeats by opId and refuses a stale version, a repeated id and a missing supplier", async () => {
		const { owner } = await ownerSetup();
		const supplierId = crypto.randomUUID();
		const opId = newOpId();
		const first = await createSupplier(owner, { opId, supplierId });
		expect(await createSupplier(owner, { opId, supplierId })).toEqual(first);
		await expect(createSupplier(owner, { supplierId })).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		await expect(
			owner.suppliers.update({
				baseVersion: 7,
				opId: newOpId(),
				patch: { name: "Outro" },
				supplierId,
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Versão desatualizada",
		});
		await expect(
			owner.suppliers.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: { name: "Outro" },
				supplierId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Fornecedor não encontrado",
		});
	});
});

describe("supplier sync", () => {
	test("creates and edits a supplier over push and reads it back on pull", async () => {
		const setup = await syncSetup(servers);
		const supplierId = crypto.randomUUID();
		const create = envelope(setup, {
			aggregateId: supplierId,
			baseVersion: null,
			command: "supplier.create",
			payload: { name: "Tecidos São José", phone: "(11) 98765-4321" },
		});
		const created = await setup.sync.sync.push({ operations: [create] });
		expect(created.accepted).toEqual([{ newVersion: 1, opId: create.opId }]);
		const edit = envelope(setup, {
			aggregateId: supplierId,
			baseVersion: 1,
			command: "supplier.update",
			payload: { email: "vendas@tecidos.com" },
		});
		const invalid = envelope(setup, {
			aggregateId: supplierId,
			baseVersion: 2,
			command: "supplier.update",
			payload: { phone: "123" },
		});
		const pushed = await setup.sync.sync.push({ operations: [edit, invalid] });
		expect(pushed.accepted).toEqual([{ newVersion: 2, opId: edit.opId }]);
		expect(pushed.quarantined).toEqual([
			{ opId: invalid.opId, reason: "invalidPayload" },
		]);
		const { changes } = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		expect(
			changes.filter((change) => change.aggregateType === "supplier").at(-1)
				?.data
		).toEqual({
			archivedAt: null,
			createdAt: expect.any(String),
			email: "vendas@tecidos.com",
			id: supplierId,
			name: "Tecidos São José",
			notes: null,
			phone: "11987654321",
			version: 2,
		});
	});
});

describe("supplier options and conflicts", () => {
	test("lists every supplier for the selectors, archived ones marked", async () => {
		const { owner } = await ownerSetup();
		const kept = await createSupplier(owner, { name: "Tecidos São José" });
		const archived = await createSupplier(owner, { name: "Aviamentos Ltda" });
		await owner.suppliers.archive({
			baseVersion: 1,
			opId: newOpId(),
			supplierId: archived.id,
		});
		const { items } = await owner.suppliers.options();
		expect(items.map((item) => [item.id, item.archivedAt === null])).toEqual([
			[archived.id, false],
			[kept.id, true],
		]);
	});

	test("resolves a stale edit that clears the contacts with keepLocal", async () => {
		const setup = await syncSetup(servers);
		const { id } = await setup.local.suppliers.create({
			email: "vendas@tecidos.com",
			name: "Tecidos São José",
			notes: null,
			opId: newOpId(),
			phone: "11987654321",
			supplierId: crypto.randomUUID(),
		});
		await setup.local.suppliers.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: { notes: "Entrega às terças" },
			supplierId: id,
		});
		const stale = envelope(setup, {
			aggregateId: id,
			baseVersion: 1,
			command: "supplier.update",
			payload: { email: "", phone: null },
		});
		const pushed = await setup.sync.sync.push({ operations: [stale] });
		expect(pushed.conflicts).toHaveLength(1);
		const resolved = await setup.local.sync.resolve({
			choice: "keepLocal",
			conflictId: pushed.conflicts[0]?.conflictId ?? "",
			opId: newOpId(),
			reason: "O celular estava certo",
		});
		expect(resolved.version).toBe(3);
		const { items } = await setup.local.suppliers.list({});
		expect(items[0]).toMatchObject({
			email: null,
			notes: "Entrega às terças",
			phone: null,
		});
	});
});

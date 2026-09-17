import { afterEach, describe, expect, test } from "bun:test";

import {
	inSequence,
	newOpId,
	type SyncSetup,
	syncSetup,
	type TestServer,
} from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

type OperationInput = {
	aggregateId: string;
	aggregateType: string;
	baseVersion: number | null;
	command: string;
	payload: unknown;
};

function envelope(setup: SyncSetup, input: OperationInput) {
	return {
		...input,
		deviceId: setup.device.id,
		epoch: setup.epoch,
		occurredAt: "2026-09-17T12:00:00.000Z",
		opId: newOpId(),
	};
}

function hash(seed: string) {
	return seed.repeat(64).slice(0, 64);
}

async function pushedClient(setup: SyncSetup) {
	const clientId = crypto.randomUUID();
	await setup.sync.sync.push({
		operations: [
			envelope(setup, {
				aggregateId: clientId,
				aggregateType: "client",
				baseVersion: null,
				command: "client.create",
				payload: { kind: "person", name: "Maria Beatriz Alencar" },
			}),
		],
	});
	return clientId;
}

function itemPayload(
	clientId: string,
	overrides: Record<string, unknown> = {}
) {
	return {
		clientId,
		condition: "good",
		description: "Vestido longo verde",
		photos: [
			{ caption: "frente", photoHash: hash("a"), thumbnailHash: hash("b") },
		],
		quantity: 1,
		receivedOn: "2026-09-17",
		...overrides,
	};
}

function createItem(
	setup: SyncSetup,
	payload: unknown,
	id = crypto.randomUUID()
) {
	return envelope(setup, {
		aggregateId: id,
		aggregateType: "receivedItem",
		baseVersion: null,
		command: "receivedItem.create",
		payload,
	});
}

function updateItem(
	setup: SyncSetup,
	id: string,
	baseVersion: number,
	payload: unknown
) {
	return envelope(setup, {
		aggregateId: id,
		aggregateType: "receivedItem",
		baseVersion,
		command: "receivedItem.update",
		payload,
	});
}

function opHash(server: TestServer, opId: string) {
	return server
		.native()
		.query<{ op_hash: string }, [string]>(
			"SELECT op_hash FROM operation WHERE op_id = ?"
		)
		.get(opId)?.op_hash;
}

describe("received items over sync", () => {
	test("creates and updates by push and pulls the snapshot", async () => {
		const setup = await syncSetup(servers);
		const clientId = await pushedClient(setup);
		const id = crypto.randomUUID();
		const created = createItem(setup, itemPayload(clientId), id);
		const updated = updateItem(setup, id, 1, { returnedOn: "2026-09-20" });
		const result = await setup.sync.sync.push({
			operations: [created, updated],
		});
		expect(result.accepted).toEqual([
			{ newVersion: 1, opId: created.opId },
			{ newVersion: 2, opId: updated.opId },
		]);
		const pulled = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
			limit: 500,
		});
		const item = pulled.changes.filter(
			(change) => change.aggregateType === "receivedItem"
		);
		expect(item.map((change) => change.version)).toEqual([1, 2]);
		expect(item[1]?.data).toMatchObject({
			clientId,
			condition: "good",
			photos: [
				{ caption: "frente", photoHash: hash("a"), thumbnailHash: hash("b") },
			],
			quantity: 1,
			returnedOn: "2026-09-20",
		});
	});

	test("quarantines a missing client, an invalid payload, a malformed envelope and a swapped type with a redacted hash", async () => {
		const setup = await syncSetup(servers);
		const missing = createItem(setup, itemPayload(crypto.randomUUID()));
		const invalid = createItem(
			setup,
			itemPayload(crypto.randomUUID(), { quantity: 0 })
		);
		const malformed = {
			...updateItem(setup, crypto.randomUUID(), 1, {}),
			baseVersion: "um",
		};
		const swapped = {
			...createItem(setup, itemPayload(crypto.randomUUID())),
			aggregateType: "installation",
		};
		const result = await setup.sync.sync.push({
			operations: [missing, invalid, malformed, swapped],
		});
		expect(result.quarantined).toEqual([
			{ opId: missing.opId, reason: "aggregateNotFound" },
			{ opId: invalid.opId, reason: "invalidPayload" },
			{ opId: malformed.opId, reason: "invalidEnvelope" },
			{ opId: swapped.opId, reason: "unknownCommand" },
		]);
		for (const op of [missing, invalid, malformed, swapped]) {
			expect(opHash(setup.server, op.opId)).toBe("redacted");
		}
	});

	test("an anonymized client quarantines late creations and updates without a new conflict", async () => {
		const setup = await syncSetup(servers);
		const clientId = await pushedClient(setup);
		const id = crypto.randomUUID();
		await setup.sync.sync.push({
			operations: [createItem(setup, itemPayload(clientId), id)],
		});
		await setup.local.clients.anonymize({
			baseVersion: 1,
			clientId,
			opId: newOpId(),
		});
		const stale = updateItem(setup, id, 1, { notes: "Botão solto" });
		const late = createItem(setup, itemPayload(clientId));
		const result = await setup.sync.sync.push({ operations: [stale, late] });
		expect(result.quarantined).toEqual([
			{ opId: stale.opId, reason: "aggregateAnonymized" },
			{ opId: late.opId, reason: "aggregateAnonymized" },
		]);
		expect(
			setup.server
				.native()
				.query(
					"SELECT id FROM sync_conflict WHERE aggregate_type = 'receivedItem'"
				)
				.all()
		).toEqual([]);
		expect(opHash(setup.server, stale.opId)).toBe("redacted");
	});

	test("resolves conflicts by keepLocal with an emptied note and with photos", async () => {
		const setup = await syncSetup(servers);
		const clientId = await pushedClient(setup);
		const id = crypto.randomUUID();
		await setup.sync.sync.push({
			operations: [
				createItem(setup, itemPayload(clientId, { notes: "Forro" }), id),
			],
		});
		await setup.local.receivedItems.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: { quantity: 2 },
			receivedItemId: id,
		});
		const emptied = updateItem(setup, id, 1, { notes: "" });
		const photos = updateItem(setup, id, 1, {
			photos: [
				{ caption: null, photoHash: hash("c"), thumbnailHash: hash("d") },
			],
		});
		const pushed = await setup.sync.sync.push({
			operations: [emptied, photos],
		});
		expect(pushed.conflicts).toHaveLength(2);
		await inSequence(pushed.conflicts, (conflict) =>
			setup.sync.sync.resolve({
				choice: "keepLocal",
				conflictId: conflict.conflictId,
				opId: newOpId(),
				reason: "Vale o que foi feito no celular",
			})
		);
		const [item] = (await setup.local.receivedItems.list({ clientId })).items;
		expect(item).toMatchObject({
			notes: null,
			photos: [
				{ caption: null, photoHash: hash("c"), thumbnailHash: hash("d") },
			],
			quantity: 2,
		});
	});
});

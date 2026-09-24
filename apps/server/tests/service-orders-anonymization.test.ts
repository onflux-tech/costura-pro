import { afterEach, describe, expect, test } from "bun:test";

import {
	completeWizard,
	newOpId,
	rpc,
	startTestServer,
	type TestServer,
} from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

type Owner = ReturnType<typeof rpc>;

async function ownerSetup() {
	const server = await startTestServer();
	servers.push(server);
	const { cookie } = await completeWizard(server);
	return { owner: rpc(server, { cookie }), server };
}

async function clientWithQuote(
	owner: Owner,
	name: string,
	unitPriceCents = "4000"
) {
	const clientId = crypto.randomUUID();
	await owner.clients.create({
		clientId,
		kind: "person",
		name,
		opId: newOpId(),
	});
	const profileId = crypto.randomUUID();
	await owner.profiles.create({
		clientId,
		name,
		opId: newOpId(),
		profileId,
	});
	const quoteId = crypto.randomUUID();
	const content = {
		discount: null,
		leadTimeDays: null,
		lines: [
			{
				description: "Ajuste de barra",
				discount: null,
				id: crypto.randomUUID(),
				kind: "free" as const,
				note: "Barra italiana",
				quantity: 1,
				unitCostCents: "0",
				unitPriceCents,
			},
		],
		notes: "Entregar no sábado",
		validityDays: 15,
	};
	await owner.quotes.create({
		...content,
		clientId,
		createdOn: "2026-09-20",
		opId: newOpId(),
		quoteId,
	});
	const revisionId = crypto.randomUUID();
	await owner.quotes.emit({
		content,
		emittedOn: "2026-09-20",
		opId: newOpId(),
		quoteId,
		reason: null,
		revisionId,
	});
	return { clientId, quoteId, revisionId };
}

function snapshotOf(server: TestServer) {
	const read = (sql: string) => server.native().query(sql).all();
	return {
		changes: read("SELECT count(*) AS total FROM change_log"),
		clients: read(
			"SELECT id, name, notes, anonymized_at, archived_at, version FROM client ORDER BY id"
		),
		items: read("SELECT id, version FROM service_order_item ORDER BY id"),
		orders: read("SELECT id, version FROM service_order ORDER BY id"),
		profiles: read(
			"SELECT id, name, archived_at, version FROM client_profile ORDER BY id"
		),
		quotes: read(
			"SELECT id, notes, lines, archived_at, version FROM quote ORDER BY id"
		),
		revisions: read(
			"SELECT id, content, version FROM quote_revision ORDER BY id"
		),
	};
}

describe("anonymization with an open order", () => {
	test("refuses a client with an order and writes nothing", async () => {
		const { owner, server } = await ownerSetup();
		const { clientId, quoteId, revisionId } = await clientWithQuote(
			owner,
			"Maria Beatriz Alencar"
		);
		await owner.quotes.approve({
			approvalId: crypto.randomUUID(),
			approvedOn: "2026-09-22",
			channel: "inPerson",
			dueOn: null,
			items: [],
			note: null,
			opId: newOpId(),
			quoteId,
			receivableId: crypto.randomUUID(),
			revisionId,
			serviceOrderId: crypto.randomUUID(),
		});
		const before = snapshotOf(server);
		const input = { baseVersion: 1, clientId, opId: newOpId() };
		const refusal = {
			code: "PRECONDITION_FAILED",
			message: "Cliente com OS aberta ou valor a receber",
		};
		await expect(owner.clients.anonymize(input)).rejects.toMatchObject(refusal);
		expect(snapshotOf(server)).toEqual(before);
		await expect(owner.clients.anonymize(input)).rejects.toMatchObject(refusal);
		expect(snapshotOf(server)).toEqual(before);
	});

	test("refuses a client whose order has no charge", async () => {
		const { owner, server } = await ownerSetup();
		const { clientId, quoteId, revisionId } = await clientWithQuote(
			owner,
			"Luísa Prado",
			"0"
		);
		await owner.quotes.approve({
			approvalId: crypto.randomUUID(),
			approvedOn: "2026-09-22",
			channel: "inPerson",
			dueOn: null,
			items: [],
			note: null,
			opId: newOpId(),
			quoteId,
			receivableId: crypto.randomUUID(),
			revisionId,
			serviceOrderId: crypto.randomUUID(),
		});
		expect(
			server.native().query("SELECT count(*) AS total FROM receivable").get()
		).toEqual({ total: 0 });
		const before = snapshotOf(server);
		await expect(
			owner.clients.anonymize({ baseVersion: 1, clientId, opId: newOpId() })
		).rejects.toMatchObject({
			code: "PRECONDITION_FAILED",
			message: "Cliente com OS aberta ou valor a receber",
		});
		expect(snapshotOf(server)).toEqual(before);
	});

	test("still anonymizes a client without an order", async () => {
		const { owner } = await ownerSetup();
		const { clientId } = await clientWithQuote(owner, "Rita de Cássia");
		expect(
			await owner.clients.anonymize({
				baseVersion: 1,
				clientId,
				opId: newOpId(),
			})
		).toEqual({ version: 2 });
		const { client } = await owner.clients.get({ clientId });
		expect(client.anonymizedAt).not.toBeNull();
	});
});

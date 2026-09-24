import { afterEach, describe, expect, test } from "bun:test";

import {
	newOpId,
	type SyncSetup,
	syncSetup,
	type TestServer,
	times,
} from "./support";

const sha256Hex = /^[0-9a-f]{64}$/;

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

function envelope(
	setup: SyncSetup,
	input: {
		aggregateId: string;
		aggregateType: "quote" | "quoteRevision";
		baseVersion: number | null;
		command: string;
		payload: unknown;
	}
) {
	return {
		...input,
		deviceId: setup.device.id,
		epoch: setup.epoch,
		occurredAt: "2026-09-24T12:00:00.000Z",
		opId: newOpId(),
	};
}

function opHash(server: TestServer, opId: string) {
	return server
		.native()
		.query<{ op_hash: string }, [string]>(
			"SELECT op_hash FROM operation WHERE op_id = ?"
		)
		.get(opId)?.op_hash;
}

const serviceLine = {
	catalogPriceCents: "16000",
	discount: { basisPoints: 1000, kind: "percent" as const, reason: null },
	estimatedMinutes: 90,
	id: crypto.randomUUID(),
	kind: "service" as const,
	note: "Blazer de linho",
	outsourced: false,
	profileId: null,
	quantity: 1,
	receivedItemId: null,
	serviceId: crypto.randomUUID(),
	serviceName: "Ajuste de cava",
	serviceVersion: 1,
	unitCostCents: "6000",
	unitPriceCents: "16000",
};

const freeLine = {
	description: "Taxa de urgência",
	discount: null,
	id: crypto.randomUUID(),
	kind: "free" as const,
	note: null,
	quantity: 1,
	unitCostCents: "0",
	unitPriceCents: "5000",
};

const content = {
	discount: { amountCents: "4000", kind: "amount" as const, reason: null },
	leadTimeDays: 20,
	lines: [serviceLine, freeLine],
	notes: "Prova em 10 dias",
	validityDays: 15,
};

async function clientOf(setup: SyncSetup, name = "Maria Beatriz Alencar") {
	const clientId = crypto.randomUUID();
	await setup.local.clients.create({
		clientId,
		kind: "person",
		name,
		opId: newOpId(),
	});
	return clientId;
}

async function quoteOf(setup: SyncSetup, clientId: string) {
	const quoteId = crypto.randomUUID();
	await setup.local.quotes.create({
		clientId,
		createdOn: "2026-09-24",
		opId: newOpId(),
		quoteId,
	});
	return quoteId;
}

describe("quote sync", () => {
	test("creates and edits a quote over push and reads both versions on pull", async () => {
		const setup = await syncSetup(servers);
		const clientId = await clientOf(setup);
		const quoteId = crypto.randomUUID();
		const create = envelope(setup, {
			aggregateId: quoteId,
			aggregateType: "quote",
			baseVersion: null,
			command: "quote.create",
			payload: { clientId, createdOn: "2026-09-24" },
		});
		const edit = envelope(setup, {
			aggregateId: quoteId,
			aggregateType: "quote",
			baseVersion: 1,
			command: "quote.update",
			payload: content,
		});
		const pushed = await setup.sync.sync.push({ operations: [create, edit] });
		expect(pushed.accepted).toEqual([
			{ newVersion: 1, opId: create.opId },
			{ newVersion: 2, opId: edit.opId },
		]);
		const { changes } = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		const quoteChanges = changes.filter(
			(change) => change.aggregateType === "quote"
		);
		expect(quoteChanges.map((change) => change.version)).toEqual([1, 2]);
		expect(quoteChanges.at(-1)?.data).toEqual({
			...content,
			archivedAt: null,
			clientId,
			code: "ORC-2026-PC-0001",
			createdAt: expect.any(String),
			createdOn: "2026-09-24",
			id: quoteId,
			refusalReason: null,
			refusedOn: null,
			version: 2,
		});
	});

	test("emits a revision over push and pulls it with the frozen totals", async () => {
		const setup = await syncSetup(servers);
		const quoteId = await quoteOf(setup, await clientOf(setup));
		const revisionId = crypto.randomUUID();
		const emit = envelope(setup, {
			aggregateId: revisionId,
			aggregateType: "quoteRevision",
			baseVersion: null,
			command: "quote.emit",
			payload: { content, emittedOn: "2026-09-24", quoteId },
		});
		const pushed = await setup.sync.sync.push({ operations: [emit] });
		expect(pushed.accepted).toEqual([{ newVersion: 1, opId: emit.opId }]);
		const { changes } = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		const revision = changes.find(
			(change) => change.aggregateType === "quoteRevision"
		);
		expect(revision?.data).toMatchObject({
			costCents: "6000",
			discountCents: "5600",
			emittedOn: "2026-09-24",
			grossCents: "21000",
			id: revisionId,
			number: 1,
			quoteId,
			reason: null,
			targetMarginBasisPoints: 4000,
			totalCents: "15400",
			validUntil: "2026-10-09",
			version: 1,
		});
		expect(revision?.data).toMatchObject({
			content: {
				lines: [
					{ grossCents: "16000", id: serviceLine.id, totalCents: "14400" },
					{ grossCents: "5000", id: freeLine.id, totalCents: "5000" },
				],
			},
		});
	});

	test("quarantines content out of shape, missing parents and anonymized clients", async () => {
		const setup = await syncSetup(servers);
		const clientId = await clientOf(setup);
		const quoteId = await quoteOf(setup, clientId);
		const invalid = [
			{ ...content, lines: [serviceLine, serviceLine] },
			{
				...content,
				discount: { amountCents: "5001", kind: "amount", reason: null },
				lines: [freeLine],
			},
			{
				...content,
				discount: null,
				lines: [
					{ ...freeLine, quantity: 9999, unitPriceCents: "900719925474099" },
				],
			},
			{ ...content, lines: [serviceLine, null] },
			{
				...content,
				lines: [
					{
						...serviceLine,
						discount: { basisPoints: 0, kind: "percent", reason: null },
					},
				],
			},
			{ ...content, lines: times(101).map(() => freeLine) },
			{
				...content,
				discount: null,
				lines: [
					{
						...serviceLine,
						discount: { amountCents: "16001", kind: "amount", reason: null },
					},
					freeLine,
				],
			},
			{
				...content,
				discount: null,
				lines: [{ ...serviceLine, unitPriceCents: "12,50" }],
			},
		].map((payload) =>
			envelope(setup, {
				aggregateId: quoteId,
				aggregateType: "quote",
				baseVersion: 1,
				command: "quote.update",
				payload,
			})
		);
		const emptyEmit = envelope(setup, {
			aggregateId: crypto.randomUUID(),
			aggregateType: "quoteRevision",
			baseVersion: null,
			command: "quote.emit",
			payload: {
				content: { ...content, discount: null, lines: [] },
				emittedOn: "2026-09-24",
				quoteId,
			},
		});
		const orphanQuote = envelope(setup, {
			aggregateId: crypto.randomUUID(),
			aggregateType: "quote",
			baseVersion: null,
			command: "quote.create",
			payload: { clientId: crypto.randomUUID(), createdOn: "2026-09-24" },
		});
		const orphanRevision = envelope(setup, {
			aggregateId: crypto.randomUUID(),
			aggregateType: "quoteRevision",
			baseVersion: null,
			command: "quote.emit",
			payload: {
				content,
				emittedOn: "2026-09-24",
				quoteId: crypto.randomUUID(),
			},
		});
		const refused = await setup.sync.sync.push({
			operations: [...invalid, emptyEmit, orphanQuote, orphanRevision],
		});
		expect(refused.quarantined).toEqual([
			...[...invalid, emptyEmit].map((operation) => ({
				opId: operation.opId,
				reason: "invalidPayload" as const,
			})),
			{ opId: orphanQuote.opId, reason: "aggregateNotFound" },
			{ opId: orphanRevision.opId, reason: "aggregateNotFound" },
		]);
		await setup.local.clients.anonymize({
			baseVersion: 1,
			clientId,
			opId: newOpId(),
		});
		const late = [
			envelope(setup, {
				aggregateId: crypto.randomUUID(),
				aggregateType: "quote",
				baseVersion: null,
				command: "quote.create",
				payload: { clientId, createdOn: "2026-09-24" },
			}),
			envelope(setup, {
				aggregateId: quoteId,
				aggregateType: "quote",
				baseVersion: 2,
				command: "quote.update",
				payload: content,
			}),
			envelope(setup, {
				aggregateId: crypto.randomUUID(),
				aggregateType: "quoteRevision",
				baseVersion: null,
				command: "quote.emit",
				payload: { content, emittedOn: "2026-09-24", quoteId },
			}),
		];
		const anonymized = await setup.sync.sync.push({ operations: late });
		expect(anonymized.quarantined).toEqual(
			late.map((operation) => ({
				opId: operation.opId,
				reason: "aggregateAnonymized" as const,
			}))
		);
	});

	test("resolves a stale content edit with keepLocal", async () => {
		const setup = await syncSetup(servers);
		const quoteId = await quoteOf(setup, await clientOf(setup));
		await setup.local.quotes.update({
			baseVersion: 1,
			content: { ...content, notes: "Mudado no PC" },
			opId: newOpId(),
			quoteId,
		});
		const phone = { ...content, discount: null, lines: [freeLine] };
		const stale = envelope(setup, {
			aggregateId: quoteId,
			aggregateType: "quote",
			baseVersion: 1,
			command: "quote.update",
			payload: phone,
		});
		const pushed = await setup.sync.sync.push({ operations: [stale] });
		expect(pushed.conflicts).toHaveLength(1);
		const resolved = await setup.local.sync.resolve({
			choice: "keepLocal",
			conflictId: pushed.conflicts[0]?.conflictId ?? "",
			opId: newOpId(),
			reason: "O celular vale",
		});
		expect(resolved.version).toBe(3);
		expect((await setup.local.quotes.get({ quoteId })).quote).toMatchObject({
			discount: null,
			lines: [freeLine],
			notes: "Prova em 10 dias",
			version: 3,
		});
	});

	test("withholds the hash of a quarantined quote command and keeps it for an accepted one", async () => {
		const setup = await syncSetup(servers);
		const quoteId = await quoteOf(setup, await clientOf(setup));
		const bad = envelope(setup, {
			aggregateId: quoteId,
			aggregateType: "quote",
			baseVersion: 1,
			command: "quote.update",
			payload: { ...content, lines: [serviceLine, serviceLine] },
		});
		const good = envelope(setup, {
			aggregateId: quoteId,
			aggregateType: "quote",
			baseVersion: 1,
			command: "quote.update",
			payload: content,
		});
		await setup.sync.sync.push({ operations: [bad, good] });
		expect(opHash(setup.server, bad.opId)).toBe("redacted");
		expect(opHash(setup.server, good.opId)).not.toBe("redacted");
		expect(opHash(setup.server, good.opId)).toMatch(sha256Hex);
	});
});

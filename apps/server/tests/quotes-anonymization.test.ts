import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { newOpId, type SyncSetup, syncSetup, type TestServer } from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

function dump(server: TestServer): string {
	const native = server.native();
	return native
		.query<{ name: string }, []>(
			"SELECT name FROM sqlite_master WHERE type = 'table'"
		)
		.all()
		.map(({ name }) =>
			native
				.query<Record<string, unknown>, []>(`SELECT * FROM "${name}"`)
				.values()
				.flat()
				.map(String)
				.join(" ")
		)
		.join("\n");
}

function databaseBytes(server: TestServer) {
	return ["atelier.db", "atelier.db-wal"]
		.map((file) => join(server.directory, file))
		.filter((file) => existsSync(file))
		.map((file) => readFileSync(file).toString("latin1"))
		.join(" ");
}

const mariaTexts = [
	"Vestido da formatura da Maria",
	"Barra de 2 cm para a Maria",
	"Retalho da vovo da Maria",
	"Amiga da Maria",
	"Indicacao da Maria",
	"Maria prova no dia 10",
	"Maria achou caro",
	"Maria pediu revisao",
];

function piece(
	description: string,
	note: string | null,
	reason: string | null
) {
	return {
		components: [
			{
				count: 1,
				estimatedMinutes: null,
				id: crypto.randomUUID(),
				kind: "service" as const,
				outsourced: false,
				serviceId: crypto.randomUUID(),
				serviceName: "Costura sob medida",
				serviceVersion: 1,
				unitCostCents: "30000",
			},
		],
		description,
		discount:
			reason === null
				? null
				: { basisPoints: 1000, kind: "percent" as const, reason },
		id: crypto.randomUUID(),
		kind: "custom" as const,
		note,
		profileId: null,
		quantity: 1,
		source: null,
		unitPriceCents: "98000",
	};
}

function mariaContent() {
	return {
		discount: {
			amountCents: "1000",
			kind: "amount" as const,
			reason: "Indicacao da Maria",
		},
		leadTimeDays: 20,
		lines: [
			piece(
				"Vestido da formatura da Maria",
				"Barra de 2 cm para a Maria",
				"Amiga da Maria"
			),
			{
				description: "Retalho da vovo da Maria",
				discount: null,
				id: crypto.randomUUID(),
				kind: "free" as const,
				note: null,
				quantity: 1,
				unitCostCents: "0",
				unitPriceCents: "3000",
			},
		],
		notes: "Maria prova no dia 10",
		validityDays: 15,
	};
}

async function clientOf(setup: SyncSetup, name: string) {
	const clientId = crypto.randomUUID();
	await setup.local.clients.create({
		clientId,
		kind: "person",
		name,
		opId: newOpId(),
	});
	return clientId;
}

type Content = Parameters<SyncSetup["local"]["quotes"]["update"]>[0]["content"];

async function quoteWith(setup: SyncSetup, clientId: string, content: Content) {
	const quoteId = crypto.randomUUID();
	await setup.local.quotes.create({
		clientId,
		createdOn: "2026-09-24",
		opId: newOpId(),
		quoteId,
	});
	await setup.local.quotes.update({
		baseVersion: 1,
		content,
		opId: newOpId(),
		quoteId,
	});
	return quoteId;
}

describe("quotes anonymization", () => {
	test("a device that already pulled the emitted revision receives the redacted revision on the next pull", async () => {
		const setup = await syncSetup(servers);
		const { local } = setup;
		const maria = await clientOf(setup, "Maria Beatriz Alencar");
		const content = mariaContent();
		const quoteId = await quoteWith(setup, maria, content);
		const revision = await local.quotes.emit({
			content,
			emittedOn: "2026-09-24",
			opId: newOpId(),
			quoteId,
			reason: "Maria pediu revisao",
			revisionId: crypto.randomUUID(),
		});
		const seen = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		await local.clients.anonymize({
			baseVersion: 1,
			clientId: maria,
			opId: newOpId(),
		});
		const next = await setup.sync.sync.pull({
			cursor: seen.cursor,
			epoch: setup.epoch,
		});
		const redacted = next.changes.filter(
			(change) =>
				change.aggregateType === "quoteRevision" &&
				change.aggregateId === revision.id
		);
		expect(redacted.map((change) => change.version)).toEqual([2]);
		expect(redacted[0]?.data).toMatchObject({
			content: {
				lines: [
					{ description: "Item anonimizado", note: null },
					{ description: "Item anonimizado", note: null },
				],
				notes: null,
			},
			reason: null,
			version: 2,
		});
		const pulledText = JSON.stringify(next.changes);
		for (const text of mariaTexts) {
			expect(pulledText).not.toContain(text);
		}
		expect(
			(await local.quotes.get({ quoteId })).revisions.map((row) => row.version)
		).toEqual([2]);
	});

	test("redacts the texts of the drafts and of the emitted revisions, keeps the values and leaves another client untouched", async () => {
		const setup = await syncSetup(servers);
		const { local, server } = setup;
		const maria = await clientOf(setup, "Maria Beatriz Alencar");
		const tereza = await clientOf(setup, "Tereza Nogueira");
		const content = mariaContent();
		const quoteId = await quoteWith(setup, maria, content);
		const emit = (reason: string | null) =>
			local.quotes.emit({
				content,
				emittedOn: "2026-09-24",
				opId: newOpId(),
				quoteId,
				reason,
				revisionId: crypto.randomUUID(),
			});
		const first = await emit(null);
		const second = await emit("Maria pediu revisao");
		const refuse = (baseVersion: number) =>
			local.quotes.refuse({
				baseVersion,
				opId: newOpId(),
				quoteId,
				reason: "Maria achou caro",
				refusedOn: "2026-09-25",
			});
		await refuse(2);
		await local.quotes.unrefuse({ baseVersion: 3, opId: newOpId(), quoteId });
		await refuse(4);
		const teresaContent = {
			...mariaContent(),
			discount: null,
			lines: [piece("Vestido de festa sob medida", null, null)],
			notes: null,
		};
		const other = await quoteWith(setup, tereza, teresaContent);
		await local.quotes.emit({
			content: teresaContent,
			emittedOn: "2026-09-24",
			opId: newOpId(),
			quoteId: other,
			revisionId: crypto.randomUUID(),
		});
		const before = await local.quotes.get({ quoteId });
		await local.clients.anonymize({
			baseVersion: 1,
			clientId: maria,
			opId: newOpId(),
		});
		const after = await local.quotes.get({ quoteId });
		expect(after.client).toMatchObject({ anonymized: true });
		expect(after.quote).toMatchObject({
			code: before.quote.code,
			createdOn: "2026-09-24",
			discount: { amountCents: "1000", kind: "amount", reason: null },
			notes: null,
			refusalReason: null,
			refusedOn: "2026-09-25",
		});
		expect(after.quote.archivedAt).not.toBeNull();
		expect(after.quote.lines).toMatchObject([
			{
				description: "Item anonimizado",
				discount: { basisPoints: 1000, kind: "percent", reason: null },
				note: null,
				unitPriceCents: "98000",
			},
			{ description: "Item anonimizado", note: null, unitPriceCents: "3000" },
		]);
		expect(after.revisions.map((revision) => revision.id)).toEqual([
			second.id,
			first.id,
		]);
		for (const [index, revision] of after.revisions.entries()) {
			const original = before.revisions[index];
			expect(revision).toMatchObject({
				costCents: original?.costCents,
				discountCents: original?.discountCents,
				grossCents: original?.grossCents,
				number: original?.number,
				reason: null,
				totalCents: original?.totalCents,
			});
			expect(revision.content).toMatchObject({
				discount: { reason: null },
				lines: [
					{
						description: "Item anonimizado",
						discount: { reason: null },
						note: null,
						totalCents: original?.content.lines[0]?.totalCents,
					},
					{ description: "Item anonimizado", note: null },
				],
				notes: null,
			});
		}
		const redacted = server
			.native()
			.query<{ aggregate_id: string; aggregate_type: string }, []>(
				"SELECT aggregate_type, aggregate_id FROM redacted_aggregate WHERE aggregate_type IN ('quote', 'quoteRevision') ORDER BY aggregate_type, aggregate_id"
			)
			.all();
		expect(redacted).toEqual([
			{ aggregate_id: quoteId, aggregate_type: "quote" },
			...[first.id, second.id]
				.sort()
				.map((id) => ({ aggregate_id: id, aggregate_type: "quoteRevision" })),
		]);
		const everything = dump(server);
		const bytes = databaseBytes(server);
		for (const text of mariaTexts) {
			expect(everything).not.toContain(text);
			expect(bytes).not.toContain(text);
		}
		const untouched = await local.quotes.get({ quoteId: other });
		expect(untouched.quote.lines).toMatchObject([
			{ description: "Vestido de festa sob medida" },
		]);
		expect(untouched.revisions[0]?.content.lines).toMatchObject([
			{ description: "Vestido de festa sob medida" },
		]);
		expect(everything).toContain("Vestido de festa sob medida");
		expect(
			server
				.native()
				.query<{ details: string }, []>(
					"SELECT details FROM audit_event WHERE type = 'client.anonymized'"
				)
				.all()
				.map((row) => JSON.parse(row.details))
		).toEqual([
			{
				clientId: maria,
				measurements: 0,
				profiles: 0,
				quoteRevisions: 2,
				quotes: 1,
				receivedItems: 0,
			},
		]);
		const late = {
			aggregateId: quoteId,
			aggregateType: "quote",
			baseVersion: 1,
			command: "quote.update",
			deviceId: setup.device.id,
			epoch: setup.epoch,
			occurredAt: "2026-09-26T12:00:00.000Z",
			opId: newOpId(),
			payload: content,
		};
		const pushed = await setup.sync.sync.push({ operations: [late] });
		expect(pushed.quarantined).toEqual([
			{ opId: late.opId, reason: "aggregateAnonymized" },
		]);
		expect(
			server
				.native()
				.query<{ op_hash: string }, [string]>(
					"SELECT op_hash FROM operation WHERE op_id = ?"
				)
				.get(late.opId)?.op_hash
		).toBe("redacted");
	});
});

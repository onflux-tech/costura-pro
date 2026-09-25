import { afterEach, describe, expect, test } from "bun:test";
import { quoteLineOfText } from "@costura-pro/domain/quote";
import {
	isWorkLine,
	linePlannedMaterials,
} from "@costura-pro/domain/service-order";

import { newOpId, type SyncSetup, syncSetup, type TestServer } from "./support";

const sha256Hex = /^[0-9a-f]{64}$/;

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

type Revision = Awaited<
	ReturnType<SyncSetup["local"]["quotes"]["get"]>
>["revisions"][number];

function envelope(
	setup: SyncSetup,
	input: { aggregateId: string; payload: unknown }
) {
	return {
		...input,
		aggregateType: "quoteApproval",
		baseVersion: null,
		command: "quote.approve",
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

function rows(server: TestServer, table: string): number {
	return (
		server
			.native()
			.query<{ total: number }, []>(`SELECT count(*) AS total FROM ${table}`)
			.get()?.total ?? 0
	);
}

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

async function zipperOf(setup: SyncSetup): Promise<string> {
	const { id: materialId } = await setup.local.materials.create({
		category: null,
		materialId: crypto.randomUUID(),
		name: "Zíper",
		notes: null,
		opId: newOpId(),
	});
	const { id: variantId } = await setup.local.materialVariants.create({
		baseUnit: "un",
		code: null,
		displayPrecision: 0,
		materialId,
		name: "20 cm",
		opId: newOpId(),
		referenceCostCents: "370",
		variantId: crypto.randomUUID(),
	});
	const { id: locationId } = await setup.local.stockLocations.create({
		locationId: crypto.randomUUID(),
		name: "Armário",
		notes: null,
		opId: newOpId(),
	});
	await setup.local.stockMovements.create({
		kind: "opening",
		locationId,
		lotId: null,
		movementId: crypto.randomUUID(),
		occurredOn: "2026-09-01",
		opId: newOpId(),
		quantityMicros: "5000000",
		reason: null,
		valueCents: "1850",
		variantId,
	});
	return variantId;
}

function linesOf(zipperId: string) {
	return [
		{
			catalogPriceCents: "16000",
			discount: null,
			estimatedMinutes: 90,
			id: crypto.randomUUID(),
			kind: "service" as const,
			note: null,
			outsourced: false,
			profileId: null,
			quantity: 1,
			receivedItemId: null,
			serviceId: crypto.randomUUID(),
			serviceName: "Ajuste de cava",
			serviceVersion: 1,
			unitCostCents: "6000",
			unitPriceCents: "16000",
		},
		{
			baseUnit: "un" as const,
			code: null,
			discount: null,
			displayPrecision: 0,
			id: crypto.randomUUID(),
			kind: "material" as const,
			materialName: "Zíper",
			materialVariantId: zipperId,
			note: null,
			quantityMicros: "2000000",
			unitCostCents: "370",
			unitPriceCents: "800",
			variantName: "20 cm",
		},
		{
			description: "Taxa de urgência",
			discount: null,
			id: crypto.randomUUID(),
			kind: "free" as const,
			note: null,
			quantity: 1,
			unitCostCents: "0",
			unitPriceCents: "5000",
		},
	];
}

async function emitted(
	setup: SyncSetup,
	clientId: string,
	lines: unknown[]
): Promise<{ quoteId: string; revision: Revision }> {
	const quoteId = crypto.randomUUID();
	const content = {
		discount: null,
		leadTimeDays: 20,
		lines,
		notes: null,
		validityDays: 15,
	} as Parameters<SyncSetup["local"]["quotes"]["emit"]>[0]["content"];
	await setup.local.quotes.create({
		...content,
		clientId,
		createdOn: "2026-09-20",
		opId: newOpId(),
		quoteId,
	});
	await setup.local.quotes.emit({
		content,
		emittedOn: "2026-09-20",
		opId: newOpId(),
		quoteId,
		reason: null,
		revisionId: crypto.randomUUID(),
	});
	const [revision] = (await setup.local.quotes.get({ quoteId })).revisions;
	if (!revision) {
		throw new Error("Revisão ausente");
	}
	return { quoteId, revision };
}

function payloadOf(
	revision: Revision,
	overrides: Record<string, unknown> = {}
) {
	return {
		approvedOn: "2026-09-22",
		channel: "phone",
		dueOn: "2026-10-12",
		items: revision.content.lines.filter(isWorkLine).map((line) => ({
			itemId: crypto.randomUUID(),
			lineId: line.id,
			measurements: [],
			reservations: linePlannedMaterials(quoteLineOfText(line)).map(
				(material) => ({
					reservationId: crypto.randomUUID(),
					variantId: material.variantId,
				})
			),
		})),
		note: "Aceitou por telefone",
		quoteId: revision.quoteId,
		receivableId: crypto.randomUUID(),
		revisionId: revision.id,
		serviceOrderId: crypto.randomUUID(),
		...overrides,
	};
}

async function cursorOf(setup: SyncSetup): Promise<string> {
	const { cursor } = await setup.sync.sync.pull({
		cursor: "0",
		epoch: setup.epoch,
		limit: 500,
	});
	return cursor;
}

describe("quote approval sync", () => {
	test("approves over push and pulls the order, the approval, the items, the reservation and the receivable", async () => {
		const setup = await syncSetup(servers);
		const zipperId = await zipperOf(setup);
		const clientId = await clientOf(setup);
		const { revision } = await emitted(setup, clientId, linesOf(zipperId));
		const cursor = await cursorOf(setup);
		const approvalId = crypto.randomUUID();
		const payload = payloadOf(revision);
		const operation = envelope(setup, { aggregateId: approvalId, payload });
		const pushed = await setup.sync.sync.push({ operations: [operation] });
		expect(pushed.accepted).toEqual([{ newVersion: 1, opId: operation.opId }]);
		const { changes } = await setup.sync.sync.pull({
			cursor,
			epoch: setup.epoch,
			limit: 500,
		});
		expect(changes.map((change) => change.aggregateType)).toEqual([
			"serviceOrder",
			"quoteApproval",
			"serviceOrderItem",
			"serviceOrderItem",
			"stockReservation",
			"receivable",
		]);
		const [order, approval, service, material, reservation, receivable] =
			changes.map((change) => change.data);
		const flow = await setup.local.productionFlow.get({});
		expect(order).toEqual({
			clientId,
			code: "OS-2026-PC-0001",
			createdAt: expect.any(String),
			flowStages: flow.stages,
			flowVersion: 1,
			id: payload.serviceOrderId,
			openedOn: "2026-09-22",
			quoteId: revision.quoteId,
			version: 1,
		});
		expect(approval).toEqual({
			approvedOn: "2026-09-22",
			channel: "phone",
			createdAt: expect.any(String),
			id: approvalId,
			note: "Aceitou por telefone",
			quoteId: revision.quoteId,
			revisionId: revision.id,
			serviceOrderId: payload.serviceOrderId,
			version: 1,
		});
		const work = revision.content.lines.filter(isWorkLine);
		expect(service).toMatchObject({
			dueOn: "2026-10-12",
			kind: "service",
			line: work[0],
			measurements: [],
			position: 0,
			productionStatus: "notStarted",
			stageId: null,
			stageIds: null,
			version: 1,
		});
		expect(material).toMatchObject({ kind: "material", position: 1 });
		expect(reservation).toMatchObject({
			kind: "approval",
			occurredOn: "2026-09-22",
			quantityMicros: "2000000",
			variantId: zipperId,
			version: 1,
		});
		expect(receivable).toMatchObject({
			amountCents: revision.totalCents,
			clientId,
			kind: "serviceOrder",
			occurredOn: "2026-09-22",
			serviceOrderId: payload.serviceOrderId,
		});
		expect(opHash(setup.server, operation.opId)).toMatch(sha256Hex);
	});

	test("pulls the quote with the refusal cleared by the approval", async () => {
		const setup = await syncSetup(servers);
		const clientId = await clientOf(setup);
		const { quoteId, revision } = await emitted(
			setup,
			clientId,
			linesOf(crypto.randomUUID())
		);
		const { quote } = await setup.local.quotes.get({ quoteId });
		await setup.local.quotes.refuse({
			baseVersion: quote.version,
			opId: newOpId(),
			quoteId,
			reason: "Achou caro",
			refusedOn: "2026-09-21",
		});
		const cursor = await cursorOf(setup);
		await setup.sync.sync.push({
			operations: [
				envelope(setup, {
					aggregateId: crypto.randomUUID(),
					payload: payloadOf(revision),
				}),
			],
		});
		const { changes } = await setup.sync.sync.pull({
			cursor,
			epoch: setup.epoch,
			limit: 500,
		});
		const pulled = changes.find((change) => change.aggregateType === "quote");
		expect(pulled?.aggregateId).toBe(quoteId);
		expect(pulled?.data).toMatchObject({
			refusalReason: null,
			refusedOn: null,
			version: quote.version + 2,
		});
	});

	test("quarantines ids already used by another approval without failing the batch", async () => {
		const setup = await syncSetup(servers);
		const zipperId = await zipperOf(setup);
		const clientId = await clientOf(setup);
		const first = await emitted(setup, clientId, linesOf(zipperId));
		const used = payloadOf(first.revision);
		await setup.sync.sync.push({
			operations: [
				envelope(setup, { aggregateId: crypto.randomUUID(), payload: used }),
			],
		});
		const usedReservation = used.items[1]?.reservations[0]?.reservationId ?? "";
		const second = await emitted(setup, clientId, linesOf(zipperId));
		const fresh = payloadOf(second.revision);
		const reused = [
			{ ...fresh, serviceOrderId: used.serviceOrderId },
			{ ...payloadOf(second.revision), receivableId: used.receivableId },
			{
				...payloadOf(second.revision),
				items: payloadOf(second.revision).items.map((item, index) =>
					index === 1
						? {
								...item,
								reservations: item.reservations.map((reservation) => ({
									...reservation,
									reservationId: usedReservation,
								})),
							}
						: item
				),
			},
		].map((payload) =>
			envelope(setup, { aggregateId: crypto.randomUUID(), payload })
		);
		const before = [
			"service_order",
			"quote_approval",
			"receivable",
			"stock_reservation",
		].map((table) => rows(setup.server, table));
		const pushed = await setup.sync.sync.push({ operations: reused });
		expect(pushed.quarantined).toEqual(
			reused.map((operation) => ({
				opId: operation.opId,
				reason: "aggregateExists",
			}))
		);
		expect(
			[
				"service_order",
				"quote_approval",
				"receivable",
				"stock_reservation",
			].map((table) => rows(setup.server, table))
		).toEqual(before);
	});

	test("repeats the same operation and quarantines a reused opId", async () => {
		const setup = await syncSetup(servers);
		const clientId = await clientOf(setup);
		const { revision } = await emitted(
			setup,
			clientId,
			linesOf(crypto.randomUUID())
		);
		const payload = payloadOf(revision);
		const operation = envelope(setup, {
			aggregateId: crypto.randomUUID(),
			payload,
		});
		const first = await setup.sync.sync.push({ operations: [operation] });
		const orders = rows(setup.server, "service_order");
		const again = await setup.sync.sync.push({ operations: [operation] });
		expect(again.accepted).toEqual(first.accepted);
		expect(rows(setup.server, "service_order")).toBe(orders);
		const reused = await setup.sync.sync.push({
			operations: [
				{
					...operation,
					payload: { ...payload, note: "Outra nota" },
				},
			],
		});
		expect(reused.quarantined).toEqual([
			{ opId: operation.opId, reason: "opIdReused" },
		]);
	});

	test("quarantines each refusal with the hash withheld", async () => {
		const setup = await syncSetup(servers);
		const clientId = await clientOf(setup);
		const lines = linesOf(crypto.randomUUID());
		const { revision } = await emitted(setup, clientId, lines);
		const accepted = envelope(setup, {
			aggregateId: crypto.randomUUID(),
			payload: payloadOf(revision),
		});
		await setup.sync.sync.push({ operations: [accepted] });
		const other = await emitted(setup, clientId, linesOf(crypto.randomUUID()));
		await setup.local.quotes.emit({
			content: {
				discount: null,
				leadTimeDays: 20,
				lines: other.revision.content.lines.map(
					({ costCents, discountCents, grossCents, totalCents, ...line }) =>
						line
				),
				notes: null,
				validityDays: 15,
			},
			emittedOn: "2026-09-21",
			opId: newOpId(),
			quoteId: other.quoteId,
			reason: null,
			revisionId: crypto.randomUUID(),
		});
		const hidden = await clientOf(setup, "Rita de Cássia");
		const gone = await emitted(setup, hidden, linesOf(crypto.randomUUID()));
		await setup.local.clients.anonymize({
			baseVersion: 1,
			clientId: hidden,
			opId: newOpId(),
		});
		const reusedId = crypto.randomUUID();
		const refused = [
			envelope(setup, {
				aggregateId: crypto.randomUUID(),
				payload: payloadOf(other.revision, { channel: "fax" }),
			}),
			envelope(setup, {
				aggregateId: crypto.randomUUID(),
				payload: payloadOf(other.revision, { quoteId: crypto.randomUUID() }),
			}),
			envelope(setup, {
				aggregateId: crypto.randomUUID(),
				payload: payloadOf(other.revision),
			}),
			envelope(setup, {
				aggregateId: crypto.randomUUID(),
				payload: payloadOf(gone.revision),
			}),
			envelope(setup, {
				aggregateId: crypto.randomUUID(),
				payload: payloadOf(revision),
			}),
			envelope(setup, {
				aggregateId: reusedId,
				payload: payloadOf(
					(await setup.local.quotes.get({ quoteId: other.quoteId }))
						.revisions[0] ?? revision,
					{ serviceOrderId: reusedId }
				),
			}),
		];
		const pushed = await setup.sync.sync.push({ operations: refused });
		expect(pushed.quarantined).toEqual(
			(
				[
					"invalidPayload",
					"aggregateNotFound",
					"aggregateNotFound",
					"aggregateAnonymized",
					"aggregateExists",
					"aggregateExists",
				] as const
			).map((reason, index) => ({
				opId: refused[index]?.opId ?? null,
				reason,
			}))
		);
		expect(
			refused.map((operation) => opHash(setup.server, operation.opId))
		).toEqual(refused.map(() => "redacted"));
		expect(opHash(setup.server, accepted.opId)).toMatch(sha256Hex);
	});
});

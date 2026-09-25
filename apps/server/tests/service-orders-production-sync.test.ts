import { afterEach, describe, expect, test } from "bun:test";

import {
	approvedQuote,
	createClient,
	materialLine,
	pieceLine,
	seedPerson,
	seedStock,
	serviceLine,
} from "./service-order-fixtures";
import { newOpId, type SyncSetup, syncSetup, type TestServer } from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

function envelope(
	setup: SyncSetup,
	input: {
		aggregateId: string;
		aggregateType?: "serviceOrder" | "serviceOrderItem";
		baseVersion: number;
		command: string;
		payload: unknown;
	}
) {
	return {
		aggregateType: "serviceOrderItem",
		...input,
		deviceId: setup.device.id,
		epoch: setup.epoch,
		occurredAt: "2026-09-25T12:00:00.000Z",
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

async function approvedOrder(setup: SyncSetup) {
	const stock = await seedStock(setup.local);
	const clientId = await createClient(setup.local);
	const person = await seedPerson(setup.local, clientId);
	const flow = await setup.local.productionFlow.get({});
	const [corte = "", , prova = "", acabamento = ""] = flow.stages.map(
		(stage) => stage.id
	);
	const input = await approvedQuote(setup.local, clientId, [
		serviceLine(person),
		pieceLine(stock, person.profileId),
		materialLine(stock.zipperId, "2000000"),
	]);
	const [service = "", , material = ""] = input.items.map(
		(item) => item.itemId
	);
	return {
		flow,
		items: { material, service },
		serviceOrderId: input.serviceOrderId,
		stages: { acabamento, corte, prova },
	};
}

function adoptEnvelope(
	setup: SyncSetup,
	serviceOrderId: string,
	baseVersion: number
) {
	return envelope(setup, {
		aggregateId: serviceOrderId,
		aggregateType: "serviceOrder",
		baseVersion,
		command: "serviceOrder.adoptCurrentFlow",
		payload: {},
	});
}

async function hideProva(setup: SyncSetup) {
	const { stages } = await setup.local.productionFlow.get({});
	await setup.local.productionFlow.update({
		baseVersion: 1,
		opId: newOpId(),
		stages: stages
			.filter((stage) => stage.name !== "Prova")
			.map(({ id, name }) => ({ id, name })),
	});
}

async function pulled(setup: SyncSetup, aggregateId: string) {
	const { changes } = await setup.sync.sync.pull({
		cursor: "0",
		epoch: setup.epoch,
		limit: 500,
	});
	return changes.filter((change) => change.aggregateId === aggregateId).at(-1);
}

describe("service order item production sync", () => {
	test("starts, advances and goes back over push and pulls the item", async () => {
		const setup = await syncSetup(servers);
		const { items, stages } = await approvedOrder(setup);
		const operations = [
			envelope(setup, {
				aggregateId: items.service,
				baseVersion: 1,
				command: "serviceOrderItem.start",
				payload: { stageIds: [stages.prova, stages.acabamento] },
			}),
			envelope(setup, {
				aggregateId: items.service,
				baseVersion: 2,
				command: "serviceOrderItem.advance",
				payload: {},
			}),
			envelope(setup, {
				aggregateId: items.service,
				baseVersion: 3,
				command: "serviceOrderItem.back",
				payload: {},
			}),
		];
		const pushed = await setup.sync.sync.push({ operations });
		expect(pushed.accepted).toEqual(
			operations.map((operation, index) => ({
				newVersion: index + 2,
				opId: operation.opId,
			}))
		);
		const change = await pulled(setup, items.service);
		expect(change?.version).toBe(4);
		expect(change?.data).toMatchObject({
			productionStatus: "inProgress",
			stageId: stages.prova,
			stageIds: [stages.prova, stages.acabamento],
			version: 4,
		});
	});

	test("a stale advance resolved with keepLocal advances once more", async () => {
		const setup = await syncSetup(servers);
		const { items, stages } = await approvedOrder(setup);
		await setup.local.serviceOrderItems.start({
			baseVersion: 1,
			itemId: items.service,
			opId: newOpId(),
			stageIds: [stages.prova, stages.acabamento],
		});
		await setup.local.serviceOrderItems.advance({
			baseVersion: 2,
			itemId: items.service,
			opId: newOpId(),
		});
		const pushed = await setup.sync.sync.push({
			operations: [
				envelope(setup, {
					aggregateId: items.service,
					baseVersion: 2,
					command: "serviceOrderItem.advance",
					payload: {},
				}),
			],
		});
		expect(pushed.accepted).toEqual([]);
		expect(pushed.conflicts).toHaveLength(1);
		const resolved = await setup.local.sync.resolve({
			choice: "keepLocal",
			conflictId: pushed.conflicts[0]?.conflictId ?? "",
			opId: newOpId(),
			reason: "O celular avançou",
		});
		expect(resolved.version).toBe(4);
		expect((await pulled(setup, items.service))?.data).toMatchObject({
			productionStatus: "ready",
			stageId: null,
			stageIds: [stages.prova, stages.acabamento],
			version: 4,
		});
	});

	test("quarantines a start on a material item with the hash withheld", async () => {
		const setup = await syncSetup(servers);
		const { items, stages } = await approvedOrder(setup);
		const operation = envelope(setup, {
			aggregateId: items.material,
			baseVersion: 1,
			command: "serviceOrderItem.start",
			payload: { stageIds: [stages.corte] },
		});
		const pushed = await setup.sync.sync.push({ operations: [operation] });
		expect(pushed.quarantined).toEqual([
			{ opId: operation.opId, reason: "aggregateNotFound" },
		]);
		expect(opHash(setup.server, operation.opId)).toBe("redacted");
	});

	test("adopts the current flow over push and pulls the order with it", async () => {
		const setup = await syncSetup(servers);
		const { serviceOrderId } = await approvedOrder(setup);
		await hideProva(setup);
		const operation = adoptEnvelope(setup, serviceOrderId, 1);
		const pushed = await setup.sync.sync.push({ operations: [operation] });
		expect(pushed.accepted).toEqual([{ newVersion: 2, opId: operation.opId }]);
		const current = await setup.local.productionFlow.get({});
		expect((await pulled(setup, serviceOrderId))?.data).toMatchObject({
			flowStages: current.stages,
			flowVersion: 2,
			version: 2,
		});
	});

	test("a stale flow adoption resolved with keepLocal adopts the flow current at the resolution", async () => {
		const setup = await syncSetup(servers);
		const { serviceOrderId, stages } = await approvedOrder(setup);
		await hideProva(setup);
		await setup.local.serviceOrders.adoptCurrentFlow({
			baseVersion: 1,
			opId: newOpId(),
			serviceOrderId,
		});
		await setup.local.productionFlow.update({
			baseVersion: 2,
			opId: newOpId(),
			stages: [{ id: stages.corte, name: "Corte" }],
		});
		const pushed = await setup.sync.sync.push({
			operations: [adoptEnvelope(setup, serviceOrderId, 1)],
		});
		expect(pushed.accepted).toEqual([]);
		expect(pushed.conflicts).toHaveLength(1);
		const resolved = await setup.local.sync.resolve({
			choice: "keepLocal",
			conflictId: pushed.conflicts[0]?.conflictId ?? "",
			opId: newOpId(),
			reason: "O celular trocou o fluxo",
		});
		expect(resolved.version).toBe(3);
		const current = await setup.local.productionFlow.get({});
		expect(current.version).toBe(3);
		expect((await pulled(setup, serviceOrderId))?.data).toMatchObject({
			flowStages: current.stages,
			flowVersion: 3,
			version: 3,
		});
	});

	test("quarantines a flow adoption of a missing order with the hash withheld", async () => {
		const setup = await syncSetup(servers);
		await approvedOrder(setup);
		const operation = adoptEnvelope(setup, crypto.randomUUID(), 1);
		const pushed = await setup.sync.sync.push({ operations: [operation] });
		expect(pushed.quarantined).toEqual([
			{ opId: operation.opId, reason: "aggregateNotFound" },
		]);
		expect(opHash(setup.server, operation.opId)).toBe("redacted");
	});

	test("pulls the order with the copied flow", async () => {
		const setup = await syncSetup(servers);
		const { flow, serviceOrderId } = await approvedOrder(setup);
		expect((await pulled(setup, serviceOrderId))?.data).toMatchObject({
			flowStages: flow.stages,
			flowVersion: 1,
		});
	});
});

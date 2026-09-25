import { afterEach, describe, expect, test } from "bun:test";

import {
	approvedQuote,
	createClient,
	materialLine,
	pieceLine,
	readyToReconcile,
	reconcileInput,
	reverseInput,
	seedPerson,
	seedStock,
	serviceLine,
} from "./service-order-fixtures";
import { newOpId, type SyncSetup, syncSetup, type TestServer } from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

function opHash(server: TestServer, opId: string) {
	return server
		.native()
		.query<{ op_hash: string }, [string]>(
			"SELECT op_hash FROM operation WHERE op_id = ?"
		)
		.get(opId)?.op_hash;
}

async function readyOrder(setup: SyncSetup) {
	const stock = await seedStock(setup.local);
	const clientId = await createClient(setup.local);
	const person = await seedPerson(setup.local, clientId);
	const flow = await setup.local.productionFlow.get({});
	const [corte = "", , , acabamento = ""] = flow.stages.map(
		(stage) => stage.id
	);
	const input = await approvedQuote(setup.local, clientId, [
		serviceLine(person),
		pieceLine(stock, person.profileId),
		materialLine(stock.zipperId, "2000000"),
	]);
	const [, piece = "", material = ""] = input.items.map((item) => item.itemId);
	await readyToReconcile(setup.local, piece, [corte, acabamento]);
	return { acabamento, items: { material, piece }, stock };
}

function reconcileEnvelope(
	setup: SyncSetup,
	input: ReturnType<typeof reconcileInput>
) {
	const { opId: _opId, reconciliationId, ...payload } = input;
	return {
		aggregateId: reconciliationId,
		aggregateType: "materialReconciliation",
		baseVersion: null,
		command: "materialReconciliation.create",
		deviceId: setup.device.id,
		epoch: setup.epoch,
		occurredAt: "2026-09-25T12:00:00.000Z",
		opId: newOpId(),
		payload,
	};
}

async function pulledChanges(setup: SyncSetup) {
	const { changes } = await setup.sync.sync.pull({
		cursor: "0",
		epoch: setup.epoch,
		limit: 500,
	});
	return changes;
}

describe("material reconciliation sync", () => {
	test("reconciles over push and pulls the fact, the consumption and the ready item", async () => {
		const setup = await syncSetup(servers);
		const { items, stock } = await readyOrder(setup);
		const input = reconcileInput({ itemId: items.piece, stock });
		const operation = reconcileEnvelope(setup, input);
		const pushed = await setup.sync.sync.push({ operations: [operation] });
		expect(pushed.accepted).toEqual([{ newVersion: 1, opId: operation.opId }]);
		const changes = await pulledChanges(setup);
		expect(
			changes.find((change) => change.aggregateId === input.reconciliationId)
		).toMatchObject({
			aggregateType: "materialReconciliation",
			data: {
				id: input.reconciliationId,
				lines: [
					{ plannedMicros: "3400000", variantId: stock.crepeId },
					{ plannedMicros: "1000000", variantId: stock.zipperId },
				],
				note: null,
				occurredOn: "2026-09-25",
				serviceOrderItemId: items.piece,
				version: 1,
			},
			version: 1,
		});
		const consumed = changes
			.filter((change) => change.aggregateType === "stockMovement")
			.map((change) => change.data)
			.filter(
				(data) =>
					(data as { materialReconciliationId?: string | null })
						.materialReconciliationId === input.reconciliationId
			);
		expect(consumed).toEqual([
			expect.objectContaining({
				kind: "consumption",
				quantityMicros: "-3400000",
				valueCents: "-10200",
				variantId: stock.crepeId,
			}),
			expect.objectContaining({
				kind: "consumption",
				quantityMicros: "-1000000",
				valueCents: "-370",
				variantId: stock.zipperId,
			}),
		]);
		expect(
			changes.filter((change) => change.aggregateId === items.piece).at(-1)
				?.data
		).toMatchObject({ productionStatus: "ready", stageId: null, version: 4 });
	});

	test("quarantines a reconciliation of a material item with the hash withheld", async () => {
		const setup = await syncSetup(servers);
		const { items, stock } = await readyOrder(setup);
		const operation = reconcileEnvelope(
			setup,
			reconcileInput({ itemId: items.material, stock })
		);
		const pushed = await setup.sync.sync.push({ operations: [operation] });
		expect(pushed.quarantined).toEqual([
			{ opId: operation.opId, reason: "aggregateNotFound" },
		]);
		expect(opHash(setup.server, operation.opId)).toBe("redacted");
	});

	test("quarantines a second reconciliation of the same piece", async () => {
		const setup = await syncSetup(servers);
		const { items, stock } = await readyOrder(setup);
		await setup.local.serviceOrderItems.reconcile(
			reconcileInput({ itemId: items.piece, stock })
		);
		const operation = reconcileEnvelope(
			setup,
			reconcileInput({ itemId: items.piece, stock })
		);
		const pushed = await setup.sync.sync.push({ operations: [operation] });
		expect(pushed.quarantined).toEqual([
			{ opId: operation.opId, reason: "aggregateExists" },
		]);
	});

	test("quarantines parts that do not add up to the output", async () => {
		const setup = await syncSetup(servers);
		const { items, stock } = await readyOrder(setup);
		const input = reconcileInput({ itemId: items.piece, stock });
		const [crepe, zipper] = input.lines;
		const operation = reconcileEnvelope(setup, {
			...input,
			lines: [{ ...crepe, consumedMicros: "3000000" }, zipper],
		} as typeof input);
		const pushed = await setup.sync.sync.push({ operations: [operation] });
		expect(pushed.quarantined).toEqual([
			{ opId: operation.opId, reason: "invalidPayload" },
		]);
	});
});

function reverseEnvelope(
	setup: SyncSetup,
	input: ReturnType<typeof reverseInput>
) {
	const { opId: _opId, reversalId, ...payload } = input;
	return {
		aggregateId: reversalId,
		aggregateType: "materialReconciliationReversal",
		baseVersion: null,
		command: "materialReconciliation.reverse",
		deviceId: setup.device.id,
		epoch: setup.epoch,
		occurredAt: "2026-09-26T12:00:00.000Z",
		opId: newOpId(),
		payload,
	};
}

describe("material reconciliation reversal sync", () => {
	test("reverses over push and pulls the reversal, the returned stock and the item", async () => {
		const setup = await syncSetup(servers);
		const { acabamento, items, stock } = await readyOrder(setup);
		const reconciled = reconcileInput({ itemId: items.piece, stock });
		await setup.local.serviceOrderItems.reconcile(reconciled);
		const input = reverseInput(reconciled);
		const operation = reverseEnvelope(setup, input);
		const pushed = await setup.sync.sync.push({ operations: [operation] });
		expect(pushed.accepted).toEqual([{ newVersion: 1, opId: operation.opId }]);
		const changes = await pulledChanges(setup);
		expect(
			changes.find((change) => change.aggregateId === input.reversalId)
		).toMatchObject({
			aggregateType: "materialReconciliationReversal",
			data: {
				id: input.reversalId,
				occurredOn: "2026-09-26",
				reason: "Peça voltou para ajuste",
				reconciliationId: reconciled.reconciliationId,
				version: 1,
			},
			version: 1,
		});
		const returned = changes
			.filter((change) => change.aggregateType === "stockMovement")
			.map((change) => change.data)
			.filter(
				(data) =>
					(data as { kind?: string; materialReconciliationId?: string | null })
						.materialReconciliationId === reconciled.reconciliationId &&
					(data as { kind?: string }).kind === "reversal"
			);
		expect(returned).toEqual([
			expect.objectContaining({
				id: input.movementIds[0],
				quantityMicros: "3400000",
				reversesMovementId: reconciled.lines[0]?.parts[0]?.movementId,
				valueCents: "10200",
				variantId: stock.crepeId,
			}),
			expect.objectContaining({
				id: input.movementIds[1],
				quantityMicros: "1000000",
				reversesMovementId: reconciled.lines[1]?.parts[0]?.movementId,
				valueCents: "370",
				variantId: stock.zipperId,
			}),
		]);
		expect(
			changes.filter((change) => change.aggregateId === items.piece).at(-1)
				?.data
		).toMatchObject({
			productionStatus: "inProgress",
			stageId: acabamento,
			version: 5,
		});
	});

	test("quarantines a second reversal with the hash withheld", async () => {
		const setup = await syncSetup(servers);
		const { items, stock } = await readyOrder(setup);
		const reconciled = reconcileInput({ itemId: items.piece, stock });
		await setup.local.serviceOrderItems.reconcile(reconciled);
		await setup.local.serviceOrderItems.reverseReconciliation(
			reverseInput(reconciled)
		);
		const operation = reverseEnvelope(setup, reverseInput(reconciled));
		const pushed = await setup.sync.sync.push({ operations: [operation] });
		expect(pushed.quarantined).toEqual([
			{ opId: operation.opId, reason: "aggregateExists" },
		]);
		expect(opHash(setup.server, operation.opId)).toBe("redacted");
	});
});

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
		baseVersion: number | null;
		command: string;
		payload: unknown;
	}
) {
	return {
		aggregateType: "productionFlow",
		...input,
		deviceId: setup.device.id,
		epoch: setup.epoch,
		occurredAt: "2026-09-25T12:00:00.000Z",
		opId: newOpId(),
	};
}

async function currentFlow(setup: SyncSetup) {
	const flow = await setup.local.productionFlow.get({});
	const [corte, montagem, prova, acabamento] = flow.stages.map(
		(stage) => stage.id
	);
	return {
		acabamento: acabamento ?? "",
		corte: corte ?? "",
		id: flow.id,
		montagem: montagem ?? "",
		prova: prova ?? "",
	};
}

describe("production flow sync", () => {
	test("hides a stage over push and reads the new version on pull", async () => {
		const setup = await syncSetup(servers);
		const { acabamento, corte, id, montagem, prova } = await currentFlow(setup);
		const hide = envelope(setup, {
			aggregateId: id,
			baseVersion: 1,
			command: "productionFlow.update",
			payload: {
				stages: [
					{ id: corte, name: "Corte" },
					{ id: montagem, name: "Montagem" },
					{ id: acabamento, name: "Acabamento" },
				],
			},
		});
		const pushed = await setup.sync.sync.push({ operations: [hide] });
		expect(pushed.accepted).toEqual([{ newVersion: 2, opId: hide.opId }]);
		const { changes } = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		const flowChanges = changes.filter(
			(change) => change.aggregateType === "productionFlow"
		);
		expect(flowChanges.map((change) => change.version)).toEqual([1, 2]);
		expect(flowChanges.at(-1)?.data).toEqual({
			createdAt: expect.any(String),
			id,
			stages: [
				{ active: true, id: corte, name: "Corte" },
				{ active: true, id: montagem, name: "Montagem" },
				{ active: true, id: acabamento, name: "Acabamento" },
				{ active: false, id: prova, name: "Prova" },
			],
			version: 2,
		});
	});

	test("a stale update resolved with keepLocal merges the sent list over the current version", async () => {
		const setup = await syncSetup(servers);
		const { acabamento, corte, id, montagem, prova } = await currentFlow(setup);
		await setup.local.productionFlow.update({
			baseVersion: 1,
			opId: newOpId(),
			stages: [
				{ id: corte, name: "Corte" },
				{ id: montagem, name: "Montagem" },
				{ id: prova, name: "Prova de roupa" },
				{ id: acabamento, name: "Acabamento" },
			],
		});
		const pushed = await setup.sync.sync.push({
			operations: [
				envelope(setup, {
					aggregateId: id,
					baseVersion: 1,
					command: "productionFlow.update",
					payload: {
						stages: [
							{ id: corte, name: "Corte" },
							{ id: montagem, name: "Costura" },
							{ id: acabamento, name: "Acabamento" },
						],
					},
				}),
			],
		});
		expect(pushed.conflicts).toHaveLength(1);
		const resolved = await setup.local.sync.resolve({
			choice: "keepLocal",
			conflictId: pushed.conflicts[0]?.conflictId ?? "",
			opId: newOpId(),
			reason: "O celular estava certo",
		});
		expect(resolved.version).toBe(3);
		expect(await setup.local.productionFlow.get({})).toMatchObject({
			stages: [
				{ active: true, id: corte, name: "Corte" },
				{ active: true, id: montagem, name: "Costura" },
				{ active: true, id: acabamento, name: "Acabamento" },
				{ active: false, id: prova, name: "Prova de roupa" },
			],
			version: 3,
		});
	});

	test("quarantines a stage list with names repeated by case, space or accent", async () => {
		const setup = await syncSetup(servers);
		const { acabamento, corte, id, prova } = await currentFlow(setup);
		const repeated = [
			[
				{ id: prova, name: "Prova" },
				{ id: corte, name: " prova" },
			],
			[
				{ id: acabamento, name: "Acabamento" },
				{ id: corte, name: "acabaménto" },
			],
		].map((stages) =>
			envelope(setup, {
				aggregateId: id,
				baseVersion: 1,
				command: "productionFlow.update",
				payload: { stages },
			})
		);
		const pushed = await setup.sync.sync.push({ operations: repeated });
		expect(pushed.accepted).toEqual([]);
		expect(pushed.quarantined).toEqual(
			repeated.map((operation) => ({
				opId: operation.opId,
				reason: "invalidPayload",
			}))
		);
		expect((await setup.local.productionFlow.get({})).version).toBe(1);
	});
});

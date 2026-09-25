import { afterEach, describe, expect, test } from "bun:test";
import { ensureProductionFlow } from "@costura-pro/api/production/seed";

import {
	completeWizard,
	inSequence,
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

const uuidPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function flowChanges(server: TestServer): { op_id: string | null }[] {
	return server
		.native()
		.query<{ op_id: string | null }, []>(
			"SELECT op_id FROM change_log WHERE aggregate_type = 'productionFlow'"
		)
		.all();
}

async function initialIds(owner: Owner) {
	const { stages } = await owner.productionFlow.get({});
	const [corte, montagem, prova, acabamento] = stages.map((stage) => stage.id);
	return {
		acabamento: acabamento ?? "",
		corte: corte ?? "",
		montagem: montagem ?? "",
		prova: prova ?? "",
	};
}

function namesAndActive(stages: { active: boolean; name: string }[]) {
	return stages.map((stage) => [stage.name, stage.active]);
}

describe("production flow", () => {
	test("a new installation starts with the four initial stages at version 1", async () => {
		const { owner, server } = await ownerSetup();
		const flow = await owner.productionFlow.get({});
		expect(flow.version).toBe(1);
		expect(namesAndActive(flow.stages)).toEqual([
			["Corte", true],
			["Montagem", true],
			["Prova", true],
			["Acabamento", true],
		]);
		const ids = flow.stages.map((stage) => stage.id);
		expect(ids.every((id) => uuidPattern.test(id))).toBe(true);
		expect(new Set(ids).size).toBe(4);
		expect(flow.id).toMatch(uuidPattern);
		expect(Number.isNaN(Date.parse(flow.updatedAt))).toBe(false);
		expect(flowChanges(server)).toEqual([{ op_id: null }]);
	});

	test("seeds only once", async () => {
		const { owner, server } = await ownerSetup();
		ensureProductionFlow(server.db, new Date());
		server.reopen();
		expect(
			server
				.native()
				.query<{ total: number }, []>(
					"SELECT COUNT(*) AS total FROM production_flow"
				)
				.get()?.total
		).toBe(1);
		expect((await owner.productionFlow.get({})).version).toBe(1);
		expect(flowChanges(server)).toHaveLength(1);
	});

	test("renames, adds and hides stages, keeping the hidden one at the end", async () => {
		const { owner, server } = await ownerSetup();
		const { acabamento, corte, montagem } = await initialIds(owner);
		const passadoria = crypto.randomUUID();
		expect(
			await owner.productionFlow.update({
				baseVersion: 1,
				opId: newOpId(),
				stages: [
					{ id: corte, name: "Corte" },
					{ id: montagem, name: " Costura " },
					{ id: acabamento, name: "Acabamento" },
					{ id: passadoria, name: "Passadoria" },
				],
			})
		).toEqual({ version: 2 });
		const flow = await owner.productionFlow.get({});
		expect(flow.version).toBe(2);
		expect(namesAndActive(flow.stages)).toEqual([
			["Corte", true],
			["Costura", true],
			["Acabamento", true],
			["Passadoria", true],
			["Prova", false],
		]);
		expect(flow.stages.map((stage) => stage.id).slice(0, 4)).toEqual([
			corte,
			montagem,
			acabamento,
			passadoria,
		]);
		expect(flowChanges(server)).toHaveLength(2);
	});

	test("sending the same active stages keeps the version", async () => {
		const { owner, server } = await ownerSetup();
		const { stages } = await owner.productionFlow.get({});
		expect(
			await owner.productionFlow.update({
				baseVersion: 1,
				opId: newOpId(),
				stages: stages.map(({ id, name }) => ({ id, name })),
			})
		).toEqual({ version: 1 });
		expect(flowChanges(server)).toHaveLength(1);
	});

	test("reactivates a hidden stage in the sent position", async () => {
		const { owner } = await ownerSetup();
		const { acabamento, corte, montagem, prova } = await initialIds(owner);
		const passadoria = crypto.randomUUID();
		await owner.productionFlow.update({
			baseVersion: 1,
			opId: newOpId(),
			stages: [
				{ id: corte, name: "Corte" },
				{ id: montagem, name: "Costura" },
				{ id: acabamento, name: "Acabamento" },
				{ id: passadoria, name: "Passadoria" },
			],
		});
		expect(
			await owner.productionFlow.update({
				baseVersion: 2,
				opId: newOpId(),
				stages: [
					{ id: prova, name: "Prova" },
					{ id: corte, name: "Corte" },
					{ id: montagem, name: "Costura" },
					{ id: acabamento, name: "Acabamento" },
					{ id: passadoria, name: "Passadoria" },
				],
			})
		).toEqual({ version: 3 });
		const flow = await owner.productionFlow.get({});
		expect(flow.stages[0]).toEqual({ active: true, id: prova, name: "Prova" });
		expect(flow.stages.every((stage) => stage.active)).toBe(true);
	});

	test("refuses a stale base version", async () => {
		const { owner } = await ownerSetup();
		const { stages } = await owner.productionFlow.get({});
		await expect(
			owner.productionFlow.update({
				baseVersion: 5,
				opId: newOpId(),
				stages: stages.slice(1).map(({ id, name }) => ({ id, name })),
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Versão desatualizada",
		});
	});

	test("refuses invalid stage lists", async () => {
		const { owner } = await ownerSetup();
		const { acabamento, corte, prova } = await initialIds(owner);
		const invalid = [
			[
				{ id: corte, name: "Corte" },
				{ id: corte, name: "Montagem" },
			],
			[
				{ id: prova, name: "Prova" },
				{ id: corte, name: " prova" },
			],
			[
				{ id: acabamento, name: "Acabamento" },
				{ id: corte, name: "acabaménto" },
			],
			[],
			Array.from({ length: 13 }, (_, index) => ({
				id: crypto.randomUUID(),
				name: `Etapa ${index + 1}`,
			})),
			[{ id: corte, name: "   " }],
			[{ id: corte, name: "a".repeat(31) }],
		];
		await inSequence(invalid, async (stages) => {
			await expect(
				owner.productionFlow.update({ baseVersion: 1, opId: newOpId(), stages })
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		});
		expect((await owner.productionFlow.get({})).version).toBe(1);
	});

	test("repeating the operation id returns the recorded result", async () => {
		const { owner, server } = await ownerSetup();
		const { stages } = await owner.productionFlow.get({});
		const input = {
			baseVersion: 1,
			opId: newOpId(),
			stages: stages.slice(1).map(({ id, name }) => ({ id, name })),
		};
		expect(await owner.productionFlow.update(input)).toEqual({ version: 2 });
		expect(await owner.productionFlow.update(input)).toEqual({ version: 2 });
		expect(flowChanges(server)).toHaveLength(2);
	});

	test("needs a session to read and to update the flow", async () => {
		const { owner, server } = await ownerSetup();
		const { stages } = await owner.productionFlow.get({});
		await expect(rpc(server).productionFlow.get({})).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
		await expect(
			rpc(server).productionFlow.update({
				baseVersion: 1,
				opId: newOpId(),
				stages: stages.map(({ id, name }) => ({ id, name })),
			})
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

import { afterEach, describe, expect, test } from "bun:test";
import { productionStatusValues } from "@costura-pro/db/schema/production";
import { productionStatuses } from "@costura-pro/domain/production";

import {
	approvedQuote,
	createClient,
	materialLine,
	type Owner,
	ownerSetup,
	pieceLine,
	seedPerson,
	seedStock,
	serviceLine,
} from "./service-order-fixtures";
import { inSequence, newOpId, rpc, type TestServer } from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

const strangeStage = "c0000000-0000-4000-8000-000000000009";

type FlowRow = { flow_stages: string | null; flow_version: number | null };

function flowOf(server: TestServer, serviceOrderId: string) {
	const row = server
		.native()
		.query<FlowRow, [string]>(
			"SELECT flow_version, flow_stages FROM service_order WHERE id = ?"
		)
		.get(serviceOrderId);
	return {
		stages: row?.flow_stages ? JSON.parse(row.flow_stages) : null,
		version: row?.flow_version ?? null,
	};
}

type ProductionRow = {
	production_status: string;
	stage_id: string | null;
	stage_ids: string | null;
	version: number;
};

function productionOf(server: TestServer, itemId: string) {
	const row = server
		.native()
		.query<ProductionRow, [string]>(
			"SELECT production_status, stage_id, stage_ids, version FROM service_order_item WHERE id = ?"
		)
		.get(itemId);
	return {
		stageId: row?.stage_id ?? null,
		stageIds: row?.stage_ids ? JSON.parse(row.stage_ids) : null,
		status: row?.production_status,
		version: row?.version,
	};
}

function changesOf(server: TestServer, aggregateId: string): number {
	return (
		server
			.native()
			.query<{ total: number }, [string]>(
				"SELECT count(*) AS total FROM change_log WHERE aggregate_id = ?"
			)
			.get(aggregateId)?.total ?? 0
	);
}

function forgetFlow(server: TestServer, serviceOrderId: string) {
	server
		.native()
		.query(
			"UPDATE service_order SET flow_version = NULL, flow_stages = NULL WHERE id = ?"
		)
		.run(serviceOrderId);
}

async function stageIdsOf(owner: Owner) {
	const flow = await owner.productionFlow.get({});
	const [corte, montagem, prova, acabamento] = flow.stages.map(
		(stage) => stage.id
	);
	return {
		acabamento: acabamento ?? "",
		corte: corte ?? "",
		montagem: montagem ?? "",
		prova: prova ?? "",
	};
}

async function productionSetup() {
	const { owner, server } = await ownerSetup(servers);
	const stock = await seedStock(owner);
	const clientId = await createClient(owner);
	const person = await seedPerson(owner, clientId);
	const stages = await stageIdsOf(owner);
	const approve = () =>
		approvedQuote(owner, clientId, [
			serviceLine(person),
			pieceLine(stock, person.profileId),
			materialLine(stock.zipperId, "2000000"),
		]);
	const input = await approve();
	const [service = "", piece = "", material = ""] = input.items.map(
		(item) => item.itemId
	);
	return {
		approve,
		items: { material, piece, service },
		owner,
		server,
		serviceOrderId: input.serviceOrderId,
		stages,
	};
}

function start(
	owner: Owner,
	itemId: string,
	baseVersion: number,
	stageIds: string[]
) {
	return owner.serviceOrderItems.start({
		baseVersion,
		itemId,
		opId: newOpId(),
		stageIds,
	});
}

function advance(owner: Owner, itemId: string, baseVersion: number) {
	return owner.serviceOrderItems.advance({
		baseVersion,
		itemId,
		opId: newOpId(),
	});
}

function back(owner: Owner, itemId: string, baseVersion: number) {
	return owner.serviceOrderItems.back({
		baseVersion,
		itemId,
		opId: newOpId(),
	});
}

async function hideProva(owner: Owner) {
	const { acabamento, corte, montagem } = await stageIdsOf(owner);
	await owner.productionFlow.update({
		baseVersion: 1,
		opId: newOpId(),
		stages: [
			{ id: corte, name: "Corte" },
			{ id: montagem, name: "Montagem" },
			{ id: acabamento, name: "Acabamento" },
		],
	});
}

async function catalogService(
	owner: Owner,
	name: string,
	suggestedStageIds?: string[]
): Promise<string> {
	const serviceId = crypto.randomUUID();
	await owner.services.create({
		costCents: "6000",
		name,
		opId: newOpId(),
		priceCents: "10000",
		serviceId,
		...(suggestedStageIds ? { suggestedStageIds } : {}),
	});
	return serviceId;
}

async function suggestionSetup() {
	const { owner, server } = await ownerSetup(servers);
	const stock = await seedStock(owner);
	const clientId = await createClient(owner);
	const person = await seedPerson(owner, clientId);
	const stages = await stageIdsOf(owner);
	const cava = await catalogService(owner, "Ajuste de cava", [
		stages.acabamento,
		stages.prova,
	]);
	const vestido = await catalogService(owner, "Costura de vestido", [
		stages.corte,
		stages.montagem,
		stages.prova,
		stages.acabamento,
	]);
	const laser = await catalogService(owner, "Corte a laser", [stages.corte]);
	const barra = await catalogService(owner, "Barra de calça");
	return {
		catalog: { barra, cava, laser, vestido },
		clientId,
		owner,
		person,
		server,
		stages,
		stock,
	};
}

async function suggestedOf(owner: Owner, serviceOrderId: string) {
	const detail = await owner.serviceOrders.get({ serviceOrderId });
	return detail.items.map((item) => item.suggestedStageIds);
}

describe("production flow of the service order", () => {
	test("keeps the status list of the database equal to the domain", () => {
		expect([...productionStatusValues]).toEqual([...productionStatuses]);
	});

	test("the approval copies the current flow and opens every item not started", async () => {
		const { items, owner, server, serviceOrderId } = await productionSetup();
		const flow = await owner.productionFlow.get({});
		expect(flowOf(server, serviceOrderId)).toEqual({
			stages: flow.stages,
			version: 1,
		});
		expect(
			[items.service, items.piece, items.material].map((itemId) =>
				productionOf(server, itemId)
			)
		).toEqual(
			[1, 2, 3].map(() => ({
				stageId: null,
				stageIds: null,
				status: "notStarted",
				version: 1,
			}))
		);
	});

	test("an approval after a new flow version copies it with the hidden stage", async () => {
		const { approve, owner, server, stages } = await productionSetup();
		await hideProva(owner);
		const later = await approve();
		const copied = flowOf(server, later.serviceOrderId);
		expect(copied.version).toBe(2);
		expect(copied.stages).toEqual((await owner.productionFlow.get({})).stages);
		expect(copied.stages).toContainEqual({
			active: false,
			id: stages.prova,
			name: "Prova",
		});
	});

	test("an order without a flow adopts the current one", async () => {
		const { owner, server, serviceOrderId } = await productionSetup();
		forgetFlow(server, serviceOrderId);
		expect(
			await owner.serviceOrders.adoptCurrentFlow({
				baseVersion: 1,
				opId: newOpId(),
				serviceOrderId,
			})
		).toEqual({ version: 2 });
		expect(flowOf(server, serviceOrderId)).toEqual({
			stages: (await owner.productionFlow.get({})).stages,
			version: 1,
		});
	});

	test("adopting the flow the order already has changes nothing", async () => {
		const { owner, server, serviceOrderId } = await productionSetup();
		const logged = changesOf(server, serviceOrderId);
		expect(
			await owner.serviceOrders.adoptCurrentFlow({
				baseVersion: 1,
				opId: newOpId(),
				serviceOrderId,
			})
		).toEqual({ version: 1 });
		expect(changesOf(server, serviceOrderId)).toBe(logged);
	});

	test("adopting a new version keeps the stages chosen for a started item", async () => {
		const { items, owner, server, serviceOrderId, stages } =
			await productionSetup();
		await start(owner, items.service, 1, [stages.prova, stages.acabamento]);
		await owner.productionFlow.update({
			baseVersion: 1,
			opId: newOpId(),
			stages: [
				{ id: stages.corte, name: "Corte" },
				{ id: stages.montagem, name: "Costura" },
				{ id: stages.acabamento, name: "Acabamento" },
				{ id: crypto.randomUUID(), name: "Passadoria" },
			],
		});
		expect(
			await owner.serviceOrders.adoptCurrentFlow({
				baseVersion: 1,
				opId: newOpId(),
				serviceOrderId,
			})
		).toEqual({ version: 2 });
		const current = await owner.productionFlow.get({});
		expect(flowOf(server, serviceOrderId)).toEqual({
			stages: current.stages,
			version: 2,
		});
		expect(productionOf(server, items.service)).toEqual({
			stageId: stages.prova,
			stageIds: [stages.prova, stages.acabamento],
			status: "inProgress",
			version: 2,
		});
	});

	test("starts in the order of the flow and ignores stages outside it", async () => {
		const { items, owner, server, stages } = await productionSetup();
		expect(
			await start(owner, items.piece, 1, [
				stages.acabamento,
				stages.corte,
				stages.montagem,
			])
		).toEqual({ version: 2 });
		expect(productionOf(server, items.piece)).toEqual({
			stageId: stages.corte,
			stageIds: [stages.corte, stages.montagem, stages.acabamento],
			status: "inProgress",
			version: 2,
		});
		expect(await start(owner, items.service, 1, [strangeStage])).toEqual({
			version: 1,
		});
		expect(productionOf(server, items.service).status).toBe("notStarted");
		expect(
			await start(owner, items.service, 1, [strangeStage, stages.corte])
		).toEqual({ version: 2 });
		expect(productionOf(server, items.service)).toMatchObject({
			stageId: stages.corte,
			stageIds: [stages.corte],
		});
	});

	test("refuses an empty or repeated stage list", async () => {
		const { items, owner, server, stages } = await productionSetup();
		await inSequence([[], [stages.corte, stages.corte]], async (stageIds) => {
			await expect(
				start(owner, items.service, 1, stageIds)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		});
		expect(productionOf(server, items.service).version).toBe(1);
	});

	test("a service goes to ready after its last stage", async () => {
		const { items, owner, server, stages } = await productionSetup();
		await start(owner, items.service, 1, [stages.prova, stages.acabamento]);
		expect(await advance(owner, items.service, 2)).toEqual({ version: 3 });
		expect(productionOf(server, items.service)).toMatchObject({
			stageId: stages.acabamento,
			status: "inProgress",
		});
		expect(await advance(owner, items.service, 3)).toEqual({ version: 4 });
		expect(productionOf(server, items.service)).toEqual({
			stageId: null,
			stageIds: [stages.prova, stages.acabamento],
			status: "ready",
			version: 4,
		});
		expect(await advance(owner, items.service, 4)).toEqual({ version: 4 });
	});

	test("a piece with planned materials waits on its last stage", async () => {
		const { items, owner, server, stages } = await productionSetup();
		await start(owner, items.piece, 1, [
			stages.corte,
			stages.montagem,
			stages.acabamento,
		]);
		await advance(owner, items.piece, 2);
		expect(productionOf(server, items.piece).stageId).toBe(stages.montagem);
		await advance(owner, items.piece, 3);
		expect(productionOf(server, items.piece).stageId).toBe(stages.acabamento);
		expect(await advance(owner, items.piece, 4)).toEqual({ version: 4 });
		expect(productionOf(server, items.piece)).toMatchObject({
			stageId: stages.acabamento,
			status: "inProgress",
		});
	});

	test("goes back from ready to the last stage and down to not started", async () => {
		const { items, owner, server, stages } = await productionSetup();
		await start(owner, items.service, 1, [stages.prova, stages.acabamento]);
		await advance(owner, items.service, 2);
		await advance(owner, items.service, 3);
		expect(await back(owner, items.service, 4)).toEqual({ version: 5 });
		expect(productionOf(server, items.service)).toMatchObject({
			stageId: stages.acabamento,
			status: "inProgress",
		});
		await back(owner, items.service, 5);
		expect(productionOf(server, items.service).stageId).toBe(stages.prova);
		expect(await back(owner, items.service, 6)).toEqual({ version: 7 });
		expect(productionOf(server, items.service)).toEqual({
			stageId: null,
			stageIds: null,
			status: "notStarted",
			version: 7,
		});
		expect(await back(owner, items.service, 7)).toEqual({ version: 7 });
	});

	test("a material item has no production", async () => {
		const { items, owner, server, stages } = await productionSetup();
		const notFound = {
			code: "NOT_FOUND",
			message: "Subitem de produção não encontrado",
		};
		await expect(
			start(owner, items.material, 1, [stages.corte])
		).rejects.toMatchObject(notFound);
		await expect(advance(owner, items.material, 1)).rejects.toMatchObject(
			notFound
		);
		await expect(back(owner, items.material, 1)).rejects.toMatchObject(
			notFound
		);
		expect(productionOf(server, items.material).version).toBe(1);
	});

	test("an order without a flow does not start until it adopts one", async () => {
		const { items, owner, server, serviceOrderId, stages } =
			await productionSetup();
		forgetFlow(server, serviceOrderId);
		expect(
			await start(owner, items.service, 1, [stages.prova, stages.acabamento])
		).toEqual({ version: 1 });
		expect(productionOf(server, items.service).status).toBe("notStarted");
	});

	test("repeats an advance by opId and moves one stage only", async () => {
		const { items, owner, server, stages } = await productionSetup();
		await start(owner, items.service, 1, [stages.prova, stages.acabamento]);
		const input = { baseVersion: 2, itemId: items.service, opId: newOpId() };
		expect(await owner.serviceOrderItems.advance(input)).toEqual({
			version: 3,
		});
		const logged = changesOf(server, items.service);
		expect(await owner.serviceOrderItems.advance(input)).toEqual({
			version: 3,
		});
		expect(changesOf(server, items.service)).toBe(logged);
		expect(productionOf(server, items.service)).toMatchObject({
			stageId: stages.acabamento,
			status: "inProgress",
			version: 3,
		});
	});

	test("a second window advancing the same version gets a conflict", async () => {
		const { items, owner, server, stages } = await productionSetup();
		await start(owner, items.service, 1, [stages.prova, stages.acabamento]);
		await advance(owner, items.service, 2);
		await expect(advance(owner, items.service, 2)).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Versão desatualizada",
		});
		expect(productionOf(server, items.service)).toMatchObject({
			stageId: stages.acabamento,
			status: "inProgress",
			version: 3,
		});
	});

	test("needs a session for the production commands", async () => {
		const { items, server, serviceOrderId, stages } = await productionSetup();
		const anonymous = rpc(server);
		await inSequence(
			[
				() =>
					anonymous.serviceOrders.adoptCurrentFlow({
						baseVersion: 1,
						opId: newOpId(),
						serviceOrderId,
					}),
				() => start(anonymous, items.service, 1, [stages.corte]),
				() => advance(anonymous, items.service, 1),
				() => back(anonymous, items.service, 1),
			],
			async (call) => {
				await expect(call()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
			}
		);
	});
});

describe("production reads", () => {
	test("suggests the stages of the service, the union of the piece services and nothing for a material", async () => {
		const { catalog, clientId, owner, person, stages, stock } =
			await suggestionSetup();
		const first = await approvedQuote(owner, clientId, [
			serviceLine(person, { serviceId: catalog.cava }),
			pieceLine(stock, person.profileId, { serviceIds: [catalog.vestido] }),
			materialLine(stock.zipperId, "1000000"),
		]);
		const detail = await owner.serviceOrders.get({
			serviceOrderId: first.serviceOrderId,
		});
		expect(detail.currentFlowVersion).toBe(1);
		expect(detail.serviceOrder.flowVersion).toBe(1);
		expect(detail.items.map((item) => item.suggestedStageIds)).toEqual([
			[stages.prova, stages.acabamento],
			[stages.corte, stages.montagem, stages.prova, stages.acabamento],
			[],
		]);
		const second = await approvedQuote(owner, clientId, [
			pieceLine(stock, person.profileId, {
				serviceIds: [catalog.laser, catalog.cava],
			}),
		]);
		expect(await suggestedOf(owner, second.serviceOrderId)).toEqual([
			[stages.corte, stages.prova, stages.acabamento],
		]);
	});

	test("suggests by the flow version of the order until it adopts the current one", async () => {
		const { catalog, clientId, owner, person, stages } =
			await suggestionSetup();
		const { serviceOrderId } = await approvedQuote(owner, clientId, [
			serviceLine(person, { serviceId: catalog.cava }),
		]);
		await hideProva(owner);
		const detail = await owner.serviceOrders.get({ serviceOrderId });
		expect([
			detail.currentFlowVersion,
			detail.serviceOrder.flowVersion,
		]).toEqual([2, 1]);
		expect(await suggestedOf(owner, serviceOrderId)).toEqual([
			[stages.prova, stages.acabamento],
		]);
		await owner.serviceOrders.adoptCurrentFlow({
			baseVersion: 1,
			opId: newOpId(),
			serviceOrderId,
		});
		expect(await suggestedOf(owner, serviceOrderId)).toEqual([
			[stages.acabamento],
		]);
	});

	test("a service without suggestion or missing from the catalog suggests every active stage", async () => {
		const { catalog, clientId, owner, person, stages } =
			await suggestionSetup();
		const { serviceOrderId } = await approvedQuote(owner, clientId, [
			serviceLine(person, { serviceId: catalog.barra }),
			serviceLine(person),
		]);
		const every = [
			stages.corte,
			stages.montagem,
			stages.prova,
			stages.acabamento,
		];
		expect(await suggestedOf(owner, serviceOrderId)).toEqual([every, every]);
	});

	test("an order without a flow suggests nothing", async () => {
		const { catalog, clientId, owner, person, server } =
			await suggestionSetup();
		const { serviceOrderId } = await approvedQuote(owner, clientId, [
			serviceLine(person, { serviceId: catalog.cava }),
		]);
		forgetFlow(server, serviceOrderId);
		const detail = await owner.serviceOrders.get({ serviceOrderId });
		expect([
			detail.currentFlowVersion,
			detail.serviceOrder.flowVersion,
		]).toEqual([1, null]);
		expect(detail.items.map((item) => item.suggestedStageIds)).toEqual([[]]);
	});

	test("counts the production items, the started and the ready ones in the list", async () => {
		const { approve, items, owner, serviceOrderId, stages } =
			await productionSetup();
		const other = await approve();
		const counts = async () =>
			Object.fromEntries(
				(await owner.serviceOrders.list({})).items.map((item) => [
					item.id,
					[item.productionCount, item.startedCount, item.readyCount],
				])
			);
		expect(await counts()).toEqual({
			[other.serviceOrderId]: [2, 0, 0],
			[serviceOrderId]: [2, 0, 0],
		});
		const [otherService = ""] = other.items.map((item) => item.itemId);
		await start(owner, items.service, 1, [stages.prova]);
		await advance(owner, items.service, 2);
		await start(owner, otherService, 1, [stages.prova]);
		expect(await counts()).toEqual({
			[other.serviceOrderId]: [2, 1, 0],
			[serviceOrderId]: [2, 0, 1],
		});
		await start(owner, items.piece, 1, [stages.corte, stages.montagem]);
		expect(await counts()).toEqual({
			[other.serviceOrderId]: [2, 1, 0],
			[serviceOrderId]: [2, 1, 1],
		});
	});

	test("the board lists service and piece items by due date, order code and position", async () => {
		const { catalog, clientId, owner, person, stages, stock } =
			await suggestionSetup();
		const open = await approvedQuote(
			owner,
			clientId,
			[
				serviceLine(person, { serviceId: catalog.cava }),
				materialLine(stock.zipperId, "1000000"),
			],
			{ dueOn: null }
		);
		const dated = await approvedQuote(
			owner,
			clientId,
			[
				serviceLine(person, { serviceId: catalog.cava }),
				pieceLine(stock, person.profileId, { serviceIds: [catalog.vestido] }),
				materialLine(stock.zipperId, "1000000"),
			],
			{ dueOn: "2026-10-10" }
		);
		await hideProva(owner);
		const later = await approvedQuote(
			owner,
			clientId,
			[serviceLine(person, { serviceId: catalog.cava })],
			{ dueOn: "2026-10-10" }
		);
		const sooner = await approvedQuote(
			owner,
			clientId,
			[serviceLine(person, { serviceId: catalog.cava })],
			{ dueOn: "2026-10-05" }
		);
		const details = await inSequence([sooner, dated, later, open], (input) =>
			owner.serviceOrders.get({ serviceOrderId: input.serviceOrderId })
		);
		const board = await owner.serviceOrderItems.board({});
		const flow = await owner.productionFlow.get({});
		expect(board.flow).toEqual({
			id: flow.id,
			stages: flow.stages,
			version: 2,
		});
		expect(board.orders).toEqual(
			details.map((detail) => ({
				clientName: "Maria Beatriz Alencar",
				code: detail.serviceOrder.code,
				flowStages: detail.serviceOrder.flowStages,
				flowVersion: detail.serviceOrder.flowVersion,
				id: detail.serviceOrder.id,
			}))
		);
		expect(board.orders.map((order) => order.flowVersion)).toEqual([
			2, 1, 2, 1,
		]);
		expect(board.items).toEqual(
			details.flatMap((detail) =>
				detail.items
					.filter((item) => item.kind !== "material")
					.map((item) => ({
						dueOn: item.dueOn,
						id: item.id,
						kind: item.kind,
						line: item.line,
						position: item.position,
						productionStatus: item.productionStatus,
						reservations: item.reservations,
						serviceOrderId: item.serviceOrderId,
						stageId: item.stageId,
						stageIds: item.stageIds,
						suggestedStageIds: item.suggestedStageIds,
						version: item.version,
					}))
			)
		);
		expect(
			board.items.map((item) => [item.serviceOrderId, item.position])
		).toEqual([
			[sooner.serviceOrderId, 0],
			[dated.serviceOrderId, 0],
			[dated.serviceOrderId, 1],
			[later.serviceOrderId, 0],
			[open.serviceOrderId, 0],
		]);
		expect(board.items[2]?.reservations).toEqual([
			{ reservedMicros: "2500000", variantId: stock.crepeId },
			{ reservedMicros: "1000000", variantId: stock.zipperId },
		]);
		expect(board.items.map((item) => item.suggestedStageIds)).toEqual([
			[stages.acabamento],
			[stages.prova, stages.acabamento],
			[stages.corte, stages.montagem, stages.prova, stages.acabamento],
			[stages.acabamento],
			[stages.prova, stages.acabamento],
		]);
	});

	test("the board without a flow is not found", async () => {
		const { owner, server } = await ownerSetup(servers);
		server.native().query("DELETE FROM production_flow").run();
		await expect(owner.serviceOrderItems.board({})).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Fluxo de produção não encontrado",
		});
	});

	test("the board needs a session", async () => {
		const { server } = await ownerSetup(servers);
		await expect(rpc(server).serviceOrderItems.board({})).rejects.toMatchObject(
			{ code: "UNAUTHORIZED" }
		);
	});
});

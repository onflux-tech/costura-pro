import { afterEach, describe, expect, test } from "bun:test";
import { reconciliationCreatePayload } from "@costura-pro/api/reconciliation/schemas";

import {
	approvedQuote,
	createClient,
	createVariant,
	materialLine,
	type Owner,
	ownerSetup,
	pieceLine,
	type ReconcileTarget,
	readyToReconcile,
	reconcileInput,
	reconcileLine,
	type Stock,
	seedPerson,
	seedStock,
	serviceLine,
} from "./service-order-fixtures";
import { inSequence, newOpId, rpc, type TestServer } from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

type MovementRow = {
	id: string;
	kind: string;
	location_id: string;
	lot_id: string | null;
	quantity_micros: number;
	value_cents: number;
	variant_id: string;
};

function movementsOf(server: TestServer, reconciliationId: string) {
	return server
		.native()
		.query<MovementRow, [string]>(
			"SELECT id, kind, variant_id, location_id, lot_id, quantity_micros, value_cents FROM stock_movement WHERE material_reconciliation_id = ? ORDER BY rowid"
		)
		.all(reconciliationId)
		.map((row) => ({
			id: row.id,
			kind: row.kind,
			locationId: row.location_id,
			lotId: row.lot_id,
			quantityMicros: String(row.quantity_micros),
			valueCents: String(row.value_cents),
			variantId: row.variant_id,
		}));
}

function movementCount(server: TestServer): number {
	return (
		server
			.native()
			.query<{ total: number }, []>(
				"SELECT count(*) AS total FROM stock_movement"
			)
			.get()?.total ?? 0
	);
}

function pointOf(server: TestServer, variantId: string, locationId: string) {
	const row = server
		.native()
		.query<{ quantity_micros: number; value_cents: number }, [string, string]>(
			"SELECT quantity_micros, value_cents FROM stock_balance WHERE variant_id = ? AND location_id = ? AND lot_id IS NULL"
		)
		.get(variantId, locationId);
	return row
		? [String(row.quantity_micros), String(row.value_cents)]
		: undefined;
}

function factsOf(server: TestServer, itemId: string) {
	return server
		.native()
		.query<
			{ id: string; lines: string; note: string | null; version: number },
			[string]
		>(
			"SELECT id, lines, note, version FROM material_reconciliation WHERE service_order_item_id = ?"
		)
		.all(itemId)
		.map((row) => ({ ...row, lines: JSON.parse(row.lines) }));
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

function itemChanges(server: TestServer, itemId: string) {
	return server
		.native()
		.query<{ op_id: string | null; version: number }, [string]>(
			"SELECT op_id, version FROM change_log WHERE aggregate_type = 'serviceOrderItem' AND aggregate_id = ? ORDER BY cursor"
		)
		.all(itemId);
}

type PointSum = {
	id: string;
	quantity_micros: number;
	value_cents: number;
};

function expectBalancesFromMovements(server: TestServer) {
	const sums = server
		.native()
		.query<PointSum, []>(
			"SELECT variant_id || '|' || location_id || '|' || coalesce(lot_id, '') AS id, sum(quantity_micros) AS quantity_micros, sum(value_cents) AS value_cents FROM stock_movement GROUP BY variant_id, location_id, lot_id ORDER BY id"
		)
		.all();
	const balances = server
		.native()
		.query<PointSum, []>(
			"SELECT variant_id || '|' || location_id || '|' || coalesce(lot_id, '') AS id, quantity_micros, value_cents FROM stock_balance ORDER BY id"
		)
		.all();
	expect(balances).toEqual(sums);
}

async function stagesOf(owner: Owner) {
	const flow = await owner.productionFlow.get({});
	const [corte = "", , , acabamento = ""] = flow.stages.map(
		(stage) => stage.id
	);
	return { acabamento, corte };
}

async function reconciliationSetup() {
	const { owner, server } = await ownerSetup(servers);
	const stock = await seedStock(owner);
	const clientId = await createClient(owner);
	const person = await seedPerson(owner, clientId);
	const stages = await stagesOf(owner);
	const input = await approvedQuote(owner, clientId, [
		serviceLine(person),
		pieceLine(stock, person.profileId),
		materialLine(stock.zipperId, "2000000"),
	]);
	const [service = "", piece = "", material = ""] = input.items.map(
		(item) => item.itemId
	);
	const target: ReconcileTarget = { itemId: piece, stock };
	return {
		clientId,
		items: { material, piece, service },
		owner,
		person,
		server,
		stages,
		stock,
		target,
	};
}

async function readySetup() {
	const setup = await reconciliationSetup();
	const version = await readyToReconcile(setup.owner, setup.items.piece, [
		setup.stages.corte,
		setup.stages.acabamento,
	]);
	return { ...setup, version };
}

function forro(owner: Owner) {
	return createVariant(owner, "Forro", {
		baseUnit: "m",
		code: null,
		displayPrecision: 2,
		name: "Branco",
		referenceCostCents: "1200",
	});
}

function meterComponent(
	variantId: string,
	materialName: string,
	quantityMicros: string
) {
	return {
		baseUnit: "m" as const,
		code: null,
		displayPrecision: 2,
		id: crypto.randomUUID(),
		kind: "material" as const,
		materialName,
		materialVariantId: variantId,
		quantityMicros,
		unitCostCents: "3000",
		variantName: "Preto",
	};
}

function crepeLine(stock: Stock, consumedMicros: string, lostMicros = "0") {
	return reconcileLine(stock.crepeId, stock.locationId, consumedMicros, {
		lostMicros,
	});
}

function zipperLine(stock: Stock) {
	return reconcileLine(stock.zipperId, stock.locationId, "1000000");
}

function issueOf(values: Record<string, unknown>) {
	return reconciliationCreatePayload.safeParse(values).error?.issues[0]
		?.message;
}

describe("material reconciliation", () => {
	test("consumes the planned materials, records the fact and marks the piece ready", async () => {
		const { items, owner, server, stock, target, version } = await readySetup();
		expect(version).toBe(3);
		const before = itemChanges(server, items.piece).length;
		const input = reconcileInput(target, {
			lines: [crepeLine(stock, "3200000", "200000"), zipperLine(stock)],
		});
		expect(await owner.serviceOrderItems.reconcile(input)).toEqual({
			id: input.reconciliationId,
			version: 1,
		});
		const [crepePart, zipperPart] = input.lines.map((line) => line.parts[0]);
		expect(movementsOf(server, input.reconciliationId)).toEqual([
			{
				id: crepePart?.movementId ?? "",
				kind: "consumption",
				locationId: stock.locationId,
				lotId: null,
				quantityMicros: "-3400000",
				valueCents: "-10200",
				variantId: stock.crepeId,
			},
			{
				id: zipperPart?.movementId ?? "",
				kind: "consumption",
				locationId: stock.locationId,
				lotId: null,
				quantityMicros: "-1000000",
				valueCents: "-370",
				variantId: stock.zipperId,
			},
		]);
		expect(factsOf(server, items.piece)).toEqual([
			{
				id: input.reconciliationId,
				lines: [
					{
						consumedMicros: "3200000",
						lostMicros: "200000",
						parts: [
							{
								locationId: stock.locationId,
								lotId: null,
								movementId: crepePart?.movementId,
								provisionalCents: "2700",
								provisionalMicros: "900000",
								quantityMicros: "3400000",
								valueCents: "10200",
							},
						],
						plannedMicros: "3400000",
						plannedVariantId: stock.crepeId,
						swapReason: null,
						variantId: stock.crepeId,
					},
					{
						consumedMicros: "1000000",
						lostMicros: "0",
						parts: [
							{
								locationId: stock.locationId,
								lotId: null,
								movementId: zipperPart?.movementId,
								provisionalCents: "0",
								provisionalMicros: "0",
								quantityMicros: "1000000",
								valueCents: "370",
							},
						],
						plannedMicros: "1000000",
						plannedVariantId: stock.zipperId,
						swapReason: null,
						variantId: stock.zipperId,
					},
				],
				note: null,
				version: 1,
			},
		]);
		expect(pointOf(server, stock.crepeId, stock.locationId)).toEqual([
			"-900000",
			"-2700",
		]);
		expect(pointOf(server, stock.zipperId, stock.locationId)).toEqual([
			"4000000",
			"1480",
		]);
		expect(productionOf(server, items.piece)).toMatchObject({
			stageId: null,
			status: "ready",
			version: 4,
		});
		const changes = itemChanges(server, items.piece);
		expect(changes).toHaveLength(before + 1);
		expect(changes.at(-1)).toEqual({ op_id: input.opId, version: 4 });
		expectBalancesFromMovements(server);
	});

	test("repeats the same operation by opId without a second fact", async () => {
		const { items, owner, server, stock, target } = await readySetup();
		const input = reconcileInput(target, { note: " Sobrou retalho " });
		const first = await owner.serviceOrderItems.reconcile(input);
		const points = [
			pointOf(server, stock.crepeId, stock.locationId),
			pointOf(server, stock.zipperId, stock.locationId),
		];
		const moved = movementCount(server);
		expect(await owner.serviceOrderItems.reconcile(input)).toEqual(first);
		expect(factsOf(server, items.piece)).toHaveLength(1);
		expect(factsOf(server, items.piece)[0]?.note).toBe("Sobrou retalho");
		expect(movementCount(server)).toBe(moved);
		expect([
			pointOf(server, stock.crepeId, stock.locationId),
			pointOf(server, stock.zipperId, stock.locationId),
		]).toEqual(points);
	});

	test("a second reconciliation of the same piece is refused without new movements", async () => {
		const { items, owner, server, target } = await readySetup();
		await owner.serviceOrderItems.reconcile(reconcileInput(target));
		const moved = movementCount(server);
		await expect(
			owner.serviceOrderItems.reconcile(reconcileInput(target))
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Subitem já reconciliado",
		});
		expect(movementCount(server)).toBe(moved);
		expect(factsOf(server, items.piece)).toHaveLength(1);
	});

	test("refuses a piece before its last stage, a ready service and a material item", async () => {
		const { items, owner, server, stages, stock, target } =
			await reconciliationSetup();
		await owner.serviceOrderItems.start({
			baseVersion: 1,
			itemId: items.piece,
			opId: newOpId(),
			stageIds: [stages.corte, stages.acabamento],
		});
		const notAtLast = {
			code: "NOT_FOUND",
			message: "O subitem não está na última etapa",
		};
		await expect(
			owner.serviceOrderItems.reconcile(reconcileInput(target))
		).rejects.toMatchObject(notAtLast);
		await readyToReconcile(owner, items.service, [stages.acabamento]);
		await owner.serviceOrderItems.advance({
			baseVersion: 2,
			itemId: items.service,
			opId: newOpId(),
		});
		expect(productionOf(server, items.service).status).toBe("ready");
		await expect(
			owner.serviceOrderItems.reconcile(
				reconcileInput({ itemId: items.service, stock })
			)
		).rejects.toMatchObject(notAtLast);
		await expect(
			owner.serviceOrderItems.reconcile(
				reconcileInput({ itemId: items.material, stock })
			)
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Subitem de produção não encontrado",
		});
		await expect(
			owner.serviceOrderItems.reconcile(
				reconcileInput({ itemId: crypto.randomUUID(), stock })
			)
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Subitem de produção não encontrado",
		});
		expect(movementCount(server)).toBe(2);
	});

	test("refuses lines that do not match the planned materials", async () => {
		const { owner, server, stock, target } = await readySetup();
		const strange = crypto.randomUUID();
		await inSequence(
			[
				[zipperLine(stock), crepeLine(stock, "3400000")],
				[crepeLine(stock, "3400000")],
				[
					crepeLine(stock, "3400000"),
					reconcileLine(strange, stock.locationId, "1000000"),
				],
			],
			async (lines) => {
				await expect(
					owner.serviceOrderItems.reconcile(reconcileInput(target, { lines }))
				).rejects.toMatchObject({
					code: "NOT_FOUND",
					message: "Materiais não conferem com o subitem",
				});
			}
		);
		expect(movementCount(server)).toBe(2);
	});

	test("a swap needs the same unit and moves the used material", async () => {
		const { owner, server, stock, target } = await readySetup();
		const forroId = await forro(owner);
		const swapped = (variantId: string) =>
			reconcileLine(variantId, stock.locationId, "3400000", {
				plannedVariantId: stock.crepeId,
				swapReason: "Crepe acabou",
			});
		await expect(
			owner.serviceOrderItems.reconcile(
				reconcileInput(target, {
					lines: [swapped(stock.zipperId), zipperLine(stock)],
				})
			)
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Troca precisa de material com a mesma unidade",
		});
		await expect(
			owner.serviceOrderItems.reconcile(
				reconcileInput(target, {
					lines: [swapped(crypto.randomUUID()), zipperLine(stock)],
				})
			)
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Troca precisa de material com a mesma unidade",
		});
		const input = reconcileInput(target, {
			lines: [swapped(forroId), zipperLine(stock)],
		});
		await owner.serviceOrderItems.reconcile(input);
		expect(movementsOf(server, input.reconciliationId)[0]).toMatchObject({
			quantityMicros: "-3400000",
			valueCents: "-4080",
			variantId: forroId,
		});
		expect(pointOf(server, forroId, stock.locationId)).toEqual([
			"-3400000",
			"-4080",
		]);
		expect(pointOf(server, stock.crepeId, stock.locationId)).toEqual([
			"2500000",
			"7500",
		]);
		expectBalancesFromMovements(server);
	});

	test("two lines of the same variant read the point left by the first", async () => {
		const { clientId, owner, person, server, stages, stock } =
			await reconciliationSetup();
		const forroId = await forro(owner);
		const piece = pieceLine(stock, person.profileId);
		const approval = await approvedQuote(owner, clientId, [
			{
				...piece,
				components: [
					meterComponent(stock.crepeId, "Crepe", "1000000"),
					meterComponent(forroId, "Forro", "1000000"),
					...piece.components.filter(
						(component) => component.kind === "service"
					),
				],
			},
		]);
		const itemId = approval.items[0]?.itemId ?? "";
		await readyToReconcile(owner, itemId, [stages.corte, stages.acabamento]);
		const input = reconcileInput(
			{ itemId, stock },
			{
				lines: [
					crepeLine(stock, "2000000"),
					reconcileLine(stock.crepeId, stock.locationId, "1000000", {
						plannedVariantId: forroId,
						swapReason: "Forro manchou",
					}),
				],
			}
		);
		await owner.serviceOrderItems.reconcile(input);
		const [fact] = factsOf(server, itemId);
		expect(
			fact?.lines.map(
				(line: {
					parts: { provisionalMicros: string; valueCents: string }[];
					plannedMicros: string;
				}) => [
					line.plannedMicros,
					line.parts[0]?.provisionalMicros,
					line.parts[0]?.valueCents,
				]
			)
		).toEqual([
			["1000000", "0", "6000"],
			["1000000", "500000", "3000"],
		]);
		expect(pointOf(server, stock.crepeId, stock.locationId)).toEqual([
			"-500000",
			"-1500",
		]);
		expectBalancesFromMovements(server);
	});

	test("refuses a malformed reconciliation", async () => {
		const { owner, server, stock, target } = await readySetup();
		const base = reconcileInput(target);
		const [crepe, zipper] = base.lines;
		if (!(crepe && zipper)) {
			throw new Error("Linhas ausentes");
		}
		const [crepePart] = crepe.parts;
		if (!crepePart) {
			throw new Error("Parte ausente");
		}
		const other = await owner.stockLocations.create({
			locationId: crypto.randomUUID(),
			name: "Gaveta",
			notes: null,
			opId: newOpId(),
		});
		const half = { ...crepePart, quantityMicros: "1700000" };
		const cases: [unknown[], string | undefined][] = [
			[
				[{ ...crepe, consumedMicros: "3000000" }, zipper],
				"Partes não somam a saída",
			],
			[
				[
					{
						...crepe,
						parts: [half, { ...half, movementId: crypto.randomUUID() }],
					},
					zipper,
				],
				"Local e lote repetidos",
			],
			[
				[{ ...crepe, variantId: stock.zipperId }, zipper],
				"Motivo da troca obrigatório",
			],
			[
				[{ ...crepe, swapReason: "Sem troca" }, zipper],
				"Motivo da troca obrigatório",
			],
			[
				[
					{
						...crepe,
						parts: [
							half,
							{
								...half,
								locationId: other.id,
								movementId: crypto.randomUUID(),
							},
						],
					},
					{
						...zipper,
						parts: [
							{
								...(zipper.parts[0] ?? crepePart),
								movementId: half.movementId,
							},
						],
					},
				],
				"Id repetido",
			],
			[
				[
					{
						...crepe,
						parts: Array.from({ length: 21 }, () => ({
							...crepePart,
							movementId: crypto.randomUUID(),
						})),
					},
					zipper,
				],
				undefined,
			],
			[
				[
					{
						...crepe,
						consumedMicros: "0",
						parts: [{ ...crepePart, quantityMicros: "0" }],
					},
					zipper,
				],
				undefined,
			],
		];
		await inSequence(cases, async ([lines, message]) => {
			const { opId: _opId, reconciliationId: _id, ...values } = base;
			if (message) {
				expect(issueOf({ ...values, lines })).toBe(message);
			}
			await expect(
				owner.serviceOrderItems.reconcile({
					...base,
					lines,
					opId: newOpId(),
				} as typeof base)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		});
		expect(movementCount(server)).toBe(2);
	});

	test("refuses a movement id already taken", async () => {
		const { owner, server, target } = await readySetup();
		const base = reconcileInput(target);
		const taken =
			server
				.native()
				.query<{ id: string }, []>("SELECT id FROM stock_movement LIMIT 1")
				.get()?.id ?? "";
		await inSequence([base.reconciliationId, taken], async (movementId) => {
			const [crepe, zipper] = base.lines;
			const lines = [
				{
					...crepe,
					parts: crepe?.parts.map((part) => ({ ...part, movementId })),
				},
				zipper,
			];
			await expect(
				owner.serviceOrderItems.reconcile({
					...base,
					lines,
					opId: newOpId(),
				} as typeof base)
			).rejects.toMatchObject({
				code: "CONFLICT",
				message: "Registro já existe",
			});
		});
		expect(movementCount(server)).toBe(2);
	});

	test("a lot tracked material needs the lot in the part", async () => {
		const { owner, server, stock, target } = await readySetup();
		const linho = await createVariant(owner, "Linho", {
			baseUnit: "m",
			code: null,
			displayPrecision: 2,
			name: "Cru",
			referenceCostCents: "2500",
			tracksLots: true,
		});
		await expect(
			owner.serviceOrderItems.reconcile(
				reconcileInput(target, {
					lines: [
						reconcileLine(linho, stock.locationId, "3400000", {
							plannedVariantId: stock.crepeId,
							swapReason: "Cliente trocou o tecido",
						}),
						zipperLine(stock),
					],
				})
			)
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Lote não encontrado",
		});
		expect(movementCount(server)).toBe(2);
	});

	test("after the reconciliation the piece goes back and advances straight to ready", async () => {
		const { items, owner, server, stages, target } = await readySetup();
		await owner.serviceOrderItems.reconcile(reconcileInput(target));
		expect(
			await owner.serviceOrderItems.back({
				baseVersion: 4,
				itemId: items.piece,
				opId: newOpId(),
			})
		).toEqual({ version: 5 });
		expect(productionOf(server, items.piece)).toMatchObject({
			stageId: stages.acabamento,
			status: "inProgress",
		});
		expect(
			await owner.serviceOrderItems.advance({
				baseVersion: 5,
				itemId: items.piece,
				opId: newOpId(),
			})
		).toEqual({ version: 6 });
		expect(productionOf(server, items.piece)).toMatchObject({
			stageId: null,
			status: "ready",
		});
	});

	test("needs a session to reconcile", async () => {
		const { server, target } = await readySetup();
		await expect(
			rpc(server).serviceOrderItems.reconcile(reconcileInput(target))
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

import { afterEach, describe, expect, test } from "bun:test";
import {
	reconciliationCreatePayload,
	reconciliationReversePayload,
} from "@costura-pro/api/reconciliation/schemas";

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
	reverseInput,
	type Stock,
	seedPerson,
	seedStock,
	serviceLine,
} from "./service-order-fixtures";
import {
	inSequence,
	manualClock,
	newOpId,
	rpc,
	type TestServer,
} from "./support";

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
		serviceOrderId: input.serviceOrderId,
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

type ReversalMovementRow = {
	id: string;
	occurred_on: string;
	quantity_micros: number;
	reason: string | null;
	reverses_movement_id: string | null;
	value_cents: number;
	variant_id: string;
};

function reversalMovementsOf(server: TestServer, reconciliationId: string) {
	return server
		.native()
		.query<ReversalMovementRow, [string]>(
			"SELECT id, variant_id, quantity_micros, value_cents, reverses_movement_id, reason, occurred_on FROM stock_movement WHERE material_reconciliation_id = ? AND kind = 'reversal' ORDER BY rowid"
		)
		.all(reconciliationId)
		.map((row) => ({
			id: row.id,
			occurredOn: row.occurred_on,
			quantityMicros: String(row.quantity_micros),
			reason: row.reason,
			reversesMovementId: row.reverses_movement_id,
			valueCents: String(row.value_cents),
			variantId: row.variant_id,
		}));
}

function reversalFactsOf(server: TestServer, reconciliationId: string) {
	return server
		.native()
		.query<
			{ id: string; occurred_on: string; reason: string; version: number },
			[string]
		>(
			"SELECT id, occurred_on, reason, version FROM material_reconciliation_reversal WHERE reconciliation_id = ?"
		)
		.all(reconciliationId);
}

function reversalChanges(server: TestServer, reversalId: string) {
	return server
		.native()
		.query<{ op_id: string | null; version: number }, [string]>(
			"SELECT op_id, version FROM change_log WHERE aggregate_type = 'materialReconciliationReversal' AND aggregate_id = ?"
		)
		.all(reversalId);
}

function reservationsOf(server: TestServer, itemId: string) {
	return server
		.native()
		.query<{ quantity: number; variant_id: string }, [string]>(
			"SELECT variant_id, quantity_micros AS quantity FROM stock_reservation WHERE service_order_item_id = ? ORDER BY rowid"
		)
		.all(itemId)
		.map((row) => [row.variant_id, String(row.quantity)]);
}

function crepeMaterialLine(stock: Stock, quantityMicros: string) {
	return {
		...materialLine(stock.crepeId, quantityMicros, {
			materialName: "Crepe",
			variantName: "Preto",
		}),
		baseUnit: "m" as const,
		displayPrecision: 2,
		unitCostCents: "3000",
	};
}

async function crepeMaterialId(owner: Owner, stock: Stock) {
	const { items } = await owner.materialVariants.search({ query: "crepe" });
	return items.find((item) => item.id === stock.crepeId)?.materialId ?? "";
}

describe("material reconciliation reversal", () => {
	test("returns the consumption at the output value and takes the piece out of ready", async () => {
		const { items, owner, server, stages, stock, target } = await readySetup();
		const reconciled = reconcileInput(target);
		await owner.serviceOrderItems.reconcile(reconciled);
		const input = reverseInput(reconciled);
		expect(await owner.serviceOrderItems.reverseReconciliation(input)).toEqual({
			id: input.reversalId,
			version: 1,
		});
		expect(pointOf(server, stock.crepeId, stock.locationId)).toEqual([
			"2500000",
			"7500",
		]);
		expect(pointOf(server, stock.zipperId, stock.locationId)).toEqual([
			"5000000",
			"1850",
		]);
		const [crepePart, zipperPart] = reconciled.lines.map(
			(line) => line.parts[0]
		);
		expect(reversalMovementsOf(server, reconciled.reconciliationId)).toEqual([
			{
				id: input.movementIds[0] ?? "",
				occurredOn: "2026-09-26",
				quantityMicros: "3400000",
				reason: "Peça voltou para ajuste",
				reversesMovementId: crepePart?.movementId ?? "",
				valueCents: "10200",
				variantId: stock.crepeId,
			},
			{
				id: input.movementIds[1] ?? "",
				occurredOn: "2026-09-26",
				quantityMicros: "1000000",
				reason: "Peça voltou para ajuste",
				reversesMovementId: zipperPart?.movementId ?? "",
				valueCents: "370",
				variantId: stock.zipperId,
			},
		]);
		expect(reversalFactsOf(server, reconciled.reconciliationId)).toEqual([
			{
				id: input.reversalId,
				occurred_on: "2026-09-26",
				reason: "Peça voltou para ajuste",
				version: 1,
			},
		]);
		expect(reversalChanges(server, input.reversalId)).toEqual([
			{ op_id: input.opId, version: 1 },
		]);
		expect(productionOf(server, items.piece)).toEqual({
			stageId: stages.acabamento,
			stageIds: [stages.corte, stages.acabamento],
			status: "inProgress",
			version: 5,
		});
		expect(itemChanges(server, items.piece).at(-1)).toEqual({
			op_id: input.opId,
			version: 5,
		});
		expectBalancesFromMovements(server);
	});

	test("refuses a partial reversal, an unknown reconciliation and a second reversal", async () => {
		const { owner, server, target } = await readySetup();
		const reconciled = reconcileInput(target);
		await owner.serviceOrderItems.reconcile(reconciled);
		const moved = movementCount(server);
		const notFound = {
			code: "NOT_FOUND",
			message: "Reconciliação não encontrada",
		};
		const input = reverseInput(reconciled);
		await expect(
			owner.serviceOrderItems.reverseReconciliation({
				...input,
				movementIds: input.movementIds.slice(1),
			})
		).rejects.toMatchObject(notFound);
		await expect(
			owner.serviceOrderItems.reverseReconciliation(
				reverseInput(reconciled, { reconciliationId: crypto.randomUUID() })
			)
		).rejects.toMatchObject(notFound);
		expect(movementCount(server)).toBe(moved);
		await owner.serviceOrderItems.reverseReconciliation(input);
		await expect(
			owner.serviceOrderItems.reverseReconciliation(reverseInput(reconciled))
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Reconciliação já estornada",
		});
		expect(movementCount(server)).toBe(moved + 2);
		expect(reversalFactsOf(server, reconciled.reconciliationId)).toHaveLength(
			1
		);
	});

	test("refuses reversal movement ids that are taken, repeated or missing", async () => {
		const { owner, server, target } = await readySetup();
		const reconciled = reconcileInput(target);
		await owner.serviceOrderItems.reconcile(reconciled);
		const moved = movementCount(server);
		const base = reverseInput(reconciled);
		const [first = "", second = ""] = base.movementIds;
		const consumed = reconciled.lines[0]?.parts[0]?.movementId ?? "";
		await inSequence([base.reversalId, consumed], async (movementId) => {
			await expect(
				owner.serviceOrderItems.reverseReconciliation({
					...base,
					movementIds: [movementId, second],
					opId: newOpId(),
				})
			).rejects.toMatchObject({
				code: "CONFLICT",
				message: "Registro já existe",
			});
		});
		const { opId: _opId, reversalId: _reversalId, ...values } = base;
		expect(
			reconciliationReversePayload.safeParse({
				...values,
				movementIds: [first, first],
			}).error?.issues[0]?.message
		).toBe("Id repetido");
		await inSequence(
			[{ movementIds: [first, first] }, { movementIds: [] }, { reason: "  " }],
			async (change) => {
				await expect(
					owner.serviceOrderItems.reverseReconciliation({
						...base,
						...change,
						opId: newOpId(),
					})
				).rejects.toMatchObject({ code: "BAD_REQUEST" });
			}
		);
		expect(movementCount(server)).toBe(moved);
	});

	test("reversing after going back keeps the piece where it is", async () => {
		const { items, owner, server, stages, target } = await readySetup();
		const reconciled = reconcileInput(target);
		await owner.serviceOrderItems.reconcile(reconciled);
		await owner.serviceOrderItems.back({
			baseVersion: 4,
			itemId: items.piece,
			opId: newOpId(),
		});
		const changes = itemChanges(server, items.piece).length;
		await owner.serviceOrderItems.reverseReconciliation(
			reverseInput(reconciled)
		);
		expect(productionOf(server, items.piece)).toMatchObject({
			stageId: stages.acabamento,
			status: "inProgress",
			version: 5,
		});
		expect(itemChanges(server, items.piece)).toHaveLength(changes);
	});

	test("a reversed piece can be reconciled again", async () => {
		const { items, owner, server, stock, target } = await readySetup();
		const reconciled = reconcileInput(target);
		await owner.serviceOrderItems.reconcile(reconciled);
		await owner.serviceOrderItems.reverseReconciliation(
			reverseInput(reconciled)
		);
		const again = reconcileInput(target);
		expect(await owner.serviceOrderItems.reconcile(again)).toEqual({
			id: again.reconciliationId,
			version: 1,
		});
		expect(productionOf(server, items.piece)).toMatchObject({
			stageId: null,
			status: "ready",
			version: 6,
		});
		expect(pointOf(server, stock.crepeId, stock.locationId)).toEqual([
			"-900000",
			"-2700",
		]);
		expectBalancesFromMovements(server);
	});

	test("a reconciliation movement is reversed only through the order", async () => {
		const { owner, server, stock, target } = await readySetup();
		const reconciled = reconcileInput(target);
		await owner.serviceOrderItems.reconcile(reconciled);
		const fromReconciliation = {
			code: "NOT_FOUND",
			message: "Movimento de reconciliação se estorna pela OS",
		};
		const reverseMovement = (reversesMovementId: string) =>
			owner.stockMovements.reverse({
				movementId: crypto.randomUUID(),
				occurredOn: "2026-09-26",
				opId: newOpId(),
				reason: "Lançado errado",
				reversesMovementId,
			});
		await expect(
			reverseMovement(reconciled.lines[0]?.parts[0]?.movementId ?? "")
		).rejects.toMatchObject(fromReconciliation);
		const adjustment = await owner.stockMovements.create({
			kind: "adjustment",
			locationId: stock.locationId,
			lotId: null,
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-26",
			opId: newOpId(),
			quantityMicros: "-100000",
			reason: "Perda no corte",
			variantId: stock.crepeId,
		});
		expect(await reverseMovement(adjustment.id)).toMatchObject({ version: 1 });
		const reversal = reverseInput(reconciled);
		await owner.serviceOrderItems.reverseReconciliation(reversal);
		const moved = movementCount(server);
		await expect(
			reverseMovement(reversal.movementIds[0] ?? "")
		).rejects.toMatchObject(fromReconciliation);
		expect(movementCount(server)).toBe(moved);
		expectBalancesFromMovements(server);
	});

	test("releases the reservation of a reconciled piece everywhere and returns it on reversal", async () => {
		const { clientId, items, owner, stock, target } = await readySetup();
		const quoteId = crypto.randomUUID();
		await owner.quotes.create({
			clientId,
			createdOn: "2026-09-24",
			discount: null,
			leadTimeDays: 20,
			lines: [crepeMaterialLine(stock, "1000000")],
			notes: null,
			opId: newOpId(),
			quoteId,
			validityDays: 15,
		} as Parameters<Owner["quotes"]["create"]>[0]);
		const materialId = await crepeMaterialId(owner, stock);
		const reservedEverywhere = async () => {
			const balances = await owner.stockBalances.list({});
			const detail = await owner.stockBalances.get({
				variantId: stock.crepeId,
			});
			const { variants } = await owner.materials.get({ materialId });
			const quote = await owner.quotes.get({ quoteId });
			return {
				balance: balances.items.find((item) => item.variantId === stock.crepeId)
					?.reservedMicros,
				detail: detail.reservations.map((reservation) => [
					reservation.itemId,
					reservation.reservedMicros,
				]),
				material: variants.find((variant) => variant.id === stock.crepeId)
					?.reservedMicros,
				quote: quote.stock.find((entry) => entry.variantId === stock.crepeId)
					?.reservedMicros,
			};
		};
		const held = {
			balance: "2500000",
			detail: [[items.piece, "2500000"]],
			material: "2500000",
			quote: "2500000",
		};
		expect(await reservedEverywhere()).toEqual(held);
		const reconciled = reconcileInput(target);
		await owner.serviceOrderItems.reconcile(reconciled);
		expect(await reservedEverywhere()).toEqual({
			balance: "0",
			detail: [],
			material: "0",
			quote: "0",
		});
		await owner.serviceOrderItems.reverseReconciliation(
			reverseInput(reconciled)
		);
		expect(await reservedEverywhere()).toEqual(held);
	});

	test("an approval after the reconciliation reserves nothing from a negative point", async () => {
		const { clientId, owner, server, stock, target } = await readySetup();
		await owner.serviceOrderItems.reconcile(reconcileInput(target));
		expect(pointOf(server, stock.crepeId, stock.locationId)).toEqual([
			"-900000",
			"-2700",
		]);
		const next = await approvedQuote(owner, clientId, [
			crepeMaterialLine(stock, "1000000"),
		]);
		expect(reservationsOf(server, next.items[0]?.itemId ?? "")).toEqual([]);
	});

	test("an approval after the reconciliation reserves what the physical stock allows", async () => {
		const { clientId, owner, server, stock, target } = await readySetup();
		await owner.serviceOrderItems.reconcile(
			reconcileInput(target, {
				lines: [crepeLine(stock, "2000000"), zipperLine(stock)],
			})
		);
		const next = await approvedQuote(owner, clientId, [
			crepeMaterialLine(stock, "1000000"),
		]);
		expect(reservationsOf(server, next.items[0]?.itemId ?? "")).toEqual([
			[stock.crepeId, "500000"],
		]);
	});

	test("a reconciled piece stops the shortage until it is reversed", async () => {
		const { owner, target } = await readySetup();
		const shortage = async () =>
			(await owner.serviceOrders.list({})).items.map((item) => item.shortage);
		expect(await shortage()).toEqual([true]);
		const reconciled = reconcileInput(target);
		await owner.serviceOrderItems.reconcile(reconciled);
		expect(await shortage()).toEqual([false]);
		await owner.serviceOrderItems.reverseReconciliation(
			reverseInput(reconciled)
		);
		expect(await shortage()).toEqual([true]);
	});

	test("needs a session to reverse a reconciliation", async () => {
		const { owner, server, target } = await readySetup();
		const reconciled = reconcileInput(target);
		await owner.serviceOrderItems.reconcile(reconciled);
		await expect(
			rpc(server).serviceOrderItems.reverseReconciliation(
				reverseInput(reconciled)
			)
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

function stockOpening(
	owner: Owner,
	variantId: string,
	locationId: string,
	lotId: string | null,
	quantityMicros: string,
	valueCents: string
) {
	return owner.stockMovements.create({
		kind: "opening",
		locationId,
		lotId,
		movementId: crypto.randomUUID(),
		occurredOn: "2026-09-01",
		opId: newOpId(),
		quantityMicros,
		reason: null,
		valueCents,
		variantId,
	});
}

async function lotNamed(owner: Owner, variantId: string, label: string) {
	const { id } = await owner.stockLots.create({
		label,
		lotId: crypto.randomUUID(),
		notes: null,
		opId: newOpId(),
		variantId,
	});
	return id;
}

function linhoVariant(owner: Owner) {
	return createVariant(owner, "Linho", {
		baseUnit: "m",
		code: null,
		displayPrecision: 2,
		name: "Cru",
		referenceCostCents: "2500",
		tracksLots: true,
	});
}

describe("material reconciliation reads", () => {
	test("the order shows the reconciliation of the piece until it is reversed", async () => {
		const { items, owner, serviceOrderId, stock, target } = await readySetup();
		const reconciled = reconcileInput(target);
		await owner.serviceOrderItems.reconcile(reconciled);
		const detail = await owner.serviceOrders.get({ serviceOrderId });
		expect(detail.items.map((item) => [item.id, item.reconciled])).toEqual([
			[items.service, false],
			[items.piece, true],
			[items.material, false],
		]);
		expect(detail.items.map((item) => item.reconciliation?.id ?? null)).toEqual(
			[null, reconciled.reconciliationId, null]
		);
		const [crepePart, zipperPart] = reconciled.lines.map(
			(line) => line.parts[0]
		);
		expect(detail.items[1]?.reconciliation).toEqual({
			id: reconciled.reconciliationId,
			lines: [
				{
					baseUnit: "m",
					consumedMicros: "3400000",
					displayPrecision: 2,
					lostMicros: "0",
					materialName: "Crepe",
					parts: [
						{
							locationId: stock.locationId,
							locationName: "Armário",
							lotId: null,
							lotLabel: null,
							movementId: crepePart?.movementId ?? "",
							provisionalCents: "2700",
							provisionalMicros: "900000",
							quantityMicros: "3400000",
							valueCents: "10200",
						},
					],
					plannedCostCents: "10200",
					plannedMicros: "3400000",
					plannedVariantId: stock.crepeId,
					swapReason: null,
					variantId: stock.crepeId,
					variantName: "Preto",
				},
				{
					baseUnit: "un",
					consumedMicros: "1000000",
					displayPrecision: 0,
					lostMicros: "0",
					materialName: "Zíper",
					parts: [
						{
							locationId: stock.locationId,
							locationName: "Armário",
							lotId: null,
							lotLabel: null,
							movementId: zipperPart?.movementId ?? "",
							provisionalCents: "0",
							provisionalMicros: "0",
							quantityMicros: "1000000",
							valueCents: "370",
						},
					],
					plannedCostCents: "370",
					plannedMicros: "1000000",
					plannedVariantId: stock.zipperId,
					swapReason: null,
					variantId: stock.zipperId,
					variantName: "20 cm",
				},
			],
			note: null,
			occurredOn: "2026-09-25",
		});
		await owner.serviceOrderItems.reverseReconciliation(
			reverseInput(reconciled)
		);
		const after = await owner.serviceOrders.get({ serviceOrderId });
		expect(
			after.items.map((item) => [item.reconciled, item.reconciliation])
		).toEqual([
			[false, null],
			[false, null],
			[false, null],
		]);
	});

	test("a swapped line reads the names of the used material and the lot of the part", async () => {
		const { owner, serviceOrderId, stock, target } = await readySetup();
		const linho = await linhoVariant(owner);
		const lotId = await lotNamed(owner, linho, "Rolo 3");
		await stockOpening(
			owner,
			linho,
			stock.locationId,
			lotId,
			"5000000",
			"12500"
		);
		const swapped = reconcileLine(linho, stock.locationId, "3400000", {
			plannedVariantId: stock.crepeId,
			swapReason: "Cliente trocou o tecido",
		});
		const [part] = swapped.parts;
		await owner.serviceOrderItems.reconcile(
			reconcileInput(target, {
				lines: [{ ...swapped, parts: [{ ...part, lotId }] }, zipperLine(stock)],
			})
		);
		const detail = await owner.serviceOrders.get({ serviceOrderId });
		const [line] = detail.items[1]?.reconciliation?.lines ?? [];
		expect(line).toMatchObject({
			baseUnit: "m",
			materialName: "Linho",
			parts: [
				{
					locationName: "Armário",
					lotId,
					lotLabel: "Rolo 3",
					valueCents: "8500",
				},
			],
			plannedCostCents: "10200",
			plannedVariantId: stock.crepeId,
			swapReason: "Cliente trocou o tecido",
			variantId: linho,
			variantName: "Cru",
		});
	});

	test("the planned cost multiplies by the pieces and is empty without a unit cost", async () => {
		const { clientId, owner, person, stages, stock } = await readySetup();
		const piece = pieceLine(stock, person.profileId);
		const approval = await approvedQuote(owner, clientId, [
			{
				...piece,
				components: piece.components.map((component) =>
					component.kind === "material" && component.materialName === "Zíper"
						? { ...component, unitCostCents: null }
						: component
				),
				quantity: 2,
			},
		]);
		const itemId = approval.items[0]?.itemId ?? "";
		await readyToReconcile(owner, itemId, [stages.corte, stages.acabamento]);
		await owner.serviceOrderItems.reconcile(
			reconcileInput(
				{ itemId, stock },
				{
					lines: [
						reconcileLine(stock.crepeId, stock.locationId, "6800000"),
						reconcileLine(stock.zipperId, stock.locationId, "2000000"),
					],
				}
			)
		);
		const detail = await owner.serviceOrders.get({
			serviceOrderId: approval.serviceOrderId,
		});
		expect(
			detail.items[0]?.reconciliation?.lines.map((line) => [
				line.plannedMicros,
				line.plannedCostCents,
			])
		).toEqual([
			["6800000", "20400"],
			["2000000", null],
		]);
	});

	test("the board marks the reconciled piece and carries the opening day of the order", async () => {
		const { items, owner, serviceOrderId, target } = await readySetup();
		const reconciled = reconcileInput(target);
		await owner.serviceOrderItems.reconcile(reconciled);
		const board = await owner.serviceOrderItems.board({});
		expect(board.items.map((item) => [item.id, item.reconciled])).toEqual([
			[items.service, false],
			[items.piece, true],
		]);
		expect(board.orders.map((order) => [order.id, order.openedOn])).toEqual([
			[serviceOrderId, "2026-09-22"],
		]);
		await owner.serviceOrderItems.reverseReconciliation(
			reverseInput(reconciled)
		);
		const after = await owner.serviceOrderItems.board({});
		expect(after.items.map((item) => item.reconciled)).toEqual([false, false]);
	});

	test("lists the balance points of the asked variants with the lot creation", async () => {
		const clock = manualClock();
		const { owner } = await ownerSetup(servers, { now: clock.now });
		const stock = await seedStock(owner);
		const { id: araraId } = await owner.stockLocations.create({
			locationId: crypto.randomUUID(),
			name: "Arara",
			notes: null,
			opId: newOpId(),
		});
		await stockOpening(owner, stock.crepeId, araraId, null, "1000000", "3000");
		const linho = await linhoVariant(owner);
		const lotB = await lotNamed(owner, linho, "Rolo B");
		clock.advance(60_000);
		const lotA = await lotNamed(owner, linho, "Rolo A");
		const lotC = await lotNamed(owner, linho, "Rolo C");
		await stockOpening(owner, linho, stock.locationId, lotB, "2000000", "5000");
		await stockOpening(owner, linho, stock.locationId, lotA, "1000000", "2600");
		await stockOpening(owner, linho, stock.locationId, lotC, "500000", "1000");
		await owner.stockMovements.create({
			kind: "adjustment",
			locationId: stock.locationId,
			lotId: lotC,
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-02",
			opId: newOpId(),
			quantityMicros: "-500000",
			reason: "Retalho",
			variantId: linho,
		});
		const { variants } = await owner.stockBalances.variantPoints({
			variantIds: [linho, crypto.randomUUID(), stock.crepeId],
		});
		expect(variants).toEqual([
			{
				baseUnit: "m",
				displayPrecision: 2,
				points: [
					{
						locationId: stock.locationId,
						locationName: "Armário",
						lotCreatedAt: "2026-09-16T12:01:00.000Z",
						lotId: lotA,
						lotLabel: "Rolo A",
						quantityMicros: "1000000",
						valueCents: "2600",
					},
					{
						locationId: stock.locationId,
						locationName: "Armário",
						lotCreatedAt: "2026-09-16T12:00:00.000Z",
						lotId: lotB,
						lotLabel: "Rolo B",
						quantityMicros: "2000000",
						valueCents: "5000",
					},
				],
				referenceCostCents: "2500",
				tracksLots: true,
				variantId: linho,
			},
			{
				baseUnit: "m",
				displayPrecision: 2,
				points: [
					{
						locationId: araraId,
						locationName: "Arara",
						lotCreatedAt: null,
						lotId: null,
						lotLabel: null,
						quantityMicros: "1000000",
						valueCents: "3000",
					},
					{
						locationId: stock.locationId,
						locationName: "Armário",
						lotCreatedAt: null,
						lotId: null,
						lotLabel: null,
						quantityMicros: "2500000",
						valueCents: "7500",
					},
				],
				referenceCostCents: "3000",
				tracksLots: false,
				variantId: stock.crepeId,
			},
		]);
	});

	test("the stock history shows the order of a reconciliation movement and of its reversal", async () => {
		const { owner, serviceOrderId, stock, target } = await readySetup();
		const reconciled = reconcileInput(target);
		await owner.serviceOrderItems.reconcile(reconciled);
		await owner.serviceOrderItems.reverseReconciliation(
			reverseInput(reconciled)
		);
		const { serviceOrder } = await owner.serviceOrders.get({ serviceOrderId });
		const { items: movements } = await owner.stockMovements.list({
			variantId: stock.crepeId,
		});
		const order = {
			itemPosition: 1,
			serviceOrderCode: serviceOrder.code,
			serviceOrderId,
		};
		const none = {
			itemPosition: null,
			serviceOrderCode: null,
			serviceOrderId: null,
		};
		expect(
			movements.map((movement) => [
				movement.kind,
				{
					itemPosition: movement.itemPosition,
					serviceOrderCode: movement.serviceOrderCode,
					serviceOrderId: movement.serviceOrderId,
				},
			])
		).toEqual([
			["reversal", order],
			["consumption", order],
			["opening", none],
		]);
	});

	test("needs a session to read the balance points of variants", async () => {
		const { server, stock } = await readySetup();
		await expect(
			rpc(server).stockBalances.variantPoints({ variantIds: [stock.crepeId] })
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

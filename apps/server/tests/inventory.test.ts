import { afterEach, describe, expect, test } from "bun:test";
import { inventorySession } from "@costura-pro/db/schema/stock";

import {
	completeWizard,
	inSequence,
	manualClock,
	newOpId,
	rpc,
	type ServerOptions,
	startTestServer,
	type TestServer,
	times,
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

function createLocation(owner: Owner, name: string) {
	return owner.stockLocations.create({
		locationId: crypto.randomUUID(),
		name,
		notes: null,
		opId: newOpId(),
	});
}

type VariantSpec = {
	baseUnit: "m" | "un";
	displayPrecision: number;
	material: string;
	name: string;
	referenceCostCents: string;
	tracksLots?: boolean;
};

async function createVariant(owner: Owner, spec: VariantSpec) {
	const material = await owner.materials.create({
		category: "Tecido",
		materialId: crypto.randomUUID(),
		name: spec.material,
		notes: null,
		opId: newOpId(),
	});
	const variant = await owner.materialVariants.create({
		baseUnit: spec.baseUnit,
		code: null,
		displayPrecision: spec.displayPrecision,
		materialId: material.id,
		name: spec.name,
		opId: newOpId(),
		referenceCostCents: spec.referenceCostCents,
		tracksLots: spec.tracksLots ?? false,
		variantId: crypto.randomUUID(),
	});
	return { materialId: material.id, variantId: variant.id };
}

function createLot(owner: Owner, variantId: string, label: string) {
	return owner.stockLots.create({
		label,
		lotId: crypto.randomUUID(),
		notes: null,
		opId: newOpId(),
		variantId,
	});
}

async function opening(
	owner: Owner,
	input: {
		locationId: string;
		lotId?: string | null;
		quantityMicros: string;
		valueCents: string;
		variantId: string;
	}
) {
	const movementId = crypto.randomUUID();
	await owner.stockMovements.create({
		kind: "opening",
		locationId: input.locationId,
		lotId: input.lotId ?? null,
		movementId,
		occurredOn: "2026-09-20",
		opId: newOpId(),
		quantityMicros: input.quantityMicros,
		reason: null,
		valueCents: input.valueCents,
		variantId: input.variantId,
	});
	return movementId;
}

async function catalog(owner: Owner) {
	const armario = await createLocation(owner, "Armário 1");
	const prateleira = await createLocation(owner, "Prateleira 2");
	const oxford = await createVariant(owner, {
		baseUnit: "m",
		displayPrecision: 2,
		material: "Oxford",
		name: "Azul",
		referenceCostCents: "2500",
	});
	const linha = await createVariant(owner, {
		baseUnit: "un",
		displayPrecision: 0,
		material: "Linha 120",
		name: "Preta",
		referenceCostCents: "200",
	});
	const tricoline = await createVariant(owner, {
		baseUnit: "m",
		displayPrecision: 2,
		material: "Tricoline",
		name: "Floral",
		referenceCostCents: "2000",
		tracksLots: true,
	});
	const rolo1 = await createLot(owner, tricoline.variantId, "Rolo 1");
	const oxfordOpening = await opening(owner, {
		locationId: armario.id,
		quantityMicros: "10000000",
		valueCents: "25000",
		variantId: oxford.variantId,
	});
	await opening(owner, {
		locationId: armario.id,
		quantityMicros: "5000000",
		valueCents: "1000",
		variantId: linha.variantId,
	});
	await opening(owner, {
		locationId: prateleira.id,
		lotId: rolo1.id,
		quantityMicros: "8000000",
		valueCents: "16000",
		variantId: tricoline.variantId,
	});
	return {
		armario: armario.id,
		linha: linha.variantId,
		linhaMaterial: linha.materialId,
		oxford: oxford.variantId,
		oxfordOpening,
		prateleira: prateleira.id,
		rolo1: rolo1.id,
		tricoline: tricoline.variantId,
	};
}

type LineInput = {
	countedMicros: string;
	expectedMicros: string;
	locationId: string;
	lotId?: string | null;
	movementId?: string | null;
	valueCents?: string | null;
	variantId: string;
};

function line(input: LineInput) {
	return { lotId: null, movementId: null, valueCents: null, ...input };
}

function sessionInput(
	lines: ReturnType<typeof line>[],
	overrides: Record<string, unknown> = {}
) {
	return {
		lines,
		notes: null,
		occurredOn: "2026-09-23",
		opId: newOpId(),
		reason: "Inventário anual",
		sessionId: crypto.randomUUID(),
		...overrides,
	};
}

async function pointOf(
	owner: Owner,
	variantId: string,
	locationId: string,
	lotId: string | null = null
) {
	const { points } = await owner.stockBalances.get({ variantId });
	return points.find(
		(point) => point.locationId === locationId && point.lotId === lotId
	);
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

describe("inventory session", () => {
	test("finalizes a surplus, a shortage and a matched line", async () => {
		const { owner, server } = await ownerSetup();
		const stock = await catalog(owner);
		const surplusId = crypto.randomUUID();
		const shortageId = crypto.randomUUID();
		const input = sessionInput([
			line({
				countedMicros: "12000000",
				expectedMicros: "10000000",
				locationId: stock.armario,
				movementId: surplusId,
				valueCents: "6000",
				variantId: stock.oxford,
			}),
			line({
				countedMicros: "3000000",
				expectedMicros: "5000000",
				locationId: stock.armario,
				movementId: shortageId,
				variantId: stock.linha,
			}),
			line({
				countedMicros: "8000000",
				expectedMicros: "8000000",
				locationId: stock.prateleira,
				lotId: stock.rolo1,
				variantId: stock.tricoline,
			}),
		]);
		expect(await owner.inventorySessions.create(input)).toEqual({
			id: input.sessionId,
			version: 1,
		});
		expect(await pointOf(owner, stock.oxford, stock.armario)).toMatchObject({
			quantityMicros: "12000000",
			valueCents: "31000",
		});
		expect(await pointOf(owner, stock.linha, stock.armario)).toMatchObject({
			quantityMicros: "3000000",
			valueCents: "600",
		});
		expect(
			await pointOf(owner, stock.tricoline, stock.prateleira, stock.rolo1)
		).toMatchObject({ quantityMicros: "8000000", valueCents: "16000" });
		const oxfordHistory = await owner.stockMovements.list({
			variantId: stock.oxford,
		});
		expect(
			oxfordHistory.items.find((item) => item.id === surplusId)
		).toMatchObject({
			inventorySessionId: input.sessionId,
			kind: "inventory",
			occurredOn: "2026-09-23",
			quantityMicros: "2000000",
			reason: "Inventário anual",
			valueCents: "6000",
		});
		const linhaHistory = await owner.stockMovements.list({
			variantId: stock.linha,
		});
		expect(
			linhaHistory.items.find((item) => item.id === shortageId)
		).toMatchObject({
			inventorySessionId: input.sessionId,
			kind: "inventory",
			quantityMicros: "-2000000",
			reason: "Inventário anual",
			valueCents: "-400",
		});
		const tricolineHistory = await owner.stockMovements.list({
			variantId: stock.tricoline,
		});
		expect(tricolineHistory.items.map((item) => item.kind)).toEqual([
			"opening",
		]);
		const stored = server.db.select().from(inventorySession).all();
		expect(stored[0]?.lines.map((row) => row.valueCents)).toEqual([
			"6000",
			"-400",
			null,
		]);
	});

	test("keeps a movement registered between the count and the finalization", async () => {
		const { owner } = await ownerSetup();
		const stock = await catalog(owner);
		await opening(owner, {
			locationId: stock.armario,
			quantityMicros: "5000000",
			valueCents: "12500",
			variantId: stock.oxford,
		});
		const shortageId = crypto.randomUUID();
		await owner.inventorySessions.create(
			sessionInput([
				line({
					countedMicros: "8000000",
					expectedMicros: "10000000",
					locationId: stock.armario,
					movementId: shortageId,
					variantId: stock.oxford,
				}),
			])
		);
		expect(await pointOf(owner, stock.oxford, stock.armario)).toMatchObject({
			quantityMicros: "13000000",
			valueCents: "32500",
		});
		const history = await owner.stockMovements.list({
			variantId: stock.oxford,
		});
		expect(history.items.find((item) => item.id === shortageId)).toMatchObject({
			quantityMicros: "-2000000",
			valueCents: "-5000",
		});
	});

	test("records a count where everything matched without any movement", async () => {
		const { owner, server } = await ownerSetup();
		const stock = await catalog(owner);
		const before = movementCount(server);
		const input = sessionInput([
			line({
				countedMicros: "10000000",
				expectedMicros: "10000000",
				locationId: stock.armario,
				variantId: stock.oxford,
			}),
		]);
		expect(await owner.inventorySessions.create(input)).toEqual({
			id: input.sessionId,
			version: 1,
		});
		expect(movementCount(server)).toBe(before);
		expect(server.db.select().from(inventorySession).all()).toHaveLength(1);
	});

	test("repeats by opId without a second movement or a balance change", async () => {
		const { owner, server } = await ownerSetup();
		const stock = await catalog(owner);
		const input = sessionInput([
			line({
				countedMicros: "3000000",
				expectedMicros: "5000000",
				locationId: stock.armario,
				movementId: crypto.randomUUID(),
				variantId: stock.linha,
			}),
		]);
		const first = await owner.inventorySessions.create(input);
		const count = movementCount(server);
		expect(await owner.inventorySessions.create(input)).toEqual(first);
		expect(movementCount(server)).toBe(count);
		expect(await pointOf(owner, stock.linha, stock.armario)).toMatchObject({
			quantityMicros: "3000000",
			valueCents: "600",
		});
	});

	test("refuses a repeated session id", async () => {
		const { owner } = await ownerSetup();
		const stock = await catalog(owner);
		const input = sessionInput([
			line({
				countedMicros: "10000000",
				expectedMicros: "10000000",
				locationId: stock.armario,
				variantId: stock.oxford,
			}),
		]);
		await owner.inventorySessions.create(input);
		await expect(
			owner.inventorySessions.create({ ...input, opId: newOpId() })
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
	});

	test("refuses a movement id already used or equal to the session id", async () => {
		const { owner, server } = await ownerSetup();
		const stock = await catalog(owner);
		const shortage = (movementId: string) =>
			line({
				countedMicros: "3000000",
				expectedMicros: "5000000",
				locationId: stock.armario,
				movementId,
				variantId: stock.linha,
			});
		await expect(
			owner.inventorySessions.create(
				sessionInput([shortage(stock.oxfordOpening)])
			)
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		const sessionId = crypto.randomUUID();
		await expect(
			owner.inventorySessions.create(
				sessionInput([shortage(sessionId)], { sessionId })
			)
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		expect(server.db.select().from(inventorySession).all()).toHaveLength(0);
		expect(await pointOf(owner, stock.linha, stock.armario)).toMatchObject({
			quantityMicros: "5000000",
			valueCents: "1000",
		});
	});

	test("refuses a missing variant, a missing location and a lot that does not fit", async () => {
		const { owner } = await ownerSetup();
		const stock = await catalog(owner);
		const other = await createVariant(owner, {
			baseUnit: "m",
			displayPrecision: 2,
			material: "Linho",
			name: "Cru",
			referenceCostCents: "3000",
			tracksLots: true,
		});
		const otherLot = await createLot(owner, other.variantId, "Rolo 9");
		const matched = (overrides: Partial<LineInput>) =>
			line({
				countedMicros: "1000000",
				expectedMicros: "1000000",
				locationId: stock.armario,
				variantId: stock.oxford,
				...overrides,
			});
		const cases: [ReturnType<typeof line>, string][] = [
			[matched({ variantId: crypto.randomUUID() }), "Variante não encontrada"],
			[matched({ locationId: crypto.randomUUID() }), "Local não encontrado"],
			[
				matched({ locationId: stock.prateleira, variantId: stock.tricoline }),
				"Lote não encontrado",
			],
			[matched({ lotId: stock.rolo1 }), "Lote não encontrado"],
			[
				matched({
					locationId: stock.prateleira,
					lotId: otherLot.id,
					variantId: stock.tricoline,
				}),
				"Lote não encontrado",
			],
		];
		await inSequence(cases, async ([candidate, message]) => {
			await expect(
				owner.inventorySessions.create(sessionInput([candidate]))
			).rejects.toMatchObject({ code: "NOT_FOUND", message });
		});
	});

	test("refuses malformed counts", async () => {
		const { owner } = await ownerSetup();
		const stock = await catalog(owner);
		const matched = line({
			countedMicros: "1000000",
			expectedMicros: "1000000",
			locationId: stock.armario,
			variantId: stock.oxford,
		});
		const shortage = line({
			countedMicros: "3000000",
			expectedMicros: "5000000",
			locationId: stock.armario,
			movementId: crypto.randomUUID(),
			variantId: stock.linha,
		});
		const surplus = line({
			countedMicros: "12000000",
			expectedMicros: "10000000",
			locationId: stock.armario,
			movementId: crypto.randomUUID(),
			valueCents: "5000",
			variantId: stock.oxford,
		});
		const tooMany = times(501).map(() =>
			line({
				countedMicros: "0",
				expectedMicros: "0",
				locationId: crypto.randomUUID(),
				variantId: crypto.randomUUID(),
			})
		);
		const repeatedId = crypto.randomUUID();
		const inputs = [
			sessionInput([]),
			sessionInput(tooMany),
			sessionInput([{ ...matched, countedMicros: "-1" }]),
			sessionInput([{ ...matched, countedMicros: "1,5" }]),
			sessionInput([matched, { ...matched }]),
			sessionInput([
				{ ...shortage, movementId: repeatedId },
				{ ...surplus, movementId: repeatedId },
			]),
			sessionInput([{ ...matched, movementId: crypto.randomUUID() }]),
			sessionInput([{ ...surplus, valueCents: null }]),
			sessionInput([{ ...shortage, valueCents: "400" }]),
			sessionInput([{ ...surplus, valueCents: "12,50" }]),
			sessionInput([matched], { reason: "  " }),
			sessionInput([matched], { occurredOn: "23/09/2026" }),
		];
		await inSequence(inputs, async (input) => {
			await expect(owner.inventorySessions.create(input)).rejects.toMatchObject(
				{ code: "BAD_REQUEST" }
			);
		});
	});

	test("keeps the projection equal to the sum of the movements", async () => {
		const { owner, server } = await ownerSetup();
		const stock = await catalog(owner);
		await owner.inventorySessions.create(
			sessionInput([
				line({
					countedMicros: "12500000",
					expectedMicros: "10000000",
					locationId: stock.armario,
					movementId: crypto.randomUUID(),
					valueCents: "6250",
					variantId: stock.oxford,
				}),
				line({
					countedMicros: "1000000",
					expectedMicros: "5000000",
					locationId: stock.armario,
					movementId: crypto.randomUUID(),
					variantId: stock.linha,
				}),
				line({
					countedMicros: "5000000",
					expectedMicros: "0",
					locationId: stock.armario,
					lotId: stock.rolo1,
					movementId: crypto.randomUUID(),
					valueCents: "10000",
					variantId: stock.tricoline,
				}),
			])
		);
		const drift = server
			.native()
			.query<{ total: number }, []>(
				`SELECT count(*) AS total FROM (
					SELECT m.variant_id, m.location_id, m.lot_id,
						sum(m.quantity_micros) AS q, sum(m.value_cents) AS v
					FROM stock_movement m
					GROUP BY m.variant_id, m.location_id, m.lot_id
				) s
				LEFT JOIN stock_balance b
					ON b.variant_id = s.variant_id
					AND b.location_id = s.location_id
					AND b.lot_id IS s.lot_id
				WHERE b.quantity_micros IS NOT s.q OR b.value_cents IS NOT s.v`
			)
			.get()?.total;
		expect(drift).toBe(0);
	});

	test("reverses an inventory movement like an adjustment", async () => {
		const { owner } = await ownerSetup();
		const stock = await catalog(owner);
		const shortageId = crypto.randomUUID();
		await owner.inventorySessions.create(
			sessionInput([
				line({
					countedMicros: "3000000",
					expectedMicros: "5000000",
					locationId: stock.armario,
					movementId: shortageId,
					variantId: stock.linha,
				}),
			])
		);
		await owner.stockMovements.reverse({
			counterpartId: null,
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-24",
			opId: newOpId(),
			reason: "Contei errado",
			reversesMovementId: shortageId,
		});
		expect(await pointOf(owner, stock.linha, stock.armario)).toMatchObject({
			quantityMicros: "5000000",
			valueCents: "1000",
		});
	});
});

describe("inventory session reads", () => {
	test("lists the counts from the newest, with counts and location names", async () => {
		const { owner } = await ownerSetup();
		const stock = await catalog(owner);
		const older = sessionInput(
			[
				line({
					countedMicros: "10000000",
					expectedMicros: "10000000",
					locationId: stock.armario,
					variantId: stock.oxford,
				}),
			],
			{ occurredOn: "2026-09-20", reason: "Conferência" }
		);
		const newer = sessionInput([
			line({
				countedMicros: "3000000",
				expectedMicros: "5000000",
				locationId: stock.armario,
				movementId: crypto.randomUUID(),
				variantId: stock.linha,
			}),
			line({
				countedMicros: "8000000",
				expectedMicros: "8000000",
				locationId: stock.prateleira,
				lotId: stock.rolo1,
				variantId: stock.tricoline,
			}),
		]);
		await owner.inventorySessions.create(older);
		await owner.inventorySessions.create(newer);
		const { items, nextOffset } = await owner.inventorySessions.list({});
		expect(nextOffset).toBeNull();
		expect(items.map((item) => item.id)).toEqual([
			newer.sessionId,
			older.sessionId,
		]);
		expect(items[0]).toMatchObject({
			divergentCount: 1,
			lineCount: 2,
			locationNames: ["Armário 1", "Prateleira 2"],
			occurredOn: "2026-09-23",
			reason: "Inventário anual",
		});
		expect(items[1]).toMatchObject({
			divergentCount: 0,
			lineCount: 1,
			locationNames: ["Armário 1"],
			occurredOn: "2026-09-20",
			reason: "Conferência",
		});
		expect(typeof items[0]?.createdAt).toBe("string");
	});

	test("pages the counts fifty at a time", async () => {
		const clock = manualClock();
		const { owner } = await ownerSetup({ now: clock.now });
		const stock = await catalog(owner);
		const ids = await inSequence(times(51), async () => {
			clock.advance(1000);
			const input = sessionInput([
				line({
					countedMicros: "10000000",
					expectedMicros: "10000000",
					locationId: stock.armario,
					variantId: stock.oxford,
				}),
			]);
			await owner.inventorySessions.create(input);
			return input.sessionId;
		});
		const first = await owner.inventorySessions.list({});
		expect(first.items).toHaveLength(50);
		expect(first.nextOffset).toBe(50);
		expect(first.items[0]?.id).toBe(ids.at(-1));
		const second = await owner.inventorySessions.list({ offset: 50 });
		expect(second.items.map((item) => item.id)).toEqual(ids.slice(0, 1));
		expect(second.nextOffset).toBeNull();
	});

	test("reads a count with the names of each line and the reversal mark", async () => {
		const { owner } = await ownerSetup();
		const stock = await catalog(owner);
		const shortageId = crypto.randomUUID();
		const input = sessionInput(
			[
				line({
					countedMicros: "3000000",
					expectedMicros: "5000000",
					locationId: stock.armario,
					movementId: shortageId,
					variantId: stock.linha,
				}),
				line({
					countedMicros: "8000000",
					expectedMicros: "8000000",
					locationId: stock.prateleira,
					lotId: stock.rolo1,
					variantId: stock.tricoline,
				}),
			],
			{ notes: "Faltou o depósito" }
		);
		await owner.inventorySessions.create(input);
		const read = await owner.inventorySessions.get({
			sessionId: input.sessionId,
		});
		expect(read.session).toMatchObject({
			id: input.sessionId,
			notes: "Faltou o depósito",
			occurredOn: "2026-09-23",
			reason: "Inventário anual",
			version: 1,
		});
		expect(read.lines).toEqual([
			{
				baseUnit: "un",
				code: null,
				countedMicros: "3000000",
				displayPrecision: 0,
				expectedMicros: "5000000",
				locationId: stock.armario,
				locationName: "Armário 1",
				lotId: null,
				lotLabel: null,
				materialId: expect.any(String),
				materialName: "Linha 120",
				movementId: shortageId,
				reversedByMovementId: null,
				valueCents: "-400",
				variantId: stock.linha,
				variantName: "Preta",
			},
			{
				baseUnit: "m",
				code: null,
				countedMicros: "8000000",
				displayPrecision: 2,
				expectedMicros: "8000000",
				locationId: stock.prateleira,
				locationName: "Prateleira 2",
				lotId: stock.rolo1,
				lotLabel: "Rolo 1",
				materialId: expect.any(String),
				materialName: "Tricoline",
				movementId: null,
				reversedByMovementId: null,
				valueCents: null,
				variantId: stock.tricoline,
				variantName: "Floral",
			},
		]);
		const reversalId = crypto.randomUUID();
		await owner.stockMovements.reverse({
			counterpartId: null,
			movementId: reversalId,
			occurredOn: "2026-09-24",
			opId: newOpId(),
			reason: "Contei errado",
			reversesMovementId: shortageId,
		});
		const after = await owner.inventorySessions.get({
			sessionId: input.sessionId,
		});
		expect(after.lines[0]?.reversedByMovementId).toBe(reversalId);
		await expect(
			owner.inventorySessions.get({ sessionId: crypto.randomUUID() })
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Contagem não encontrada",
		});
	});

	test("lists the points with balance in the chosen locations", async () => {
		const { owner } = await ownerSetup();
		const stock = await catalog(owner);
		const armario = await owner.stockBalances.points({
			locationIds: [stock.armario],
		});
		expect(
			armario.items.map((item) => [item.materialName, item.variantName])
		).toEqual([
			["Linha 120", "Preta"],
			["Oxford", "Azul"],
		]);
		expect(armario.items[1]).toEqual({
			archived: false,
			baseUnit: "m",
			code: null,
			displayPrecision: 2,
			locationId: stock.armario,
			locationName: "Armário 1",
			lotId: null,
			lotLabel: null,
			materialId: expect.any(String),
			materialName: "Oxford",
			quantityMicros: "10000000",
			referenceCostCents: "2500",
			tracksLots: false,
			valueCents: "25000",
			variantId: stock.oxford,
			variantName: "Azul",
		});
		const both = await owner.stockBalances.points({
			locationIds: [stock.armario, stock.prateleira],
		});
		expect(both.items.map((item) => item.locationName)).toEqual([
			"Armário 1",
			"Armário 1",
			"Prateleira 2",
		]);
		expect(both.items[2]).toMatchObject({
			lotId: stock.rolo1,
			lotLabel: "Rolo 1",
			tracksLots: true,
			variantId: stock.tricoline,
		});
	});

	test("leaves a zeroed point out and keeps an archived variant with balance", async () => {
		const { owner } = await ownerSetup();
		const stock = await catalog(owner);
		await owner.stockMovements.create({
			kind: "adjustment",
			locationId: stock.armario,
			lotId: null,
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-21",
			opId: newOpId(),
			quantityMicros: "-5000000",
			reason: "Acabou",
			variantId: stock.linha,
		});
		await owner.materialVariants.archive({
			baseVersion: 1,
			opId: newOpId(),
			variantId: stock.oxford,
		});
		const { items } = await owner.stockBalances.points({
			locationIds: [stock.armario],
		});
		expect(items.map((item) => [item.variantId, item.archived])).toEqual([
			[stock.oxford, true],
		]);
		await expect(
			owner.stockBalances.points({ locationIds: [] })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

describe("inventory session review gaps", () => {
	test("refuses a divergent line without a movement id and a difference beyond the exact ceiling", async () => {
		const { owner, server } = await ownerSetup();
		const stock = await catalog(owner);
		const inputs = [
			sessionInput([
				line({
					countedMicros: "12000000",
					expectedMicros: "10000000",
					locationId: stock.armario,
					valueCents: "6000",
					variantId: stock.oxford,
				}),
			]),
			sessionInput([
				line({
					countedMicros: "3000000",
					expectedMicros: "5000000",
					locationId: stock.armario,
					variantId: stock.linha,
				}),
			]),
			sessionInput([
				line({
					countedMicros: "9007199254740991",
					expectedMicros: "-1",
					locationId: stock.armario,
					movementId: crypto.randomUUID(),
					valueCents: "100",
					variantId: stock.oxford,
				}),
			]),
		];
		await inSequence(inputs, async (input) => {
			await expect(owner.inventorySessions.create(input)).rejects.toMatchObject(
				{ code: "BAD_REQUEST" }
			);
		});
		expect(server.db.select().from(inventorySession).all()).toHaveLength(0);
	});

	test("checks every line: a used movement id or a bad lot in the second line refuses the whole count", async () => {
		const { owner, server } = await ownerSetup();
		const stock = await catalog(owner);
		const shortage = line({
			countedMicros: "3000000",
			expectedMicros: "5000000",
			locationId: stock.armario,
			movementId: crypto.randomUUID(),
			variantId: stock.linha,
		});
		await expect(
			owner.inventorySessions.create(
				sessionInput([
					shortage,
					line({
						countedMicros: "12000000",
						expectedMicros: "10000000",
						locationId: stock.armario,
						movementId: stock.oxfordOpening,
						valueCents: "6000",
						variantId: stock.oxford,
					}),
				])
			)
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		const other = await createVariant(owner, {
			baseUnit: "m",
			displayPrecision: 2,
			material: "Linho",
			name: "Cru",
			referenceCostCents: "3000",
			tracksLots: true,
		});
		const otherLot = await createLot(owner, other.variantId, "Rolo 9");
		await expect(
			owner.inventorySessions.create(
				sessionInput([
					shortage,
					line({
						countedMicros: "8000000",
						expectedMicros: "8000000",
						locationId: stock.prateleira,
						lotId: otherLot.id,
						variantId: stock.tricoline,
					}),
				])
			)
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Lote não encontrado",
		});
		expect(server.db.select().from(inventorySession).all()).toHaveLength(0);
		expect(await pointOf(owner, stock.linha, stock.armario)).toMatchObject({
			quantityMicros: "5000000",
			valueCents: "1000",
		});
	});

	test("orders the list by the count date before the creation instant and names each location once", async () => {
		const clock = manualClock();
		const { owner } = await ownerSetup({ now: clock.now });
		const stock = await catalog(owner);
		const newer = sessionInput(
			[
				line({
					countedMicros: "8000000",
					expectedMicros: "8000000",
					locationId: stock.prateleira,
					lotId: stock.rolo1,
					variantId: stock.tricoline,
				}),
				line({
					countedMicros: "5000000",
					expectedMicros: "5000000",
					locationId: stock.armario,
					variantId: stock.linha,
				}),
				line({
					countedMicros: "10000000",
					expectedMicros: "10000000",
					locationId: stock.armario,
					variantId: stock.oxford,
				}),
			],
			{ occurredOn: "2026-09-23" }
		);
		clock.advance(1000);
		await owner.inventorySessions.create(newer);
		const older = sessionInput(
			[
				line({
					countedMicros: "10000000",
					expectedMicros: "10000000",
					locationId: stock.armario,
					variantId: stock.oxford,
				}),
			],
			{ occurredOn: "2026-09-20" }
		);
		clock.advance(1000);
		await owner.inventorySessions.create(older);
		const { items } = await owner.inventorySessions.list({});
		expect(items.map((item) => item.id)).toEqual([
			newer.sessionId,
			older.sessionId,
		]);
		expect(items[0]?.locationNames).toEqual(["Armário 1", "Prateleira 2"]);
	});

	test("marks a point archived when only its material is archived and refuses more than one hundred locations", async () => {
		const { owner } = await ownerSetup();
		const stock = await catalog(owner);
		await owner.materials.archive({
			baseVersion: 1,
			materialId: stock.linhaMaterial,
			opId: newOpId(),
		});
		const { items } = await owner.stockBalances.points({
			locationIds: [stock.armario],
		});
		expect(items.map((item) => [item.variantName, item.archived])).toEqual([
			["Preta", true],
			["Azul", false],
		]);
		await expect(
			owner.stockBalances.points({
				locationIds: times(101).map(() => crypto.randomUUID()),
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

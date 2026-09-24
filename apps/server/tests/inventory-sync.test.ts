import { afterEach, describe, expect, test } from "bun:test";

import { newOpId, type SyncSetup, syncSetup, type TestServer } from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

type OperationInput = {
	aggregateId: string;
	aggregateType: string;
	baseVersion: number | null;
	command: string;
	payload: unknown;
};

function envelope(setup: SyncSetup, input: OperationInput) {
	return {
		...input,
		deviceId: setup.device.id,
		epoch: setup.epoch,
		occurredAt: "2026-09-23T12:00:00.000Z",
		opId: newOpId(),
	};
}

function countOperation(
	setup: SyncSetup,
	payload: unknown,
	id = crypto.randomUUID()
) {
	return envelope(setup, {
		aggregateId: id,
		aggregateType: "inventorySession",
		baseVersion: null,
		command: "inventorySession.create",
		payload,
	});
}

async function stocked(setup: SyncSetup) {
	const location = await setup.local.stockLocations.create({
		locationId: crypto.randomUUID(),
		name: "Armário 1",
		notes: null,
		opId: newOpId(),
	});
	const variantOf = async (
		name: string,
		baseUnit: "m" | "un",
		tracksLots = false
	) => {
		const material = await setup.local.materials.create({
			category: "Tecido",
			materialId: crypto.randomUUID(),
			name,
			notes: null,
			opId: newOpId(),
		});
		const variant = await setup.local.materialVariants.create({
			baseUnit,
			displayPrecision: 2,
			materialId: material.id,
			name: "Azul",
			opId: newOpId(),
			tracksLots,
			variantId: crypto.randomUUID(),
		});
		return variant.id;
	};
	const oxford = await variantOf("Oxford", "m");
	const linha = await variantOf("Linha", "un");
	const tricoline = await variantOf("Tricoline", "m", true);
	const linho = await variantOf("Linho", "m", true);
	const linhoLot = await setup.local.stockLots.create({
		label: "Rolo 9",
		lotId: crypto.randomUUID(),
		notes: null,
		opId: newOpId(),
		variantId: linho,
	});
	const openingOf = async (
		variantId: string,
		quantityMicros: string,
		valueCents: string
	) => {
		const movementId = crypto.randomUUID();
		await setup.local.stockMovements.create({
			kind: "opening",
			locationId: location.id,
			lotId: null,
			movementId,
			occurredOn: "2026-09-20",
			opId: newOpId(),
			quantityMicros,
			reason: null,
			valueCents,
			variantId,
		});
		return movementId;
	};
	const oxfordOpening = await openingOf(oxford, "10000000", "25000");
	await openingOf(linha, "5000000", "1000");
	return {
		linha,
		linhoLot: linhoLot.id,
		locationId: location.id,
		oxford,
		oxfordOpening,
		tricoline,
	};
}

type Stock = Awaited<ReturnType<typeof stocked>>;

function surplusLine(stock: Stock, movementId: string) {
	return {
		countedMicros: "12000000",
		expectedMicros: "10000000",
		locationId: stock.locationId,
		lotId: null,
		movementId,
		valueCents: "6000",
		variantId: stock.oxford,
	};
}

function shortageLine(stock: Stock, movementId: string) {
	return {
		countedMicros: "3000000",
		expectedMicros: "5000000",
		locationId: stock.locationId,
		lotId: null,
		movementId,
		valueCents: null,
		variantId: stock.linha,
	};
}

function matchedLine(stock: Stock, overrides: Record<string, unknown> = {}) {
	return {
		countedMicros: "0",
		expectedMicros: "0",
		locationId: stock.locationId,
		lotId: null,
		movementId: null,
		valueCents: null,
		variantId: stock.oxford,
		...overrides,
	};
}

function countPayload(
	lines: unknown[],
	overrides: Record<string, unknown> = {}
) {
	return {
		lines,
		notes: null,
		occurredOn: "2026-09-23",
		reason: "Inventário anual",
		...overrides,
	};
}

describe("inventory session sync", () => {
	test("finalizes a count over push, repeats it and reads it back on pull", async () => {
		const setup = await syncSetup(servers);
		const stock = await stocked(setup);
		const surplusId = crypto.randomUUID();
		const shortageId = crypto.randomUUID();
		const create = countOperation(
			setup,
			countPayload([
				surplusLine(stock, surplusId),
				shortageLine(stock, shortageId),
			])
		);
		const pushed = await setup.sync.sync.push({ operations: [create] });
		expect(pushed.accepted).toEqual([{ newVersion: 1, opId: create.opId }]);
		const again = await setup.sync.sync.push({ operations: [create] });
		expect(again.accepted).toEqual([{ newVersion: 1, opId: create.opId }]);
		const { changes } = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		const sessions = changes.filter(
			(change) => change.aggregateType === "inventorySession"
		);
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.data).toEqual({
			createdAt: expect.any(String),
			id: create.aggregateId,
			lines: [
				{ ...surplusLine(stock, surplusId) },
				{ ...shortageLine(stock, shortageId), valueCents: "-400" },
			],
			notes: null,
			occurredOn: "2026-09-23",
			reason: "Inventário anual",
			version: 1,
		});
		const counted = changes
			.filter((change) => change.aggregateType === "stockMovement")
			.map((change) => change.data)
			.filter(
				(data) =>
					(data as { inventorySessionId?: string | null })
						.inventorySessionId === create.aggregateId
			);
		expect(counted).toEqual([
			expect.objectContaining({
				id: surplusId,
				kind: "inventory",
				quantityMicros: "2000000",
				reason: "Inventário anual",
				valueCents: "6000",
			}),
			expect.objectContaining({
				id: shortageId,
				kind: "inventory",
				quantityMicros: "-2000000",
				reason: "Inventário anual",
				valueCents: "-400",
			}),
		]);
	});

	test("quarantines each malformed count as an invalid payload", async () => {
		const setup = await syncSetup(servers);
		const stock = await stocked(setup);
		const repeated = crypto.randomUUID();
		const payloads = [
			countPayload([]),
			countPayload([
				surplusLine(stock, crypto.randomUUID()),
				surplusLine(stock, crypto.randomUUID()),
			]),
			countPayload([
				surplusLine(stock, repeated),
				shortageLine(stock, repeated),
			]),
			countPayload([matchedLine(stock, { movementId: crypto.randomUUID() })]),
			countPayload([
				{ ...surplusLine(stock, crypto.randomUUID()), valueCents: null },
			]),
			countPayload([
				{ ...shortageLine(stock, crypto.randomUUID()), valueCents: "400" },
			]),
			countPayload([
				{ ...surplusLine(stock, crypto.randomUUID()), countedMicros: "-1" },
			]),
			countPayload([
				{ ...surplusLine(stock, crypto.randomUUID()), valueCents: "12,50" },
			]),
			countPayload([matchedLine(stock)], { reason: "" }),
			countPayload([
				{ ...surplusLine(stock, crypto.randomUUID()), movementId: null },
			]),
			countPayload([
				{
					...surplusLine(stock, crypto.randomUUID()),
					countedMicros: "9007199254740991",
					expectedMicros: "-1",
				},
			]),
		];
		const pushed = await setup.sync.sync.push({
			operations: payloads.map((payload) => countOperation(setup, payload)),
		});
		expect(pushed.quarantined.map((item) => item.reason)).toEqual(
			payloads.map(() => "invalidPayload")
		);
	});

	test("quarantines a count whose variant or lot is missing", async () => {
		const setup = await syncSetup(servers);
		const stock = await stocked(setup);
		const pushed = await setup.sync.sync.push({
			operations: [
				countOperation(
					setup,
					countPayload([matchedLine(stock, { variantId: crypto.randomUUID() })])
				),
				countOperation(
					setup,
					countPayload([
						matchedLine(stock, {
							lotId: stock.linhoLot,
							variantId: stock.tricoline,
						}),
					])
				),
			],
		});
		expect(pushed.quarantined.map((item) => item.reason)).toEqual([
			"aggregateNotFound",
			"aggregateNotFound",
		]);
	});

	test("quarantines a repeated count id and a movement id already used or equal to the count", async () => {
		const setup = await syncSetup(servers);
		const stock = await stocked(setup);
		const sessionId = crypto.randomUUID();
		await setup.sync.sync.push({
			operations: [
				countOperation(setup, countPayload([matchedLine(stock)]), sessionId),
			],
		});
		const ownId = crypto.randomUUID();
		const pushed = await setup.sync.sync.push({
			operations: [
				countOperation(setup, countPayload([matchedLine(stock)]), sessionId),
				countOperation(
					setup,
					countPayload([shortageLine(stock, ownId)]),
					ownId
				),
				countOperation(
					setup,
					countPayload([shortageLine(stock, stock.oxfordOpening)])
				),
			],
		});
		expect(pushed.quarantined.map((item) => item.reason)).toEqual([
			"aggregateExists",
			"aggregateExists",
			"aggregateExists",
		]);
		const { points } = await setup.local.stockBalances.get({
			variantId: stock.linha,
		});
		expect(points[0]).toMatchObject({
			quantityMicros: "5000000",
			valueCents: "1000",
		});
	});
});

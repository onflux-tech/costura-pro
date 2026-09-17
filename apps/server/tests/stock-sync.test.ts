import { afterEach, describe, expect, test } from "bun:test";

import {
	inSequence,
	newOpId,
	type SyncSetup,
	syncSetup,
	type TestServer,
} from "./support";

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
		occurredAt: "2026-09-17T12:00:00.000Z",
		opId: newOpId(),
	};
}

function operation(
	setup: SyncSetup,
	aggregateType: string,
	command: string,
	payload: unknown,
	id = crypto.randomUUID()
) {
	return envelope(setup, {
		aggregateId: id,
		aggregateType,
		baseVersion: null,
		command,
		payload,
	});
}

async function stockedVariant(setup: SyncSetup, tracksLots = false) {
	const material = await setup.local.materials.create({
		category: "Tecido",
		materialId: crypto.randomUUID(),
		name: "Gorgurão",
		notes: null,
		opId: newOpId(),
	});
	const variant = await setup.local.materialVariants.create({
		baseUnit: "m",
		code: "GR-AZ",
		displayPrecision: 2,
		materialId: material.id,
		name: "Azul marinho",
		opId: newOpId(),
		tracksLots,
		variantId: crypto.randomUUID(),
	});
	const location = await setup.local.stockLocations.create({
		locationId: crypto.randomUUID(),
		name: "Armário 1",
		notes: null,
		opId: newOpId(),
	});
	return {
		locationId: location.id,
		materialId: material.id,
		variantId: variant.id,
	};
}

function openingPayload(
	variantId: string,
	locationId: string,
	overrides: Record<string, unknown> = {}
) {
	return {
		kind: "opening",
		locationId,
		lotId: null,
		occurredOn: "2026-09-17",
		quantityMicros: "5000000",
		valueCents: "6250",
		variantId,
		...overrides,
	};
}

describe("stock sync", () => {
	test("creates and edits a location over push and reads it back on pull", async () => {
		const setup = await syncSetup(servers);
		const locationId = crypto.randomUUID();
		const create = operation(
			setup,
			"stockLocation",
			"stockLocation.create",
			{ name: "Armário 1", notes: null },
			locationId
		);
		const created = await setup.sync.sync.push({ operations: [create] });
		expect(created.accepted).toEqual([{ newVersion: 1, opId: create.opId }]);
		const edit = envelope(setup, {
			aggregateId: locationId,
			aggregateType: "stockLocation",
			baseVersion: 1,
			command: "stockLocation.update",
			payload: { name: "Prateleira A" },
		});
		const edited = await setup.sync.sync.push({ operations: [edit] });
		expect(edited.accepted).toEqual([{ newVersion: 2, opId: edit.opId }]);
		const { changes } = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		const locations = changes.filter(
			(change) => change.aggregateType === "stockLocation"
		);
		expect(locations.at(-1)?.data).toMatchObject({
			id: locationId,
			name: "Prateleira A",
			version: 2,
		});
	});

	test("creates a movement over push and projects the balance", async () => {
		const setup = await syncSetup(servers);
		const { locationId, variantId } = await stockedVariant(setup);
		const movementId = crypto.randomUUID();
		const create = operation(
			setup,
			"stockMovement",
			"stockMovement.create",
			openingPayload(variantId, locationId),
			movementId
		);
		const pushed = await setup.sync.sync.push({ operations: [create] });
		expect(pushed.accepted).toEqual([{ newVersion: 1, opId: create.opId }]);
		const { points } = await setup.local.stockBalances.get({ variantId });
		expect(points[0]).toMatchObject({
			quantityMicros: "5000000",
			valueCents: "6250",
		});
		const { changes } = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		expect(
			changes.find((change) => change.aggregateType === "stockMovement")?.data
		).toMatchObject({
			id: movementId,
			kind: "opening",
			quantityMicros: "5000000",
			valueCents: "6250",
		});
	});

	test("transfers and reverses over push", async () => {
		const setup = await syncSetup(servers);
		const { locationId, variantId } = await stockedVariant(setup);
		const destination = await setup.local.stockLocations.create({
			locationId: crypto.randomUUID(),
			name: "Prateleira B",
			notes: null,
			opId: newOpId(),
		});
		const opening = operation(
			setup,
			"stockMovement",
			"stockMovement.create",
			openingPayload(variantId, locationId)
		);
		const transfer = operation(
			setup,
			"stockMovement",
			"stockMovement.transfer",
			{
				fromLocationId: locationId,
				inboundId: crypto.randomUUID(),
				lotId: null,
				occurredOn: "2026-09-17",
				quantityMicros: "2000000",
				toLocationId: destination.id,
				variantId,
			}
		);
		const reverse = operation(setup, "stockMovement", "stockMovement.reverse", {
			counterpartId: crypto.randomUUID(),
			occurredOn: "2026-09-18",
			reason: "Transferi errado",
			reversesMovementId: transfer.aggregateId,
		});
		const results = await inSequence([opening, transfer, reverse], (item) =>
			setup.sync.sync.push({ operations: [item] })
		);
		expect(results.flatMap((result) => result.accepted)).toHaveLength(3);
		const { points } = await setup.local.stockBalances.get({ variantId });
		const byLocation = Object.fromEntries(
			points.map((point) => [point.locationId, point])
		);
		expect(byLocation[locationId]).toMatchObject({
			quantityMicros: "5000000",
		});
		expect(byLocation[destination.id]).toBeUndefined();
	});

	test("quarantines a movement whose variant, location or lot is missing", async () => {
		const setup = await syncSetup(servers);
		const { locationId, variantId } = await stockedVariant(setup);
		const tracked = await stockedVariant(setup, true);
		const operations = [
			operation(
				setup,
				"stockMovement",
				"stockMovement.create",
				openingPayload(crypto.randomUUID(), locationId)
			),
			operation(
				setup,
				"stockMovement",
				"stockMovement.create",
				openingPayload(variantId, crypto.randomUUID())
			),
			operation(
				setup,
				"stockMovement",
				"stockMovement.create",
				openingPayload(tracked.variantId, tracked.locationId)
			),
			operation(
				setup,
				"stockMovement",
				"stockMovement.create",
				openingPayload(variantId, locationId, { lotId: crypto.randomUUID() })
			),
		];
		const pushed = await setup.sync.sync.push({ operations });
		expect(pushed.quarantined.map((item) => item.reason)).toEqual([
			"aggregateNotFound",
			"aggregateNotFound",
			"aggregateNotFound",
			"aggregateNotFound",
		]);
	});

	test("quarantines an invalid payload and a repeated movement id", async () => {
		const setup = await syncSetup(servers);
		const { locationId, variantId } = await stockedVariant(setup);
		const movementId = crypto.randomUUID();
		await setup.sync.sync.push({
			operations: [
				operation(
					setup,
					"stockMovement",
					"stockMovement.create",
					openingPayload(variantId, locationId),
					movementId
				),
			],
		});
		const operations = [
			operation(
				setup,
				"stockMovement",
				"stockMovement.create",
				openingPayload(variantId, locationId),
				movementId
			),
			operation(
				setup,
				"stockMovement",
				"stockMovement.create",
				openingPayload(variantId, locationId, { kind: "transferOut" })
			),
			operation(
				setup,
				"stockMovement",
				"stockMovement.create",
				openingPayload(variantId, locationId, { quantityMicros: "12,50" })
			),
			operation(
				setup,
				"stockMovement",
				"stockMovement.create",
				openingPayload(variantId, locationId, {
					valueCents: "99999999999999999999",
				})
			),
		];
		const pushed = await setup.sync.sync.push({ operations });
		expect(pushed.quarantined.map((item) => item.reason)).toEqual([
			"aggregateExists",
			"invalidPayload",
			"invalidPayload",
			"invalidPayload",
		]);
	});

	test("quarantines a second reversal of the same movement", async () => {
		const setup = await syncSetup(servers);
		const { locationId, variantId } = await stockedVariant(setup);
		const opening = await setup.local.stockMovements.create({
			kind: "opening",
			locationId,
			lotId: null,
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-17",
			opId: newOpId(),
			quantityMicros: "5000000",
			reason: null,
			valueCents: "6250",
			variantId,
		});
		const reversalPayload = {
			occurredOn: "2026-09-18",
			reason: "Lançado errado",
			reversesMovementId: opening.id,
		};
		const first = await setup.sync.sync.push({
			operations: [
				operation(
					setup,
					"stockMovement",
					"stockMovement.reverse",
					reversalPayload
				),
			],
		});
		expect(first.accepted).toHaveLength(1);
		const second = await setup.sync.sync.push({
			operations: [
				operation(
					setup,
					"stockMovement",
					"stockMovement.reverse",
					reversalPayload
				),
			],
		});
		expect(second.quarantined.map((item) => item.reason)).toEqual([
			"aggregateExists",
		]);
	});

	test("quarantines a lot on a variant that does not track lots", async () => {
		const setup = await syncSetup(servers);
		const { variantId } = await stockedVariant(setup);
		const pushed = await setup.sync.sync.push({
			operations: [
				operation(setup, "stockLot", "stockLot.create", {
					label: "Rolo 1",
					notes: null,
					variantId,
				}),
			],
		});
		expect(pushed.quarantined.map((item) => item.reason)).toEqual([
			"aggregateNotFound",
		]);
	});

	test("ignores lot tracking in a variant patch and refuses a patch with only it", async () => {
		const setup = await syncSetup(servers);
		const { materialId, variantId } = await stockedVariant(setup);
		const onlyFlag = envelope(setup, {
			aggregateId: variantId,
			aggregateType: "materialVariant",
			baseVersion: 1,
			command: "materialVariant.update",
			payload: { tracksLots: true },
		});
		const mixed = envelope(setup, {
			aggregateId: variantId,
			aggregateType: "materialVariant",
			baseVersion: 1,
			command: "materialVariant.update",
			payload: { name: "Azul royal", tracksLots: true },
		});
		const pushed = await setup.sync.sync.push({
			operations: [onlyFlag, mixed],
		});
		expect(pushed.quarantined).toEqual([
			{ opId: onlyFlag.opId, reason: "invalidPayload" },
		]);
		expect(pushed.accepted).toEqual([{ newVersion: 2, opId: mixed.opId }]);
		const { variants } = await setup.local.materials.get({ materialId });
		expect(variants[0]).toMatchObject({
			name: "Azul royal",
			tracksLots: false,
			version: 2,
		});
	});

	test("opens a conflict on a stale location edit and resolves it with keepLocal", async () => {
		const setup = await syncSetup(servers);
		const { id } = await setup.local.stockLocations.create({
			locationId: crypto.randomUUID(),
			name: "Armário 1",
			notes: null,
			opId: newOpId(),
		});
		await setup.local.stockLocations.update({
			baseVersion: 1,
			locationId: id,
			opId: newOpId(),
			patch: { name: "Prateleira A" },
		});
		const stale = envelope(setup, {
			aggregateId: id,
			aggregateType: "stockLocation",
			baseVersion: 1,
			command: "stockLocation.update",
			payload: { notes: "Escrito no celular" },
		});
		const pushed = await setup.sync.sync.push({ operations: [stale] });
		expect(pushed.conflicts).toHaveLength(1);
		const [conflict] = pushed.conflicts;
		const resolved = await setup.local.sync.resolve({
			choice: "keepLocal",
			conflictId: conflict?.conflictId ?? "",
			opId: newOpId(),
			reason: "O celular estava certo",
		});
		expect(resolved.choice).toBe("keepLocal");
		const { items } = await setup.local.stockLocations.list({});
		expect(items[0]).toMatchObject({
			name: "Prateleira A",
			notes: "Escrito no celular",
		});
	});
});

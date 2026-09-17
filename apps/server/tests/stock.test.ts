import { afterEach, describe, expect, test } from "bun:test";
import { stockMovementKindValues } from "@costura-pro/db/schema/stock";
import { stockMovementKinds } from "@costura-pro/domain/stock";

import {
	completeWizard,
	manualClock,
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

function createLocation(owner: Owner, overrides: Record<string, unknown> = {}) {
	return owner.stockLocations.create({
		locationId: crypto.randomUUID(),
		name: "Armário 1",
		notes: null,
		opId: newOpId(),
		...overrides,
	});
}

async function createVariant(
	owner: Owner,
	overrides: Record<string, unknown> = {}
) {
	const material = await owner.materials.create({
		category: "Tecido",
		materialId: crypto.randomUUID(),
		name: "Gorgurão",
		notes: null,
		opId: newOpId(),
	});
	const variant = await owner.materialVariants.create({
		baseUnit: "m",
		code: "GR-AZ",
		displayPrecision: 2,
		materialId: material.id,
		name: "Azul marinho",
		opId: newOpId(),
		referenceCostCents: "1250",
		variantId: crypto.randomUUID(),
		...overrides,
	});
	return { materialId: material.id, variantId: variant.id };
}

function openingInput(
	variantId: string,
	locationId: string,
	overrides: Record<string, unknown> = {}
) {
	return {
		kind: "opening" as const,
		locationId,
		lotId: null,
		movementId: crypto.randomUUID(),
		occurredOn: "2026-09-17",
		opId: newOpId(),
		quantityMicros: "5000000",
		reason: null,
		valueCents: "6250",
		variantId,
		...overrides,
	};
}

async function stockedVariant(owner: Owner) {
	const { materialId, variantId } = await createVariant(owner);
	const { id: locationId } = await createLocation(owner);
	await owner.stockMovements.create(openingInput(variantId, locationId));
	return { locationId, materialId, variantId };
}

describe("stock locations", () => {
	test("keeps the movement kind list of the database equal to the domain", () => {
		expect([...stockMovementKindValues]).toEqual([...stockMovementKinds]);
	});

	test("creates, reads and edits a location", async () => {
		const { owner } = await ownerSetup({ now: manualClock().now });
		const created = await createLocation(owner, {
			locationId: "00000000-0000-4000-8000-000000000001",
		});
		expect(created).toEqual({
			id: "00000000-0000-4000-8000-000000000001",
			version: 1,
		});
		const { items } = await owner.stockLocations.list({});
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			archivedAt: null,
			id: created.id,
			name: "Armário 1",
			notes: null,
			version: 1,
		});
		expect(typeof items[0]?.updatedAt).toBe("string");
		expect(
			await owner.stockLocations.update({
				baseVersion: 1,
				locationId: created.id,
				opId: newOpId(),
				patch: { name: "Prateleira A", notes: "Ao lado da janela" },
			})
		).toEqual({ version: 2 });
		const edited = await owner.stockLocations.list({});
		expect(edited.items[0]).toMatchObject({
			name: "Prateleira A",
			notes: "Ao lado da janela",
			version: 2,
		});
	});

	test("archives without effect twice, unarchives and filters the list", async () => {
		const { owner, server } = await ownerSetup();
		const { id } = await createLocation(owner);
		const changes = () =>
			server
				.native()
				.query<{ total: number }, []>(
					"SELECT count(*) AS total FROM change_log WHERE aggregate_type = 'stockLocation'"
				)
				.get()?.total ?? 0;
		expect(
			await owner.stockLocations.archive({
				baseVersion: 1,
				locationId: id,
				opId: newOpId(),
			})
		).toEqual({ version: 2 });
		const after = changes();
		expect(
			await owner.stockLocations.archive({
				baseVersion: 2,
				locationId: id,
				opId: newOpId(),
			})
		).toEqual({ version: 2 });
		expect(changes()).toBe(after);
		expect((await owner.stockLocations.list({})).items).toHaveLength(0);
		expect(
			(await owner.stockLocations.list({ archived: true })).items
		).toHaveLength(1);
		expect(
			await owner.stockLocations.unarchive({
				baseVersion: 2,
				locationId: id,
				opId: newOpId(),
			})
		).toEqual({ version: 3 });
	});

	test("repeats by opId and refuses a stale version, a repeated id and an empty patch", async () => {
		const { owner } = await ownerSetup();
		const locationId = crypto.randomUUID();
		const opId = newOpId();
		const first = await createLocation(owner, { locationId, opId });
		expect(await createLocation(owner, { locationId, opId })).toEqual(first);
		await expect(createLocation(owner, { locationId })).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		await expect(
			owner.stockLocations.update({
				baseVersion: 9,
				locationId,
				opId: newOpId(),
				patch: { name: "Outro" },
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: { currentVersion: 1 },
			message: "Versão desatualizada",
		});
		await expect(
			owner.stockLocations.update({
				baseVersion: 1,
				locationId,
				opId: newOpId(),
				patch: {},
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("refuses a missing location", async () => {
		const { owner } = await ownerSetup();
		await expect(
			owner.stockLocations.update({
				baseVersion: 1,
				locationId: crypto.randomUUID(),
				opId: newOpId(),
				patch: { name: "Outro" },
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Local não encontrado",
		});
	});
});

describe("stock lots", () => {
	test("creates a lot only on a variant that tracks lots", async () => {
		const { owner } = await ownerSetup();
		const plain = await createVariant(owner);
		await expect(
			owner.stockLots.create({
				label: "Rolo 1",
				lotId: crypto.randomUUID(),
				notes: null,
				opId: newOpId(),
				variantId: plain.variantId,
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Variante não encontrada",
		});
		const tracked = await createVariant(owner, { tracksLots: true });
		const created = await owner.stockLots.create({
			label: "Rolo 1",
			lotId: crypto.randomUUID(),
			notes: "Compra de agosto",
			opId: newOpId(),
			variantId: tracked.variantId,
		});
		expect(created.version).toBe(1);
		const { items } = await owner.stockLots.list({
			variantId: tracked.variantId,
		});
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			archivedAt: null,
			id: created.id,
			label: "Rolo 1",
			notes: "Compra de agosto",
			variantId: tracked.variantId,
			version: 1,
		});
	});

	test("refuses a lot on a missing variant and edits an existing lot", async () => {
		const { owner } = await ownerSetup();
		await expect(
			owner.stockLots.create({
				label: "Rolo 1",
				lotId: crypto.randomUUID(),
				notes: null,
				opId: newOpId(),
				variantId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Variante não encontrada",
		});
		const { variantId } = await createVariant(owner, { tracksLots: true });
		const { id } = await owner.stockLots.create({
			label: "Rolo 1",
			lotId: crypto.randomUUID(),
			notes: null,
			opId: newOpId(),
			variantId,
		});
		expect(
			await owner.stockLots.update({
				baseVersion: 1,
				lotId: id,
				opId: newOpId(),
				patch: { label: "Rolo 2" },
			})
		).toEqual({ version: 2 });
		expect(
			await owner.stockLots.archive({
				baseVersion: 2,
				lotId: id,
				opId: newOpId(),
			})
		).toEqual({ version: 3 });
	});

	test("refuses a missing lot", async () => {
		const { owner } = await ownerSetup();
		await expect(
			owner.stockLots.update({
				baseVersion: 1,
				lotId: crypto.randomUUID(),
				opId: newOpId(),
				patch: { label: "Rolo 2" },
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Lote não encontrado",
		});
	});
});

describe("stock movements", () => {
	test("records an opening and projects the balance", async () => {
		const { owner } = await ownerSetup();
		const { variantId } = await createVariant(owner);
		const { id: locationId } = await createLocation(owner);
		const created = await owner.stockMovements.create(
			openingInput(variantId, locationId)
		);
		expect(created.version).toBe(1);
		const { points } = await owner.stockBalances.get({ variantId });
		expect(points).toEqual([
			{
				locationId,
				locationName: "Armário 1",
				lotId: null,
				lotLabel: null,
				quantityMicros: "5000000",
				valueCents: "6250",
			},
		]);
	});

	test("adds a second opening into the same point", async () => {
		const { owner } = await ownerSetup();
		const { locationId, variantId } = await stockedVariant(owner);
		await owner.stockMovements.create(
			openingInput(variantId, locationId, {
				quantityMicros: "1000000",
				valueCents: "1000",
			})
		);
		const { points } = await owner.stockBalances.get({ variantId });
		expect(points[0]).toMatchObject({
			quantityMicros: "6000000",
			valueCents: "7250",
		});
	});

	test("takes the average of the point on a negative adjustment", async () => {
		const { owner } = await ownerSetup();
		const { locationId, variantId } = await stockedVariant(owner);
		await owner.stockMovements.create({
			kind: "adjustment",
			locationId,
			lotId: null,
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-17",
			opId: newOpId(),
			quantityMicros: "-1000000",
			reason: "Perda no corte",
			variantId,
		});
		const { points } = await owner.stockBalances.get({ variantId });
		expect(points[0]).toMatchObject({
			quantityMicros: "4000000",
			valueCents: "5000",
		});
	});

	test("refuses a value on a negative adjustment and demands one on a positive", async () => {
		const { owner } = await ownerSetup();
		const { locationId, variantId } = await stockedVariant(owner);
		const loose = owner.stockMovements.create as unknown as (
			input: Record<string, unknown>
		) => Promise<{ id: string; version: number }>;
		await expect(
			loose({
				kind: "adjustment",
				locationId,
				lotId: null,
				movementId: crypto.randomUUID(),
				occurredOn: "2026-09-17",
				opId: newOpId(),
				quantityMicros: "-1000000",
				reason: "Perda",
				valueCents: "100",
				variantId,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			loose({
				kind: "adjustment",
				locationId,
				lotId: null,
				movementId: crypto.randomUUID(),
				occurredOn: "2026-09-17",
				opId: newOpId(),
				quantityMicros: "1000000",
				reason: "Achado",
				variantId,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("refuses an adjustment without a reason and a zero quantity", async () => {
		const { owner } = await ownerSetup();
		const { locationId, variantId } = await stockedVariant(owner);
		const loose = owner.stockMovements.create as unknown as (
			input: Record<string, unknown>
		) => Promise<{ id: string; version: number }>;
		await expect(
			loose({
				kind: "adjustment",
				locationId,
				lotId: null,
				movementId: crypto.randomUUID(),
				occurredOn: "2026-09-17",
				opId: newOpId(),
				quantityMicros: "-1000000",
				variantId,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			loose(openingInput(variantId, locationId, { quantityMicros: "0" }))
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("refuses a malformed quantity without throwing a syntax error", async () => {
		const { owner } = await ownerSetup();
		const { locationId, variantId } = await stockedVariant(owner);
		const loose = owner.stockMovements.create as unknown as (
			input: Record<string, unknown>
		) => Promise<{ id: string; version: number }>;
		await expect(
			loose(openingInput(variantId, locationId, { quantityMicros: "12,50" }))
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("canonicalizes a signed integer with leading zeros", async () => {
		const { owner } = await ownerSetup();
		const { locationId, variantId } = await stockedVariant(owner);
		await owner.stockMovements.create({
			kind: "adjustment",
			locationId,
			lotId: null,
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-17",
			opId: newOpId(),
			quantityMicros: "-0001000000",
			reason: "Perda no corte",
			variantId,
		});
		const { items } = await owner.stockMovements.list({ variantId });
		expect(items[0]).toMatchObject({ quantityMicros: "-1000000" });
	});

	test("demands a lot on a variant that tracks lots and refuses one otherwise", async () => {
		const { owner } = await ownerSetup();
		const tracked = await createVariant(owner, { tracksLots: true });
		const plain = await createVariant(owner);
		const { id: locationId } = await createLocation(owner);
		await expect(
			owner.stockMovements.create(openingInput(tracked.variantId, locationId))
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Lote não encontrado",
		});
		const lot = await owner.stockLots.create({
			label: "Rolo 1",
			lotId: crypto.randomUUID(),
			notes: null,
			opId: newOpId(),
			variantId: tracked.variantId,
		});
		await expect(
			owner.stockMovements.create(
				openingInput(plain.variantId, locationId, { lotId: lot.id })
			)
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Lote não encontrado",
		});
		const created = await owner.stockMovements.create(
			openingInput(tracked.variantId, locationId, { lotId: lot.id })
		);
		expect(created.version).toBe(1);
		const { points } = await owner.stockBalances.get({
			variantId: tracked.variantId,
		});
		expect(points[0]).toMatchObject({ lotId: lot.id, lotLabel: "Rolo 1" });
	});

	test("refuses a missing variant and a missing location", async () => {
		const { owner } = await ownerSetup();
		const { variantId } = await createVariant(owner);
		const { id: locationId } = await createLocation(owner);
		await expect(
			owner.stockMovements.create(openingInput(crypto.randomUUID(), locationId))
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Variante não encontrada",
		});
		await expect(
			owner.stockMovements.create(openingInput(variantId, crypto.randomUUID()))
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Local não encontrado",
		});
	});

	test("refuses a kind that has its own command", async () => {
		const { owner } = await ownerSetup();
		const { locationId, variantId } = await stockedVariant(owner);
		const loose = owner.stockMovements.create as unknown as (
			input: Record<string, unknown>
		) => Promise<{ id: string; version: number }>;
		await expect(
			loose(openingInput(variantId, locationId, { kind: "transferOut" }))
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("repeats by opId without duplicating the movement or the balance", async () => {
		const { owner } = await ownerSetup();
		const { variantId } = await createVariant(owner);
		const { id: locationId } = await createLocation(owner);
		const input = openingInput(variantId, locationId);
		const first = await owner.stockMovements.create(input);
		expect(await owner.stockMovements.create(input)).toEqual(first);
		const { items } = await owner.stockMovements.list({ variantId });
		expect(items).toHaveLength(1);
		const { points } = await owner.stockBalances.get({ variantId });
		expect(points[0]).toMatchObject({ quantityMicros: "5000000" });
	});

	test("refuses a repeated movement id", async () => {
		const { owner } = await ownerSetup();
		const { variantId } = await createVariant(owner);
		const { id: locationId } = await createLocation(owner);
		const movementId = crypto.randomUUID();
		await owner.stockMovements.create(
			openingInput(variantId, locationId, { movementId })
		);
		await expect(
			owner.stockMovements.create(
				openingInput(variantId, locationId, { movementId })
			)
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
	});

	test("keeps the projection equal to the sum of the movements", async () => {
		const { owner, server } = await ownerSetup();
		const { locationId, variantId } = await stockedVariant(owner);
		const other = await createLocation(owner, { name: "Prateleira B" });
		await owner.stockMovements.create(
			openingInput(variantId, other.id, {
				quantityMicros: "2000000",
				valueCents: "3000",
			})
		);
		await owner.stockMovements.create({
			kind: "adjustment",
			locationId,
			lotId: null,
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-17",
			opId: newOpId(),
			quantityMicros: "-1000000",
			reason: "Perda no corte",
			variantId,
		});
		await owner.stockMovements.transfer({
			fromLocationId: locationId,
			inboundId: crypto.randomUUID(),
			lotId: null,
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-17",
			opId: newOpId(),
			quantityMicros: "1000000",
			reason: null,
			toLocationId: other.id,
			variantId,
		});
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

	test("refuses an update straight at the movement table", async () => {
		const { owner, server } = await ownerSetup();
		const { variantId } = await stockedVariant(owner);
		expect(variantId).toBeTruthy();
		expect(() =>
			server.native().run("UPDATE stock_movement SET quantity_micros = 1")
		).toThrow("stock_movement é append-only");
	});
});

describe("stock transfer", () => {
	test("moves the quantity and the average value between locations", async () => {
		const { owner } = await ownerSetup();
		const { locationId, variantId } = await stockedVariant(owner);
		const destination = await createLocation(owner, { name: "Prateleira B" });
		await owner.stockMovements.transfer({
			fromLocationId: locationId,
			inboundId: crypto.randomUUID(),
			lotId: null,
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-17",
			opId: newOpId(),
			quantityMicros: "2000000",
			reason: "Liberar espaço",
			toLocationId: destination.id,
			variantId,
		});
		const { points } = await owner.stockBalances.get({ variantId });
		const byLocation = Object.fromEntries(
			points.map((point) => [point.locationId, point])
		);
		expect(byLocation[locationId]).toMatchObject({
			quantityMicros: "3000000",
			valueCents: "3750",
		});
		expect(byLocation[destination.id]).toMatchObject({
			quantityMicros: "2000000",
			valueCents: "2500",
		});
	});

	test("writes two linked movements and repeats by opId without duplicating", async () => {
		const { owner } = await ownerSetup();
		const { locationId, variantId } = await stockedVariant(owner);
		const destination = await createLocation(owner, { name: "Prateleira B" });
		const input = {
			fromLocationId: locationId,
			inboundId: crypto.randomUUID(),
			lotId: null,
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-17",
			opId: newOpId(),
			quantityMicros: "2000000",
			reason: null,
			toLocationId: destination.id,
			variantId,
		};
		const first = await owner.stockMovements.transfer(input);
		expect(await owner.stockMovements.transfer(input)).toEqual(first);
		const { items } = await owner.stockMovements.list({ variantId });
		const transfers = items.filter((item) => item.transferId !== null);
		expect(transfers).toHaveLength(2);
		expect(new Set(transfers.map((item) => item.transferId)).size).toBe(1);
		expect(transfers.map((item) => item.kind).sort()).toEqual([
			"transferIn",
			"transferOut",
		]);
	});

	test("refuses a transfer to the same location", async () => {
		const { owner } = await ownerSetup();
		const { locationId, variantId } = await stockedVariant(owner);
		await expect(
			owner.stockMovements.transfer({
				fromLocationId: locationId,
				inboundId: crypto.randomUUID(),
				lotId: null,
				movementId: crypto.randomUUID(),
				occurredOn: "2026-09-17",
				opId: newOpId(),
				quantityMicros: "1000000",
				reason: null,
				toLocationId: locationId,
				variantId,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

describe("stock reversal", () => {
	test("reverses a movement once and refuses the second attempt", async () => {
		const { owner } = await ownerSetup();
		const { variantId } = await createVariant(owner);
		const { id: locationId } = await createLocation(owner);
		const opening = await owner.stockMovements.create(
			openingInput(variantId, locationId)
		);
		await owner.stockMovements.reverse({
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-18",
			opId: newOpId(),
			reason: "Lançado na variante errada",
			reversesMovementId: opening.id,
		});
		const { points } = await owner.stockBalances.get({ variantId });
		expect(points).toHaveLength(0);
		await expect(
			owner.stockMovements.reverse({
				movementId: crypto.randomUUID(),
				occurredOn: "2026-09-18",
				opId: newOpId(),
				reason: "De novo",
				reversesMovementId: opening.id,
			})
		).rejects.toMatchObject({ code: "CONFLICT" });
	});

	test("marks the reversed movement in the history", async () => {
		const { owner } = await ownerSetup();
		const { variantId } = await createVariant(owner);
		const { id: locationId } = await createLocation(owner);
		const opening = await owner.stockMovements.create(
			openingInput(variantId, locationId)
		);
		const reversal = await owner.stockMovements.reverse({
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-18",
			opId: newOpId(),
			reason: "Lançado errado",
			reversesMovementId: opening.id,
		});
		const { items } = await owner.stockMovements.list({ variantId });
		const original = items.find((item) => item.id === opening.id);
		expect(original?.reversedByMovementId).toBe(reversal.id);
		expect(items.find((item) => item.id === reversal.id)).toMatchObject({
			kind: "reversal",
			quantityMicros: "-5000000",
			reversesMovementId: opening.id,
			valueCents: "-6250",
		});
	});

	test("refuses reversing a missing movement", async () => {
		const { owner } = await ownerSetup();
		await expect(
			owner.stockMovements.reverse({
				movementId: crypto.randomUUID(),
				occurredOn: "2026-09-18",
				opId: newOpId(),
				reason: "Qualquer",
				reversesMovementId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Movimento não encontrado",
		});
	});
});

describe("stock balances", () => {
	test("lists one row per variant with the total and paginates", async () => {
		const { owner } = await ownerSetup();
		const { locationId, variantId } = await stockedVariant(owner);
		const other = await createLocation(owner, { name: "Prateleira B" });
		await owner.stockMovements.create(
			openingInput(variantId, other.id, {
				quantityMicros: "2000000",
				valueCents: "3000",
			})
		);
		const { items, nextOffset } = await owner.stockBalances.list({});
		expect(nextOffset).toBeNull();
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			baseUnit: "m",
			code: "GR-AZ",
			displayPrecision: 2,
			materialName: "Gorgurão",
			quantityMicros: "7000000",
			tracksLots: false,
			valueCents: "9250",
			variantId,
			variantName: "Azul marinho",
		});
		const filtered = await owner.stockBalances.list({ locationId });
		expect(filtered.items[0]).toMatchObject({ quantityMicros: "5000000" });
	});

	test("finds a variant by material name and by variant code", async () => {
		const { owner } = await ownerSetup();
		await stockedVariant(owner);
		expect(
			(await owner.stockBalances.list({ query: "gorgurao" })).items
		).toHaveLength(1);
		expect(
			(await owner.stockBalances.list({ query: "gr-az" })).items
		).toHaveLength(1);
		expect(
			(await owner.stockBalances.list({ query: "linha" })).items
		).toHaveLength(0);
	});

	test("omits a point that went back to zero", async () => {
		const { owner } = await ownerSetup();
		const { locationId, variantId } = await stockedVariant(owner);
		await owner.stockMovements.create({
			kind: "adjustment",
			locationId,
			lotId: null,
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-17",
			opId: newOpId(),
			quantityMicros: "-5000000",
			reason: "Saiu tudo",
			variantId,
		});
		expect((await owner.stockBalances.get({ variantId })).points).toHaveLength(
			0
		);
	});

	test("shows the balance of each variant on the material page", async () => {
		const { owner } = await ownerSetup();
		const { materialId, variantId } = await stockedVariant(owner);
		const { variants } = await owner.materials.get({ materialId });
		expect(variants).toHaveLength(1);
		expect(variants[0]).toMatchObject({
			id: variantId,
			quantityMicros: "5000000",
			tracksLots: false,
		});
	});

	test("orders the history by date, creation and id, all descending", async () => {
		const clock = manualClock();
		const { owner } = await ownerSetup({ now: clock.now });
		const { locationId, variantId } = await stockedVariant(owner);
		clock.advance(1000);
		const second = await owner.stockMovements.create(
			openingInput(variantId, locationId, {
				occurredOn: "2026-09-18",
				quantityMicros: "1000000",
				valueCents: "1000",
			})
		);
		clock.advance(1000);
		const third = await owner.stockMovements.create(
			openingInput(variantId, locationId, {
				occurredOn: "2026-09-18",
				quantityMicros: "1000000",
				valueCents: "1000",
			})
		);
		const { items } = await owner.stockMovements.list({ variantId });
		expect(items.slice(0, 2).map((item) => item.id)).toEqual([
			third.id,
			second.id,
		]);
		expect(items[0]).toMatchObject({
			locationName: "Armário 1",
			lotLabel: null,
		});
	});
});

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

function operation(
	setup: SyncSetup,
	aggregateType: string,
	command: string,
	payload: unknown,
	id = crypto.randomUUID()
) {
	return {
		aggregateId: id,
		aggregateType,
		baseVersion: null,
		command,
		deviceId: setup.device.id,
		epoch: setup.epoch,
		occurredAt: "2026-09-17T12:00:00.000Z",
		opId: newOpId(),
		payload,
	};
}

type Catalog = {
	accountId: string;
	fabricId: string;
	locationId: string;
	supplierId: string;
};

async function catalogOf(setup: SyncSetup): Promise<Catalog> {
	const material = await setup.local.materials.create({
		category: "Tecido",
		materialId: crypto.randomUUID(),
		name: "Gorgurão",
		notes: null,
		opId: newOpId(),
	});
	const fabric = await setup.local.materialVariants.create({
		baseUnit: "m",
		displayPrecision: 2,
		materialId: material.id,
		name: "Azul marinho",
		opId: newOpId(),
		packaging: { label: "Rolo 50 m", quantityMicros: "50000000" },
		variantId: crypto.randomUUID(),
	});
	const location = await setup.local.stockLocations.create({
		locationId: crypto.randomUUID(),
		name: "Prateleira A",
		notes: null,
		opId: newOpId(),
	});
	const account = await setup.local.financialAccounts.create({
		accountId: crypto.randomUUID(),
		kind: "cash",
		name: "Caixa",
		notes: null,
		opId: newOpId(),
	});
	const supplier = await setup.local.suppliers.create({
		email: null,
		name: "Tecidos São José",
		notes: null,
		opId: newOpId(),
		phone: null,
		supplierId: crypto.randomUUID(),
	});
	return {
		accountId: account.id,
		fabricId: fabric.id,
		locationId: location.id,
		supplierId: supplier.id,
	};
}

function purchasePayload(
	catalog: Catalog,
	overrides: Record<string, unknown> = {}
) {
	return {
		discountCents: "500",
		freightCents: "1000",
		items: [
			{
				locationId: catalog.locationId,
				movementId: crypto.randomUUID(),
				packageCountMicros: "2000000",
				packagingLabel: "Rolo 50 m",
				packagingQuantityMicros: "50000000",
				unitPriceCents: "12000",
				variantId: catalog.fabricId,
			},
		],
		obligationId: crypto.randomUUID(),
		occurredOn: "2026-09-17",
		payment: { dueOn: "2026-10-17", kind: "later" },
		reference: "NF 77",
		supplierId: catalog.supplierId,
		...overrides,
	};
}

type Payload = ReturnType<typeof purchasePayload>;

function reversePayload(
	purchaseId: string,
	payload: Payload,
	overrides: Record<string, unknown> = {}
) {
	return {
		movementIds: payload.items.map(() => crypto.randomUUID()),
		occurredOn: "2026-09-18",
		paymentReversalId: crypto.randomUUID(),
		purchaseId,
		reason: "Lançada errada",
		...overrides,
	};
}

describe("purchase sync", () => {
	test("creates, pays and reverses a purchase over push and reads every fact on pull", async () => {
		const setup = await syncSetup(servers);
		const catalog = await catalogOf(setup);
		const payload = purchasePayload(catalog);
		const create = operation(setup, "purchase", "purchase.create", payload);
		const pay = operation(setup, "financialMovement", "obligation.pay", {
			accountId: catalog.accountId,
			obligationId: payload.obligationId,
			occurredOn: "2026-10-01",
		});
		const reverse = operation(
			setup,
			"purchaseReversal",
			"purchase.reverse",
			reversePayload(create.aggregateId, payload)
		);
		const results = await inSequence([create, pay, reverse], (item) =>
			setup.sync.sync.push({ operations: [item] })
		);
		expect(results.flatMap((result) => result.accepted)).toEqual([
			{ newVersion: 1, opId: create.opId },
			{ newVersion: 1, opId: pay.opId },
			{ newVersion: 1, opId: reverse.opId },
		]);
		const again = await setup.sync.sync.push({ operations: [create, reverse] });
		expect(again.accepted).toEqual([
			{ newVersion: 1, opId: create.opId },
			{ newVersion: 1, opId: reverse.opId },
		]);
		const { changes } = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		const dataOf = (type: string, id: string) =>
			changes.find(
				(change) => change.aggregateType === type && change.aggregateId === id
			)?.data;
		const movementId = payload.items.at(0)?.movementId ?? "";
		expect(dataOf("purchase", create.aggregateId)).toEqual({
			createdAt: expect.any(String),
			discountCents: "500",
			freightCents: "1000",
			grossCents: "24000",
			id: create.aggregateId,
			items: [
				{
					discountCents: "500",
					freightCents: "1000",
					grossCents: "24000",
					locationId: catalog.locationId,
					lotId: null,
					movementId,
					packageCountMicros: "2000000",
					packagingLabel: "Rolo 50 m",
					packagingQuantityMicros: "50000000",
					quantityMicros: "100000000",
					unitPriceCents: "12000",
					valueCents: "24500",
					variantId: catalog.fabricId,
				},
			],
			notes: null,
			occurredOn: "2026-09-17",
			reference: "NF 77",
			supplierId: catalog.supplierId,
			totalCents: "24500",
			version: 1,
		});
		expect(dataOf("obligation", payload.obligationId)).toEqual({
			amountCents: "24500",
			createdAt: expect.any(String),
			dueOn: "2026-10-17",
			id: payload.obligationId,
			kind: "purchase",
			purchaseId: create.aggregateId,
			version: 1,
		});
		expect(dataOf("stockMovement", movementId)).toMatchObject({
			kind: "purchase",
			purchaseId: create.aggregateId,
			quantityMicros: "100000000",
			valueCents: "24500",
		});
		expect(dataOf("financialMovement", pay.aggregateId)).toMatchObject({
			amountCents: "-24500",
			kind: "obligationPayment",
			obligationId: payload.obligationId,
		});
		expect(dataOf("purchaseReversal", reverse.aggregateId)).toEqual({
			createdAt: expect.any(String),
			id: reverse.aggregateId,
			occurredOn: "2026-09-18",
			purchaseId: create.aggregateId,
			reason: "Lançada errada",
			version: 1,
		});
		const { items } = await setup.local.financialAccounts.list({});
		expect(items[0]?.balanceCents).toBe("0");
	});

	test("quarantines missing parents, a cancelled obligation and a purchase movement reversed by stock", async () => {
		const setup = await syncSetup(servers);
		const catalog = await catalogOf(setup);
		const payload = purchasePayload(catalog);
		const create = operation(setup, "purchase", "purchase.create", payload);
		await setup.sync.sync.push({ operations: [create] });
		await setup.sync.sync.push({
			operations: [
				operation(
					setup,
					"purchaseReversal",
					"purchase.reverse",
					reversePayload(create.aggregateId, payload)
				),
			],
		});
		const operations = [
			operation(
				setup,
				"purchase",
				"purchase.create",
				purchasePayload(catalog, { supplierId: crypto.randomUUID() })
			),
			operation(
				setup,
				"purchase",
				"purchase.create",
				purchasePayload({ ...catalog, fabricId: crypto.randomUUID() })
			),
			operation(setup, "financialMovement", "obligation.pay", {
				accountId: catalog.accountId,
				obligationId: payload.obligationId,
				occurredOn: "2026-10-01",
			}),
			operation(setup, "stockMovement", "stockMovement.reverse", {
				occurredOn: "2026-09-18",
				reason: "Tentativa",
				reversesMovementId: payload.items.at(0)?.movementId,
			}),
			operation(
				setup,
				"purchaseReversal",
				"purchase.reverse",
				reversePayload(crypto.randomUUID(), payload)
			),
		];
		const pushed = await setup.sync.sync.push({ operations });
		expect(pushed.quarantined.map((item) => item.reason)).toEqual([
			"aggregateNotFound",
			"aggregateNotFound",
			"aggregateNotFound",
			"aggregateNotFound",
			"aggregateNotFound",
		]);
	});

	test("quarantines a second reversal, a second payment and a movement id already used", async () => {
		const setup = await syncSetup(servers);
		const catalog = await catalogOf(setup);
		const paid = purchasePayload(catalog);
		const reversed = purchasePayload(catalog);
		const createPaid = operation(setup, "purchase", "purchase.create", paid);
		const createReversed = operation(
			setup,
			"purchase",
			"purchase.create",
			reversed
		);
		await setup.sync.sync.push({ operations: [createPaid, createReversed] });
		await setup.sync.sync.push({
			operations: [
				operation(setup, "financialMovement", "obligation.pay", {
					accountId: catalog.accountId,
					obligationId: paid.obligationId,
					occurredOn: "2026-10-01",
				}),
				operation(
					setup,
					"purchaseReversal",
					"purchase.reverse",
					reversePayload(createReversed.aggregateId, reversed)
				),
			],
		});
		const pushed = await setup.sync.sync.push({
			operations: [
				operation(setup, "financialMovement", "obligation.pay", {
					accountId: catalog.accountId,
					obligationId: paid.obligationId,
					occurredOn: "2026-10-02",
				}),
				operation(
					setup,
					"purchaseReversal",
					"purchase.reverse",
					reversePayload(createReversed.aggregateId, reversed)
				),
				operation(
					setup,
					"purchase",
					"purchase.create",
					purchasePayload(catalog, { items: paid.items })
				),
			],
		});
		expect(pushed.quarantined.map((item) => item.reason)).toEqual([
			"aggregateExists",
			"aggregateExists",
			"aggregateExists",
		]);
	});

	test("quarantines repeated ids, a zero total and a malformed amount as invalid payload", async () => {
		const setup = await syncSetup(servers);
		const catalog = await catalogOf(setup);
		const base = purchasePayload(catalog);
		const operations = [
			operation(
				setup,
				"purchase",
				"purchase.create",
				purchasePayload(catalog, {
					items: base.items,
					obligationId: base.items.at(0)?.movementId,
				})
			),
			operation(
				setup,
				"purchase",
				"purchase.create",
				purchasePayload(catalog, {
					discountCents: "25000",
					freightCents: "1000",
				})
			),
			operation(
				setup,
				"purchase",
				"purchase.create",
				purchasePayload(catalog, { freightCents: "12,50" })
			),
			operation(
				setup,
				"purchase",
				"purchase.create",
				purchasePayload(catalog, { items: "nenhum" })
			),
		];
		const pushed = await setup.sync.sync.push({ operations });
		expect(pushed.quarantined.map((item) => item.reason)).toEqual([
			"invalidPayload",
			"invalidPayload",
			"invalidPayload",
			"invalidPayload",
		]);
	});
});

describe("purchase sync ids", () => {
	test("quarantines a purchase whose obligation or payment id is already used", async () => {
		const setup = await syncSetup(servers);
		const catalog = await catalogOf(setup);
		const usedPayment = crypto.randomUUID();
		const first = purchasePayload(catalog, {
			payment: {
				accountId: catalog.accountId,
				kind: "now",
				movementId: usedPayment,
			},
		});
		await setup.sync.sync.push({
			operations: [operation(setup, "purchase", "purchase.create", first)],
		});
		const pushed = await setup.sync.sync.push({
			operations: [
				operation(
					setup,
					"purchase",
					"purchase.create",
					purchasePayload(catalog, { obligationId: first.obligationId })
				),
				operation(
					setup,
					"purchase",
					"purchase.create",
					purchasePayload(catalog, {
						payment: {
							accountId: catalog.accountId,
							kind: "now",
							movementId: usedPayment,
						},
					})
				),
			],
		});
		expect(pushed.quarantined.map((item) => item.reason)).toEqual([
			"aggregateExists",
			"aggregateExists",
		]);
		const { items } = await setup.local.purchases.list({});
		expect(items).toHaveLength(1);
	});
});

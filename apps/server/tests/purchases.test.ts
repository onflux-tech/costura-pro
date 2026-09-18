import { afterEach, describe, expect, test } from "bun:test";

import {
	completeWizard,
	inSequence,
	newOpId,
	rpc,
	startTestServer,
	type TestServer,
} from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

type Owner = ReturnType<typeof rpc>;

type Catalog = {
	accountId: string;
	bankId: string;
	fabricId: string;
	floralId: string;
	locationId: string;
	lotId: string;
	materialId: string;
	supplierId: string;
	threadId: string;
};

async function createVariant(
	owner: Owner,
	materialId: string,
	overrides: Record<string, unknown>
) {
	const { id } = await owner.materialVariants.create({
		baseUnit: "m",
		displayPrecision: 2,
		materialId,
		name: "Azul marinho",
		opId: newOpId(),
		variantId: crypto.randomUUID(),
		...overrides,
	});
	return id;
}

async function catalogSetup(): Promise<{
	catalog: Catalog;
	owner: Owner;
	server: TestServer;
}> {
	const server = await startTestServer();
	servers.push(server);
	const { cookie } = await completeWizard(server);
	const owner = rpc(server, { cookie });
	const material = await owner.materials.create({
		category: "Tecido",
		materialId: crypto.randomUUID(),
		name: "Gorgurão",
		notes: null,
		opId: newOpId(),
	});
	const fabricId = await createVariant(owner, material.id, {
		packaging: { label: "Rolo 50 m", quantityMicros: "50000000" },
	});
	const floralId = await createVariant(owner, material.id, {
		name: "Tricoline floral",
		packaging: { label: "Rolo 50 m", quantityMicros: "50000000" },
		tracksLots: true,
	});
	const thread = await owner.materials.create({
		category: "Linha",
		materialId: crypto.randomUUID(),
		name: "Linha de costura",
		notes: null,
		opId: newOpId(),
	});
	const threadId = await createVariant(owner, thread.id, {
		baseUnit: "un",
		displayPrecision: 0,
		name: "Branca",
	});
	const lot = await owner.stockLots.create({
		label: "Rolo 1",
		lotId: crypto.randomUUID(),
		notes: null,
		opId: newOpId(),
		variantId: floralId,
	});
	const location = await owner.stockLocations.create({
		locationId: crypto.randomUUID(),
		name: "Prateleira A",
		notes: null,
		opId: newOpId(),
	});
	const account = await owner.financialAccounts.create({
		accountId: crypto.randomUUID(),
		kind: "cash",
		name: "Caixa",
		notes: null,
		opId: newOpId(),
	});
	await owner.financialMovements.create({
		accountId: account.id,
		amountCents: "100000",
		kind: "opening",
		movementId: crypto.randomUUID(),
		occurredOn: "2026-09-01",
		opId: newOpId(),
		reason: null,
	});
	const bank = await owner.financialAccounts.create({
		accountId: crypto.randomUUID(),
		kind: "bank",
		name: "Banco",
		notes: null,
		opId: newOpId(),
	});
	const supplier = await owner.suppliers.create({
		email: null,
		name: "Tecidos São José",
		notes: null,
		opId: newOpId(),
		phone: null,
		supplierId: crypto.randomUUID(),
	});
	return {
		catalog: {
			accountId: account.id,
			bankId: bank.id,
			fabricId,
			floralId,
			locationId: location.id,
			lotId: lot.id,
			materialId: material.id,
			supplierId: supplier.id,
			threadId,
		},
		owner,
		server,
	};
}

function item(
	catalog: Catalog,
	overrides: Record<string, unknown> = {}
): {
	locationId: string;
	lotId: string | null;
	movementId: string;
	packageCountMicros: string;
	packagingLabel: string;
	packagingQuantityMicros: string;
	unitPriceCents: string;
	variantId: string;
} {
	return {
		locationId: catalog.locationId,
		lotId: null,
		movementId: crypto.randomUUID(),
		packageCountMicros: "3000000",
		packagingLabel: "Rolo 50 m",
		packagingQuantityMicros: "50000000",
		unitPriceCents: "12000",
		variantId: catalog.fabricId,
		...overrides,
	};
}

function caItems(catalog: Catalog) {
	return [
		item(catalog),
		item(catalog, {
			packageCountMicros: "10000000",
			packagingLabel: "un",
			packagingQuantityMicros: "1000000",
			unitPriceCents: "850",
			variantId: catalog.threadId,
		}),
		item(catalog, {
			lotId: catalog.lotId,
			packageCountMicros: "1000000",
			unitPriceCents: "9000",
			variantId: catalog.floralId,
		}),
	];
}

function purchaseInput(
	catalog: Catalog,
	overrides: Record<string, unknown> = {}
) {
	return {
		discountCents: "2000",
		freightCents: "1500",
		items: caItems(catalog),
		notes: null,
		obligationId: crypto.randomUUID(),
		occurredOn: "2026-09-17",
		opId: newOpId(),
		payment: {
			accountId: catalog.accountId,
			kind: "now" as const,
			movementId: crypto.randomUUID(),
		},
		purchaseId: crypto.randomUUID(),
		reference: "NF 4521",
		supplierId: catalog.supplierId,
		...overrides,
	};
}

function laterInput(catalog: Catalog, overrides: Record<string, unknown> = {}) {
	return purchaseInput(catalog, {
		payment: { dueOn: "2026-10-17", kind: "later" },
		...overrides,
	});
}

type PurchaseInput = ReturnType<typeof purchaseInput>;

function firstMovement(input: { items: { movementId: string }[] }): string {
	return input.items.at(0)?.movementId ?? "";
}

function reversalInput(
	purchase: PurchaseInput,
	overrides: Record<string, unknown> = {}
) {
	return {
		movementIds: purchase.items.map(() => crypto.randomUUID()),
		occurredOn: "2026-09-18",
		opId: newOpId(),
		paymentReversalId: crypto.randomUUID(),
		purchaseId: purchase.purchaseId,
		reason: "Lançada errada",
		reversalId: crypto.randomUUID(),
		...overrides,
	};
}

async function accountBalance(owner: Owner, accountId: string) {
	const { items } = await owner.financialAccounts.list({});
	return items.find((account) => account.id === accountId)?.balanceCents;
}

async function variantPoint(owner: Owner, variantId: string) {
	const { points } = await owner.stockBalances.get({ variantId });
	return points.map(({ lotId, quantityMicros, valueCents }) => ({
		lotId,
		quantityMicros,
		valueCents,
	}));
}

function projectionDrift(server: TestServer) {
	return server
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
}

function countRows(server: TestServer, sql: string) {
	return server.native().query<{ total: number }, []>(sql).get()?.total ?? -1;
}

describe("purchase with packaging, conversion and allocation", () => {
	test("converts packages, allocates freight and discount and pays from an account (CA-03)", async () => {
		const { catalog, owner, server } = await catalogSetup();
		const input = purchaseInput(catalog);
		expect(await owner.purchases.create(input)).toEqual({
			id: input.purchaseId,
			version: 1,
		});
		expect(await variantPoint(owner, catalog.fabricId)).toEqual([
			{ lotId: null, quantityMicros: "150000000", valueCents: "35664" },
		]);
		expect(await variantPoint(owner, catalog.threadId)).toEqual([
			{ lotId: null, quantityMicros: "10000000", valueCents: "8421" },
		]);
		expect(await variantPoint(owner, catalog.floralId)).toEqual([
			{ lotId: catalog.lotId, quantityMicros: "50000000", valueCents: "8915" },
		]);
		expect(await accountBalance(owner, catalog.accountId)).toBe("47000");
		expect(projectionDrift(server)).toBe(0);

		const detail = await owner.purchases.get({ purchaseId: input.purchaseId });
		expect(detail.purchase).toMatchObject({
			discountCents: "2000",
			freightCents: "1500",
			grossCents: "53500",
			id: input.purchaseId,
			occurredOn: "2026-09-17",
			reference: "NF 4521",
			supplierId: catalog.supplierId,
			supplierName: "Tecidos São José",
			totalCents: "53000",
			version: 1,
		});
		expect(
			detail.items.map((line) => ({
				discountCents: line.discountCents,
				freightCents: line.freightCents,
				grossCents: line.grossCents,
				quantityMicros: line.quantityMicros,
				valueCents: line.valueCents,
			}))
		).toEqual([
			{
				discountCents: "1345",
				freightCents: "1009",
				grossCents: "36000",
				quantityMicros: "150000000",
				valueCents: "35664",
			},
			{
				discountCents: "317",
				freightCents: "238",
				grossCents: "8500",
				quantityMicros: "10000000",
				valueCents: "8421",
			},
			{
				discountCents: "338",
				freightCents: "253",
				grossCents: "9000",
				quantityMicros: "50000000",
				valueCents: "8915",
			},
		]);
		expect(detail.items[2]).toMatchObject({
			baseUnit: "m",
			displayPrecision: 2,
			locationName: "Prateleira A",
			lotLabel: "Rolo 1",
			materialName: "Gorgurão",
			packagingLabel: "Rolo 50 m",
			variantName: "Tricoline floral",
		});
		expect(detail.obligation).toEqual({
			amountCents: "53000",
			dueOn: "2026-09-17",
			id: input.obligationId,
			payment: {
				accountId: catalog.accountId,
				accountName: "Caixa",
				movementId: input.payment.movementId,
				occurredOn: "2026-09-17",
			},
			status: "paid",
		});
		expect(detail.reversal).toBeNull();

		const { items: movements } = await owner.stockMovements.list({
			variantId: catalog.fabricId,
		});
		expect(movements[0]).toMatchObject({
			id: firstMovement(input),
			kind: "purchase",
			purchaseId: input.purchaseId,
			quantityMicros: "150000000",
			valueCents: "35664",
		});
		const { items: statement } = await owner.financialMovements.list({
			accountId: catalog.accountId,
		});
		expect(statement[0]).toMatchObject({
			amountCents: "-53000",
			id: input.payment.movementId,
			kind: "obligationPayment",
			obligationId: input.obligationId,
			purchaseId: input.purchaseId,
			purchaseReference: "NF 4521",
			supplierName: "Tecidos São José",
		});
	});

	test("lists purchases by supplier with their status", async () => {
		const { catalog, owner } = await catalogSetup();
		const other = await owner.suppliers.create({
			email: null,
			name: "Aviamentos Ltda",
			notes: null,
			opId: newOpId(),
			phone: null,
			supplierId: crypto.randomUUID(),
		});
		const paid = purchaseInput(catalog, { occurredOn: "2026-09-10" });
		const later = laterInput(catalog, { occurredOn: "2026-09-12" });
		const elsewhere = laterInput(catalog, { supplierId: other.id });
		await owner.purchases.create(paid);
		await owner.purchases.create(later);
		await owner.purchases.create(elsewhere);
		const all = await owner.purchases.list({});
		expect(all.items.map((row) => [row.id, row.status])).toEqual([
			[elsewhere.purchaseId, "open"],
			[later.purchaseId, "open"],
			[paid.purchaseId, "paid"],
		]);
		const bySupplier = await owner.purchases.list({
			supplierId: catalog.supplierId,
		});
		expect(bySupplier.items.map((row) => row.id)).toEqual([
			later.purchaseId,
			paid.purchaseId,
		]);
		expect(bySupplier.items[0]).toEqual({
			dueOn: "2026-10-17",
			id: later.purchaseId,
			itemCount: 3,
			occurredOn: "2026-09-12",
			reference: "NF 4521",
			status: "open",
			supplierId: catalog.supplierId,
			supplierName: "Tecidos São José",
			totalCents: "53000",
		});
		expect(bySupplier.nextOffset).toBeNull();
	});

	test("repeats by opId without duplicating movements or payment", async () => {
		const { catalog, owner, server } = await catalogSetup();
		const input = purchaseInput(catalog);
		const first = await owner.purchases.create(input);
		expect(await owner.purchases.create(input)).toEqual(first);
		expect(
			countRows(
				server,
				"SELECT count(*) AS total FROM stock_movement WHERE purchase_id IS NOT NULL"
			)
		).toBe(3);
		expect(await accountBalance(owner, catalog.accountId)).toBe("47000");
		await expect(
			owner.purchases.create({ ...input, opId: newOpId() })
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
	});

	test("refuses missing supplier, variant, location, lot and account", async () => {
		const { catalog, owner } = await catalogSetup();
		const cases: [Record<string, unknown>, string][] = [
			[{ supplierId: crypto.randomUUID() }, "Fornecedor não encontrado"],
			[
				{ items: [item(catalog, { variantId: crypto.randomUUID() })] },
				"Variante não encontrada",
			],
			[
				{ items: [item(catalog, { locationId: crypto.randomUUID() })] },
				"Local não encontrado",
			],
			[
				{ items: [item(catalog, { variantId: catalog.floralId })] },
				"Lote não encontrado",
			],
			[
				{ items: [item(catalog, { lotId: catalog.lotId })] },
				"Lote não encontrado",
			],
			[
				{
					payment: {
						accountId: crypto.randomUUID(),
						kind: "now",
						movementId: crypto.randomUUID(),
					},
				},
				"Conta não encontrada",
			],
		];
		await inSequence(cases, async ([overrides, message]) => {
			await expect(
				owner.purchases.create(purchaseInput(catalog, overrides))
			).rejects.toMatchObject({ code: "NOT_FOUND", message });
		});
		const { items } = await owner.purchases.list({});
		expect(items).toEqual([]);
	});

	test("refuses repeated ids, a used movement id and invalid values", async () => {
		const { catalog, owner } = await catalogSetup();
		const repeated = crypto.randomUUID();
		const invalid: Record<string, unknown>[] = [
			{
				items: [
					item(catalog, { movementId: repeated }),
					item(catalog, { movementId: repeated }),
				],
			},
			{ items: [item(catalog, { unitPriceCents: "0" })] },
			{
				discountCents: "0",
				freightCents: "0",
				items: [item(catalog, { unitPriceCents: "0" })],
			},
			{ items: [item(catalog, { packageCountMicros: "0" })] },
			{ items: [item(catalog, { unitPriceCents: "12,50" })] },
			{ items: [] },
			{ discountCents: "-1" },
		];
		const withSharedId = purchaseInput(catalog);
		invalid.push({
			items: withSharedId.items,
			obligationId: firstMovement(withSharedId),
		});
		await inSequence(invalid, async (overrides) => {
			await expect(
				owner.purchases.create(purchaseInput(catalog, overrides))
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		});
		const opening = await owner.stockMovements.create({
			kind: "opening",
			locationId: catalog.locationId,
			lotId: null,
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-01",
			opId: newOpId(),
			quantityMicros: "1000000",
			reason: null,
			valueCents: "100",
			variantId: catalog.fabricId,
		});
		await expect(
			owner.purchases.create(
				purchaseInput(catalog, {
					items: [item(catalog, { movementId: opening.id })],
				})
			)
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
	});

	test("finds variants with their packaging and hides the archived", async () => {
		const { catalog, owner } = await catalogSetup();
		const { items } = await owner.materialVariants.search({ query: "gorgu" });
		expect(items.map((variant) => variant.id).sort()).toEqual(
			[catalog.fabricId, catalog.floralId].sort()
		);
		expect(items.find((variant) => variant.id === catalog.fabricId)).toEqual({
			baseUnit: "m",
			code: null,
			displayPrecision: 2,
			id: catalog.fabricId,
			materialId: catalog.materialId,
			materialName: "Gorgurão",
			name: "Azul marinho",
			packaging: { label: "Rolo 50 m", quantityMicros: "50000000" },
			tracksLots: false,
		});
		await owner.materialVariants.archive({
			baseVersion: 1,
			opId: newOpId(),
			variantId: catalog.fabricId,
		});
		const after = await owner.materialVariants.search({ query: "gorgu" });
		expect(after.items.map((variant) => variant.id)).toEqual([
			catalog.floralId,
		]);
		const thread = await owner.materialVariants.search({ query: "linha" });
		expect(thread.items[0]).toMatchObject({
			id: catalog.threadId,
			packaging: null,
		});
	});

	test("answers a missing purchase and refuses writing straight to the table", async () => {
		const { catalog, owner, server } = await catalogSetup();
		await expect(
			owner.purchases.get({ purchaseId: crypto.randomUUID() })
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Compra não encontrada",
		});
		await owner.purchases.create(purchaseInput(catalog));
		expect(() =>
			server.native().run("UPDATE purchase SET total_cents = 1")
		).toThrow("purchase é append-only");
	});
});

describe("purchase obligation", () => {
	test("opens an obligation, pays it once, reopens it by reversing the payment and pays again", async () => {
		const { catalog, owner } = await catalogSetup();
		const input = laterInput(catalog);
		await owner.purchases.create(input);
		expect(await accountBalance(owner, catalog.accountId)).toBe("100000");
		const open = await owner.obligations.list({});
		expect(open.items).toEqual([
			{
				amountCents: "53000",
				dueOn: "2026-10-17",
				id: input.obligationId,
				paidAccountName: null,
				paidOn: null,
				paymentMovementId: null,
				purchaseId: input.purchaseId,
				purchaseOccurredOn: "2026-09-17",
				reference: "NF 4521",
				status: "open",
				supplierId: catalog.supplierId,
				supplierName: "Tecidos São José",
			},
		]);
		const pay = {
			accountId: catalog.bankId,
			movementId: crypto.randomUUID(),
			obligationId: input.obligationId,
			occurredOn: "2026-10-10",
			opId: newOpId(),
		};
		const paid = await owner.obligations.pay(pay);
		expect(await owner.obligations.pay(pay)).toEqual(paid);
		expect(await accountBalance(owner, catalog.bankId)).toBe("-53000");
		expect((await owner.obligations.list({})).items).toEqual([]);
		const paidList = await owner.obligations.list({ status: "paid" });
		expect(paidList.items[0]).toMatchObject({
			paidAccountName: "Banco",
			paidOn: "2026-10-10",
			paymentMovementId: pay.movementId,
			status: "paid",
		});
		const listed = await owner.purchases.list({});
		expect(listed.items[0]?.status).toBe("paid");
		await expect(
			owner.obligations.pay({
				...pay,
				movementId: crypto.randomUUID(),
				opId: newOpId(),
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Obrigação já paga",
		});
		await owner.financialMovements.reverse({
			movementId: crypto.randomUUID(),
			occurredOn: "2026-10-11",
			opId: newOpId(),
			reason: "Paguei da conta errada",
			reversesMovementId: pay.movementId,
		});
		expect(await accountBalance(owner, catalog.bankId)).toBe("0");
		expect((await owner.obligations.list({})).items[0]?.status).toBe("open");
		await owner.obligations.pay({
			...pay,
			accountId: catalog.accountId,
			movementId: crypto.randomUUID(),
			opId: newOpId(),
		});
		expect(await accountBalance(owner, catalog.accountId)).toBe("47000");
		const detail = await owner.purchases.get({ purchaseId: input.purchaseId });
		expect(detail.obligation).toMatchObject({
			payment: { accountName: "Caixa" },
			status: "paid",
		});
	});

	test("refuses a missing obligation and a missing account", async () => {
		const { catalog, owner } = await catalogSetup();
		const input = laterInput(catalog);
		await owner.purchases.create(input);
		await expect(
			owner.obligations.pay({
				accountId: catalog.accountId,
				movementId: crypto.randomUUID(),
				obligationId: crypto.randomUUID(),
				occurredOn: "2026-10-10",
				opId: newOpId(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Obrigação não encontrada",
		});
		await expect(
			owner.obligations.pay({
				accountId: crypto.randomUUID(),
				movementId: crypto.randomUUID(),
				obligationId: input.obligationId,
				occurredOn: "2026-10-10",
				opId: newOpId(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Conta não encontrada",
		});
	});
});

describe("purchase reversal", () => {
	test("returns stock and money, cancels the obligation and refuses a second reversal", async () => {
		const { catalog, owner, server } = await catalogSetup();
		const input = purchaseInput(catalog);
		await owner.purchases.create(input);
		await expect(
			owner.purchases.reverse(
				reversalInput(input, { movementIds: [crypto.randomUUID()] })
			)
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Compra não encontrada",
		});
		const reversal = reversalInput(input);
		const first = await owner.purchases.reverse(reversal);
		expect(first).toEqual({ id: reversal.reversalId, version: 1 });
		expect(await owner.purchases.reverse(reversal)).toEqual(first);
		expect(await variantPoint(owner, catalog.fabricId)).toEqual([]);
		expect(await variantPoint(owner, catalog.threadId)).toEqual([]);
		expect(await variantPoint(owner, catalog.floralId)).toEqual([]);
		expect(await accountBalance(owner, catalog.accountId)).toBe("100000");
		expect(projectionDrift(server)).toBe(0);
		const detail = await owner.purchases.get({ purchaseId: input.purchaseId });
		expect(detail.obligation.status).toBe("cancelled");
		expect(detail.obligation.payment).toBeNull();
		expect(detail.reversal).toMatchObject({
			id: reversal.reversalId,
			occurredOn: "2026-09-18",
			reason: "Lançada errada",
		});
		expect((await owner.purchases.list({})).items[0]?.status).toBe("reversed");
		expect(
			(await owner.obligations.list({ status: "cancelled" })).items
		).toHaveLength(1);
		const { items: movements } = await owner.stockMovements.list({
			variantId: catalog.fabricId,
		});
		expect(movements.find((row) => row.kind === "reversal")).toMatchObject({
			id: reversal.movementIds.at(0),
			purchaseId: input.purchaseId,
			quantityMicros: "-150000000",
			reason: "Lançada errada",
			reversesMovementId: firstMovement(input),
			valueCents: "-35664",
		});
		await expect(
			owner.purchases.reverse(reversalInput(input))
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Compra já estornada",
		});
		await expect(
			owner.obligations.pay({
				accountId: catalog.accountId,
				movementId: crypto.randomUUID(),
				obligationId: input.obligationId,
				occurredOn: "2026-10-10",
				opId: newOpId(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Obrigação cancelada",
		});
		await expect(
			owner.financialMovements.reverse({
				movementId: crypto.randomUUID(),
				occurredOn: "2026-09-19",
				opId: newOpId(),
				reason: "De novo",
				reversesMovementId: input.payment.movementId,
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Movimento já estornado",
		});
	});

	test("reverses a purchase to be paid without touching any account", async () => {
		const { catalog, owner, server } = await catalogSetup();
		const input = laterInput(catalog);
		await owner.purchases.create(input);
		const before = countRows(
			server,
			"SELECT count(*) AS total FROM financial_movement"
		);
		const reversal = reversalInput(input);
		await owner.purchases.reverse(reversal);
		expect(
			countRows(server, "SELECT count(*) AS total FROM financial_movement")
		).toBe(before);
		expect(await accountBalance(owner, catalog.accountId)).toBe("100000");
		expect((await owner.obligations.list({})).items).toEqual([]);
	});

	test("reverses the later payment of an obligation together with the purchase", async () => {
		const { catalog, owner } = await catalogSetup();
		const input = laterInput(catalog);
		await owner.purchases.create(input);
		await owner.obligations.pay({
			accountId: catalog.bankId,
			movementId: crypto.randomUUID(),
			obligationId: input.obligationId,
			occurredOn: "2026-10-10",
			opId: newOpId(),
		});
		await owner.purchases.reverse(reversalInput(input));
		expect(await accountBalance(owner, catalog.bankId)).toBe("0");
		const detail = await owner.purchases.get({ purchaseId: input.purchaseId });
		expect(detail.obligation.status).toBe("cancelled");
	});

	test("keeps purchase movements out of the stock reversal", async () => {
		const { catalog, owner } = await catalogSetup();
		const input = purchaseInput(catalog);
		await owner.purchases.create(input);
		const stockReverse = (reversesMovementId: string) =>
			owner.stockMovements.reverse({
				movementId: crypto.randomUUID(),
				occurredOn: "2026-09-18",
				opId: newOpId(),
				reason: "Tentativa",
				reversesMovementId,
			});
		await expect(stockReverse(firstMovement(input))).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Movimento de compra se estorna pela compra",
		});
		const reversal = reversalInput(input);
		await owner.purchases.reverse(reversal);
		await expect(
			stockReverse(reversal.movementIds.at(0) ?? "")
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Movimento de compra se estorna pela compra",
		});
	});

	test("refuses a reversal of a missing purchase and ids already used", async () => {
		const { catalog, owner } = await catalogSetup();
		const input = purchaseInput(catalog);
		await owner.purchases.create(input);
		await expect(
			owner.purchases.reverse(
				reversalInput(input, { purchaseId: crypto.randomUUID() })
			)
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Compra não encontrada",
		});
		await expect(
			owner.purchases.reverse(
				reversalInput(input, {
					movementIds: [
						firstMovement(input),
						crypto.randomUUID(),
						crypto.randomUUID(),
					],
				})
			)
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		await expect(
			owner.purchases.reverse(
				reversalInput(input, { paymentReversalId: input.payment.movementId })
			)
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		const repeated = crypto.randomUUID();
		await expect(
			owner.purchases.reverse(
				reversalInput(input, {
					movementIds: [repeated, repeated, crypto.randomUUID()],
				})
			)
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(await accountBalance(owner, catalog.accountId)).toBe("47000");
	});
});

describe("obligation order", () => {
	test("lists open obligations by due date ascending and paid ones descending", async () => {
		const { catalog, owner } = await catalogSetup();
		const late = laterInput(catalog, {
			payment: { dueOn: "2026-11-30", kind: "later" },
		});
		const soon = laterInput(catalog, {
			payment: { dueOn: "2026-10-01", kind: "later" },
		});
		await owner.purchases.create(late);
		await owner.purchases.create(soon);
		const open = await owner.obligations.list({});
		expect(open.items.map((row) => row.id)).toEqual([
			soon.obligationId,
			late.obligationId,
		]);
		await inSequence([soon, late], (input) =>
			owner.obligations.pay({
				accountId: catalog.accountId,
				movementId: crypto.randomUUID(),
				obligationId: input.obligationId,
				occurredOn: "2026-09-20",
				opId: newOpId(),
			})
		);
		const paid = await owner.obligations.list({ status: "paid" });
		expect(paid.items.map((row) => row.id)).toEqual([
			late.obligationId,
			soon.obligationId,
		]);
	});
});

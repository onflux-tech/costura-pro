import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";

import {
	applyMigrations,
	closeDb,
	createDb,
	type Database,
	getNativeDatabase,
} from "../src/index";
import { financialAccount, financialMovement } from "../src/schema/finance";
import { material, materialVariant } from "../src/schema/materials";
import {
	obligation,
	type PurchaseItemRecord,
	purchase,
	purchaseReversal,
	supplier,
} from "../src/schema/purchases";
import { stockLocation, stockMovement } from "../src/schema/stock";

const openDatabases: Database[] = [];
const temporaryDirectories: string[] = [];

afterEach(async () => {
	for (const database of openDatabases.splice(0)) {
		closeDb(database);
	}
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true }))
	);
});

async function migratedDatabase() {
	const directory = await mkdtemp(join(tmpdir(), "costura-pro-purchases-"));
	temporaryDirectories.push(directory);
	const database = createDb({ DATABASE_FILE: join(directory, "atelier.db") });
	openDatabases.push(database);
	applyMigrations(database);
	return database;
}

const epoch = new Date(0);

const item: PurchaseItemRecord = {
	discountCents: "100",
	freightCents: "50",
	grossCents: "1000",
	locationId: "location-1",
	lotId: null,
	movementId: "movement-1",
	packageCountMicros: "2000000",
	packagingLabel: "Rolo 50 m",
	packagingQuantityMicros: "50000000",
	quantityMicros: "100000000",
	unitPriceCents: "500",
	valueCents: "950",
	variantId: "variant-1",
};

function seedSupplier(database: Database) {
	database
		.insert(supplier)
		.values({
			archivedAt: null,
			createdAt: epoch,
			email: null,
			id: "supplier-1",
			name: "Tecidos São José",
			notes: null,
			phone: null,
			searchText: "tecidos sao jose",
			updatedAt: epoch,
			version: 1,
		})
		.run();
}

function seedPurchase(database: Database, id = "purchase-1") {
	database
		.insert(purchase)
		.values({
			createdAt: epoch,
			discountCents: 100n,
			freightCents: 50n,
			grossCents: 1000n,
			id,
			items: [item],
			notes: null,
			occurredOn: "2026-09-17",
			reference: "NF 123",
			supplierId: "supplier-1",
			totalCents: 950n,
			version: 1,
		})
		.run();
}

function seedAccount(database: Database) {
	database
		.insert(financialAccount)
		.values({
			archivedAt: null,
			createdAt: epoch,
			id: "account-1",
			kind: "cash",
			name: "Caixa",
			notes: null,
			updatedAt: epoch,
			version: 1,
		})
		.run();
}

const movementValues = {
	accountId: "account-1",
	amountCents: -950n,
	createdAt: epoch,
	kind: "opening",
	obligationId: null,
	occurredOn: "2026-09-17",
	reason: null,
	reversesMovementId: null,
	transferId: null,
	version: 1,
} as const;

function columnsOf(database: Database, table: string) {
	return getNativeDatabase(database)
		.query<{ name: string }, []>(
			`SELECT name FROM pragma_table_info('${table}')`
		)
		.all()
		.map((row) => row.name)
		.sort();
}

function uniqueIndexes(database: Database, table: string) {
	return getNativeDatabase(database)
		.query<{ name: string; unique: number }, []>(
			`SELECT name, "unique" FROM pragma_index_list('${table}')`
		)
		.all()
		.filter((row) => row.unique === 1)
		.map((row) => row.name);
}

describe("purchase and finance schema", () => {
	test("creates the tables with their columns", async () => {
		const database = await migratedDatabase();
		expect(columnsOf(database, "supplier")).toEqual(
			[
				"archived_at",
				"created_at",
				"email",
				"id",
				"name",
				"notes",
				"phone",
				"search_text",
				"updated_at",
				"version",
			].sort()
		);
		expect(columnsOf(database, "purchase")).toEqual(
			[
				"created_at",
				"discount_cents",
				"freight_cents",
				"gross_cents",
				"id",
				"items",
				"notes",
				"occurred_on",
				"reference",
				"supplier_id",
				"total_cents",
				"version",
			].sort()
		);
		expect(columnsOf(database, "obligation")).toEqual(
			[
				"amount_cents",
				"created_at",
				"due_on",
				"id",
				"kind",
				"purchase_id",
				"version",
			].sort()
		);
		expect(columnsOf(database, "purchase_reversal")).toEqual(
			[
				"created_at",
				"id",
				"occurred_on",
				"purchase_id",
				"reason",
				"version",
			].sort()
		);
		expect(columnsOf(database, "financial_account")).toEqual(
			[
				"archived_at",
				"created_at",
				"id",
				"kind",
				"name",
				"notes",
				"updated_at",
				"version",
			].sort()
		);
		expect(columnsOf(database, "financial_movement")).toEqual(
			[
				"account_id",
				"amount_cents",
				"created_at",
				"id",
				"kind",
				"obligation_id",
				"occurred_on",
				"reason",
				"reverses_movement_id",
				"transfer_id",
				"version",
			].sort()
		);
		expect(columnsOf(database, "stock_movement")).toContain("purchase_id");
	});

	test("keeps the items and the money of a purchase exact", async () => {
		const database = await migratedDatabase();
		seedSupplier(database);
		seedPurchase(database);
		const row = database
			.select()
			.from(purchase)
			.where(eq(purchase.id, "purchase-1"))
			.get();
		expect(row?.items).toEqual([item]);
		expect(row?.totalCents).toBe(950n);
	});

	test("refuses a purchase, an obligation or a movement without its parent", async () => {
		const database = await migratedDatabase();
		expect(() => seedPurchase(database)).toThrow();
		seedSupplier(database);
		seedPurchase(database);
		expect(() =>
			database
				.insert(obligation)
				.values({
					amountCents: 950n,
					createdAt: epoch,
					dueOn: "2026-10-17",
					id: "obligation-1",
					kind: "purchase",
					purchaseId: "sem-compra",
					version: 1,
				})
				.run()
		).toThrow();
		expect(() =>
			database
				.insert(financialMovement)
				.values({ ...movementValues, id: "m" })
				.run()
		).toThrow();
		seedAccount(database);
		expect(() =>
			database
				.insert(financialMovement)
				.values({
					...movementValues,
					id: "m",
					kind: "obligationPayment",
					obligationId: "sem-obrigacao",
				})
				.run()
		).toThrow();
	});

	test("allows one obligation and one reversal per purchase", async () => {
		const database = await migratedDatabase();
		seedSupplier(database);
		seedPurchase(database);
		const obligationValues = {
			amountCents: 950n,
			createdAt: epoch,
			dueOn: "2026-10-17",
			kind: "purchase",
			purchaseId: "purchase-1",
			version: 1,
		} as const;
		database
			.insert(obligation)
			.values({ ...obligationValues, id: "obligation-1" })
			.run();
		expect(() =>
			database
				.insert(obligation)
				.values({ ...obligationValues, id: "obligation-2" })
				.run()
		).toThrow();
		const reversalValues = {
			createdAt: epoch,
			occurredOn: "2026-09-18",
			purchaseId: "purchase-1",
			reason: "Lançada errada",
			version: 1,
		};
		database
			.insert(purchaseReversal)
			.values({ ...reversalValues, id: "reversal-1" })
			.run();
		expect(() =>
			database
				.insert(purchaseReversal)
				.values({ ...reversalValues, id: "reversal-2" })
				.run()
		).toThrow();
		expect(uniqueIndexes(database, "obligation")).toContain(
			"obligation_purchase_idx"
		);
		expect(uniqueIndexes(database, "purchase_reversal")).toContain(
			"purchase_reversal_purchase_idx"
		);
	});

	test("allows one reversal per financial movement and keeps a signed amount", async () => {
		const database = await migratedDatabase();
		seedAccount(database);
		database
			.insert(financialMovement)
			.values({ ...movementValues, id: "movement-1" })
			.run();
		expect(
			database
				.select()
				.from(financialMovement)
				.where(eq(financialMovement.id, "movement-1"))
				.get()?.amountCents
		).toBe(-950n);
		const reversal = {
			...movementValues,
			amountCents: 950n,
			kind: "reversal",
			reason: "Lançado errado",
			reversesMovementId: "movement-1",
		} as const;
		database
			.insert(financialMovement)
			.values({ ...reversal, id: "reversal-1" })
			.run();
		expect(() =>
			database
				.insert(financialMovement)
				.values({ ...reversal, id: "reversal-2" })
				.run()
		).toThrow();
		expect(uniqueIndexes(database, "financial_movement")).toContain(
			"financial_movement_reverses_idx"
		);
	});

	test("keeps purchase, obligation, reversal and financial movement append-only", async () => {
		const database = await migratedDatabase();
		seedSupplier(database);
		seedPurchase(database);
		seedAccount(database);
		database
			.insert(obligation)
			.values({
				amountCents: 950n,
				createdAt: epoch,
				dueOn: "2026-10-17",
				id: "obligation-1",
				kind: "purchase",
				purchaseId: "purchase-1",
				version: 1,
			})
			.run();
		database
			.insert(purchaseReversal)
			.values({
				createdAt: epoch,
				id: "reversal-1",
				occurredOn: "2026-09-18",
				purchaseId: "purchase-1",
				reason: "Lançada errada",
				version: 1,
			})
			.run();
		database
			.insert(financialMovement)
			.values({ ...movementValues, id: "movement-1" })
			.run();
		const native = getNativeDatabase(database);
		for (const table of [
			"purchase",
			"obligation",
			"purchase_reversal",
			"financial_movement",
		]) {
			expect(() => native.run(`UPDATE ${table} SET version = 2`)).toThrow(
				`${table} é append-only`
			);
			expect(() => native.run(`DELETE FROM ${table}`)).toThrow(
				`${table} é append-only`
			);
		}
	});

	test("links a stock movement to its purchase and keeps it append-only", async () => {
		const database = await migratedDatabase();
		seedSupplier(database);
		seedPurchase(database);
		database
			.insert(material)
			.values({
				archivedAt: null,
				category: null,
				createdAt: epoch,
				id: "material-1",
				name: "Gorgurão",
				notes: null,
				searchText: "gorgurao",
				updatedAt: epoch,
				version: 1,
			})
			.run();
		database
			.insert(materialVariant)
			.values({
				archivedAt: null,
				baseUnit: "m",
				code: null,
				createdAt: epoch,
				displayPrecision: 2,
				id: "variant-1",
				materialId: "material-1",
				name: "Azul",
				searchText: "azul",
				updatedAt: epoch,
				version: 1,
			})
			.run();
		database
			.insert(stockLocation)
			.values({
				archivedAt: null,
				createdAt: epoch,
				id: "location-1",
				name: "Armário",
				notes: null,
				updatedAt: epoch,
				version: 1,
			})
			.run();
		const values = {
			createdAt: epoch,
			kind: "purchase",
			locationId: "location-1",
			lotId: null,
			occurredOn: "2026-09-17",
			quantityMicros: 100_000_000n,
			reason: null,
			reversesMovementId: null,
			transferId: null,
			valueCents: 950n,
			variantId: "variant-1",
			version: 1,
		} as const;
		database
			.insert(stockMovement)
			.values({ ...values, id: "movement-1", purchaseId: "purchase-1" })
			.run();
		expect(() =>
			database
				.insert(stockMovement)
				.values({ ...values, id: "movement-2", purchaseId: "sem-compra" })
				.run()
		).toThrow();
		expect(() =>
			getNativeDatabase(database).run(
				"UPDATE stock_movement SET purchase_id = NULL"
			)
		).toThrow("stock_movement é append-only");
	});
});

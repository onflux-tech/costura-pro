import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import {
	applyMigrations,
	closeDb,
	createDb,
	type Database,
	getNativeDatabase,
} from "../src/index";
import { client } from "../src/schema/clients";
import { quote } from "../src/schema/quotes";
import {
	materialReconciliation,
	materialReconciliationReversal,
	type ReconciliationLineRow,
} from "../src/schema/reconciliation";
import { serviceOrder, serviceOrderItem } from "../src/schema/service-orders";

const openDatabases: Database[] = [];
const temporaryDirectories: string[] = [];
const migrationsFolder = fileURLToPath(
	new URL("../src/migrations", import.meta.url)
);
const epoch = new Date(0);

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

async function temporaryDirectory() {
	const directory = await mkdtemp(
		join(tmpdir(), "costura-pro-reconciliation-")
	);
	temporaryDirectories.push(directory);
	return directory;
}

async function openDatabase() {
	const directory = await temporaryDirectory();
	const database = createDb({ DATABASE_FILE: join(directory, "atelier.db") });
	openDatabases.push(database);
	return database;
}

async function migratedDatabase() {
	const database = await openDatabase();
	applyMigrations(database);
	return database;
}

const reconciledLines: ReconciliationLineRow[] = [
	{
		consumedMicros: "3000000",
		lostMicros: "200000",
		parts: [
			{
				locationId: "location-cabinet",
				lotId: "lot-a",
				movementId: "movement-1",
				provisionalCents: "0",
				provisionalMicros: "0",
				quantityMicros: "1000000",
				valueCents: "3000",
			},
			{
				locationId: "location-shelf",
				lotId: null,
				movementId: "movement-2",
				provisionalCents: "2000",
				provisionalMicros: "800000",
				quantityMicros: "2200000",
				valueCents: "5750",
			},
		],
		plannedMicros: "3400000",
		plannedVariantId: "variant-crepe",
		swapReason: null,
		variantId: "variant-crepe",
	},
];

function seedItem(database: Database) {
	database
		.insert(client)
		.values({
			address: null,
			anonymizedAt: null,
			archivedAt: null,
			createdAt: epoch,
			email: null,
			id: "client-1",
			kind: "person",
			name: "Maria",
			notes: null,
			phone: null,
			searchText: "maria",
			secondaryPhone: null,
			updatedAt: epoch,
			version: 1,
		})
		.run();
	database
		.insert(quote)
		.values({
			archivedAt: null,
			clientId: "client-1",
			code: "ORC-2026-PC-0001",
			codeDevice: "PC",
			codeNumber: 1,
			codeYear: 2026,
			createdAt: epoch,
			createdOn: "2026-09-20",
			discount: null,
			id: "quote-1",
			leadTimeDays: 20,
			lines: [],
			notes: null,
			refusalReason: null,
			refusedOn: null,
			searchText: "orc-2026-pc-0001",
			updatedAt: epoch,
			validityDays: 15,
			version: 1,
		})
		.run();
	database
		.insert(serviceOrder)
		.values({
			clientId: "client-1",
			code: "OS-2026-PC-0001",
			codeDevice: "PC",
			codeNumber: 1,
			codeYear: 2026,
			createdAt: epoch,
			id: "order-1",
			openedOn: "2026-09-22",
			quoteId: "quote-1",
			searchText: "os-2026-pc-0001",
			updatedAt: epoch,
			version: 1,
		})
		.run();
	database
		.insert(serviceOrderItem)
		.values({
			createdAt: epoch,
			dueOn: null,
			id: "item-1",
			kind: "custom",
			line: {
				components: [],
				costCents: null,
				description: "Vestido sob medida",
				discount: null,
				discountCents: "0",
				grossCents: "98000",
				id: "line-custom",
				kind: "custom",
				note: null,
				profileId: null,
				quantity: 1,
				source: null,
				totalCents: "98000",
				unitPriceCents: "98000",
			},
			lineId: "line-custom",
			measurements: [],
			position: 0,
			serviceOrderId: "order-1",
			updatedAt: epoch,
			version: 1,
		})
		.run();
}

async function seededDatabase() {
	const database = await migratedDatabase();
	seedItem(database);
	database
		.insert(materialReconciliation)
		.values({
			createdAt: epoch,
			id: "reconciliation-1",
			lines: reconciledLines,
			note: "Sobrou retalho",
			occurredOn: "2026-09-25",
			serviceOrderItemId: "item-1",
			version: 1,
		})
		.run();
	database
		.insert(materialReconciliationReversal)
		.values({
			createdAt: epoch,
			id: "reconciliation-reversal-1",
			occurredOn: "2026-09-26",
			reason: "Reconciliado no subitem errado",
			reconciliationId: "reconciliation-1",
			version: 1,
		})
		.run();
	return { database, native: getNativeDatabase(database) };
}

describe("material reconciliation schema", () => {
	test("creates the reconciliation and its reversal with their columns and indexes", async () => {
		const database = await migratedDatabase();
		const native = getNativeDatabase(database);
		const columns = (table: string) =>
			native
				.query<{ name: string; notnull: number }, []>(
					`SELECT name, "notnull" FROM pragma_table_info('${table}')`
				)
				.all()
				.sort((left, right) => (left.name < right.name ? -1 : 1));
		expect(columns("material_reconciliation")).toEqual([
			{ name: "created_at", notnull: 1 },
			{ name: "id", notnull: 1 },
			{ name: "lines", notnull: 1 },
			{ name: "note", notnull: 0 },
			{ name: "occurred_on", notnull: 1 },
			{ name: "service_order_item_id", notnull: 1 },
			{ name: "version", notnull: 1 },
		]);
		expect(columns("material_reconciliation_reversal")).toEqual([
			{ name: "created_at", notnull: 1 },
			{ name: "id", notnull: 1 },
			{ name: "occurred_on", notnull: 1 },
			{ name: "reason", notnull: 1 },
			{ name: "reconciliation_id", notnull: 1 },
			{ name: "version", notnull: 1 },
		]);
		const indexes = native
			.query<{ name: string; unique: number }, []>(
				[
					"material_reconciliation",
					"material_reconciliation_reversal",
					"stock_movement",
				]
					.map(
						(table) =>
							`SELECT name, "unique" FROM pragma_index_list('${table}')`
					)
					.join(" UNION ALL ")
			)
			.all()
			.filter(
				(row) =>
					row.name.includes("reconciliation") &&
					!row.name.startsWith("sqlite_autoindex")
			);
		expect(
			indexes.sort((left, right) => (left.name < right.name ? -1 : 1))
		).toEqual([
			{ name: "material_reconciliation_item_idx", unique: 0 },
			{ name: "material_reconciliation_reversal_idx", unique: 1 },
			{ name: "stock_movement_material_reconciliation_idx", unique: 0 },
		]);
	});

	test("links the reconciliation, its reversal and the stock movement by foreign key", async () => {
		const database = await migratedDatabase();
		const native = getNativeDatabase(database);
		const keys = (table: string) =>
			native
				.query<{ from: string; table: string; to: string }, []>(
					`SELECT "from", "table", "to" FROM pragma_foreign_key_list('${table}')`
				)
				.all()
				.filter(
					(key) =>
						key.table.includes("reconciliation") || table !== "stock_movement"
				);
		expect(keys("material_reconciliation")).toEqual([
			{ from: "service_order_item_id", table: "service_order_item", to: "id" },
		]);
		expect(keys("material_reconciliation_reversal")).toEqual([
			{ from: "reconciliation_id", table: "material_reconciliation", to: "id" },
		]);
		expect(keys("stock_movement")).toEqual([
			{
				from: "material_reconciliation_id",
				table: "material_reconciliation",
				to: "id",
			},
		]);
	});

	test("keeps the reconciled lines with their parts as written", async () => {
		const { database } = await seededDatabase();
		const row = database
			.select()
			.from(materialReconciliation)
			.where(eq(materialReconciliation.id, "reconciliation-1"))
			.get();
		expect(row?.lines).toEqual(reconciledLines);
		expect(row?.note).toBe("Sobrou retalho");
	});

	test("refuses a second reversal of the same reconciliation", async () => {
		const { database } = await seededDatabase();
		expect(() =>
			database
				.insert(materialReconciliationReversal)
				.values({
					createdAt: epoch,
					id: "reconciliation-reversal-2",
					occurredOn: "2026-09-27",
					reason: "De novo",
					reconciliationId: "reconciliation-1",
					version: 1,
				})
				.run()
		).toThrow();
	});

	test("keeps the reconciliation and its reversal append-only", async () => {
		const { native } = await seededDatabase();
		for (const table of [
			"material_reconciliation_reversal",
			"material_reconciliation",
		]) {
			expect(() => native.run(`UPDATE ${table} SET version = 2`)).toThrow(
				`${table} é append-only`
			);
			expect(() => native.run(`DELETE FROM ${table}`)).toThrow(
				`${table} é append-only`
			);
		}
	});

	test("adds the reconciliation to existing stock movements without rebuilding them", async () => {
		const database = await openDatabase();
		const earlier = await temporaryDirectory();
		await cp(migrationsFolder, earlier, { recursive: true });
		const journalFile = join(earlier, "meta", "_journal.json");
		const journal = JSON.parse(await readFile(journalFile, "utf8")) as {
			entries: { tag: string }[];
		};
		const cut = journal.entries.findIndex((entry) =>
			entry.tag.endsWith("_material_reconciliation")
		);
		expect(cut).toBeGreaterThan(0);
		await writeFile(
			journalFile,
			JSON.stringify({ ...journal, entries: journal.entries.slice(0, cut) })
		);
		migrate(database, { migrationsFolder: earlier });
		const native = getNativeDatabase(database);
		const tableSql = () =>
			native
				.query<{ sql: string }, []>(
					"SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'stock_movement'"
				)
				.get()?.sql ?? "";
		const before = tableSql();
		native.run(
			"INSERT INTO material (id, name, category, search_text, created_at, updated_at, version) VALUES ('material-1', 'Crepe', 'Tecido', 'crepe tecido', 0, 0, 1)"
		);
		native.run(
			"INSERT INTO material_variant (id, material_id, name, base_unit, display_precision, search_text, created_at, updated_at, version) VALUES ('variant-1', 'material-1', 'Preto', 'm', 2, 'preto', 0, 0, 1)"
		);
		native.run(
			"INSERT INTO stock_location (id, name, created_at, updated_at, version) VALUES ('location-1', 'Armário', 0, 0, 1)"
		);
		native.run(
			"INSERT INTO stock_movement (id, kind, variant_id, location_id, occurred_on, quantity_micros, value_cents, created_at, version) VALUES ('movement-1', 'opening', 'variant-1', 'location-1', '2026-09-20', 2500000, 7500, 0, 1)"
		);
		applyMigrations(database);
		expect(
			native
				.query<
					{
						id: string;
						material_reconciliation_id: string | null;
						quantity_micros: number;
					},
					[]
				>(
					"SELECT id, material_reconciliation_id, quantity_micros FROM stock_movement"
				)
				.all()
		).toEqual([
			{
				id: "movement-1",
				material_reconciliation_id: null,
				quantity_micros: 2_500_000,
			},
		]);
		const added =
			", `material_reconciliation_id` text REFERENCES material_reconciliation(id)";
		const after = tableSql();
		expect(after).toContain(added);
		expect(after.replace(added, "")).toBe(before);
		expect(
			native
				.query<{ name: string }, []>(
					"SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'stock_movement' ORDER BY name"
				)
				.all()
				.map((row) => row.name)
		).toEqual(["stock_movement_no_delete", "stock_movement_no_update"]);
	});
});

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";

import { maxExactInteger } from "../src/columns";
import {
	applyMigrations,
	closeDb,
	createDb,
	type Database,
	getNativeDatabase,
} from "../src/index";
import { material, materialVariant } from "../src/schema/materials";
import {
	inventorySession,
	stockBalance,
	stockLocation,
	stockLot,
	stockMovement,
} from "../src/schema/stock";

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
	const directory = await mkdtemp(join(tmpdir(), "costura-pro-stock-"));
	temporaryDirectories.push(directory);
	const database = createDb({ DATABASE_FILE: join(directory, "atelier.db") });
	openDatabases.push(database);
	applyMigrations(database);
	return database;
}

function seedVariant(database: Database) {
	database
		.insert(material)
		.values({
			archivedAt: null,
			category: "Tecido",
			createdAt: new Date(0),
			id: "material-1",
			name: "Gorgurão",
			notes: null,
			searchText: "gorgurao tecido",
			updatedAt: new Date(0),
			version: 1,
		})
		.run();
	database
		.insert(materialVariant)
		.values({
			archivedAt: null,
			baseUnit: "m",
			code: "GR-AZ",
			createdAt: new Date(0),
			displayPrecision: 2,
			id: "variant-1",
			materialId: "material-1",
			name: "Azul marinho",
			searchText: "azul marinho gr-az",
			updatedAt: new Date(0),
			version: 1,
		})
		.run();
}

function seedLocation(database: Database, id: string) {
	database
		.insert(stockLocation)
		.values({
			archivedAt: null,
			createdAt: new Date(0),
			id,
			name: `Armário ${id}`,
			notes: null,
			updatedAt: new Date(0),
			version: 1,
		})
		.run();
}

const movementValues = {
	createdAt: new Date(0),
	kind: "opening",
	locationId: "location-1",
	lotId: null,
	occurredOn: "2026-09-17",
	quantityMicros: 5_000_000n,
	reason: null,
	reversesMovementId: null,
	transferId: null,
	valueCents: 2500n,
	variantId: "variant-1",
	version: 1,
} as const;

const sessionValues = {
	createdAt: new Date(0),
	id: "session-1",
	lines: [],
	notes: null,
	occurredOn: "2026-09-23",
	reason: "Inventário anual",
	version: 1,
};

function columnsOf(database: Database, table: string) {
	return getNativeDatabase(database)
		.query<{ name: string }, []>(
			`SELECT name FROM pragma_table_info('${table}')`
		)
		.all()
		.map((row) => row.name)
		.sort();
}

describe("stock schema", () => {
	test("creates the four stock tables with their columns", async () => {
		const database = await migratedDatabase();
		expect(columnsOf(database, "stock_location")).toEqual(
			[
				"archived_at",
				"created_at",
				"id",
				"name",
				"notes",
				"updated_at",
				"version",
			].sort()
		);
		expect(columnsOf(database, "stock_lot")).toEqual(
			[
				"archived_at",
				"created_at",
				"id",
				"label",
				"notes",
				"updated_at",
				"variant_id",
				"version",
			].sort()
		);
		expect(columnsOf(database, "stock_movement")).toEqual(
			[
				"created_at",
				"id",
				"inventory_session_id",
				"kind",
				"location_id",
				"lot_id",
				"occurred_on",
				"purchase_id",
				"quantity_micros",
				"reason",
				"reverses_movement_id",
				"transfer_id",
				"value_cents",
				"variant_id",
				"version",
			].sort()
		);
		expect(columnsOf(database, "stock_balance")).toEqual(
			[
				"id",
				"location_id",
				"lot_id",
				"quantity_micros",
				"updated_at",
				"value_cents",
				"variant_id",
			].sort()
		);
	});

	test("gives a material variant lot tracking off by default", async () => {
		const database = await migratedDatabase();
		seedVariant(database);
		const row = database
			.select()
			.from(materialVariant)
			.where(eq(materialVariant.id, "variant-1"))
			.get();
		expect(row?.tracksLots).toBe(false);
	});

	test("keeps signed quantity and value exact through the integer column", async () => {
		const database = await migratedDatabase();
		seedVariant(database);
		seedLocation(database, "location-1");
		database
			.insert(stockMovement)
			.values({
				...movementValues,
				id: "movement-1",
				kind: "adjustment",
				quantityMicros: -1_500_000n,
				reason: "Sobra devolvida",
				valueCents: -750n,
			})
			.run();
		const row = database
			.select()
			.from(stockMovement)
			.where(eq(stockMovement.id, "movement-1"))
			.get();
		expect(row?.quantityMicros).toBe(-1_500_000n);
		expect(row?.valueCents).toBe(-750n);
		expect(
			getNativeDatabase(database)
				.query<{ typeof_value: string }, []>(
					"SELECT typeof(quantity_micros) AS typeof_value FROM stock_movement"
				)
				.all()
		).toEqual([{ typeof_value: "integer" }]);
	});

	test("refuses a quantity beyond the exact integer ceiling", async () => {
		const database = await migratedDatabase();
		seedVariant(database);
		seedLocation(database, "location-1");
		expect(() =>
			database
				.insert(stockMovement)
				.values({
					...movementValues,
					id: "movement-1",
					quantityMicros: maxExactInteger + 1n,
				})
				.run()
		).toThrow("Valor inteiro fora da faixa exata");
	});

	test("refuses a movement whose variant, location or lot does not exist", async () => {
		const database = await migratedDatabase();
		seedVariant(database);
		seedLocation(database, "location-1");
		expect(() =>
			database
				.insert(stockMovement)
				.values({ ...movementValues, id: "m", variantId: "sem-variante" })
				.run()
		).toThrow();
		expect(() =>
			database
				.insert(stockMovement)
				.values({ ...movementValues, id: "m", locationId: "sem-local" })
				.run()
		).toThrow();
		expect(() =>
			database
				.insert(stockMovement)
				.values({ ...movementValues, id: "m", lotId: "sem-lote" })
				.run()
		).toThrow();
	});

	test("refuses a lot whose variant does not exist", async () => {
		const database = await migratedDatabase();
		expect(() =>
			database
				.insert(stockLot)
				.values({
					archivedAt: null,
					createdAt: new Date(0),
					id: "lot-1",
					label: "Rolo 1",
					notes: null,
					updatedAt: new Date(0),
					variantId: "sem-variante",
					version: 1,
				})
				.run()
		).toThrow();
	});

	test("keeps stock_movement append-only", async () => {
		const database = await migratedDatabase();
		seedVariant(database);
		seedLocation(database, "location-1");
		database
			.insert(stockMovement)
			.values({ ...movementValues, id: "movement-1" })
			.run();
		const native = getNativeDatabase(database);
		expect(() =>
			native.run(
				"UPDATE stock_movement SET quantity_micros = 1 WHERE id = 'movement-1'"
			)
		).toThrow("stock_movement é append-only");
		expect(() =>
			native.run("DELETE FROM stock_movement WHERE id = 'movement-1'")
		).toThrow("stock_movement é append-only");
	});

	test("allows one reversal per movement and many movements without one", async () => {
		const database = await migratedDatabase();
		seedVariant(database);
		seedLocation(database, "location-1");
		database
			.insert(stockMovement)
			.values({ ...movementValues, id: "movement-1" })
			.run();
		database
			.insert(stockMovement)
			.values({ ...movementValues, id: "movement-2" })
			.run();
		database
			.insert(stockMovement)
			.values({
				...movementValues,
				id: "reversal-1",
				kind: "reversal",
				quantityMicros: -5_000_000n,
				reason: "Lançado errado",
				reversesMovementId: "movement-1",
				valueCents: -2500n,
			})
			.run();
		expect(() =>
			database
				.insert(stockMovement)
				.values({
					...movementValues,
					id: "reversal-2",
					kind: "reversal",
					quantityMicros: -5_000_000n,
					reason: "De novo",
					reversesMovementId: "movement-1",
					valueCents: -2500n,
				})
				.run()
		).toThrow();
	});

	test("indexes the balance point, the transfer and the reversal", async () => {
		const database = await migratedDatabase();
		const indexes = (table: string) =>
			getNativeDatabase(database)
				.query<{ name: string; unique: number }, []>(
					`SELECT name, "unique" FROM pragma_index_list('${table}')`
				)
				.all();
		expect(indexes("stock_movement").map((row) => row.name)).toEqual(
			expect.arrayContaining([
				"stock_movement_point_idx",
				"stock_movement_transfer_idx",
				"stock_movement_reverses_idx",
			])
		);
		expect(
			indexes("stock_movement").find(
				(row) => row.name === "stock_movement_reverses_idx"
			)?.unique
		).toBe(1);
		expect(indexes("stock_balance").map((row) => row.name)).toEqual(
			expect.arrayContaining(["stock_balance_variant_idx"])
		);
	});

	test("creates the inventory session with its columns", async () => {
		const database = await migratedDatabase();
		expect(columnsOf(database, "inventory_session")).toEqual(
			[
				"created_at",
				"id",
				"lines",
				"notes",
				"occurred_on",
				"reason",
				"version",
			].sort()
		);
	});

	test("keeps the counted lines of an inventory session through the JSON column", async () => {
		const database = await migratedDatabase();
		const lines = [
			{
				countedMicros: "12000000",
				expectedMicros: "-2000000",
				locationId: "location-1",
				lotId: null,
				movementId: "movement-9",
				valueCents: "5000",
				variantId: "variant-1",
			},
			{
				countedMicros: "3000000",
				expectedMicros: "3000000",
				locationId: "location-1",
				lotId: null,
				movementId: null,
				valueCents: null,
				variantId: "variant-1",
			},
		];
		database
			.insert(inventorySession)
			.values({ ...sessionValues, lines })
			.run();
		const row = database
			.select()
			.from(inventorySession)
			.where(eq(inventorySession.id, "session-1"))
			.get();
		expect(row?.lines).toEqual(lines);
		expect(row?.reason).toBe("Inventário anual");
	});

	test("links a movement only to an existing inventory session", async () => {
		const database = await migratedDatabase();
		seedVariant(database);
		seedLocation(database, "location-1");
		expect(() =>
			database
				.insert(stockMovement)
				.values({
					...movementValues,
					id: "movement-1",
					inventorySessionId: "sem-contagem",
					kind: "inventory",
				})
				.run()
		).toThrow();
		database.insert(inventorySession).values(sessionValues).run();
		database
			.insert(stockMovement)
			.values({
				...movementValues,
				id: "movement-1",
				inventorySessionId: "session-1",
				kind: "inventory",
			})
			.run();
		expect(
			database
				.select()
				.from(stockMovement)
				.where(eq(stockMovement.id, "movement-1"))
				.get()?.inventorySessionId
		).toBe("session-1");
	});

	test("keeps inventory_session append-only", async () => {
		const database = await migratedDatabase();
		database.insert(inventorySession).values(sessionValues).run();
		const native = getNativeDatabase(database);
		expect(() =>
			native.run(
				"UPDATE inventory_session SET reason = 'x' WHERE id = 'session-1'"
			)
		).toThrow("inventory_session é append-only");
		expect(() =>
			native.run("DELETE FROM inventory_session WHERE id = 'session-1'")
		).toThrow("inventory_session é append-only");
	});

	test("adds the inventory link to stock_movement without recreating the table", async () => {
		const database = await migratedDatabase();
		const native = getNativeDatabase(database);
		const definition = native
			.query<{ sql: string }, []>(
				"SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'stock_movement'"
			)
			.get()?.sql;
		expect(definition?.startsWith("CREATE TABLE `stock_movement`")).toBe(true);
		expect(
			native
				.query<{ name: string }, []>(
					"SELECT name FROM pragma_index_list('stock_movement')"
				)
				.all()
				.map((row) => row.name)
		).toEqual(expect.arrayContaining(["stock_movement_inventory_session_idx"]));
		expect(
			native
				.query<{ name: string }, []>(
					"SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'stock_movement' ORDER BY name"
				)
				.all()
				.map((row) => row.name)
		).toEqual(["stock_movement_no_delete", "stock_movement_no_update"]);
	});

	test("keeps one balance row per variant, location and lot", async () => {
		const database = await migratedDatabase();
		seedVariant(database);
		seedLocation(database, "location-1");
		const point = {
			locationId: "location-1",
			quantityMicros: 1_000_000n,
			updatedAt: new Date(0),
			valueCents: 100n,
			variantId: "variant-1",
		};
		database
			.insert(stockBalance)
			.values({ ...point, id: "variant-1|location-1|-", lotId: null })
			.run();
		expect(() =>
			database
				.insert(stockBalance)
				.values({ ...point, id: "variant-1|location-1|-", lotId: null })
				.run()
		).toThrow();
	});
});

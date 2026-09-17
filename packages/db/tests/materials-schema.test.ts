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
	const directory = await mkdtemp(join(tmpdir(), "costura-pro-materials-"));
	temporaryDirectories.push(directory);
	const database = createDb({ DATABASE_FILE: join(directory, "atelier.db") });
	openDatabases.push(database);
	applyMigrations(database);
	return database;
}

function insertMaterial(database: Database, id: string) {
	database
		.insert(material)
		.values({
			archivedAt: null,
			category: "Tecido",
			createdAt: new Date(0),
			id,
			name: "Gorgurão",
			notes: null,
			searchText: "gorgurao tecido",
			updatedAt: new Date(0),
			version: 1,
		})
		.run();
}

const variantValues = {
	archivedAt: null,
	baseUnit: "m",
	code: "GR-AZ",
	createdAt: new Date(0),
	displayPrecision: 2,
	name: "Azul marinho",
	packagingLabel: "Rolo",
	packagingQuantityMicros: 50_000_000n,
	photo: null,
	searchText: "azul marinho gr-az",
	updatedAt: new Date(0),
	version: 1,
} as const;

describe("materials schema", () => {
	test("creates material and material_variant with their columns", async () => {
		const database = await migratedDatabase();
		const native = getNativeDatabase(database);
		const columns = (table: string) =>
			native
				.query<{ name: string }, []>(
					`SELECT name FROM pragma_table_info('${table}')`
				)
				.all()
				.map((row) => row.name)
				.sort();
		expect(columns("material")).toEqual(
			[
				"archived_at",
				"category",
				"created_at",
				"id",
				"name",
				"notes",
				"search_text",
				"updated_at",
				"version",
			].sort()
		);
		expect(columns("material_variant")).toEqual(
			[
				"archived_at",
				"base_unit",
				"code",
				"created_at",
				"display_precision",
				"id",
				"material_id",
				"min_quantity_micros",
				"name",
				"packaging_label",
				"packaging_quantity_micros",
				"photo",
				"reference_cost_cents",
				"search_text",
				"target_quantity_micros",
				"tracks_lots",
				"updated_at",
				"version",
			].sort()
		);
		expect(
			native
				.query<{ name: string }, []>(
					"SELECT name FROM pragma_index_list('material_variant')"
				)
				.all()
				.map((row) => row.name)
		).toEqual(
			expect.arrayContaining([
				"material_variant_material_idx",
				"material_variant_code_idx",
			])
		);
	});

	test("keeps money and quantity exact through the integer column", async () => {
		const database = await migratedDatabase();
		insertMaterial(database, "material-1");
		database
			.insert(materialVariant)
			.values({
				...variantValues,
				id: "variant-1",
				materialId: "material-1",
				minQuantityMicros: 1_500_000n,
				referenceCostCents: 1250n,
				targetQuantityMicros: maxExactInteger,
			})
			.run();
		const row = database
			.select()
			.from(materialVariant)
			.where(eq(materialVariant.id, "variant-1"))
			.get();
		expect(row?.referenceCostCents).toBe(1250n);
		expect(row?.minQuantityMicros).toBe(1_500_000n);
		expect(row?.targetQuantityMicros).toBe(maxExactInteger);
		expect(row?.packagingQuantityMicros).toBe(50_000_000n);
		expect(
			getNativeDatabase(database)
				.query<{ typeof_value: string }, []>(
					"SELECT typeof(reference_cost_cents) AS typeof_value FROM material_variant"
				)
				.all()
		).toEqual([{ typeof_value: "integer" }]);
	});

	test("refuses a value beyond the exact integer ceiling", async () => {
		const database = await migratedDatabase();
		insertMaterial(database, "material-1");
		expect(() =>
			database
				.insert(materialVariant)
				.values({
					...variantValues,
					id: "variant-1",
					materialId: "material-1",
					referenceCostCents: maxExactInteger + 1n,
				})
				.run()
		).toThrow("Valor inteiro fora da faixa exata");
	});

	test("refuses a variant whose material does not exist", async () => {
		const database = await migratedDatabase();
		expect(() =>
			database
				.insert(materialVariant)
				.values({
					...variantValues,
					id: "variant-1",
					materialId: "sem-material",
				})
				.run()
		).toThrow();
	});
});

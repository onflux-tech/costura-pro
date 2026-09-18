import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { maxExactInteger } from "../src/columns";
import {
	applyMigrations,
	closeDb,
	createDb,
	type Database,
	getNativeDatabase,
} from "../src/index";
import { service } from "../src/schema/services";

const openDatabases: Database[] = [];
const temporaryDirectories: string[] = [];
const migrationsFolder = fileURLToPath(
	new URL("../src/migrations", import.meta.url)
);

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
	const directory = await mkdtemp(join(tmpdir(), "costura-pro-services-"));
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

const serviceValues = {
	archivedAt: null,
	category: "Barra",
	createdAt: new Date(0),
	estimatedMinutes: 30,
	name: "Barra de calça",
	notes: null,
	outsourced: false,
	searchText: "barra de calca barra",
	targetMarginBasisPoints: null,
	updatedAt: new Date(0),
	version: 1,
} as const;

describe("services schema", () => {
	test("creates the service table with its columns", async () => {
		const database = await migratedDatabase();
		const columns = getNativeDatabase(database)
			.query<{ name: string }, []>(
				"SELECT name FROM pragma_table_info('service')"
			)
			.all()
			.map((row) => row.name)
			.sort();
		expect(columns).toEqual(
			[
				"archived_at",
				"category",
				"cost_cents",
				"created_at",
				"estimated_minutes",
				"id",
				"name",
				"notes",
				"outsourced",
				"price_cents",
				"search_text",
				"target_margin_basis_points",
				"updated_at",
				"version",
			].sort()
		);
	});

	test("keeps cost and price exact through the integer column", async () => {
		const database = await migratedDatabase();
		database
			.insert(service)
			.values({
				...serviceValues,
				costCents: 6000n,
				id: "service-1",
				priceCents: maxExactInteger,
			})
			.run();
		const row = database
			.select()
			.from(service)
			.where(eq(service.id, "service-1"))
			.get();
		expect(row?.costCents).toBe(6000n);
		expect(row?.priceCents).toBe(maxExactInteger);
		expect(row?.outsourced).toBe(false);
		expect(
			getNativeDatabase(database)
				.query<{ cost: string; price: string }, []>(
					"SELECT typeof(cost_cents) AS cost, typeof(price_cents) AS price FROM service"
				)
				.all()
		).toEqual([{ cost: "integer", price: "integer" }]);
		expect(() =>
			database
				.insert(service)
				.values({
					...serviceValues,
					costCents: maxExactInteger + 1n,
					id: "service-2",
					priceCents: 0n,
				})
				.run()
		).toThrow("Valor inteiro fora da faixa exata");
	});

	test("adds the target margin to an existing installation without rebuilding it", async () => {
		const database = await openDatabase();
		const earlier = await temporaryDirectory();
		await cp(migrationsFolder, earlier, { recursive: true });
		const journalFile = join(earlier, "meta", "_journal.json");
		const journal = JSON.parse(await readFile(journalFile, "utf8")) as {
			entries: { tag: string }[];
		};
		const cut = journal.entries.findIndex((entry) =>
			entry.tag.endsWith("_services_target_margin")
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
					"SELECT sql FROM sqlite_master WHERE name = 'installation'"
				)
				.get()?.sql ?? "";
		const before = tableSql();
		native.run(
			"INSERT INTO installation (id, singleton, state, epoch, atelier_name, created_at, updated_at, version) VALUES ('instalacao', 1, 'ready', 'epoch', 'Ateliê da Dona', 0, 0, 7)"
		);
		applyMigrations(database);
		expect(
			native
				.query<
					{
						atelier_name: string;
						target_margin_basis_points: number;
						version: number;
					},
					[]
				>(
					"SELECT atelier_name, target_margin_basis_points, version FROM installation"
				)
				.all()
		).toEqual([
			{
				atelier_name: "Ateliê da Dona",
				target_margin_basis_points: 4000,
				version: 7,
			},
		]);
		const added =
			", `target_margin_basis_points` integer DEFAULT 4000 NOT NULL";
		const after = tableSql();
		expect(after).toContain(added);
		expect(after.replace(added, "")).toBe(before);
	});
});

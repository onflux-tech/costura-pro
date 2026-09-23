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
import {
	product,
	productVariant,
	type SheetChangeRow,
	type SheetItemRow,
} from "../src/schema/products";

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
	const directory = await mkdtemp(join(tmpdir(), "costura-pro-products-"));
	temporaryDirectories.push(directory);
	const database = createDb({ DATABASE_FILE: join(directory, "atelier.db") });
	openDatabases.push(database);
	applyMigrations(database);
	return database;
}

const sheet: SheetItemRow[] = [
	{
		id: "00000000-0000-4000-8000-000000000011",
		kind: "material",
		loss: { kind: "fixed", quantityMicros: "5000000" },
		materialVariantId: "00000000-0000-4000-8000-000000000021",
		note: "Linha do bordado",
		quantityMicros: "50000000",
	},
	{
		count: 2,
		id: "00000000-0000-4000-8000-000000000012",
		kind: "service",
		note: null,
		serviceId: "00000000-0000-4000-8000-000000000031",
	},
];

const photos = [
	{
		caption: "Frente",
		photoHash: "a".repeat(64),
		thumbnailHash: "b".repeat(64),
	},
];

const changes: SheetChangeRow[] = [
	{ itemId: "00000000-0000-4000-8000-000000000012", kind: "remove" },
];

function insertProduct(database: Database, id: string) {
	database
		.insert(product)
		.values({
			archivedAt: null,
			category: "Roupa",
			createdAt: new Date(0),
			id,
			name: "Vestido Midi",
			notes: null,
			photos,
			searchText: "vestido midi roupa",
			sheet,
			targetMarginBasisPoints: 3000,
			updatedAt: new Date(0),
			version: 1,
		})
		.run();
}

const variantValues = {
	archivedAt: null,
	code: "VM-P-AZ",
	coverPhotoHash: "a".repeat(64),
	createdAt: new Date(0),
	name: "P Azul",
	searchText: "p azul vm-p-az",
	sheetChanges: changes,
	updatedAt: new Date(0),
	version: 1,
};

describe("products schema", () => {
	test("creates product and product_variant with their columns and indexes", async () => {
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
		expect(columns("product")).toEqual(
			[
				"archived_at",
				"category",
				"created_at",
				"id",
				"name",
				"notes",
				"photos",
				"search_text",
				"sheet",
				"target_margin_basis_points",
				"updated_at",
				"version",
			].sort()
		);
		expect(columns("product_variant")).toEqual(
			[
				"archived_at",
				"code",
				"cover_photo_hash",
				"created_at",
				"id",
				"name",
				"price_cents",
				"product_id",
				"search_text",
				"sheet_changes",
				"updated_at",
				"version",
			].sort()
		);
		expect(
			native
				.query<{ name: string }, []>(
					"SELECT name FROM pragma_index_list('product_variant')"
				)
				.all()
				.map((row) => row.name)
		).toEqual(
			expect.arrayContaining([
				"product_variant_product_idx",
				"product_variant_code_idx",
			])
		);
	});

	test("keeps the sheet, the photos and the price through the round trip", async () => {
		const database = await migratedDatabase();
		insertProduct(database, "product-1");
		database
			.insert(productVariant)
			.values({
				...variantValues,
				id: "variant-1",
				priceCents: maxExactInteger,
				productId: "product-1",
			})
			.run();
		const stored = database
			.select()
			.from(product)
			.where(eq(product.id, "product-1"))
			.get();
		expect(stored?.sheet).toEqual(sheet);
		expect(stored?.photos).toEqual(photos);
		expect(stored?.targetMarginBasisPoints).toBe(3000);
		const variant = database
			.select()
			.from(productVariant)
			.where(eq(productVariant.id, "variant-1"))
			.get();
		expect(variant?.priceCents).toBe(maxExactInteger);
		expect(variant?.sheetChanges).toEqual(changes);
		expect(variant?.coverPhotoHash).toBe("a".repeat(64));
		expect(
			getNativeDatabase(database)
				.query<{ typeof_value: string }, []>(
					"SELECT typeof(price_cents) AS typeof_value FROM product_variant"
				)
				.all()
		).toEqual([{ typeof_value: "integer" }]);
	});

	test("refuses a variant whose product does not exist", async () => {
		const database = await migratedDatabase();
		expect(() =>
			database
				.insert(productVariant)
				.values({
					...variantValues,
					id: "variant-1",
					priceCents: 17_000n,
					productId: "sem-produto",
				})
				.run()
		).toThrow();
	});
});

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
import { client } from "../src/schema/clients";
import {
	type QuoteDiscountRow,
	type QuoteLineRow,
	type QuoteRevisionContentRow,
	quote,
	quoteRevision,
} from "../src/schema/quotes";

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
	const directory = await mkdtemp(join(tmpdir(), "costura-pro-quotes-"));
	temporaryDirectories.push(directory);
	const database = createDb({ DATABASE_FILE: join(directory, "atelier.db") });
	openDatabases.push(database);
	applyMigrations(database);
	return database;
}

const epoch = new Date(0);

const lines: QuoteLineRow[] = [
	{
		catalogPriceCents: "16000",
		discount: { basisPoints: 1000, kind: "percent", reason: null },
		estimatedMinutes: 90,
		id: "line-service",
		kind: "service",
		note: "Blazer de linho",
		outsourced: false,
		profileId: null,
		quantity: 1,
		receivedItemId: null,
		serviceId: "service-1",
		serviceName: "Ajuste de cava",
		serviceVersion: 2,
		unitCostCents: "6000",
		unitPriceCents: "16000",
	},
	{
		components: [
			{
				baseUnit: "m",
				code: "TEC-0142",
				displayPrecision: 2,
				id: "component-fabric",
				kind: "material",
				materialName: "Crepe georgette",
				materialVariantId: "variant-crepe",
				quantityMicros: "3400000",
				unitCostCents: null,
				variantName: "Verde musgo",
			},
			{
				count: 1,
				estimatedMinutes: null,
				id: "component-sewing",
				kind: "service",
				outsourced: true,
				serviceId: "service-2",
				serviceName: "Costura sob medida",
				serviceVersion: 3,
				unitCostCents: "30000",
			},
		],
		description: "Vestido de festa sob medida",
		discount: null,
		id: "line-custom",
		kind: "custom",
		note: null,
		profileId: "profile-1",
		quantity: 1,
		source: {
			productId: "product-1",
			productName: "Vestido longo",
			productVersion: 2,
			variantId: null,
			variantName: null,
		},
		unitPriceCents: "98000",
	},
	{
		baseUnit: "un",
		code: null,
		discount: null,
		displayPrecision: 0,
		id: "line-material",
		kind: "material",
		materialName: "Zíper invisível",
		materialVariantId: "variant-zipper",
		note: null,
		quantityMicros: "1000000",
		unitCostCents: "370",
		unitPriceCents: "800",
		variantName: "20 cm preto",
	},
	{
		description: "Taxa de urgência",
		discount: null,
		id: "line-free",
		kind: "free",
		note: null,
		quantity: 1,
		unitCostCents: null,
		unitPriceCents: "5000",
	},
];

const discount: QuoteDiscountRow = {
	amountCents: "30000",
	kind: "amount",
	reason: "Cliente antiga",
};

const content: QuoteRevisionContentRow = {
	discount,
	leadTimeDays: 20,
	lines: lines.map((line) => ({
		...line,
		costCents: null,
		discountCents: "0",
		grossCents: "1000",
		totalCents: "1000",
	})),
	notes: "Prova em 10 dias",
	validityDays: 15,
};

function seedClient(database: Database, id = "client-1") {
	database
		.insert(client)
		.values({
			address: null,
			anonymizedAt: null,
			archivedAt: null,
			createdAt: epoch,
			email: null,
			id,
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
}

function quoteValues(overrides: Partial<typeof quote.$inferInsert> = {}) {
	return {
		archivedAt: null,
		clientId: "client-1",
		code: "ORC-2026-PC-0001",
		codeDevice: "PC",
		codeNumber: 1,
		codeYear: 2026,
		createdAt: epoch,
		createdOn: "2026-09-24",
		discount,
		id: "quote-1",
		leadTimeDays: 20,
		lines,
		notes: "Prova em 10 dias",
		refusalReason: null,
		refusedOn: null,
		searchText: "orc-2026-pc-0001",
		updatedAt: epoch,
		validityDays: 15,
		version: 1,
		...overrides,
	};
}

function revisionValues(
	overrides: Partial<typeof quoteRevision.$inferInsert> = {}
) {
	return {
		content,
		costCents: null,
		createdAt: epoch,
		discountCents: 31_600n,
		emittedOn: "2026-09-24",
		grossCents: 119_800n,
		id: "revision-1",
		number: 1,
		quoteId: "quote-1",
		reason: "Aceite parcial",
		targetMarginBasisPoints: 4000,
		totalCents: maxExactInteger,
		validUntil: "2026-10-09",
		version: 1,
		...overrides,
	};
}

async function seededDatabase() {
	const database = await migratedDatabase();
	seedClient(database);
	database.insert(quote).values(quoteValues()).run();
	database.insert(quoteRevision).values(revisionValues()).run();
	return { database, native: getNativeDatabase(database) };
}

function redact(
	native: ReturnType<typeof getNativeDatabase>,
	aggregateType: string,
	aggregateId: string
) {
	native.run(
		"INSERT INTO redacted_aggregate (aggregate_type, aggregate_id, op_id, redacted_at) VALUES (?, ?, 'op', 1)",
		[aggregateType, aggregateId]
	);
}

describe("quotes schema", () => {
	test("creates quote and quote_revision with their columns and unique indexes", async () => {
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
		expect(columns("quote")).toEqual(
			[
				"archived_at",
				"client_id",
				"code",
				"code_device",
				"code_number",
				"code_year",
				"created_at",
				"created_on",
				"discount",
				"id",
				"lead_time_days",
				"lines",
				"notes",
				"refusal_reason",
				"refused_on",
				"search_text",
				"updated_at",
				"validity_days",
				"version",
			].sort()
		);
		expect(columns("quote_revision")).toEqual(
			[
				"content",
				"cost_cents",
				"created_at",
				"discount_cents",
				"emitted_on",
				"gross_cents",
				"id",
				"number",
				"quote_id",
				"reason",
				"target_margin_basis_points",
				"total_cents",
				"valid_until",
				"version",
			].sort()
		);
		const indexes = native
			.query<{ name: string; unique: number }, []>(
				"SELECT name, \"unique\" FROM pragma_index_list('quote') UNION ALL SELECT name, \"unique\" FROM pragma_index_list('quote_revision')"
			)
			.all()
			.filter((row) => !row.name.startsWith("sqlite_autoindex"));
		expect(
			indexes.sort((left, right) => (left.name < right.name ? -1 : 1))
		).toEqual([
			{ name: "quote_client_idx", unique: 0 },
			{ name: "quote_code_idx", unique: 1 },
			{ name: "quote_code_sequence_idx", unique: 1 },
			{ name: "quote_revision_number_idx", unique: 1 },
		]);
	});

	test("keeps lines, discount, content and big values as written", async () => {
		const { database, native } = await seededDatabase();
		const stored = database
			.select()
			.from(quote)
			.where(eq(quote.id, "quote-1"))
			.get();
		expect(stored?.lines).toEqual(lines);
		expect(stored?.discount).toEqual(discount);
		const revision = database
			.select()
			.from(quoteRevision)
			.where(eq(quoteRevision.id, "revision-1"))
			.get();
		expect(revision?.content).toEqual(content);
		expect(revision?.totalCents).toBe(maxExactInteger);
		expect(revision?.costCents).toBeNull();
		expect(revision?.grossCents).toBe(119_800n);
		expect(
			native
				.query<{ kind: string }, []>(
					"SELECT typeof(total_cents) AS kind FROM quote_revision"
				)
				.get()?.kind
		).toBe("integer");
	});

	test("a quote needs an existing client and a revision an existing quote", async () => {
		const database = await migratedDatabase();
		expect(() =>
			database
				.insert(quote)
				.values(quoteValues({ clientId: "nobody" }))
				.run()
		).toThrow();
		seedClient(database);
		expect(() =>
			database
				.insert(quoteRevision)
				.values(revisionValues({ quoteId: "missing" }))
				.run()
		).toThrow();
	});

	test("refuses a repeated code, a repeated sequence and a repeated revision number", async () => {
		const { database } = await seededDatabase();
		expect(() =>
			database
				.insert(quote)
				.values(quoteValues({ codeNumber: 2, id: "quote-2" }))
				.run()
		).toThrow();
		expect(() =>
			database
				.insert(quote)
				.values(quoteValues({ code: "ORC-2026-PC-9999", id: "quote-3" }))
				.run()
		).toThrow();
		expect(() =>
			database
				.insert(quoteRevision)
				.values(revisionValues({ id: "revision-2" }))
				.run()
		).toThrow();
	});

	test("keeps a revision append-only outside the redaction, which rewrites content and reason and bumps the version once", async () => {
		const { native } = await seededDatabase();
		const refused = (change: string) =>
			expect(() => native.run(`UPDATE quote_revision SET ${change}`)).toThrow(
				"append-only fora da redação"
			);
		refused("total_cents = 1");
		refused("content = '{}', version = version + 1");
		redact(native, "quote", "revision-1");
		refused("content = '{}', version = version + 1");
		redact(native, "quoteRevision", "revision-1");
		refused("content = '{}'");
		refused("content = '{}', version = version + 2");
		for (const change of [
			"id = 'revision-9'",
			"quote_id = 'quote-9'",
			"number = 2",
			"emitted_on = '2026-09-25'",
			"valid_until = '2026-12-31'",
			"gross_cents = 1",
			"discount_cents = 1",
			"total_cents = 1",
			"cost_cents = 10",
			"target_margin_basis_points = 1",
			"created_at = 1",
		]) {
			refused(`${change}, version = version + 1`);
		}
		native.run(
			"UPDATE quote_revision SET content = '{\"lines\":[]}', reason = NULL, version = version + 1"
		);
		expect(
			native
				.query<{ content: string; reason: string | null; version: number }, []>(
					"SELECT content, reason, version FROM quote_revision"
				)
				.get()
		).toEqual({ content: '{"lines":[]}', reason: null, version: 2 });
		expect(() => native.run("DELETE FROM quote_revision")).toThrow(
			"append-only"
		);
	});
});

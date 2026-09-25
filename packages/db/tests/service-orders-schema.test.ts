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
import { material, materialVariant } from "../src/schema/materials";
import {
	type QuoteLineRow,
	type QuoteRevisionContentRow,
	quote,
	quoteRevision,
} from "../src/schema/quotes";
import {
	type MeasurementSnapshotRow,
	quoteApproval,
	receivable,
	type ServiceOrderLineRow,
	serviceOrder,
	serviceOrderItem,
	stockReservation,
} from "../src/schema/service-orders";

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
	const directory = await mkdtemp(join(tmpdir(), "costura-pro-orders-"));
	temporaryDirectories.push(directory);
	const database = createDb({ DATABASE_FILE: join(directory, "atelier.db") });
	openDatabases.push(database);
	applyMigrations(database);
	return database;
}

const epoch = new Date(0);

const pieceLine: ServiceOrderLineRow = {
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
			unitCostCents: "3800",
			variantName: "Preto",
		},
	],
	costCents: "12920",
	description: "Vestido de festa sob medida",
	discount: null,
	discountCents: "0",
	grossCents: "98000",
	id: "line-custom",
	kind: "custom",
	note: "Barra italiana",
	profileId: "profile-1",
	quantity: 1,
	source: null,
	totalCents: "98000",
	unitPriceCents: "98000",
};

const measurements: MeasurementSnapshotRow[] = [
	{
		fields: [
			{ fieldId: "field-bust", label: "Busto", valueMm: 880 },
			{ fieldId: "field-waist", label: "Cintura", valueMm: null },
		],
		measurementId: "measurement-dress",
		notes: "Prefere cintura alta",
		takenOn: "2026-09-01",
		templateId: "template-dress",
		templateName: "Vestido",
		templateVersion: 2,
	},
	{
		fields: [{ fieldId: "field-shoulder", label: "Ombro", valueMm: 400 }],
		measurementId: "measurement-blazer",
		notes: null,
		takenOn: "2026-09-10",
		templateId: "template-blazer",
		templateName: "Blazer e paletó",
		templateVersion: 1,
	},
];

const quoteLine: QuoteLineRow = {
	description: "Taxa de urgência",
	discount: null,
	id: "line-free",
	kind: "free",
	note: null,
	quantity: 1,
	unitCostCents: null,
	unitPriceCents: "5000",
};

const content: QuoteRevisionContentRow = {
	discount: null,
	leadTimeDays: 20,
	lines: [
		{
			...quoteLine,
			costCents: null,
			discountCents: "0",
			grossCents: "5000",
			totalCents: "5000",
		},
	],
	notes: null,
	validityDays: 15,
};

function seedBase(database: Database) {
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
		.insert(material)
		.values({
			archivedAt: null,
			category: "Tecido",
			createdAt: epoch,
			id: "material-crepe",
			name: "Crepe",
			notes: null,
			searchText: "crepe",
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
			id: "variant-crepe",
			materialId: "material-crepe",
			minQuantityMicros: null,
			name: "Preto",
			packagingLabel: null,
			packagingQuantityMicros: null,
			photo: null,
			referenceCostCents: 3800n,
			searchText: "preto",
			targetQuantityMicros: null,
			tracksLots: false,
			updatedAt: epoch,
			version: 1,
		})
		.run();
	for (const number of [1, 2]) {
		database
			.insert(quote)
			.values({
				archivedAt: null,
				clientId: "client-1",
				code: `ORC-2026-PC-000${number}`,
				codeDevice: "PC",
				codeNumber: number,
				codeYear: 2026,
				createdAt: epoch,
				createdOn: "2026-09-20",
				discount: null,
				id: `quote-${number}`,
				leadTimeDays: 20,
				lines: [quoteLine],
				notes: null,
				refusalReason: null,
				refusedOn: null,
				searchText: `orc-2026-pc-000${number}`,
				updatedAt: epoch,
				validityDays: 15,
				version: 1,
			})
			.run();
	}
	database
		.insert(quoteRevision)
		.values({
			content,
			costCents: null,
			createdAt: epoch,
			discountCents: 0n,
			emittedOn: "2026-09-20",
			grossCents: 5000n,
			id: "revision-1",
			number: 1,
			quoteId: "quote-1",
			reason: null,
			targetMarginBasisPoints: 4000,
			totalCents: 5000n,
			validUntil: "2026-10-05",
			version: 1,
		})
		.run();
}

function orderValues(
	overrides: Partial<typeof serviceOrder.$inferInsert> = {}
) {
	return {
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
		...overrides,
	};
}

function approvalValues(
	overrides: Partial<typeof quoteApproval.$inferInsert> = {}
) {
	return {
		approvedOn: "2026-09-22",
		channel: "whatsapp" as const,
		createdAt: epoch,
		id: "approval-1",
		note: "Aceitou por áudio",
		quoteId: "quote-1",
		revisionId: "revision-1",
		serviceOrderId: "order-1",
		version: 1,
		...overrides,
	};
}

function itemValues(
	overrides: Partial<typeof serviceOrderItem.$inferInsert> = {}
) {
	return {
		createdAt: epoch,
		dueOn: "2026-10-12",
		id: "item-1",
		kind: "custom" as const,
		line: pieceLine,
		lineId: "line-custom",
		measurements,
		position: 0,
		serviceOrderId: "order-1",
		updatedAt: epoch,
		version: 1,
		...overrides,
	};
}

function reservationValues(
	overrides: Partial<typeof stockReservation.$inferInsert> = {}
) {
	return {
		createdAt: epoch,
		id: "reservation-1",
		kind: "approval" as const,
		occurredOn: "2026-09-22",
		quantityMicros: maxExactInteger,
		serviceOrderItemId: "item-1",
		variantId: "variant-crepe",
		version: 1,
		...overrides,
	};
}

function receivableValues(
	overrides: Partial<typeof receivable.$inferInsert> = {}
) {
	return {
		amountCents: 12_345n,
		clientId: "client-1",
		createdAt: epoch,
		id: "receivable-1",
		kind: "serviceOrder" as const,
		occurredOn: "2026-09-22",
		serviceOrderId: "order-1",
		version: 1,
		...overrides,
	};
}

async function seededDatabase() {
	const database = await migratedDatabase();
	seedBase(database);
	database.insert(serviceOrder).values(orderValues()).run();
	database.insert(quoteApproval).values(approvalValues()).run();
	database.insert(serviceOrderItem).values(itemValues()).run();
	database.insert(stockReservation).values(reservationValues()).run();
	database.insert(receivable).values(receivableValues()).run();
	return { database, native: getNativeDatabase(database) };
}

describe("service orders schema", () => {
	test("creates the five tables with their columns and indexes", async () => {
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
		expect(columns("service_order")).toEqual(
			[
				"client_id",
				"code",
				"code_device",
				"code_number",
				"code_year",
				"created_at",
				"flow_stages",
				"flow_version",
				"id",
				"opened_on",
				"quote_id",
				"search_text",
				"updated_at",
				"version",
			].sort()
		);
		expect(columns("quote_approval")).toEqual(
			[
				"approved_on",
				"channel",
				"created_at",
				"id",
				"note",
				"quote_id",
				"revision_id",
				"service_order_id",
				"version",
			].sort()
		);
		expect(columns("service_order_item")).toEqual(
			[
				"created_at",
				"due_on",
				"id",
				"kind",
				"line",
				"line_id",
				"measurements",
				"position",
				"production_status",
				"service_order_id",
				"stage_id",
				"stage_ids",
				"updated_at",
				"version",
			].sort()
		);
		expect(columns("stock_reservation")).toEqual(
			[
				"created_at",
				"id",
				"kind",
				"occurred_on",
				"quantity_micros",
				"service_order_item_id",
				"variant_id",
				"version",
			].sort()
		);
		expect(columns("receivable")).toEqual(
			[
				"amount_cents",
				"client_id",
				"created_at",
				"id",
				"kind",
				"occurred_on",
				"service_order_id",
				"version",
			].sort()
		);
		const indexes = native
			.query<{ name: string; unique: number }, []>(
				[
					"service_order",
					"quote_approval",
					"service_order_item",
					"stock_reservation",
					"receivable",
				]
					.map(
						(table) =>
							`SELECT name, "unique" FROM pragma_index_list('${table}')`
					)
					.join(" UNION ALL ")
			)
			.all()
			.filter((row) => !row.name.startsWith("sqlite_autoindex"));
		expect(
			indexes.sort((left, right) => (left.name < right.name ? -1 : 1))
		).toEqual([
			{ name: "quote_approval_quote_idx", unique: 0 },
			{ name: "quote_approval_revision_idx", unique: 1 },
			{ name: "receivable_client_idx", unique: 0 },
			{ name: "receivable_service_order_idx", unique: 1 },
			{ name: "service_order_client_idx", unique: 0 },
			{ name: "service_order_code_idx", unique: 1 },
			{ name: "service_order_code_sequence_idx", unique: 1 },
			{ name: "service_order_item_line_idx", unique: 1 },
			{ name: "service_order_quote_idx", unique: 1 },
			{ name: "stock_reservation_item_idx", unique: 0 },
			{ name: "stock_reservation_variant_idx", unique: 0 },
		]);
	});

	test("keeps the frozen line, the measurements and big values as written", async () => {
		const { database, native } = await seededDatabase();
		const item = database
			.select()
			.from(serviceOrderItem)
			.where(eq(serviceOrderItem.id, "item-1"))
			.get();
		expect(item?.line).toEqual(pieceLine);
		expect(item?.measurements).toEqual(measurements);
		const reservation = database
			.select()
			.from(stockReservation)
			.where(eq(stockReservation.id, "reservation-1"))
			.get();
		expect(reservation?.quantityMicros).toBe(maxExactInteger);
		const owed = database
			.select()
			.from(receivable)
			.where(eq(receivable.id, "receivable-1"))
			.get();
		expect(owed?.amountCents).toBe(12_345n);
		expect(
			native
				.query<{ kind: string }, []>(
					"SELECT typeof(quantity_micros) AS kind FROM stock_reservation"
				)
				.get()?.kind
		).toBe("integer");
	});

	test("refuses a repeated code, sequence, quote, approved revision, line and receivable", async () => {
		const { database } = await seededDatabase();
		const refused = (run: () => unknown) => expect(run).toThrow();
		refused(() =>
			database
				.insert(serviceOrder)
				.values(
					orderValues({ codeNumber: 2, id: "order-2", quoteId: "quote-2" })
				)
				.run()
		);
		refused(() =>
			database
				.insert(serviceOrder)
				.values(
					orderValues({
						code: "OS-2026-PC-9999",
						id: "order-3",
						quoteId: "quote-2",
					})
				)
				.run()
		);
		refused(() =>
			database
				.insert(serviceOrder)
				.values(
					orderValues({ code: "OS-2026-PC-0002", codeNumber: 2, id: "order-4" })
				)
				.run()
		);
		refused(() =>
			database
				.insert(quoteApproval)
				.values(approvalValues({ id: "approval-2" }))
				.run()
		);
		refused(() =>
			database
				.insert(serviceOrderItem)
				.values(itemValues({ id: "item-2" }))
				.run()
		);
		refused(() =>
			database
				.insert(receivable)
				.values(receivableValues({ id: "receivable-2" }))
				.run()
		);
		database
			.insert(receivable)
			.values(receivableValues({ id: "receivable-3", serviceOrderId: null }))
			.run();
		database
			.insert(receivable)
			.values(receivableValues({ id: "receivable-4", serviceOrderId: null }))
			.run();
	});

	test("needs existing parents for the item and the reservation", async () => {
		const { database } = await seededDatabase();
		expect(() =>
			database
				.insert(serviceOrderItem)
				.values(
					itemValues({ id: "item-9", lineId: "line-9", serviceOrderId: "none" })
				)
				.run()
		).toThrow();
		expect(() =>
			database
				.insert(stockReservation)
				.values(reservationValues({ id: "reservation-9", variantId: "none" }))
				.run()
		).toThrow();
	});

	test("keeps approval, reservation and receivable append-only and the order and item editable", async () => {
		const { native } = await seededDatabase();
		for (const table of ["quote_approval", "stock_reservation", "receivable"]) {
			expect(() => native.run(`UPDATE ${table} SET version = 2`)).toThrow(
				`${table} é append-only`
			);
			expect(() => native.run(`DELETE FROM ${table}`)).toThrow(
				`${table} é append-only`
			);
		}
		native.run("UPDATE service_order SET version = 2");
		native.run("UPDATE service_order_item SET version = 2");
		expect(
			native
				.query<{ version: number }, []>(
					"SELECT version FROM service_order_item"
				)
				.get()?.version
		).toBe(2);
	});
});

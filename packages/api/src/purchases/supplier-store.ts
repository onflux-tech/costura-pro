import type { Database } from "@costura-pro/db";
import { supplier } from "@costura-pro/db/schema/purchases";
import { supplierSearchKey } from "@costura-pro/domain/supplier";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

import { appendChange } from "../change-log";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";

export type SupplierRow = typeof supplier.$inferSelect;

export type SupplierFields = Pick<
	SupplierRow,
	"email" | "name" | "notes" | "phone"
>;

export type SupplierPatch = Partial<
	SupplierFields & Pick<SupplierRow, "archivedAt">
>;

export type SupplierSnapshot = {
	archivedAt: string | null;
	createdAt: string;
	email: string | null;
	id: string;
	name: string;
	notes: string | null;
	phone: string | null;
	version: number;
};

export function supplierSnapshot(row: SupplierRow): SupplierSnapshot {
	return {
		archivedAt: row.archivedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		email: row.email,
		id: row.id,
		name: row.name,
		notes: row.notes,
		phone: row.phone,
		version: row.version,
	};
}

export function readSupplier(
	db: Pick<Database, "select">,
	id: string
): SupplierRow | undefined {
	return db.select().from(supplier).where(eq(supplier.id, id)).get();
}

function recordSupplier(db: Executor, row: SupplierRow, stamp: ChangeStamp) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "supplier",
		data: supplierSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

export function insertSupplier(
	db: Executor,
	id: string,
	fields: SupplierFields,
	stamp: ChangeStamp
): SupplierRow {
	const row = db
		.insert(supplier)
		.values({
			...fields,
			createdAt: stamp.now,
			id,
			searchText: supplierSearchKey(fields),
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordSupplier(db, row, stamp);
	return row;
}

export function updateSupplier(
	db: Executor,
	current: SupplierRow,
	patch: SupplierPatch,
	stamp: ChangeStamp
): SupplierRow {
	const next = db
		.update(supplier)
		.set({
			...patch,
			searchText: supplierSearchKey({ ...current, ...patch }),
			updatedAt: stamp.now,
			version: current.version + 1,
		})
		.where(
			and(eq(supplier.id, current.id), eq(supplier.version, current.version))
		)
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Fornecedor mudou durante a operação",
		});
	}
	recordSupplier(db, next, stamp);
	return next;
}

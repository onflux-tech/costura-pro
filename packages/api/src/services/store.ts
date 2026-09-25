import type { Database } from "@costura-pro/db";
import { service } from "@costura-pro/db/schema/services";
import { serviceSearchKey } from "@costura-pro/domain/service";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

import { appendChange } from "../change-log";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";

export type ServiceRow = typeof service.$inferSelect;

export type ServiceFields = {
	category: string | null;
	costCents: string;
	estimatedMinutes: number | null;
	name: string;
	notes: string | null;
	outsourced: boolean;
	priceCents: string;
	suggestedStageIds: string[];
	targetMarginBasisPoints: number | null;
};

export type ServicePatch = Partial<ServiceFields> & {
	archivedAt?: Date | null;
};

export type ServiceSnapshot = ServiceFields & {
	archivedAt: string | null;
	createdAt: string;
	id: string;
	version: number;
};

type Reader = Pick<Database, "select">;

export function serviceSnapshot(row: ServiceRow): ServiceSnapshot {
	return {
		archivedAt: row.archivedAt?.toISOString() ?? null,
		category: row.category,
		costCents: row.costCents.toString(),
		createdAt: row.createdAt.toISOString(),
		estimatedMinutes: row.estimatedMinutes,
		id: row.id,
		name: row.name,
		notes: row.notes,
		outsourced: row.outsourced,
		priceCents: row.priceCents.toString(),
		suggestedStageIds: row.suggestedStageIds,
		targetMarginBasisPoints: row.targetMarginBasisPoints,
		version: row.version,
	};
}

export function readService(db: Reader, id: string): ServiceRow | undefined {
	return db.select().from(service).where(eq(service.id, id)).get();
}

function serviceColumns(patch: ServicePatch) {
	const { costCents, priceCents, ...rest } = patch;
	return {
		...rest,
		...(costCents === undefined ? {} : { costCents: BigInt(costCents) }),
		...(priceCents === undefined ? {} : { priceCents: BigInt(priceCents) }),
	};
}

function recordService(db: Executor, row: ServiceRow, stamp: ChangeStamp) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "service",
		data: serviceSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

export function insertService(
	db: Executor,
	id: string,
	fields: ServiceFields,
	stamp: ChangeStamp
): ServiceRow {
	const row = db
		.insert(service)
		.values({
			...serviceColumns(fields),
			costCents: BigInt(fields.costCents),
			createdAt: stamp.now,
			id,
			name: fields.name,
			outsourced: fields.outsourced,
			priceCents: BigInt(fields.priceCents),
			searchText: serviceSearchKey(fields),
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordService(db, row, stamp);
	return row;
}

export function updateService(
	db: Executor,
	current: ServiceRow,
	patch: ServicePatch,
	stamp: ChangeStamp
): ServiceRow {
	const next = db
		.update(service)
		.set({
			...serviceColumns(patch),
			searchText: serviceSearchKey({
				category:
					patch.category === undefined ? current.category : patch.category,
				name: patch.name ?? current.name,
			}),
			updatedAt: stamp.now,
			version: current.version + 1,
		})
		.where(
			and(eq(service.id, current.id), eq(service.version, current.version))
		)
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Serviço mudou durante a operação",
		});
	}
	recordService(db, next, stamp);
	return next;
}

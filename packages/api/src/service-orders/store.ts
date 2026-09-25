import type { Database } from "@costura-pro/db";
import type { FlowStageRow } from "@costura-pro/db/schema/production";
import {
	type MeasurementSnapshotRow,
	quoteApproval,
	receivable,
	type ServiceOrderLineRow,
	serviceOrder,
	serviceOrderItem,
} from "@costura-pro/db/schema/service-orders";
import type { ProductionStatus } from "@costura-pro/domain/production";
import {
	documentCode,
	documentSearchKey,
	serverDeviceCode,
} from "@costura-pro/domain/quote";
import {
	type ApprovalChannel,
	serviceOrderCodePrefix,
	type WorkLineKind,
} from "@costura-pro/domain/service-order";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, gt, sql } from "drizzle-orm";

import { appendChange } from "../change-log";
import { readClient } from "../clients/store";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";

type Reader = Pick<Database, "select">;

export type ServiceOrderRow = typeof serviceOrder.$inferSelect;
export type QuoteApprovalRow = typeof quoteApproval.$inferSelect;
export type ServiceOrderItemRow = typeof serviceOrderItem.$inferSelect;

export type ServiceOrderSnapshot = {
	clientId: string;
	code: string;
	createdAt: string;
	flowStages: FlowStageRow[] | null;
	flowVersion: number | null;
	id: string;
	openedOn: string;
	quoteId: string;
	version: number;
};

export type ServiceOrderFlow = { stages: FlowStageRow[]; version: number };

export type ServiceOrderPatch = {
	flowStages: FlowStageRow[];
	flowVersion: number;
};

export type ServiceOrderItemPatch = {
	productionStatus: ProductionStatus;
	stageId: string | null;
	stageIds: string[] | null;
};

export type QuoteApprovalSnapshot = {
	approvedOn: string;
	channel: ApprovalChannel;
	createdAt: string;
	id: string;
	note: string | null;
	quoteId: string;
	revisionId: string;
	serviceOrderId: string;
	version: number;
};

export type ServiceOrderItemSnapshot = {
	createdAt: string;
	dueOn: string | null;
	id: string;
	kind: WorkLineKind;
	line: ServiceOrderLineRow;
	lineId: string;
	measurements: MeasurementSnapshotRow[];
	position: number;
	productionStatus: ProductionStatus;
	serviceOrderId: string;
	stageId: string | null;
	stageIds: string[] | null;
	version: number;
};

export function serviceOrderSnapshot(
	row: ServiceOrderRow
): ServiceOrderSnapshot {
	return {
		clientId: row.clientId,
		code: row.code,
		createdAt: row.createdAt.toISOString(),
		flowStages: row.flowStages,
		flowVersion: row.flowVersion,
		id: row.id,
		openedOn: row.openedOn,
		quoteId: row.quoteId,
		version: row.version,
	};
}

export function quoteApprovalSnapshot(
	row: QuoteApprovalRow
): QuoteApprovalSnapshot {
	return {
		approvedOn: row.approvedOn,
		channel: row.channel,
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		note: row.note,
		quoteId: row.quoteId,
		revisionId: row.revisionId,
		serviceOrderId: row.serviceOrderId,
		version: row.version,
	};
}

export function serviceOrderItemSnapshot(
	row: ServiceOrderItemRow
): ServiceOrderItemSnapshot {
	return {
		createdAt: row.createdAt.toISOString(),
		dueOn: row.dueOn,
		id: row.id,
		kind: row.kind,
		line: row.line,
		lineId: row.lineId,
		measurements: row.measurements,
		position: row.position,
		productionStatus: row.productionStatus,
		serviceOrderId: row.serviceOrderId,
		stageId: row.stageId,
		stageIds: row.stageIds,
		version: row.version,
	};
}

export function itemTitle(line: ServiceOrderLineRow): string {
	switch (line.kind) {
		case "service":
			return line.serviceName;
		case "material":
			return `${line.materialName} · ${line.variantName}`;
		default:
			return line.description;
	}
}

export function readServiceOrder(
	db: Reader,
	id: string
): ServiceOrderRow | undefined {
	return db.select().from(serviceOrder).where(eq(serviceOrder.id, id)).get();
}

export function isServiceOrderAnonymized(
	db: Reader,
	row: ServiceOrderRow
): boolean {
	return (readClient(db, row.clientId)?.anonymizedAt ?? null) !== null;
}

export function readQuoteApproval(
	db: Reader,
	id: string
): QuoteApprovalRow | undefined {
	return db.select().from(quoteApproval).where(eq(quoteApproval.id, id)).get();
}

export function readApprovalOfQuote(
	db: Reader,
	quoteId: string
): QuoteApprovalRow | undefined {
	return db
		.select()
		.from(quoteApproval)
		.where(eq(quoteApproval.quoteId, quoteId))
		.get();
}

export function readServiceOrderItem(
	db: Reader,
	id: string
): ServiceOrderItemRow | undefined {
	return db
		.select()
		.from(serviceOrderItem)
		.where(eq(serviceOrderItem.id, id))
		.get();
}

export function listServiceOrderItems(
	db: Reader,
	serviceOrderId: string
): ServiceOrderItemRow[] {
	return db
		.select()
		.from(serviceOrderItem)
		.where(eq(serviceOrderItem.serviceOrderId, serviceOrderId))
		.orderBy(asc(serviceOrderItem.position))
		.all();
}

export function clientHasOpenWork(db: Reader, clientId: string): boolean {
	const order = db
		.select({ id: serviceOrder.id })
		.from(serviceOrder)
		.where(eq(serviceOrder.clientId, clientId))
		.get();
	const owed = db
		.select({ id: receivable.id })
		.from(receivable)
		.where(
			and(eq(receivable.clientId, clientId), gt(receivable.amountCents, 0n))
		)
		.get();
	return order !== undefined || owed !== undefined;
}

function nextCodeNumber(db: Reader, year: number): number {
	const last =
		db
			.select({ last: sql<number | null>`max(${serviceOrder.codeNumber})` })
			.from(serviceOrder)
			.where(
				and(
					eq(serviceOrder.codeYear, year),
					eq(serviceOrder.codeDevice, serverDeviceCode)
				)
			)
			.get()?.last ?? 0;
	return last + 1;
}

function recordServiceOrder(
	db: Executor,
	row: ServiceOrderRow,
	stamp: ChangeStamp
) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "serviceOrder",
		data: serviceOrderSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

function recordServiceOrderItem(
	db: Executor,
	row: ServiceOrderItemRow,
	stamp: ChangeStamp
) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "serviceOrderItem",
		data: serviceOrderItemSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

export function insertServiceOrder(
	db: Executor,
	id: string,
	fields: {
		clientId: string;
		flow: ServiceOrderFlow | null;
		openedOn: string;
		quoteId: string;
		titles: readonly string[];
	},
	stamp: ChangeStamp
): ServiceOrderRow {
	const year = Number(fields.openedOn.slice(0, 4));
	const number = nextCodeNumber(db, year);
	const code = documentCode({
		device: serverDeviceCode,
		number,
		prefix: serviceOrderCodePrefix,
		year,
	});
	const row = db
		.insert(serviceOrder)
		.values({
			clientId: fields.clientId,
			code,
			codeDevice: serverDeviceCode,
			codeNumber: number,
			codeYear: year,
			createdAt: stamp.now,
			flowStages: fields.flow?.stages ?? null,
			flowVersion: fields.flow?.version ?? null,
			id,
			openedOn: fields.openedOn,
			quoteId: fields.quoteId,
			searchText: documentSearchKey({ code, titles: fields.titles }),
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordServiceOrder(db, row, stamp);
	return row;
}

export function updateServiceOrder(
	db: Executor,
	current: ServiceOrderRow,
	patch: ServiceOrderPatch,
	stamp: ChangeStamp
): ServiceOrderRow {
	const next = db
		.update(serviceOrder)
		.set({
			flowStages: patch.flowStages,
			flowVersion: patch.flowVersion,
			updatedAt: stamp.now,
			version: current.version + 1,
		})
		.where(
			and(
				eq(serviceOrder.id, current.id),
				eq(serviceOrder.version, current.version)
			)
		)
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "OS mudou durante a operação",
		});
	}
	recordServiceOrder(db, next, stamp);
	return next;
}

export function insertQuoteApproval(
	db: Executor,
	id: string,
	fields: Omit<QuoteApprovalSnapshot, "createdAt" | "id" | "version">,
	stamp: ChangeStamp
): QuoteApprovalRow {
	const row = db
		.insert(quoteApproval)
		.values({ ...fields, createdAt: stamp.now, id, version: 1 })
		.returning()
		.get();
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "quoteApproval",
		data: quoteApprovalSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
	return row;
}

export function insertServiceOrderItem(
	db: Executor,
	id: string,
	fields: Omit<
		ServiceOrderItemSnapshot,
		"createdAt" | "id" | "productionStatus" | "stageId" | "stageIds" | "version"
	>,
	stamp: ChangeStamp
): ServiceOrderItemRow {
	const row = db
		.insert(serviceOrderItem)
		.values({
			...fields,
			createdAt: stamp.now,
			id,
			productionStatus: "notStarted",
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordServiceOrderItem(db, row, stamp);
	return row;
}

export function updateServiceOrderItem(
	db: Executor,
	current: ServiceOrderItemRow,
	patch: ServiceOrderItemPatch,
	stamp: ChangeStamp
): ServiceOrderItemRow {
	const next = db
		.update(serviceOrderItem)
		.set({
			productionStatus: patch.productionStatus,
			stageId: patch.stageId,
			stageIds: patch.stageIds,
			updatedAt: stamp.now,
			version: current.version + 1,
		})
		.where(
			and(
				eq(serviceOrderItem.id, current.id),
				eq(serviceOrderItem.version, current.version)
			)
		)
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Subitem mudou durante a operação",
		});
	}
	recordServiceOrderItem(db, next, stamp);
	return next;
}

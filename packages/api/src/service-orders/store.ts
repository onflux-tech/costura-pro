import type { Database } from "@costura-pro/db";
import {
	type MeasurementSnapshotRow,
	quoteApproval,
	receivable,
	type ServiceOrderLineRow,
	serviceOrder,
	serviceOrderItem,
} from "@costura-pro/db/schema/service-orders";
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
import { and, asc, eq, gt, sql } from "drizzle-orm";

import { appendChange } from "../change-log";
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
	id: string;
	openedOn: string;
	quoteId: string;
	version: number;
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
	serviceOrderId: string;
	version: number;
};

export function serviceOrderSnapshot(
	row: ServiceOrderRow
): ServiceOrderSnapshot {
	return {
		clientId: row.clientId,
		code: row.code,
		createdAt: row.createdAt.toISOString(),
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
		serviceOrderId: row.serviceOrderId,
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

export function insertServiceOrder(
	db: Executor,
	id: string,
	fields: {
		clientId: string;
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
			id,
			openedOn: fields.openedOn,
			quoteId: fields.quoteId,
			searchText: documentSearchKey({ code, titles: fields.titles }),
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "serviceOrder",
		data: serviceOrderSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
	return row;
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
	fields: Omit<ServiceOrderItemSnapshot, "createdAt" | "id" | "version">,
	stamp: ChangeStamp
): ServiceOrderItemRow {
	const row = db
		.insert(serviceOrderItem)
		.values({
			...fields,
			createdAt: stamp.now,
			id,
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "serviceOrderItem",
		data: serviceOrderItemSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
	return row;
}

import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { bigintInteger } from "../columns";
import { client } from "./clients";
import { materialVariant } from "./materials";
import type { MeasurementFieldRow } from "./measurements";
import { type FlowStageRow, productionStatusValues } from "./production";
import {
	type QuoteLineRow,
	type QuoteLineTotalsRow,
	quote,
	quoteRevision,
} from "./quotes";

export const approvalChannelValues = [
	"inPerson",
	"whatsapp",
	"phone",
	"email",
	"other",
] as const;

export const serviceOrderItemKindValues = [
	"service",
	"custom",
	"material",
] as const;

export const stockReservationKindValues = ["approval"] as const;

export const receivableKindValues = ["serviceOrder"] as const;

export type MeasurementSnapshotRow = {
	fields: MeasurementFieldRow[];
	measurementId: string;
	notes: string | null;
	takenOn: string;
	templateId: string;
	templateName: string;
	templateVersion: number;
};

export type ServiceOrderLineRow = Exclude<QuoteLineRow, { kind: "free" }> &
	QuoteLineTotalsRow;

export const serviceOrder = sqliteTable(
	"service_order",
	{
		clientId: text("client_id")
			.notNull()
			.references(() => client.id),
		code: text("code").notNull(),
		codeDevice: text("code_device").notNull(),
		codeNumber: integer("code_number").notNull(),
		codeYear: integer("code_year").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		flowStages: text("flow_stages", { mode: "json" }).$type<FlowStageRow[]>(),
		flowVersion: integer("flow_version"),
		id: text("id").primaryKey(),
		openedOn: text("opened_on").notNull(),
		quoteId: text("quote_id")
			.notNull()
			.references(() => quote.id),
		searchText: text("search_text").notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
		version: integer("version").notNull(),
	},
	(table) => [
		uniqueIndex("service_order_code_idx").on(table.code),
		uniqueIndex("service_order_code_sequence_idx").on(
			table.codeYear,
			table.codeDevice,
			table.codeNumber
		),
		uniqueIndex("service_order_quote_idx").on(table.quoteId),
		index("service_order_client_idx").on(table.clientId),
	]
);

export const quoteApproval = sqliteTable(
	"quote_approval",
	{
		approvedOn: text("approved_on").notNull(),
		channel: text("channel", { enum: approvalChannelValues }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		id: text("id").primaryKey(),
		note: text("note"),
		quoteId: text("quote_id")
			.notNull()
			.references(() => quote.id),
		revisionId: text("revision_id")
			.notNull()
			.references(() => quoteRevision.id),
		serviceOrderId: text("service_order_id")
			.notNull()
			.references(() => serviceOrder.id),
		version: integer("version").notNull(),
	},
	(table) => [
		uniqueIndex("quote_approval_revision_idx").on(table.revisionId),
		index("quote_approval_quote_idx").on(table.quoteId),
	]
);

export const serviceOrderItem = sqliteTable(
	"service_order_item",
	{
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		dueOn: text("due_on"),
		id: text("id").primaryKey(),
		kind: text("kind", { enum: serviceOrderItemKindValues }).notNull(),
		line: text("line", { mode: "json" }).$type<ServiceOrderLineRow>().notNull(),
		lineId: text("line_id").notNull(),
		measurements: text("measurements", { mode: "json" })
			.$type<MeasurementSnapshotRow[]>()
			.notNull(),
		position: integer("position").notNull(),
		productionStatus: text("production_status", {
			enum: productionStatusValues,
		})
			.notNull()
			.default("notStarted"),
		serviceOrderId: text("service_order_id")
			.notNull()
			.references(() => serviceOrder.id),
		stageId: text("stage_id"),
		stageIds: text("stage_ids", { mode: "json" }).$type<string[]>(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
		version: integer("version").notNull(),
	},
	(table) => [
		uniqueIndex("service_order_item_line_idx").on(
			table.serviceOrderId,
			table.lineId
		),
	]
);

export const stockReservation = sqliteTable(
	"stock_reservation",
	{
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		id: text("id").primaryKey(),
		kind: text("kind", { enum: stockReservationKindValues }).notNull(),
		occurredOn: text("occurred_on").notNull(),
		quantityMicros: bigintInteger("quantity_micros").notNull(),
		serviceOrderItemId: text("service_order_item_id")
			.notNull()
			.references(() => serviceOrderItem.id),
		variantId: text("variant_id")
			.notNull()
			.references(() => materialVariant.id),
		version: integer("version").notNull(),
	},
	(table) => [
		index("stock_reservation_variant_idx").on(table.variantId),
		index("stock_reservation_item_idx").on(table.serviceOrderItemId),
	]
);

export const receivable = sqliteTable(
	"receivable",
	{
		amountCents: bigintInteger("amount_cents").notNull(),
		clientId: text("client_id")
			.notNull()
			.references(() => client.id),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		id: text("id").primaryKey(),
		kind: text("kind", { enum: receivableKindValues }).notNull(),
		occurredOn: text("occurred_on").notNull(),
		serviceOrderId: text("service_order_id").references(() => serviceOrder.id),
		version: integer("version").notNull(),
	},
	(table) => [
		uniqueIndex("receivable_service_order_idx").on(table.serviceOrderId),
		index("receivable_client_idx").on(table.clientId),
	]
);

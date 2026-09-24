import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { bigintInteger } from "../columns";
import { client } from "./clients";
import type { baseUnitValues } from "./materials";

type BaseUnitRow = (typeof baseUnitValues)[number];

export type QuoteDiscountRow =
	| { amountCents: string; kind: "amount"; reason: string | null }
	| { basisPoints: number; kind: "percent"; reason: string | null };

export type QuoteComponentRow =
	| {
			baseUnit: BaseUnitRow;
			code: string | null;
			displayPrecision: number;
			id: string;
			kind: "material";
			materialName: string;
			materialVariantId: string;
			quantityMicros: string;
			unitCostCents: string | null;
			variantName: string;
	  }
	| {
			count: number;
			estimatedMinutes: number | null;
			id: string;
			kind: "service";
			outsourced: boolean;
			serviceId: string;
			serviceName: string;
			serviceVersion: number;
			unitCostCents: string;
	  };

export type QuoteSourceRow = {
	productId: string;
	productName: string;
	productVersion: number;
	variantId: string | null;
	variantName: string | null;
};

export type QuoteLineRow =
	| {
			catalogPriceCents: string;
			discount: QuoteDiscountRow | null;
			estimatedMinutes: number | null;
			id: string;
			kind: "service";
			note: string | null;
			outsourced: boolean;
			profileId: string | null;
			quantity: number;
			receivedItemId: string | null;
			serviceId: string;
			serviceName: string;
			serviceVersion: number;
			unitCostCents: string;
			unitPriceCents: string;
	  }
	| {
			components: QuoteComponentRow[];
			description: string;
			discount: QuoteDiscountRow | null;
			id: string;
			kind: "custom";
			note: string | null;
			profileId: string | null;
			quantity: number;
			source: QuoteSourceRow | null;
			unitPriceCents: string;
	  }
	| {
			baseUnit: BaseUnitRow;
			code: string | null;
			discount: QuoteDiscountRow | null;
			displayPrecision: number;
			id: string;
			kind: "material";
			materialName: string;
			materialVariantId: string;
			note: string | null;
			quantityMicros: string;
			unitCostCents: string | null;
			unitPriceCents: string;
			variantName: string;
	  }
	| {
			description: string;
			discount: QuoteDiscountRow | null;
			id: string;
			kind: "free";
			note: string | null;
			quantity: number;
			unitCostCents: string | null;
			unitPriceCents: string;
	  };

export type QuoteLineTotalsRow = {
	costCents: string | null;
	discountCents: string;
	grossCents: string;
	totalCents: string;
};

export type QuoteRevisionContentRow = {
	discount: QuoteDiscountRow | null;
	leadTimeDays: number | null;
	lines: (QuoteLineRow & QuoteLineTotalsRow)[];
	notes: string | null;
	validityDays: number;
};

export const quote = sqliteTable(
	"quote",
	{
		archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
		clientId: text("client_id")
			.notNull()
			.references(() => client.id),
		code: text("code").notNull(),
		codeDevice: text("code_device").notNull(),
		codeNumber: integer("code_number").notNull(),
		codeYear: integer("code_year").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		createdOn: text("created_on").notNull(),
		discount: text("discount", { mode: "json" }).$type<QuoteDiscountRow>(),
		id: text("id").primaryKey(),
		leadTimeDays: integer("lead_time_days"),
		lines: text("lines", { mode: "json" }).$type<QuoteLineRow[]>().notNull(),
		notes: text("notes"),
		refusalReason: text("refusal_reason"),
		refusedOn: text("refused_on"),
		searchText: text("search_text").notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
		validityDays: integer("validity_days").notNull(),
		version: integer("version").notNull(),
	},
	(table) => [
		uniqueIndex("quote_code_idx").on(table.code),
		uniqueIndex("quote_code_sequence_idx").on(
			table.codeYear,
			table.codeDevice,
			table.codeNumber
		),
		index("quote_client_idx").on(table.clientId),
	]
);

export const quoteRevision = sqliteTable(
	"quote_revision",
	{
		content: text("content", { mode: "json" })
			.$type<QuoteRevisionContentRow>()
			.notNull(),
		costCents: bigintInteger("cost_cents"),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		discountCents: bigintInteger("discount_cents").notNull(),
		emittedOn: text("emitted_on").notNull(),
		grossCents: bigintInteger("gross_cents").notNull(),
		id: text("id").primaryKey(),
		number: integer("number").notNull(),
		quoteId: text("quote_id")
			.notNull()
			.references(() => quote.id),
		reason: text("reason"),
		targetMarginBasisPoints: integer("target_margin_basis_points").notNull(),
		totalCents: bigintInteger("total_cents").notNull(),
		validUntil: text("valid_until").notNull(),
		version: integer("version").notNull(),
	},
	(table) => [
		uniqueIndex("quote_revision_number_idx").on(table.quoteId, table.number),
	]
);

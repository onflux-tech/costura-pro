import type { Database } from "@costura-pro/db";
import { client } from "@costura-pro/db/schema/clients";
import { quote } from "@costura-pro/db/schema/quotes";
import {
	plannedMaterials,
	type QuoteStatus,
	quoteLineOfText,
	quoteStatus,
	quoteTotalsOfText,
} from "@costura-pro/domain/quote";
import { searchTokens } from "@costura-pro/domain/search";
import type { ApprovalChannel } from "@costura-pro/domain/service-order";
import { ORPCError } from "@orpc/server";
import {
	and,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	not,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import z from "zod";

import { clientMatches } from "../clients/queries";
import { commandMessages } from "../command-messages";
import { containing } from "../search";
import { readApprovalOfQuote, readServiceOrder } from "../service-orders/store";
import { physicalByVariant, reservedByVariant } from "../stock/reservations";
import {
	listQuoteRevisions,
	type QuoteRevisionSnapshot,
	type QuoteRow,
	type QuoteSnapshot,
	quoteRevisionSnapshot,
	quoteSnapshot,
	readQuote,
} from "./store";

type Reader = Pick<Database, "select">;

export const quotePageSize = 50;

export const quoteStatusValues = [
	"approved",
	"draft",
	"emitted",
	"expired",
	"refused",
] as const;

export const quoteListInput = z.object({
	archived: z.boolean().default(false),
	offset: z.number().int().nonnegative().default(0),
	query: z.string().max(100).optional(),
	status: z.enum(quoteStatusValues),
	today: z.iso.date(),
});

export const latestRevision = {
	emittedOn: sql<
		string | null
	>`(SELECT revision.emitted_on FROM quote_revision AS revision WHERE revision.quote_id = "quote"."id" ORDER BY revision.number DESC LIMIT 1)`,
	number: sql<
		number | null
	>`(SELECT max(revision.number) FROM quote_revision AS revision WHERE revision.quote_id = "quote"."id")`,
	totalCents: sql<
		string | null
	>`(SELECT cast(revision.total_cents AS text) FROM quote_revision AS revision WHERE revision.quote_id = "quote"."id" ORDER BY revision.number DESC LIMIT 1)`,
	validUntil: sql<
		string | null
	>`(SELECT revision.valid_until FROM quote_revision AS revision WHERE revision.quote_id = "quote"."id" ORDER BY revision.number DESC LIMIT 1)`,
};

export const approvalExists = sql<number>`EXISTS (SELECT 1 FROM quote_approval AS approval WHERE approval.quote_id = "quote"."id")`;

const serviceOrderCode = sql<
	string | null
>`(SELECT so.code FROM service_order AS so WHERE so.quote_id = "quote"."id")`;

const approvedOn = sql<
	string | null
>`(SELECT approval.approved_on FROM quote_approval AS approval WHERE approval.quote_id = "quote"."id")`;

export function quoteMatches(
	db: Reader,
	tokens: readonly string[]
): (SQL | undefined)[] {
	return tokens.map((token) =>
		or(
			sql`${quote.searchText} LIKE ${containing(token)} ESCAPE '\\'`,
			inArray(
				quote.clientId,
				db
					.select({ id: client.id })
					.from(client)
					.where(and(...clientMatches([token])))
			)
		)
	);
}

export function draftTotalCents(
	lines: QuoteRow["lines"],
	discount: QuoteRow["discount"]
): string {
	return quoteTotalsOfText(lines, discount).totalCents.toString();
}

function statusFilter(status: QuoteStatus, today: string): SQL | undefined {
	const pending = not(approvalExists);
	switch (status) {
		case "approved":
			return approvalExists;
		case "refused":
			return and(pending, isNotNull(quote.refusedOn));
		case "draft":
			return and(
				pending,
				isNull(quote.refusedOn),
				sql`${latestRevision.validUntil} IS NULL`
			);
		case "expired":
			return and(
				pending,
				isNull(quote.refusedOn),
				sql`${latestRevision.validUntil} < ${today}`
			);
		case "emitted":
			return and(
				pending,
				isNull(quote.refusedOn),
				sql`${latestRevision.validUntil} >= ${today}`
			);
		default:
			return status satisfies never;
	}
}

export type QuoteListItem = {
	approvedOn: string | null;
	archivedAt: string | null;
	clientId: string;
	clientName: string;
	code: string;
	createdOn: string;
	emittedOn: string | null;
	id: string;
	lineCount: number;
	refusedOn: string | null;
	revisionNumber: number | null;
	serviceOrderCode: string | null;
	status: QuoteStatus;
	totalCents: string;
	validUntil: string | null;
};

export function listQuotes(
	db: Reader,
	{ archived, offset, query, status, today }: z.output<typeof quoteListInput>
): { items: QuoteListItem[]; nextOffset: number | null } {
	const rows = db
		.select({
			approved: approvalExists,
			approvedOn,
			archivedAt: quote.archivedAt,
			clientId: quote.clientId,
			clientName: client.name,
			code: quote.code,
			createdOn: quote.createdOn,
			discount: quote.discount,
			emittedOn: latestRevision.emittedOn,
			id: quote.id,
			lines: quote.lines,
			refusedOn: quote.refusedOn,
			revisionNumber: latestRevision.number,
			revisionTotalCents: latestRevision.totalCents,
			serviceOrderCode,
			validUntil: latestRevision.validUntil,
		})
		.from(quote)
		.innerJoin(client, eq(client.id, quote.clientId))
		.where(
			and(
				archived ? isNotNull(quote.archivedAt) : isNull(quote.archivedAt),
				statusFilter(status, today),
				...quoteMatches(db, searchTokens(query ?? ""))
			)
		)
		.orderBy(desc(quote.createdAt), desc(quote.id))
		.limit(quotePageSize + 1)
		.offset(offset)
		.all();
	return {
		items: rows
			.slice(0, quotePageSize)
			.map(({ approved, discount, lines, revisionTotalCents, ...row }) => ({
				...row,
				archivedAt: row.archivedAt?.toISOString() ?? null,
				lineCount: lines.length,
				status: quoteStatus({
					approved: Boolean(approved),
					refused: row.refusedOn !== null,
					today,
					validUntil: row.validUntil,
				}),
				totalCents: revisionTotalCents ?? draftTotalCents(lines, discount),
			})),
		nextOffset: rows.length > quotePageSize ? offset + quotePageSize : null,
	};
}

export type QuoteApprovalView = {
	approvedOn: string;
	channel: ApprovalChannel;
	id: string;
	note: string | null;
	revisionId: string;
	revisionNumber: number;
	serviceOrderCode: string;
	serviceOrderId: string;
};

export type QuoteDetail = {
	approval: QuoteApprovalView | null;
	client: { anonymized: boolean; archived: boolean; id: string; name: string };
	quote: QuoteSnapshot & { updatedAt: string };
	revisions: QuoteRevisionSnapshot[];
	stock: {
		quantityMicros: string;
		reservedMicros: string;
		variantId: string;
	}[];
};

function stockOf(db: Reader, variantIds: readonly string[]) {
	const physical = physicalByVariant(db, variantIds);
	const reserved = reservedByVariant(db, variantIds);
	return variantIds.map((variantId) => ({
		quantityMicros: (physical.get(variantId) ?? 0n).toString(),
		reservedMicros: (reserved.get(variantId) ?? 0n).toString(),
		variantId,
	}));
}

function approvalOf(
	db: Reader,
	quoteId: string,
	revisions: readonly QuoteRevisionSnapshot[]
): QuoteApprovalView | null {
	const approval = readApprovalOfQuote(db, quoteId);
	const order = approval
		? readServiceOrder(db, approval.serviceOrderId)
		: undefined;
	const revision = revisions.find((item) => item.id === approval?.revisionId);
	if (!(approval && order && revision)) {
		return null;
	}
	return {
		approvedOn: approval.approvedOn,
		channel: approval.channel,
		id: approval.id,
		note: approval.note,
		revisionId: approval.revisionId,
		revisionNumber: revision.number,
		serviceOrderCode: order.code,
		serviceOrderId: order.id,
	};
}

export function getQuote(db: Reader, quoteId: string): QuoteDetail {
	const row = readQuote(db, quoteId);
	const owner = row
		? db.select().from(client).where(eq(client.id, row.clientId)).get()
		: undefined;
	if (!(row && owner)) {
		throw new ORPCError("NOT_FOUND", {
			message: commandMessages.quoteNotFound,
		});
	}
	const revisions = listQuoteRevisions(db, row.id).map(quoteRevisionSnapshot);
	const latest = revisions[0]?.content.lines ?? [];
	const planned = plannedMaterials(
		[...row.lines, ...latest].map(quoteLineOfText)
	);
	return {
		approval: approvalOf(db, row.id, revisions),
		client: {
			anonymized: owner.anonymizedAt !== null,
			archived: owner.archivedAt !== null,
			id: owner.id,
			name: owner.name,
		},
		quote: { ...quoteSnapshot(row), updatedAt: row.updatedAt.toISOString() },
		revisions,
		stock: stockOf(db, [...planned.keys()]),
	};
}

import type { Database } from "@costura-pro/db";
import { client } from "@costura-pro/db/schema/clients";
import { quote } from "@costura-pro/db/schema/quotes";
import { stockBalance } from "@costura-pro/db/schema/stock";
import {
	plannedMaterials,
	type QuoteStatus,
	quoteLineOfText,
	quoteStatus,
	quoteTotalsOfText,
} from "@costura-pro/domain/quote";
import { searchTokens } from "@costura-pro/domain/search";
import { ORPCError } from "@orpc/server";
import {
	and,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import z from "zod";

import { clientMatches } from "../clients/queries";
import { commandMessages } from "../command-messages";
import { containing } from "../search";
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
	switch (status) {
		case "refused":
			return isNotNull(quote.refusedOn);
		case "draft":
			return and(
				isNull(quote.refusedOn),
				sql`${latestRevision.validUntil} IS NULL`
			);
		case "expired":
			return and(
				isNull(quote.refusedOn),
				sql`${latestRevision.validUntil} < ${today}`
			);
		case "emitted":
			return and(
				isNull(quote.refusedOn),
				sql`${latestRevision.validUntil} >= ${today}`
			);
		default:
			return status satisfies never;
	}
}

export type QuoteListItem = {
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
			.map(({ discount, lines, revisionTotalCents, ...row }) => ({
				...row,
				archivedAt: row.archivedAt?.toISOString() ?? null,
				lineCount: lines.length,
				status: quoteStatus({
					refused: row.refusedOn !== null,
					today,
					validUntil: row.validUntil,
				}),
				totalCents: revisionTotalCents ?? draftTotalCents(lines, discount),
			})),
		nextOffset: rows.length > quotePageSize ? offset + quotePageSize : null,
	};
}

export type QuoteDetail = {
	client: { anonymized: boolean; archived: boolean; id: string; name: string };
	quote: QuoteSnapshot & { updatedAt: string };
	revisions: QuoteRevisionSnapshot[];
	stock: { quantityMicros: string; variantId: string }[];
};

function stockOf(db: Reader, variantIds: readonly string[]) {
	if (variantIds.length === 0) {
		return [];
	}
	const totals = new Map(
		db
			.select({
				quantityMicros: sql<string>`cast(sum(${stockBalance.quantityMicros}) as text)`,
				variantId: stockBalance.variantId,
			})
			.from(stockBalance)
			.where(inArray(stockBalance.variantId, [...variantIds]))
			.groupBy(stockBalance.variantId)
			.all()
			.map((row) => [row.variantId, row.quantityMicros])
	);
	return variantIds.map((variantId) => ({
		quantityMicros: totals.get(variantId) ?? "0",
		variantId,
	}));
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
	const planned = plannedMaterials(row.lines.map(quoteLineOfText));
	return {
		client: {
			anonymized: owner.anonymizedAt !== null,
			archived: owner.archivedAt !== null,
			id: owner.id,
			name: owner.name,
		},
		quote: { ...quoteSnapshot(row), updatedAt: row.updatedAt.toISOString() },
		revisions: listQuoteRevisions(db, row.id).map(quoteRevisionSnapshot),
		stock: stockOf(db, [...planned.keys()]),
	};
}

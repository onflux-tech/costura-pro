import type { Database } from "@costura-pro/db";
import {
	type QuoteLineRow,
	type QuoteRevisionContentRow,
	quote,
	quoteRevision,
} from "@costura-pro/db/schema/quotes";
import {
	documentCode,
	documentSearchKey,
	quoteCodePrefix,
	serverDeviceCode,
} from "@costura-pro/domain/quote";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";

import { appendChange } from "../change-log";
import { readClient } from "../clients/store";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";
import type { QuoteContentValues } from "./schemas";

export type QuoteRow = typeof quote.$inferSelect;
export type QuoteRevisionRow = typeof quoteRevision.$inferSelect;

export type QuoteContent = QuoteContentValues;

export type QuotePatch = Partial<QuoteContent> & {
	archivedAt?: Date | null;
	refusalReason?: string | null;
	refusedOn?: string | null;
};

export type QuoteSnapshot = QuoteContent & {
	archivedAt: string | null;
	clientId: string;
	code: string;
	createdAt: string;
	createdOn: string;
	id: string;
	refusalReason: string | null;
	refusedOn: string | null;
	version: number;
};

export type QuoteRevisionFields = {
	content: QuoteRevisionContentRow;
	costCents: string | null;
	discountCents: string;
	emittedOn: string;
	grossCents: string;
	number: number;
	quoteId: string;
	reason: string | null;
	targetMarginBasisPoints: number;
	totalCents: string;
	validUntil: string;
};

export type QuoteRevisionSnapshot = QuoteRevisionFields & {
	createdAt: string;
	id: string;
	version: number;
};

type Reader = Pick<Database, "select">;

export function contentOf(row: QuoteRow): QuoteContent {
	return {
		discount: row.discount,
		leadTimeDays: row.leadTimeDays,
		lines: row.lines,
		notes: row.notes,
		validityDays: row.validityDays,
	};
}

export function quoteSnapshot(row: QuoteRow): QuoteSnapshot {
	return {
		...contentOf(row),
		archivedAt: row.archivedAt?.toISOString() ?? null,
		clientId: row.clientId,
		code: row.code,
		createdAt: row.createdAt.toISOString(),
		createdOn: row.createdOn,
		id: row.id,
		refusalReason: row.refusalReason,
		refusedOn: row.refusedOn,
		version: row.version,
	};
}

export function quoteRevisionSnapshot(
	row: QuoteRevisionRow
): QuoteRevisionSnapshot {
	return {
		content: row.content,
		costCents: row.costCents?.toString() ?? null,
		createdAt: row.createdAt.toISOString(),
		discountCents: row.discountCents.toString(),
		emittedOn: row.emittedOn,
		grossCents: row.grossCents.toString(),
		id: row.id,
		number: row.number,
		quoteId: row.quoteId,
		reason: row.reason,
		targetMarginBasisPoints: row.targetMarginBasisPoints,
		totalCents: row.totalCents.toString(),
		validUntil: row.validUntil,
		version: row.version,
	};
}

export function searchTitles(lines: readonly QuoteLineRow[]): string[] {
	return lines.map((line) => {
		switch (line.kind) {
			case "service":
				return line.serviceName;
			case "material":
				return `${line.materialName} ${line.variantName}`;
			default:
				return line.description;
		}
	});
}

export function readQuote(db: Reader, id: string): QuoteRow | undefined {
	return db.select().from(quote).where(eq(quote.id, id)).get();
}

export function readQuoteRevision(
	db: Reader,
	id: string
): QuoteRevisionRow | undefined {
	return db.select().from(quoteRevision).where(eq(quoteRevision.id, id)).get();
}

export function listQuoteRevisions(
	db: Reader,
	quoteId: string
): QuoteRevisionRow[] {
	return db
		.select()
		.from(quoteRevision)
		.where(eq(quoteRevision.quoteId, quoteId))
		.orderBy(desc(quoteRevision.number))
		.all();
}

export function listQuotesOfClient(db: Reader, clientId: string): QuoteRow[] {
	return db.select().from(quote).where(eq(quote.clientId, clientId)).all();
}

export function isQuoteAnonymized(db: Reader, row: QuoteRow): boolean {
	return (readClient(db, row.clientId)?.anonymizedAt ?? null) !== null;
}

export function latestRevisionNumber(db: Reader, quoteId: string): number {
	return (
		db
			.select({ last: sql<number | null>`max(${quoteRevision.number})` })
			.from(quoteRevision)
			.where(eq(quoteRevision.quoteId, quoteId))
			.get()?.last ?? 0
	);
}

function nextCodeNumber(db: Reader, year: number): number {
	const last =
		db
			.select({ last: sql<number | null>`max(${quote.codeNumber})` })
			.from(quote)
			.where(
				and(eq(quote.codeYear, year), eq(quote.codeDevice, serverDeviceCode))
			)
			.get()?.last ?? 0;
	return last + 1;
}

function recordQuote(db: Executor, row: QuoteRow, stamp: ChangeStamp) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "quote",
		data: quoteSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

export function insertQuote(
	db: Executor,
	id: string,
	fields: QuoteContent & { clientId: string; createdOn: string },
	stamp: ChangeStamp
): QuoteRow {
	const year = Number(fields.createdOn.slice(0, 4));
	const number = nextCodeNumber(db, year);
	const code = documentCode({
		device: serverDeviceCode,
		number,
		prefix: quoteCodePrefix,
		year,
	});
	const row = db
		.insert(quote)
		.values({
			...fields,
			code,
			codeDevice: serverDeviceCode,
			codeNumber: number,
			codeYear: year,
			createdAt: stamp.now,
			id,
			searchText: documentSearchKey({
				code,
				titles: searchTitles(fields.lines),
			}),
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordQuote(db, row, stamp);
	return row;
}

export function updateQuote(
	db: Executor,
	current: QuoteRow,
	patch: QuotePatch,
	stamp: ChangeStamp
): QuoteRow {
	const next = db
		.update(quote)
		.set({
			...patch,
			searchText: documentSearchKey({
				code: current.code,
				titles: searchTitles(patch.lines ?? current.lines),
			}),
			updatedAt: stamp.now,
			version: current.version + 1,
		})
		.where(and(eq(quote.id, current.id), eq(quote.version, current.version)))
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Orçamento mudou durante a operação",
		});
	}
	recordQuote(db, next, stamp);
	return next;
}

export function insertQuoteRevision(
	db: Executor,
	id: string,
	fields: QuoteRevisionFields,
	stamp: ChangeStamp
): QuoteRevisionRow {
	const row = db
		.insert(quoteRevision)
		.values({
			...fields,
			costCents: fields.costCents === null ? null : BigInt(fields.costCents),
			createdAt: stamp.now,
			discountCents: BigInt(fields.discountCents),
			grossCents: BigInt(fields.grossCents),
			id,
			totalCents: BigInt(fields.totalCents),
			version: 1,
		})
		.returning()
		.get();
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "quoteRevision",
		data: quoteRevisionSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
	return row;
}

export function redactQuoteRevision(
	db: Executor,
	row: QuoteRevisionRow,
	content: QuoteRevisionContentRow,
	stamp: ChangeStamp
): QuoteRevisionRow {
	const redacted = db
		.update(quoteRevision)
		.set({ content, reason: null, version: row.version + 1 })
		.where(
			and(eq(quoteRevision.id, row.id), eq(quoteRevision.version, row.version))
		)
		.returning()
		.get();
	if (!redacted) {
		throw new ORPCError("CONFLICT", {
			message: "Revisão do orçamento mudou durante a operação",
		});
	}
	appendChange(db, {
		aggregateId: redacted.id,
		aggregateType: "quoteRevision",
		data: quoteRevisionSnapshot(redacted),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: redacted.version,
	});
	return redacted;
}

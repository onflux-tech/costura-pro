import type { QuoteRevisionContentRow } from "@costura-pro/db/schema/quotes";
import { canonicalJson } from "@costura-pro/domain/canonical-json";
import {
	addDays,
	type QuoteTotals,
	quoteTotalsOfText,
} from "@costura-pro/domain/quote";

import { readClient } from "../clients/store";
import { commandMessages } from "../command-messages";
import { readInstallation } from "../installation/store";
import { emptyPayload } from "../schemas";
import { readApprovalOfQuote } from "../service-orders/store";
import type { CreateDefinition } from "../sync/commands";
import {
	archivePatch,
	unarchivePatch,
	updateCommands,
} from "../update-command";
import {
	type QuoteEmitValues,
	quoteContentPayload,
	quoteCreatePayload,
	quoteEmitPayload,
	quoteRefusePayload,
} from "./schemas";
import {
	contentOf,
	insertQuote,
	insertQuoteRevision,
	isQuoteAnonymized,
	latestRevisionNumber,
	type QuotePatch,
	type QuoteRow,
	quoteSnapshot,
	readQuote,
	readQuoteRevision,
	updateQuote,
} from "./store";

const quoteCommand = updateCommands<QuoteRow, QuotePatch>({
	aggregateType: "quote",
	anonymized: isQuoteAnonymized,
	read: readQuote,
	snapshot: quoteSnapshot,
	update: updateQuote,
});

const createQuote: CreateDefinition = {
	aggregateType: "quote",
	create: (db, id, values, stamp) => {
		const fields = quoteCreatePayload.parse(values);
		const owner = readClient(db, fields.clientId);
		if (!owner) {
			return {
				message: commandMessages.clientNotFound,
				reason: "aggregateNotFound",
			};
		}
		if (owner.anonymizedAt) {
			return { reason: "aggregateAnonymized" };
		}
		return insertQuote(db, id, fields, stamp).version;
	},
	exists: (db, id) => readQuote(db, id) !== undefined,
	kind: "create",
	payload: quoteCreatePayload,
};

function frozenContent(
	content: QuoteEmitValues["content"],
	totals: QuoteTotals
): QuoteRevisionContentRow {
	return {
		...content,
		lines: content.lines.map((line, index) => {
			const computed = totals.lines[index];
			return {
				...line,
				costCents: computed?.costCents?.toString() ?? null,
				discountCents: (computed?.discountCents ?? 0n).toString(),
				grossCents: (computed?.grossCents ?? 0n).toString(),
				totalCents: (computed?.totalCents ?? 0n).toString(),
			};
		}),
	};
}

const emitQuote: CreateDefinition = {
	aggregateType: "quoteRevision",
	create: (db, id, values, stamp) => {
		const fields = quoteEmitPayload.parse(values);
		const target = readQuote(db, fields.quoteId);
		if (!target) {
			return {
				message: commandMessages.quoteNotFound,
				reason: "aggregateNotFound",
			};
		}
		if (isQuoteAnonymized(db, target)) {
			return { reason: "aggregateAnonymized" };
		}
		if (readApprovalOfQuote(db, target.id)) {
			return {
				message: commandMessages.quoteApproved,
				reason: "aggregateExists",
			};
		}
		const totals = quoteTotalsOfText(
			fields.content.lines,
			fields.content.discount
		);
		const revision = insertQuoteRevision(
			db,
			id,
			{
				content: frozenContent(fields.content, totals),
				costCents: totals.costCents?.toString() ?? null,
				discountCents: (
					totals.lineDiscountCents + totals.documentDiscountCents
				).toString(),
				emittedOn: fields.emittedOn,
				grossCents: totals.grossCents.toString(),
				number: latestRevisionNumber(db, target.id) + 1,
				quoteId: target.id,
				reason: fields.reason,
				targetMarginBasisPoints: readInstallation(db).targetMarginBasisPoints,
				totalCents: totals.totalCents.toString(),
				validUntil: addDays(fields.emittedOn, fields.content.validityDays),
			},
			stamp
		);
		if (target.refusedOn !== null) {
			updateQuote(db, target, { refusalReason: null, refusedOn: null }, stamp);
		}
		return revision.version;
	},
	exists: (db, id) => readQuoteRevision(db, id) !== undefined,
	kind: "create",
	payload: quoteEmitPayload,
};

export const quoteCommands = {
	"quote.archive": quoteCommand(emptyPayload, archivePatch),
	"quote.create": createQuote,
	"quote.emit": emitQuote,
	"quote.refuse": quoteCommand(quoteRefusePayload, (row, values) =>
		row.refusedOn === values.refusedOn && row.refusalReason === values.reason
			? null
			: { refusalReason: values.reason, refusedOn: values.refusedOn }
	),
	"quote.unarchive": quoteCommand(emptyPayload, unarchivePatch),
	"quote.unrefuse": quoteCommand(emptyPayload, (row) =>
		row.refusedOn === null ? null : { refusalReason: null, refusedOn: null }
	),
	"quote.update": quoteCommand(quoteContentPayload, (row, values) =>
		canonicalJson(contentOf(row)) === canonicalJson(values) ? null : values
	),
};

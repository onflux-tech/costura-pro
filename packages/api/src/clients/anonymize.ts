import { truncateWal } from "@costura-pro/db";
import type {
	QuoteDiscountRow,
	QuoteLineRow,
	QuoteRevisionContentRow,
} from "@costura-pro/db/schema/quotes";
import {
	anonymizedClientName,
	anonymizedProfileName,
} from "@costura-pro/domain/client";
import type { MediaType } from "@costura-pro/domain/media";
import { anonymizedQuoteItemDescription } from "@costura-pro/domain/quote";
import { anonymizedReceivedItemDescription } from "@costura-pro/domain/received-item";
import { ORPCError } from "@orpc/server";

import { appendAudit } from "../audit";
import { commandMessages } from "../command-messages";
import type { Context } from "../context";
import type { Executor } from "../executor";
import { readInstallation } from "../installation/store";
import {
	listMeasurementsOfProfiles,
	measurementSnapshot,
	updateMeasurement,
} from "../measurements/store";
import { removeMediaFile } from "../media/files";
import { withMediaLock } from "../media/lock";
import {
	deleteMediaFile,
	isMediaReferenced,
	photoHashes,
	type Querier,
	readMediaFile,
} from "../media/store";
import { runDirectCommand } from "../operations";
import {
	listQuoteRevisions,
	listQuotesOfClient,
	quoteRevisionSnapshot,
	quoteSnapshot,
	redactQuoteRevision,
	updateQuote,
} from "../quotes/store";
import {
	listReceivedItemsOfClient,
	receivedItemHistoryValues,
	receivedItemSnapshot,
	updateReceivedItem,
} from "../received-items/store";
import { type RedactionStamp, redactHistory } from "../redaction";
import {
	clientSnapshot,
	listProfiles,
	profileSnapshot,
	readClient,
	updateClient,
	updateProfile,
} from "./store";

type RemovedFile = { hash: string; mime: MediaType };

function anonymizeReceivedItems(
	tx: Executor & Querier,
	clientId: string,
	stamp: RedactionStamp
): { count: number; removed: RemovedFile[] } {
	const items = listReceivedItemsOfClient(tx, clientId);
	const collected = new Set(
		items.flatMap((row) => [
			...photoHashes(row),
			...receivedItemHistoryValues(tx, row.id).flatMap(photoHashes),
		])
	);
	for (const row of items) {
		const anonymized = updateReceivedItem(
			tx,
			row,
			{
				accessories: null,
				archivedAt: row.archivedAt ?? stamp.now,
				description: anonymizedReceivedItemDescription,
				notes: null,
				photos: [],
			},
			stamp
		);
		redactHistory(
			tx,
			{
				current: receivedItemSnapshot(anonymized),
				id: anonymized.id,
				type: "receivedItem",
			},
			stamp
		);
	}
	const removed = [...collected].flatMap((hash) => {
		const media = readMediaFile(tx, hash);
		if (!media || isMediaReferenced(tx, hash)) {
			return [];
		}
		deleteMediaFile(tx, hash);
		return [{ hash, mime: media.mime }];
	});
	return { count: items.length, removed };
}

function redactedDiscount(
	discount: QuoteDiscountRow | null
): QuoteDiscountRow | null {
	return discount === null ? null : { ...discount, reason: null };
}

function redactedLine<T extends QuoteLineRow>(line: T): T {
	return {
		...line,
		discount: redactedDiscount(line.discount),
		note: null,
		...(line.kind === "custom" || line.kind === "free"
			? { description: anonymizedQuoteItemDescription }
			: {}),
	};
}

function anonymizeQuotes(
	tx: Executor & Querier,
	clientId: string,
	stamp: RedactionStamp
): { quotes: number; revisions: number } {
	const quotes = listQuotesOfClient(tx, clientId);
	let revisions = 0;
	for (const row of quotes) {
		const anonymized = updateQuote(
			tx,
			row,
			{
				archivedAt: row.archivedAt ?? stamp.now,
				discount: redactedDiscount(row.discount),
				lines: row.lines.map(redactedLine),
				notes: null,
				refusalReason: null,
			},
			stamp
		);
		redactHistory(
			tx,
			{ current: quoteSnapshot(anonymized), id: anonymized.id, type: "quote" },
			stamp
		);
		for (const revision of listQuoteRevisions(tx, row.id)) {
			const content: QuoteRevisionContentRow = {
				...revision.content,
				discount: redactedDiscount(revision.content.discount),
				lines: revision.content.lines.map(redactedLine),
				notes: null,
			};
			redactHistory(
				tx,
				{
					current: quoteRevisionSnapshot({
						...revision,
						content,
						reason: null,
					}),
					id: revision.id,
					type: "quoteRevision",
				},
				stamp
			);
			redactQuoteRevision(tx, revision, content, stamp);
			revisions += 1;
		}
	}
	return { quotes: quotes.length, revisions };
}

function removeFilesWithoutRow(
	context: Pick<Context, "db" | "mediaRoot">,
	files: readonly RemovedFile[]
): Promise<number> {
	return files.reduce<Promise<number>>(async (previous, file) => {
		const failed = await previous;
		const removed = await withMediaLock(file.hash, async () => {
			if (readMediaFile(context.db, file.hash)) {
				return true;
			}
			try {
				await removeMediaFile(context.mediaRoot, file.hash, file.mime);
				return true;
			} catch {
				return false;
			}
		});
		return removed ? failed : failed + 1;
	}, Promise.resolve(0));
}

export async function anonymizeClient(
	context: Pick<Context, "access" | "db" | "log" | "mediaRoot" | "now">,
	input: { baseVersion: number; clientId: string; opId: string }
): Promise<{ version: number }> {
	const removedFiles: RemovedFile[] = [];
	const result = await runDirectCommand(
		context,
		{
			aggregate: { id: input.clientId, type: "client" },
			command: "client.anonymize",
			input: { baseVersion: input.baseVersion, clientId: input.clientId },
			opId: input.opId,
		},
		(record) => {
			const now = context.now();
			return context.db.transaction((tx) => {
				const current = readClient(tx, input.clientId);
				if (!current) {
					throw new ORPCError("NOT_FOUND", {
						message: commandMessages.clientNotFound,
					});
				}
				if (current.anonymizedAt) {
					throw new ORPCError("PRECONDITION_FAILED", {
						message: commandMessages.clientAnonymized,
					});
				}
				if (current.version !== input.baseVersion) {
					throw new ORPCError("CONFLICT", {
						data: {
							current: clientSnapshot(current),
							currentVersion: current.version,
						},
						message: commandMessages.staleVersion,
					});
				}
				const stamp = {
					epoch: readInstallation(tx).epoch,
					now,
					opId: input.opId,
				};
				const profiles = listProfiles(tx, current.id);
				const next = updateClient(
					tx,
					current,
					{
						address: null,
						anonymizedAt: now,
						archivedAt: current.archivedAt ?? now,
						email: null,
						name: anonymizedClientName,
						notes: null,
						phone: null,
						secondaryPhone: null,
					},
					stamp
				);
				redactHistory(
					tx,
					{ current: clientSnapshot(next), id: next.id, type: "client" },
					stamp
				);
				for (const profile of profiles) {
					const anonymized = updateProfile(
						tx,
						profile,
						{
							archivedAt: profile.archivedAt ?? now,
							name: anonymizedProfileName,
							notes: null,
						},
						stamp
					);
					redactHistory(
						tx,
						{
							current: profileSnapshot(anonymized),
							id: anonymized.id,
							type: "profile",
						},
						stamp
					);
				}
				const measurements = listMeasurementsOfProfiles(
					tx,
					profiles.map((profile) => profile.id)
				);
				for (const row of measurements) {
					const anonymized = updateMeasurement(
						tx,
						row,
						{
							archivedAt: row.archivedAt ?? now,
							fields: row.fields.map((field) => ({ ...field, valueMm: null })),
							notes: null,
						},
						stamp
					);
					redactHistory(
						tx,
						{
							current: measurementSnapshot(anonymized),
							id: anonymized.id,
							type: "measurement",
						},
						stamp
					);
				}
				const receivedItems = anonymizeReceivedItems(tx, current.id, stamp);
				removedFiles.push(...receivedItems.removed);
				const quotes = anonymizeQuotes(tx, current.id, stamp);
				appendAudit(
					tx,
					now,
					{
						access: context.access,
						details: {
							clientId: next.id,
							measurements: measurements.length,
							profiles: profiles.length,
							quoteRevisions: quotes.revisions,
							quotes: quotes.quotes,
							receivedItems: receivedItems.count,
						},
						outcome: "succeeded",
						type: "client.anonymized",
					},
					context.log
				);
				return record(tx, { version: next.version });
			});
		}
	);
	truncateWal(context.db);
	const failed = await removeFilesWithoutRow(context, removedFiles);
	if (failed > 0) {
		console.error({ failed, scope: "media.anonymize" });
	}
	return result;
}

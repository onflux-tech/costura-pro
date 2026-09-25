import type {
	QuoteLineRow,
	QuoteLineTotalsRow,
} from "@costura-pro/db/schema/quotes";
import type { ServiceOrderLineRow } from "@costura-pro/db/schema/service-orders";
import { quoteLineOfText } from "@costura-pro/domain/quote";
import { planReservations } from "@costura-pro/domain/reservation";
import {
	approvalWindowError,
	isWorkLine,
	linePlannedMaterials,
} from "@costura-pro/domain/service-order";

import { commandMessages } from "../command-messages";
import { insertReceivable, readReceivable } from "../finance/receivables";
import { readMeasurement } from "../measurements/store";
import { readCurrentProductionFlow } from "../production/store";
import {
	isQuoteAnonymized,
	latestRevisionNumber,
	readQuote,
	readQuoteRevision,
	updateQuote,
} from "../quotes/store";
import {
	insertStockReservation,
	physicalByVariant,
	readStockReservation,
	reservedByVariant,
} from "../stock/reservations";
import type {
	CommandExecutor,
	CreateDefinition,
	CreateRejection,
} from "../sync/commands";
import { productionCommands } from "./production";
import { type QuoteApproveValues, quoteApprovePayload } from "./schemas";
import {
	insertQuoteApproval,
	insertServiceOrder,
	insertServiceOrderItem,
	itemTitle,
	readApprovalOfQuote,
	readQuoteApproval,
	readServiceOrder,
	readServiceOrderItem,
} from "./store";

const notFound = (message: string): CreateRejection => ({
	message,
	reason: "aggregateNotFound",
});

const taken: CreateRejection = { reason: "aggregateExists" };

type ApprovalItem = QuoteApproveValues["items"][number];

type WorkPair = { item: ApprovalItem; line: ServiceOrderLineRow };

function profileOf(line: ServiceOrderLineRow): string | null {
	return line.kind === "material" ? null : line.profileId;
}

function sameVariants(line: ServiceOrderLineRow, item: ApprovalItem): boolean {
	const planned = linePlannedMaterials(quoteLineOfText(line)).map(
		(material) => material.variantId
	);
	return (
		planned.length === item.reservations.length &&
		planned.every(
			(variantId, position) =>
				item.reservations[position]?.variantId === variantId
		)
	);
}

function workPairs(
	fields: QuoteApproveValues,
	lines: readonly (QuoteLineRow & QuoteLineTotalsRow)[]
): WorkPair[] | null {
	const workLines = lines.filter(isWorkLine);
	if (fields.items.length !== workLines.length) {
		return null;
	}
	const pairs: WorkPair[] = [];
	for (const [index, item] of fields.items.entries()) {
		const line = workLines[index];
		if (!line || line.id !== item.lineId) {
			return null;
		}
		if (profileOf(line) === null && item.measurements.length > 0) {
			return null;
		}
		if (!sameVariants(line, item)) {
			return null;
		}
		pairs.push({ item, line });
	}
	return pairs;
}

function measurementsBelong(
	db: CommandExecutor,
	pairs: readonly WorkPair[]
): boolean {
	return pairs.every(({ item, line }) =>
		item.measurements.every(
			(snapshot) =>
				readMeasurement(db, snapshot.measurementId)?.profileId ===
				profileOf(line)
		)
	);
}

function idsTaken(
	db: CommandExecutor,
	id: string,
	fields: QuoteApproveValues
): boolean {
	const itemIds = fields.items.map((item) => item.itemId);
	const reservationIds = fields.items.flatMap((item) =>
		item.reservations.map((reservation) => reservation.reservationId)
	);
	return (
		[
			fields.serviceOrderId,
			fields.receivableId,
			...itemIds,
			...reservationIds,
		].includes(id) ||
		readServiceOrder(db, fields.serviceOrderId) !== undefined ||
		readReceivable(db, fields.receivableId) !== undefined ||
		itemIds.some((itemId) => readServiceOrderItem(db, itemId) !== undefined) ||
		reservationIds.some(
			(reservationId) => readStockReservation(db, reservationId) !== undefined
		)
	);
}

const approveQuote: CreateDefinition = {
	aggregateType: "quoteApproval",
	create: (db, id, values, stamp) => {
		const fields = quoteApprovePayload.parse(values);
		const target = readQuote(db, fields.quoteId);
		if (!target) {
			return notFound(commandMessages.quoteNotFound);
		}
		if (isQuoteAnonymized(db, target)) {
			return { reason: "aggregateAnonymized" };
		}
		if (readApprovalOfQuote(db, target.id)) {
			return { message: commandMessages.quoteApproved, ...taken };
		}
		const revision = readQuoteRevision(db, fields.revisionId);
		if (!revision || revision.quoteId !== target.id) {
			return notFound(commandMessages.quoteRevisionNotFound);
		}
		if (revision.number !== latestRevisionNumber(db, target.id)) {
			return notFound(commandMessages.quoteRevisionSuperseded);
		}
		if (approvalWindowError(fields.approvedOn, revision) !== null) {
			return notFound(commandMessages.approvalOutsideValidity);
		}
		const pairs = workPairs(fields, revision.content.lines);
		if (!pairs) {
			return notFound(commandMessages.approvalItemsMismatch);
		}
		if (!measurementsBelong(db, pairs)) {
			return notFound(commandMessages.measurementNotFound);
		}
		if (idsTaken(db, id, fields)) {
			return taken;
		}
		const flow = readCurrentProductionFlow(db);
		const order = insertServiceOrder(
			db,
			fields.serviceOrderId,
			{
				clientId: target.clientId,
				flow: flow ? { stages: flow.stages, version: flow.version } : null,
				openedOn: fields.approvedOn,
				quoteId: target.id,
				titles: pairs.map(({ line }) => itemTitle(line)),
			},
			stamp
		);
		const approval = insertQuoteApproval(
			db,
			id,
			{
				approvedOn: fields.approvedOn,
				channel: fields.channel,
				note: fields.note,
				quoteId: target.id,
				revisionId: revision.id,
				serviceOrderId: order.id,
			},
			stamp
		);
		const needs = pairs.flatMap(({ item, line }, position) => {
			insertServiceOrderItem(
				db,
				item.itemId,
				{
					dueOn: fields.dueOn,
					kind: line.kind,
					line,
					lineId: line.id,
					measurements: item.measurements,
					position,
					serviceOrderId: order.id,
				},
				stamp
			);
			return linePlannedMaterials(quoteLineOfText(line)).map(
				(material, index) => ({
					key: item.itemId,
					quantityMicros: material.quantityMicros,
					reservationId: item.reservations[index]?.reservationId ?? "",
					variantId: material.variantId,
				})
			);
		});
		const variantIds = [...new Set(needs.map((need) => need.variantId))];
		for (const outcome of planReservations(
			needs,
			physicalByVariant(db, variantIds),
			reservedByVariant(db, variantIds)
		)) {
			if (outcome.reservedMicros > 0n) {
				insertStockReservation(
					db,
					outcome.reservationId,
					{
						kind: "approval",
						occurredOn: fields.approvedOn,
						quantityMicros: outcome.reservedMicros.toString(),
						serviceOrderItemId: outcome.key,
						variantId: outcome.variantId,
					},
					stamp
				);
			}
		}
		if (revision.totalCents > 0n) {
			insertReceivable(
				db,
				fields.receivableId,
				{
					amountCents: revision.totalCents.toString(),
					clientId: target.clientId,
					kind: "serviceOrder",
					occurredOn: fields.approvedOn,
					serviceOrderId: order.id,
				},
				stamp
			);
		}
		if (target.refusedOn !== null) {
			updateQuote(db, target, { refusalReason: null, refusedOn: null }, stamp);
		}
		return approval.version;
	},
	exists: (db, id) => readQuoteApproval(db, id) !== undefined,
	kind: "create",
	payload: quoteApprovePayload,
};

export const serviceOrderCommands = {
	...productionCommands,
	"quote.approve": approveQuote,
};

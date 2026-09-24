import type { Database } from "@costura-pro/db";
import { client } from "@costura-pro/db/schema/clients";
import {
	serviceOrder,
	serviceOrderItem,
} from "@costura-pro/db/schema/service-orders";
import { quoteLineOfText } from "@costura-pro/domain/quote";
import { searchTokens } from "@costura-pro/domain/search";
import { linePlannedMaterials } from "@costura-pro/domain/service-order";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import z from "zod";

import { clientMatches } from "../clients/queries";
import { commandMessages } from "../command-messages";
import {
	type ReceivableSnapshot,
	readReceivableOfServiceOrder,
	receivableSnapshot,
} from "../finance/receivables";
import { readQuote, readQuoteRevision } from "../quotes/store";
import { containing } from "../search";
import { reservationsOfItems } from "../stock/reservations";
import {
	listServiceOrderItems,
	type QuoteApprovalSnapshot,
	quoteApprovalSnapshot,
	readApprovalOfQuote,
	readServiceOrder,
	type ServiceOrderItemSnapshot,
	type ServiceOrderSnapshot,
	serviceOrderItemSnapshot,
	serviceOrderSnapshot,
} from "./store";

type Reader = Pick<Database, "select">;

export const serviceOrderPageSize = 50;

export const serviceOrderListInput = z.object({
	offset: z.number().int().nonnegative().default(0),
	query: z.string().max(100).optional(),
});

const earliestDue = sql<
	string | null
>`(SELECT min(item.due_on) FROM service_order_item AS item WHERE item.service_order_id = "service_order"."id")`;

const itemCount = sql<number>`(SELECT count(*) FROM service_order_item AS item WHERE item.service_order_id = "service_order"."id")`;

const receivableTotal = sql<
	string | null
>`(SELECT cast(owed.amount_cents AS text) FROM receivable AS owed WHERE owed.service_order_id = "service_order"."id")`;

export const serviceOrderOrder: SQL[] = [
	sql`${earliestDue} IS NULL`,
	sql`${earliestDue}`,
	desc(serviceOrder.createdAt),
	desc(serviceOrder.id),
];

export const serviceOrderColumns = {
	clientId: serviceOrder.clientId,
	clientName: client.name,
	code: serviceOrder.code,
	dueOn: earliestDue,
	id: serviceOrder.id,
	itemCount,
	openedOn: serviceOrder.openedOn,
	totalCents: receivableTotal,
};

export function serviceOrderMatches(
	db: Reader,
	tokens: readonly string[]
): (SQL | undefined)[] {
	return tokens.map((token) =>
		or(
			sql`${serviceOrder.searchText} LIKE ${containing(token)} ESCAPE '\\'`,
			inArray(
				serviceOrder.clientId,
				db
					.select({ id: client.id })
					.from(client)
					.where(and(...clientMatches([token])))
			)
		)
	);
}

export function shortageOf(
	db: Reader,
	serviceOrderIds: readonly string[]
): Set<string> {
	if (serviceOrderIds.length === 0) {
		return new Set();
	}
	const items = db
		.select({
			id: serviceOrderItem.id,
			line: serviceOrderItem.line,
			serviceOrderId: serviceOrderItem.serviceOrderId,
		})
		.from(serviceOrderItem)
		.where(inArray(serviceOrderItem.serviceOrderId, [...serviceOrderIds]))
		.all();
	const reserved = new Map(
		reservationsOfItems(
			db,
			items.map((item) => item.id)
		).map((row) => [
			`${row.itemId}|${row.variantId}`,
			BigInt(row.reservedMicros),
		])
	);
	return new Set(
		items
			.filter((item) =>
				linePlannedMaterials(quoteLineOfText(item.line)).some(
					(material) =>
						material.quantityMicros >
						(reserved.get(`${item.id}|${material.variantId}`) ?? 0n)
				)
			)
			.map((item) => item.serviceOrderId)
	);
}

export type ServiceOrderListItem = {
	clientId: string;
	clientName: string;
	code: string;
	dueOn: string | null;
	id: string;
	itemCount: number;
	openedOn: string;
	shortage: boolean;
	totalCents: string;
};

export function listServiceOrders(
	db: Reader,
	{ offset, query }: z.output<typeof serviceOrderListInput>
): { items: ServiceOrderListItem[]; nextOffset: number | null } {
	const rows = db
		.select(serviceOrderColumns)
		.from(serviceOrder)
		.innerJoin(client, eq(client.id, serviceOrder.clientId))
		.where(and(...serviceOrderMatches(db, searchTokens(query ?? ""))))
		.orderBy(...serviceOrderOrder)
		.limit(serviceOrderPageSize + 1)
		.offset(offset)
		.all();
	const page = rows.slice(0, serviceOrderPageSize);
	const short = shortageOf(
		db,
		page.map((row) => row.id)
	);
	return {
		items: page.map((row) => ({
			...row,
			shortage: short.has(row.id),
			totalCents: row.totalCents ?? "0",
		})),
		nextOffset:
			rows.length > serviceOrderPageSize ? offset + serviceOrderPageSize : null,
	};
}

export type ServiceOrderDetail = {
	approval: QuoteApprovalSnapshot;
	client: { anonymized: boolean; archived: boolean; id: string; name: string };
	items: (ServiceOrderItemSnapshot & {
		reservations: { reservedMicros: string; variantId: string }[];
	})[];
	quote: { code: string; id: string };
	receivable: ReceivableSnapshot | null;
	revision: {
		costCents: string | null;
		discountCents: string;
		emittedOn: string;
		grossCents: string;
		id: string;
		number: number;
		targetMarginBasisPoints: number;
		totalCents: string;
		validUntil: string;
	};
	serviceOrder: ServiceOrderSnapshot & { updatedAt: string };
};

function missingOrder(): ORPCError<"NOT_FOUND", unknown> {
	return new ORPCError("NOT_FOUND", {
		message: commandMessages.serviceOrderNotFound,
	});
}

export function getServiceOrder(
	db: Reader,
	serviceOrderId: string
): ServiceOrderDetail {
	const row = readServiceOrder(db, serviceOrderId);
	const owner = row
		? db.select().from(client).where(eq(client.id, row.clientId)).get()
		: undefined;
	const source = row ? readQuote(db, row.quoteId) : undefined;
	const approval = row ? readApprovalOfQuote(db, row.quoteId) : undefined;
	const revision = approval
		? readQuoteRevision(db, approval.revisionId)
		: undefined;
	if (!(row && owner && source && approval && revision)) {
		throw missingOrder();
	}
	const items = listServiceOrderItems(db, row.id);
	const reservations = reservationsOfItems(
		db,
		items.map((item) => item.id)
	);
	const receivable = readReceivableOfServiceOrder(db, row.id);
	return {
		approval: quoteApprovalSnapshot(approval),
		client: {
			anonymized: owner.anonymizedAt !== null,
			archived: owner.archivedAt !== null,
			id: owner.id,
			name: owner.name,
		},
		items: items.map((item) => {
			const order = linePlannedMaterials(quoteLineOfText(item.line)).map(
				(material) => material.variantId
			);
			return {
				...serviceOrderItemSnapshot(item),
				reservations: reservations
					.filter((reservation) => reservation.itemId === item.id)
					.sort(
						(left, right) =>
							order.indexOf(left.variantId) - order.indexOf(right.variantId)
					)
					.map(({ reservedMicros, variantId }) => ({
						reservedMicros,
						variantId,
					})),
			};
		}),
		quote: { code: source.code, id: source.id },
		receivable: receivable ? receivableSnapshot(receivable) : null,
		revision: {
			costCents: revision.costCents?.toString() ?? null,
			discountCents: revision.discountCents.toString(),
			emittedOn: revision.emittedOn,
			grossCents: revision.grossCents.toString(),
			id: revision.id,
			number: revision.number,
			targetMarginBasisPoints: revision.targetMarginBasisPoints,
			totalCents: revision.totalCents.toString(),
			validUntil: revision.validUntil,
		},
		serviceOrder: {
			...serviceOrderSnapshot(row),
			updatedAt: row.updatedAt.toISOString(),
		},
	};
}

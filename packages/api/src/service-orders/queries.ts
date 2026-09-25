import type { Database } from "@costura-pro/db";
import { client } from "@costura-pro/db/schema/clients";
import { material, materialVariant } from "@costura-pro/db/schema/materials";
import type { FlowStageRow } from "@costura-pro/db/schema/production";
import type {
	ReconciliationLineRow,
	ReconciliationPartRow,
} from "@costura-pro/db/schema/reconciliation";
import {
	serviceOrder,
	serviceOrderItem,
} from "@costura-pro/db/schema/service-orders";
import { service } from "@costura-pro/db/schema/services";
import { stockLocation, stockLot } from "@costura-pro/db/schema/stock";
import { suggestedStageIds } from "@costura-pro/domain/production";
import { multiplyHalfUp } from "@costura-pro/domain/quantity";
import { type QuoteLine, quoteLineOfText } from "@costura-pro/domain/quote";
import { searchTokens } from "@costura-pro/domain/search";
import { linePlannedMaterials } from "@costura-pro/domain/service-order";
import type { BaseUnitCode } from "@costura-pro/domain/unit";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import z from "zod";

import { clientMatches } from "../clients/queries";
import { commandMessages } from "../command-messages";
import {
	type ReceivableSnapshot,
	readReceivableOfServiceOrder,
	receivableSnapshot,
} from "../finance/receivables";
import { readCurrentProductionFlow } from "../production/store";
import { readQuote, readQuoteRevision } from "../quotes/store";
import {
	readActiveReconciliations,
	reconciledItemIds,
} from "../reconciliation/store";
import { containing } from "../search";
import { reservationsOfItems } from "../stock/reservations";
import {
	listServiceOrderItems,
	type QuoteApprovalSnapshot,
	quoteApprovalSnapshot,
	readApprovalOfQuote,
	readServiceOrder,
	type ServiceOrderItemRow,
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

const productionCount = sql<number>`(SELECT count(*) FROM service_order_item AS item WHERE item.service_order_id = "service_order"."id" AND item.kind IN ('service', 'custom'))`;

const startedCount = sql<number>`(SELECT count(*) FROM service_order_item AS item WHERE item.service_order_id = "service_order"."id" AND item.production_status = 'inProgress' AND item.kind IN ('service', 'custom'))`;

const readyCount = sql<number>`(SELECT count(*) FROM service_order_item AS item WHERE item.service_order_id = "service_order"."id" AND item.production_status = 'ready' AND item.kind IN ('service', 'custom'))`;

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
	const itemIds = items.map((item) => item.id);
	const reserved = new Map(
		reservationsOfItems(db, itemIds).map((row) => [
			`${row.itemId}|${row.variantId}`,
			BigInt(row.reservedMicros),
		])
	);
	const reconciled = reconciledItemIds(db, itemIds);
	return new Set(
		items
			.filter(
				(item) =>
					!reconciled.has(item.id) &&
					linePlannedMaterials(quoteLineOfText(item.line)).some(
						(planned) =>
							planned.quantityMicros >
							(reserved.get(`${item.id}|${planned.variantId}`) ?? 0n)
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
	productionCount: number;
	readyCount: number;
	shortage: boolean;
	startedCount: number;
	totalCents: string;
};

export function listServiceOrders(
	db: Reader,
	{ offset, query }: z.output<typeof serviceOrderListInput>
): { items: ServiceOrderListItem[]; nextOffset: number | null } {
	const rows = db
		.select({
			...serviceOrderColumns,
			productionCount,
			readyCount,
			startedCount,
		})
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

type ItemReservation = { reservedMicros: string; variantId: string };

export type ReconciliationPartDetail = ReconciliationPartRow & {
	locationName: string;
	lotLabel: string | null;
};

export type ReconciliationLineDetail = Omit<ReconciliationLineRow, "parts"> & {
	baseUnit: BaseUnitCode;
	displayPrecision: number;
	materialName: string;
	parts: ReconciliationPartDetail[];
	plannedCostCents: string | null;
	variantName: string;
};

export type ReconciliationDetail = {
	id: string;
	lines: ReconciliationLineDetail[];
	note: string | null;
	occurredOn: string;
};

export type ServiceOrderDetail = {
	approval: QuoteApprovalSnapshot;
	client: { anonymized: boolean; archived: boolean; id: string; name: string };
	currentFlowVersion: number | null;
	items: (ServiceOrderItemSnapshot & {
		reconciled: boolean;
		reconciliation: ReconciliationDetail | null;
		reservations: ItemReservation[];
		suggestedStageIds: string[];
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

function lineServiceIds(item: ServiceOrderItemRow): string[] {
	const { line } = item;
	switch (line.kind) {
		case "service":
			return [line.serviceId];
		case "custom":
			return line.components.flatMap((component) =>
				component.kind === "service" ? [component.serviceId] : []
			);
		default:
			return [];
	}
}

function suggestedListsOf(
	db: Reader,
	items: readonly ServiceOrderItemRow[]
): Map<string, string[]> {
	const serviceIds = [...new Set(items.flatMap(lineServiceIds))];
	if (serviceIds.length === 0) {
		return new Map();
	}
	return new Map(
		db
			.select({ id: service.id, suggestedStageIds: service.suggestedStageIds })
			.from(service)
			.where(inArray(service.id, serviceIds))
			.all()
			.map((row) => [row.id, row.suggestedStageIds])
	);
}

function itemSuggestion(
	flowStages: FlowStageRow[] | null,
	item: ServiceOrderItemRow,
	lists: ReadonlyMap<string, string[]>
): string[] {
	if (flowStages === null || item.kind === "material") {
		return [];
	}
	return suggestedStageIds(
		flowStages,
		lineServiceIds(item).map((serviceId) => lists.get(serviceId) ?? [])
	);
}

export function suggestionsOf(
	db: Reader,
	flowStages: FlowStageRow[] | null,
	items: ServiceOrderItemRow[]
): Map<string, string[]> {
	const lists = suggestedListsOf(db, items);
	return new Map(
		items.map((item) => [item.id, itemSuggestion(flowStages, item, lists)])
	);
}

function itemReservations(
	db: Reader,
	items: readonly ServiceOrderItemRow[]
): Map<string, ItemReservation[]> {
	const byItem = new Map<string, ItemReservation[]>();
	for (const { itemId, reservedMicros, variantId } of reservationsOfItems(
		db,
		items.map((item) => item.id)
	)) {
		const list = byItem.get(itemId) ?? [];
		list.push({ reservedMicros, variantId });
		byItem.set(itemId, list);
	}
	return new Map(
		items.map((item) => {
			const order = linePlannedMaterials(quoteLineOfText(item.line)).map(
				(planned) => planned.variantId
			);
			return [
				item.id,
				(byItem.get(item.id) ?? []).sort(
					(left, right) =>
						order.indexOf(left.variantId) - order.indexOf(right.variantId)
				),
			];
		})
	);
}

function plannedCostOf(line: QuoteLine, variantId: string): string | null {
	if (line.kind !== "custom") {
		return null;
	}
	let total = 0n;
	for (const component of line.components) {
		if (
			component.kind === "material" &&
			component.materialVariantId === variantId
		) {
			if (component.unitCostCents === null) {
				return null;
			}
			total += multiplyHalfUp(
				component.quantityMicros * BigInt(line.quantity),
				component.unitCostCents
			);
		}
	}
	return total.toString();
}

function known<T>(values: ReadonlyMap<string, T>, id: string): T {
	const value = values.get(id);
	if (value === undefined) {
		throw new ORPCError("INTERNAL_SERVER_ERROR");
	}
	return value;
}

function reconciliationsOf(
	db: Reader,
	items: readonly ServiceOrderItemRow[]
): Map<string, ReconciliationDetail> {
	const rows = readActiveReconciliations(
		db,
		items.map((item) => item.id)
	);
	if (rows.length === 0) {
		return new Map();
	}
	const lines = rows.flatMap((row) => row.lines);
	const parts = lines.flatMap((line) => line.parts);
	const variants = new Map(
		db
			.select({
				baseUnit: materialVariant.baseUnit,
				displayPrecision: materialVariant.displayPrecision,
				id: materialVariant.id,
				materialName: material.name,
				variantName: materialVariant.name,
			})
			.from(materialVariant)
			.innerJoin(material, eq(material.id, materialVariant.materialId))
			.where(
				inArray(materialVariant.id, [
					...new Set(lines.map((line) => line.variantId)),
				])
			)
			.all()
			.map(({ id, ...names }) => [id, names])
	);
	const locations = new Map(
		db
			.select({ id: stockLocation.id, name: stockLocation.name })
			.from(stockLocation)
			.where(
				inArray(stockLocation.id, [
					...new Set(parts.map((part) => part.locationId)),
				])
			)
			.all()
			.map((row) => [row.id, row.name])
	);
	const lotIds = [
		...new Set(parts.flatMap((part) => (part.lotId ? [part.lotId] : []))),
	];
	const lots = new Map(
		lotIds.length === 0
			? []
			: db
					.select({ id: stockLot.id, label: stockLot.label })
					.from(stockLot)
					.where(inArray(stockLot.id, lotIds))
					.all()
					.map((row) => [row.id, row.label])
	);
	const itemLines = new Map(
		items.map((item) => [item.id, quoteLineOfText(item.line)])
	);
	return new Map(
		rows.map((row) => {
			const itemLine = known(itemLines, row.serviceOrderItemId);
			return [
				row.serviceOrderItemId,
				{
					id: row.id,
					lines: row.lines.map((line) => ({
						...line,
						...known(variants, line.variantId),
						parts: line.parts.map((part) => ({
							...part,
							locationName: known(locations, part.locationId),
							lotLabel: part.lotId ? known(lots, part.lotId) : null,
						})),
						plannedCostCents: plannedCostOf(itemLine, line.plannedVariantId),
					})),
					note: row.note,
					occurredOn: row.occurredOn,
				},
			];
		})
	);
}

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
	const reservations = itemReservations(db, items);
	const suggestions = suggestionsOf(db, row.flowStages, items);
	const reconciliations = reconciliationsOf(db, items);
	const receivable = readReceivableOfServiceOrder(db, row.id);
	return {
		approval: quoteApprovalSnapshot(approval),
		client: {
			anonymized: owner.anonymizedAt !== null,
			archived: owner.archivedAt !== null,
			id: owner.id,
			name: owner.name,
		},
		currentFlowVersion: readCurrentProductionFlow(db)?.version ?? null,
		items: items.map((item) => ({
			...serviceOrderItemSnapshot(item),
			reconciled: reconciliations.has(item.id),
			reconciliation: reconciliations.get(item.id) ?? null,
			reservations: reservations.get(item.id) ?? [],
			suggestedStageIds: suggestions.get(item.id) ?? [],
		})),
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

type BoardOrder = {
	clientName: string;
	code: string;
	flowStages: FlowStageRow[] | null;
	flowVersion: number | null;
	id: string;
	openedOn: string;
};

export type ProductionBoard = {
	flow: { id: string; stages: FlowStageRow[]; version: number };
	items: (Omit<
		ServiceOrderItemSnapshot,
		"createdAt" | "lineId" | "measurements"
	> & {
		reconciled: boolean;
		reservations: ItemReservation[];
		suggestedStageIds: string[];
	})[];
	orders: BoardOrder[];
};

export function boardOf(db: Reader): ProductionBoard {
	const flow = readCurrentProductionFlow(db);
	if (!flow) {
		throw new ORPCError("NOT_FOUND", {
			message: commandMessages.productionFlowNotFound,
		});
	}
	const rows = db
		.select({
			clientName: client.name,
			item: serviceOrderItem,
			order: serviceOrder,
		})
		.from(serviceOrderItem)
		.innerJoin(
			serviceOrder,
			eq(serviceOrder.id, serviceOrderItem.serviceOrderId)
		)
		.innerJoin(client, eq(client.id, serviceOrder.clientId))
		.where(inArray(serviceOrderItem.kind, ["service", "custom"]))
		.orderBy(
			sql`${serviceOrderItem.dueOn} IS NULL`,
			asc(serviceOrderItem.dueOn),
			asc(serviceOrder.code),
			asc(serviceOrderItem.position)
		)
		.all();
	const items = rows.map((row) => row.item);
	const reservations = itemReservations(db, items);
	const reconciled = reconciledItemIds(
		db,
		items.map((item) => item.id)
	);
	const lists = suggestedListsOf(db, items);
	const orders = new Map<string, BoardOrder>();
	for (const { clientName, order } of rows) {
		if (!orders.has(order.id)) {
			orders.set(order.id, {
				clientName,
				code: order.code,
				flowStages: order.flowStages,
				flowVersion: order.flowVersion,
				id: order.id,
				openedOn: order.openedOn,
			});
		}
	}
	return {
		flow: { id: flow.id, stages: flow.stages, version: flow.version },
		items: rows.map(({ item, order }) => {
			const {
				createdAt: _createdAt,
				lineId: _lineId,
				measurements: _measurements,
				...snapshot
			} = serviceOrderItemSnapshot(item);
			return {
				...snapshot,
				reconciled: reconciled.has(item.id),
				reservations: reservations.get(item.id) ?? [],
				suggestedStageIds: itemSuggestion(order.flowStages, item, lists),
			};
		}),
		orders: [...orders.values()],
	};
}

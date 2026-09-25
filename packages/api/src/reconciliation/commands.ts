import type {
	ReconciliationLineRow,
	ReconciliationPartRow,
} from "@costura-pro/db/schema/reconciliation";
import { quoteLineOfText } from "@costura-pro/domain/quote";
import { consumptionPartValue } from "@costura-pro/domain/reconciliation";
import {
	linePlannedMaterials,
	type PlannedMaterial,
} from "@costura-pro/domain/service-order";
import { balancePointId } from "@costura-pro/domain/stock";

import { commandMessages } from "../command-messages";
import {
	type MaterialVariantRow,
	readMaterialVariant,
} from "../materials/store";
import {
	isServiceOrderAnonymized,
	readServiceOrder,
	readServiceOrderItem,
	type ServiceOrderItemRow,
	updateServiceOrderItem,
} from "../service-orders/store";
import { checkPlace, type Place } from "../stock/commands";
import {
	insertStockMovement,
	readStockBalancePoint,
	readStockMovement,
} from "../stock/store";
import type {
	CommandExecutor,
	CreateDefinition,
	CreateRejection,
} from "../sync/commands";
import {
	type ReconciliationCreateValues,
	reconciliationCreatePayload,
	reconciliationReversePayload,
} from "./schemas";
import {
	insertMaterialReconciliation,
	insertMaterialReconciliationReversal,
	readActiveReconciliation,
	readMaterialReconciliation,
	readMaterialReconciliationReversal,
	readReversalOfReconciliation,
} from "./store";

type ReconciliationLine = ReconciliationCreateValues["lines"][number];

type PointBalance = { quantityMicros: bigint; valueCents: bigint };

const notFound = (message: string): CreateRejection => ({
	message,
	reason: "aggregateNotFound",
});

function isAtLastStage(item: ServiceOrderItemRow): boolean {
	return (
		item.productionStatus === "inProgress" &&
		item.stageId !== null &&
		item.stageId === item.stageIds?.at(-1)
	);
}

function linesMatch(
	planned: readonly PlannedMaterial[],
	lines: readonly ReconciliationLine[]
): boolean {
	return (
		planned.length > 0 &&
		planned.length === lines.length &&
		planned.every(
			(material, index) => material.variantId === lines[index]?.plannedVariantId
		)
	);
}

function usedVariantsOf(
	db: CommandExecutor,
	lines: readonly ReconciliationLine[]
): MaterialVariantRow[] | null {
	const used: MaterialVariantRow[] = [];
	for (const line of lines) {
		const variant = readMaterialVariant(db, line.variantId);
		const planned = readMaterialVariant(db, line.plannedVariantId);
		if (!(variant && planned) || variant.baseUnit !== planned.baseUnit) {
			return null;
		}
		used.push(variant);
	}
	return used;
}

function partRejection(
	db: CommandExecutor,
	id: string,
	lines: readonly ReconciliationLine[]
): CreateRejection | null {
	for (const line of lines) {
		for (const part of line.parts) {
			const rejection = checkPlace(db, { ...part, variantId: line.variantId });
			if (rejection) {
				return rejection;
			}
		}
	}
	const taken = lines.some((line) =>
		line.parts.some(
			(part) =>
				part.movementId === id ||
				readStockMovement(db, part.movementId) !== undefined
		)
	);
	return taken ? { reason: "aggregateExists" } : null;
}

function pointLedger(db: CommandExecutor) {
	const known = new Map<string, PointBalance>();
	const keyOf = (place: Place) =>
		balancePointId(place.variantId, place.locationId, place.lotId);
	return {
		read: (place: Place): PointBalance => {
			const cached = known.get(keyOf(place));
			if (cached) {
				return cached;
			}
			const row = readStockBalancePoint(
				db,
				place.variantId,
				place.locationId,
				place.lotId
			);
			return {
				quantityMicros: row?.quantityMicros ?? 0n,
				valueCents: row?.valueCents ?? 0n,
			};
		},
		write: (place: Place, balance: PointBalance) => {
			known.set(keyOf(place), balance);
		},
	};
}

function valuedLines(
	db: CommandExecutor,
	lines: readonly ReconciliationLine[],
	planned: readonly PlannedMaterial[],
	used: readonly MaterialVariantRow[]
): ReconciliationLineRow[] {
	const ledger = pointLedger(db);
	return lines.map((line, index) => ({
		consumedMicros: line.consumedMicros,
		lostMicros: line.lostMicros,
		parts: line.parts.map((part): ReconciliationPartRow => {
			const place = { ...part, variantId: line.variantId };
			const quantity = BigInt(part.quantityMicros);
			const point = ledger.read(place);
			const value = consumptionPartValue(
				point.quantityMicros,
				point.valueCents,
				quantity,
				used[index]?.referenceCostCents ?? null
			);
			ledger.write(place, {
				quantityMicros: point.quantityMicros - quantity,
				valueCents: point.valueCents - value.valueCents,
			});
			return {
				locationId: part.locationId,
				lotId: part.lotId,
				movementId: part.movementId,
				provisionalCents: value.provisionalCents.toString(),
				provisionalMicros: value.provisionalMicros.toString(),
				quantityMicros: part.quantityMicros,
				valueCents: value.valueCents.toString(),
			};
		}),
		plannedMicros: (planned[index]?.quantityMicros ?? 0n).toString(),
		plannedVariantId: line.plannedVariantId,
		swapReason: line.swapReason,
		variantId: line.variantId,
	}));
}

const createReconciliation: CreateDefinition = {
	aggregateType: "materialReconciliation",
	create: (db, id, values, stamp) => {
		const fields = reconciliationCreatePayload.parse(values);
		const item = readServiceOrderItem(db, fields.itemId);
		const order =
			item && item.kind !== "material"
				? readServiceOrder(db, item.serviceOrderId)
				: undefined;
		if (!(item && order)) {
			return notFound(commandMessages.productionItemNotFound);
		}
		if (isServiceOrderAnonymized(db, order)) {
			return { reason: "aggregateAnonymized" };
		}
		if (readActiveReconciliation(db, item.id)) {
			return {
				message: commandMessages.reconciliationExists,
				reason: "aggregateExists",
			};
		}
		if (!isAtLastStage(item)) {
			return notFound(commandMessages.reconciliationNotAtLastStage);
		}
		const planned = linePlannedMaterials(quoteLineOfText(item.line));
		if (!linesMatch(planned, fields.lines)) {
			return notFound(commandMessages.reconciliationLinesMismatch);
		}
		const used = usedVariantsOf(db, fields.lines);
		if (!used) {
			return notFound(commandMessages.reconciliationSwapUnit);
		}
		const rejection = partRejection(db, id, fields.lines);
		if (rejection) {
			return rejection;
		}
		const lines = valuedLines(db, fields.lines, planned, used);
		const created = insertMaterialReconciliation(
			db,
			id,
			{
				lines,
				note: fields.note,
				occurredOn: fields.occurredOn,
				serviceOrderItemId: item.id,
			},
			stamp
		);
		for (const line of lines) {
			for (const part of line.parts) {
				insertStockMovement(
					db,
					part.movementId,
					{
						inventorySessionId: null,
						kind: "consumption",
						locationId: part.locationId,
						lotId: part.lotId,
						materialReconciliationId: id,
						occurredOn: fields.occurredOn,
						purchaseId: null,
						quantityMicros: (-BigInt(part.quantityMicros)).toString(),
						reason: null,
						reversesMovementId: null,
						transferId: null,
						valueCents: (-BigInt(part.valueCents)).toString(),
						variantId: line.variantId,
					},
					stamp
				);
			}
		}
		updateServiceOrderItem(
			db,
			item,
			{ productionStatus: "ready", stageId: null, stageIds: item.stageIds },
			stamp
		);
		return created.version;
	},
	exists: (db, id) => readMaterialReconciliation(db, id) !== undefined,
	kind: "create",
	payload: reconciliationCreatePayload,
};

const reverseReconciliation: CreateDefinition = {
	aggregateType: "materialReconciliationReversal",
	create: (db, id, values, stamp) => {
		const fields = reconciliationReversePayload.parse(values);
		const reconciliation = readMaterialReconciliation(
			db,
			fields.reconciliationId
		);
		const item = reconciliation
			? readServiceOrderItem(db, reconciliation.serviceOrderItemId)
			: undefined;
		const order = item ? readServiceOrder(db, item.serviceOrderId) : undefined;
		if (!(reconciliation && item && order)) {
			return notFound(commandMessages.reconciliationNotFound);
		}
		if (isServiceOrderAnonymized(db, order)) {
			return { reason: "aggregateAnonymized" };
		}
		if (readReversalOfReconciliation(db, reconciliation.id)) {
			return {
				message: commandMessages.reconciliationReversed,
				reason: "aggregateExists",
			};
		}
		const parts = reconciliation.lines.flatMap((line) =>
			line.parts.map((part) => ({ part, variantId: line.variantId }))
		);
		if (parts.length !== fields.movementIds.length) {
			return notFound(commandMessages.reconciliationNotFound);
		}
		if (
			fields.movementIds.some(
				(movementId) =>
					movementId === id || readStockMovement(db, movementId) !== undefined
			)
		) {
			return { reason: "aggregateExists" };
		}
		const created = insertMaterialReconciliationReversal(
			db,
			id,
			{
				occurredOn: fields.occurredOn,
				reason: fields.reason,
				reconciliationId: reconciliation.id,
			},
			stamp
		);
		const returns = parts.flatMap((entry, index) => {
			const movementId = fields.movementIds[index];
			return movementId ? [{ ...entry, movementId }] : [];
		});
		for (const { movementId, part, variantId } of returns) {
			insertStockMovement(
				db,
				movementId,
				{
					inventorySessionId: null,
					kind: "reversal",
					locationId: part.locationId,
					lotId: part.lotId,
					materialReconciliationId: reconciliation.id,
					occurredOn: fields.occurredOn,
					purchaseId: null,
					quantityMicros: part.quantityMicros,
					reason: fields.reason,
					reversesMovementId: part.movementId,
					transferId: null,
					valueCents: part.valueCents,
					variantId,
				},
				stamp
			);
		}
		if (item.productionStatus === "ready") {
			updateServiceOrderItem(
				db,
				item,
				{
					productionStatus: "inProgress",
					stageId: item.stageIds?.at(-1) ?? null,
					stageIds: item.stageIds,
				},
				stamp
			);
		}
		return created.version;
	},
	exists: (db, id) => readMaterialReconciliationReversal(db, id) !== undefined,
	kind: "create",
	payload: reconciliationReversePayload,
};

export const reconciliationCommands = {
	"materialReconciliation.create": createReconciliation,
	"materialReconciliation.reverse": reverseReconciliation,
};

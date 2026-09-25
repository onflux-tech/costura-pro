import type { FlowStageRow } from "@costura-pro/db/schema/production";
import {
	advanceProduction,
	backProduction,
	type ProductionState,
	startProduction,
} from "@costura-pro/domain/production";
import { quoteLineOfText } from "@costura-pro/domain/quote";
import { linePlannedMaterials } from "@costura-pro/domain/service-order";

import {
	type ProductionFlowRow,
	readCurrentProductionFlow,
} from "../production/store";
import { readActiveReconciliation } from "../reconciliation/store";
import { emptyPayload } from "../schemas";
import type { CommandExecutor } from "../sync/commands";
import { updateCommands } from "../update-command";
import { productionStartPayload } from "./schemas";
import {
	isServiceOrderAnonymized,
	readServiceOrder,
	readServiceOrderItem,
	type ServiceOrderItemPatch,
	type ServiceOrderItemRow,
	type ServiceOrderPatch,
	type ServiceOrderRow,
	serviceOrderItemSnapshot,
	serviceOrderSnapshot,
	updateServiceOrder,
	updateServiceOrderItem,
} from "./store";

type FlowOrder = ServiceOrderRow & {
	anonymizedClient: boolean;
	currentFlow: ProductionFlowRow | undefined;
};

type ProductionItem = ServiceOrderItemRow & {
	anonymizedClient: boolean;
	flowStages: FlowStageRow[] | null;
	reconciled: boolean;
};

function readFlowOrder(db: CommandExecutor, id: string): FlowOrder | undefined {
	const row = readServiceOrder(db, id);
	if (!row) {
		return;
	}
	return {
		...row,
		anonymizedClient: isServiceOrderAnonymized(db, row),
		currentFlow: readCurrentProductionFlow(db),
	};
}

function readProductionItem(
	db: CommandExecutor,
	id: string
): ProductionItem | undefined {
	const row = readServiceOrderItem(db, id);
	const order =
		row && row.kind !== "material"
			? readServiceOrder(db, row.serviceOrderId)
			: undefined;
	if (!(row && order)) {
		return;
	}
	return {
		...row,
		anonymizedClient: isServiceOrderAnonymized(db, order),
		flowStages: order.flowStages,
		reconciled: readActiveReconciliation(db, id) !== undefined,
	};
}

const orderCommand = updateCommands<FlowOrder, ServiceOrderPatch>({
	aggregateType: "serviceOrder",
	anonymized: (_db, row) => row.anonymizedClient,
	read: readFlowOrder,
	snapshot: serviceOrderSnapshot,
	update: (db, row, patch, stamp) => ({
		...row,
		...updateServiceOrder(db, row, patch, stamp),
	}),
});

const itemCommand = updateCommands<ProductionItem, ServiceOrderItemPatch>({
	aggregateType: "serviceOrderItem",
	anonymized: (_db, row) => row.anonymizedClient,
	read: readProductionItem,
	snapshot: serviceOrderItemSnapshot,
	update: (db, row, patch, stamp) => ({
		...row,
		...updateServiceOrderItem(db, row, patch, stamp),
	}),
});

function stateOf(row: ServiceOrderItemRow): ProductionState {
	return {
		stageId: row.stageId,
		stageIds: row.stageIds,
		status: row.productionStatus,
	};
}

function patchOf(next: ProductionState | null): ServiceOrderItemPatch | null {
	return (
		next && {
			productionStatus: next.status,
			stageId: next.stageId,
			stageIds: next.stageIds,
		}
	);
}

export const productionCommands = {
	"serviceOrder.adoptCurrentFlow": orderCommand(
		emptyPayload,
		({ currentFlow, flowVersion }) =>
			!currentFlow || flowVersion === currentFlow.version
				? null
				: { flowStages: currentFlow.stages, flowVersion: currentFlow.version }
	),
	"serviceOrderItem.advance": itemCommand(emptyPayload, (row) =>
		patchOf(
			advanceProduction(
				stateOf(row),
				linePlannedMaterials(quoteLineOfText(row.line)).length > 0 &&
					!row.reconciled
			)
		)
	),
	"serviceOrderItem.back": itemCommand(emptyPayload, (row) =>
		patchOf(backProduction(stateOf(row)))
	),
	"serviceOrderItem.start": itemCommand(
		productionStartPayload,
		(row, { stageIds }) =>
			patchOf(startProduction(stateOf(row), row.flowStages ?? [], stageIds))
	),
};

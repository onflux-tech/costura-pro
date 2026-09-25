import type { FlowStageRow } from "@costura-pro/db/schema/production";
import {
	mergeFlowStages,
	sameFlowStages,
} from "@costura-pro/domain/production";

import { updateCommands } from "../update-command";
import { productionFlowUpdatePayload } from "./schemas";
import {
	type ProductionFlowRow,
	productionFlowSnapshot,
	readProductionFlow,
	updateProductionFlow,
} from "./store";

const productionFlowCommand = updateCommands<
	ProductionFlowRow,
	{ stages: FlowStageRow[] }
>({
	aggregateType: "productionFlow",
	anonymized: () => false,
	read: readProductionFlow,
	snapshot: productionFlowSnapshot,
	update: updateProductionFlow,
});

export const productionFlowCommands = {
	"productionFlow.update": productionFlowCommand(
		productionFlowUpdatePayload,
		(row, { stages }) => {
			const merged = mergeFlowStages(row.stages, stages);
			return sameFlowStages(row.stages, merged) ? null : { stages: merged };
		}
	),
};

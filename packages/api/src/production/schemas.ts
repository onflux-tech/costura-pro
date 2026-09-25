import { duplicateLabelIndex } from "@costura-pro/domain/measurement";
import { productionLimits } from "@costura-pro/domain/production";
import z from "zod";

const stageNameField = z
	.string()
	.trim()
	.min(productionLimits.stageName.min)
	.max(productionLimits.stageName.max);

export const flowStagesPayload = z
	.array(z.object({ id: z.uuid(), name: stageNameField }))
	.min(productionLimits.activeStages.min)
	.max(productionLimits.activeStages.max)
	.refine(
		(stages) => new Set(stages.map((stage) => stage.id)).size === stages.length,
		"Etapa repetida"
	)
	.refine(
		(stages) => duplicateLabelIndex(stages.map((stage) => stage.name)) === null,
		"Nome de etapa repetido"
	);

export const productionFlowUpdatePayload = z.object({
	stages: flowStagesPayload,
});

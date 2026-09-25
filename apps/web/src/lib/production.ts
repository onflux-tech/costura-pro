import { duplicateLabelIndex } from "@costura-pro/domain/measurement";
import {
	advanceProduction,
	mergeFlowStages,
	type ProductionStatus,
	productionLimits,
	sameFlowStages,
	startProduction,
} from "@costura-pro/domain/production";
import { quoteLineOfText } from "@costura-pro/domain/quote";
import {
	linePlannedMaterials,
	type WorkLineKind,
} from "@costura-pro/domain/service-order";

import { moveField } from "./measurements";
import { itemMaterials, type WorkLineView } from "./service-orders";

export type FlowStageView = { active: boolean; id: string; name: string };

export type ProductionFlowView = {
	id: string;
	stages: FlowStageView[];
	updatedAt: string;
	version: number;
};

type DraftStage = { id: string; name: string };

export type FlowDraft = { active: DraftStage[]; hidden: DraftStage[] };

export function flowDraftOf(stages: readonly FlowStageView[]): FlowDraft {
	const plain = ({ id, name }: FlowStageView): DraftStage => ({ id, name });
	return {
		active: stages.filter((stage) => stage.active).map(plain),
		hidden: stages.filter((stage) => !stage.active).map(plain),
	};
}

export function renameStage(
	draft: FlowDraft,
	index: number,
	name: string
): FlowDraft {
	return {
		...draft,
		active: draft.active.map((stage, position) =>
			position === index ? { ...stage, name } : stage
		),
	};
}

export function moveStage(
	draft: FlowDraft,
	index: number,
	direction: -1 | 1
): FlowDraft {
	return { ...draft, active: moveField(draft.active, index, direction) };
}

export function hideStage(
	draft: FlowDraft,
	index: number,
	saved: readonly FlowStageView[]
): FlowDraft {
	const active = draft.active.filter((_, position) => position !== index);
	return {
		active,
		hidden: flowDraftOf(
			mergeFlowStages(saved, flowPayload({ active, hidden: [] }).stages)
		).hidden,
	};
}

export function showStage(draft: FlowDraft, id: string): FlowDraft {
	const stage = draft.hidden.find((hidden) => hidden.id === id);
	if (stage === undefined) {
		return draft;
	}
	return {
		active: [...draft.active, stage],
		hidden: draft.hidden.filter((hidden) => hidden.id !== id),
	};
}

export function addStage(draft: FlowDraft, id: string): FlowDraft {
	return { ...draft, active: [...draft.active, { id, name: "" }] };
}

export function flowChanged(
	stages: readonly FlowStageView[],
	draft: FlowDraft
): boolean {
	return !sameFlowStages(
		stages,
		mergeFlowStages(stages, flowPayload(draft).stages)
	);
}

export type FlowErrors = { list: string | null; names: (string | null)[] };

function listError(count: number): string | null {
	if (count < productionLimits.activeStages.min) {
		return "Mantenha ao menos uma etapa.";
	}
	return count > productionLimits.activeStages.max
		? `Use até ${productionLimits.activeStages.max} etapas.`
		: null;
}

export function flowErrors(draft: FlowDraft): FlowErrors {
	const names = draft.active.map((stage) => stage.name.trim());
	return {
		list: listError(names.length),
		names: names.map((name, index) => {
			if (name.length < productionLimits.stageName.min) {
				return "Dê um nome à etapa.";
			}
			if (name.length > productionLimits.stageName.max) {
				return `Use até ${productionLimits.stageName.max} caracteres.`;
			}
			const repeated = names
				.slice(0, index)
				.some((previous) => duplicateLabelIndex([previous, name]) !== null);
			return repeated ? "Já existe uma etapa com esse nome." : null;
		}),
	};
}

export function hasFlowErrors(errors: FlowErrors): boolean {
	return errors.list !== null || errors.names.some((error) => error !== null);
}

export function flowPayload(draft: FlowDraft): { stages: DraftStage[] } {
	return {
		stages: draft.active.map((stage) => ({
			id: stage.id,
			name: stage.name.trim(),
		})),
	};
}

export type BoardItemView = {
	dueOn: string | null;
	id: string;
	kind: "custom" | "service";
	line: WorkLineView;
	position: number;
	productionStatus: ProductionStatus;
	reconciled: boolean;
	reservations: { reservedMicros: string; variantId: string }[];
	serviceOrderId: string;
	stageId: string | null;
	stageIds: string[] | null;
	suggestedStageIds: string[];
	version: number;
};

export type BoardColumn = {
	id: string;
	items: BoardItemView[];
	kind: "notStarted" | "ready" | "stage";
	label: string;
};

export function boardColumns(
	flow: readonly FlowStageView[],
	items: readonly BoardItemView[]
): BoardColumn[] {
	const inStage = (stageId: string) =>
		items.filter(
			(item) =>
				item.productionStatus === "inProgress" && item.stageId === stageId
		);
	const stages = flow
		.map(
			(stage): BoardColumn => ({
				id: stage.id,
				items: inStage(stage.id),
				kind: "stage",
				label: stage.active ? stage.name : `${stage.name} (oculta)`,
			})
		)
		.filter(
			(column, index) => flow[index]?.active === true || column.items.length > 0
		);
	return [
		{
			id: "a-iniciar",
			items: items.filter((item) => item.productionStatus === "notStarted"),
			kind: "notStarted",
			label: "A iniciar",
		},
		...stages,
		{
			id: "pronto",
			items: items.filter((item) => item.productionStatus === "ready"),
			kind: "ready",
			label: "Pronto",
		},
	];
}

export function boardTab(
	columns: readonly BoardColumn[],
	etapa: string | undefined
): string {
	if (etapa !== undefined && columns.some((column) => column.id === etapa)) {
		return etapa;
	}
	return columns.find((column) => column.items.length > 0)?.id ?? "a-iniciar";
}

export function boardDueLabel(dueOn: string | null): string {
	if (dueOn === null) {
		return "a combinar";
	}
	const [, month, day] = dueOn.split("-");
	return `prazo ${day}/${month}`;
}

export type ProductionAction =
	| { kind: "advance"; label: string }
	| { kind: "none" }
	| { kind: "ready" }
	| { kind: "reconcile" }
	| { kind: "start" }
	| { kind: "useFlow" };

export type ItemProduction = {
	back: boolean;
	label: string;
	next: ProductionAction;
	track: {
		current: number;
		stages: { id: string; label: string }[];
	} | null;
};

type ProductionItem = Pick<
	BoardItemView,
	"line" | "productionStatus" | "reconciled" | "stageId" | "stageIds"
> & { kind: WorkLineKind };

const readyStage = { id: "pronto", label: "Pronto" };

function nextAction(
	item: ProductionItem,
	nameOf: (id: string) => string
): ProductionAction {
	const next = advanceProduction(
		{
			stageId: item.stageId,
			stageIds: item.stageIds,
			status: item.productionStatus,
		},
		linePlannedMaterials(quoteLineOfText(item.line)).length > 0 &&
			!item.reconciled
	);
	if (next === null) {
		return { kind: "reconcile" };
	}
	return next.stageId === null
		? { kind: "ready" }
		: { kind: "advance", label: `Avançar para ${nameOf(next.stageId)}` };
}

export function itemProduction(
	item: ProductionItem,
	flowStages: readonly FlowStageView[] | null
): ItemProduction {
	if (item.kind === "material") {
		return {
			back: false,
			label: "Só entrega, sem produção",
			next: { kind: "none" },
			track: null,
		};
	}
	if (flowStages === null || item.stageIds === null) {
		return {
			back: false,
			label: "A iniciar",
			next: { kind: flowStages === null ? "useFlow" : "start" },
			track: null,
		};
	}
	const nameOf = (id: string) =>
		flowStages.find((stage) => stage.id === id)?.name ?? "";
	const { stageIds } = item;
	const stages = [
		...stageIds.map((id) => ({ id, label: nameOf(id) })),
		readyStage,
	];
	if (item.productionStatus === "ready" || item.stageId === null) {
		return {
			back: true,
			label: readyStage.label,
			next: { kind: "none" },
			track: { current: stageIds.length, stages },
		};
	}
	const current = stageIds.indexOf(item.stageId);
	return {
		back: true,
		label: nameOf(item.stageId),
		next: nextAction(item, nameOf),
		track: { current, stages },
	};
}

export function productionLate(
	item: {
		dueOn: string | null;
		kind: WorkLineKind;
		productionStatus: ProductionStatus;
	},
	today: string
): boolean {
	return (
		item.kind !== "material" &&
		item.productionStatus !== "ready" &&
		item.dueOn !== null &&
		item.dueOn < today
	);
}

export function productionBlocked(
	item: Pick<
		BoardItemView,
		"line" | "productionStatus" | "reconciled" | "reservations"
	> & {
		kind: WorkLineKind;
	}
): string | null {
	if (item.kind === "material" || item.productionStatus === "ready") {
		return null;
	}
	return (
		itemMaterials(item).find((row) => row.shortageMicros > 0n)?.label ?? null
	);
}

export function productionOpKey(
	itemId: string,
	action: "advance" | "back" | "start",
	baseVersion: number,
	stageIds: readonly string[] = []
): string {
	const key = `${itemId}:${action}:${baseVersion}`;
	return action === "start" ? `${key}:${stageIds.join(",")}` : key;
}

export const staleItemMessage =
	"Este subitem mudou em outra janela. Confira e tente de novo.";

export function productionFailureMessage(failure: {
	kind: "anonymized" | "exists" | "other" | "stale";
	message: string;
}): string {
	return failure.kind === "stale" ? staleItemMessage : failure.message;
}

export function flowAdoptionOpKey(
	serviceOrderId: string,
	baseVersion: number
): string {
	return `${serviceOrderId}:adoptCurrentFlow:${baseVersion}`;
}

export type ProductionTarget = { id: string; version: number };

type OpIdFor = (key: string) => string;

export function productionStepInput(
	item: ProductionTarget,
	action: "advance" | "back",
	opIdFor: OpIdFor
): { baseVersion: number; itemId: string; opId: string } {
	return {
		baseVersion: item.version,
		itemId: item.id,
		opId: opIdFor(productionOpKey(item.id, action, item.version)),
	};
}

export function productionStartInput(
	item: ProductionTarget,
	stageIds: readonly string[],
	opIdFor: OpIdFor
): { baseVersion: number; itemId: string; opId: string; stageIds: string[] } {
	return {
		baseVersion: item.version,
		itemId: item.id,
		opId: opIdFor(productionOpKey(item.id, "start", item.version, stageIds)),
		stageIds: [...stageIds],
	};
}

export function flowAdoptionInput(
	order: ProductionTarget,
	opIdFor: OpIdFor
): { baseVersion: number; opId: string; serviceOrderId: string } {
	return {
		baseVersion: order.version,
		opId: opIdFor(flowAdoptionOpKey(order.id, order.version)),
		serviceOrderId: order.id,
	};
}

export const unchangedItemMessage =
	"Nada mudou: este subitem ou o fluxo da OS mudou em outra janela. Confira e tente de novo.";

export function productionOutcome(
	result: { version: number },
	baseVersion: number
): "applied" | "unchanged" {
	return result.version === baseVersion ? "unchanged" : "applied";
}

export function serviceOrderFlow(
	serviceOrder: { flowVersion: number | null },
	currentFlowVersion: number | null
): { action: string | null; text: string } {
	const { flowVersion } = serviceOrder;
	if (flowVersion === null) {
		return {
			action:
				currentFlowVersion === null
					? null
					: `Usar o fluxo v${currentFlowVersion}`,
			text: "Esta OS é anterior ao fluxo de produção.",
		};
	}
	return {
		action:
			currentFlowVersion !== null && flowVersion < currentFlowVersion
				? `Usar a versão nova (v${currentFlowVersion})`
				: null,
		text: `Fluxo de produção v${flowVersion}`,
	};
}

export function startStageIds(
	flowStages: readonly FlowStageView[],
	chosen: readonly string[]
): string[] {
	return (
		startProduction(
			{ stageId: null, stageIds: null, status: "notStarted" },
			flowStages,
			chosen
		)?.stageIds ?? []
	);
}

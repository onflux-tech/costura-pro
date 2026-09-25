export const productionLimits = {
	activeStages: { max: 12, min: 1 },
	stageName: { max: 30, min: 1 },
} as const;

export const initialProductionStages = [
	"Corte",
	"Montagem",
	"Prova",
	"Acabamento",
] as const;

export const productionStatuses = [
	"notStarted",
	"inProgress",
	"ready",
] as const;

export type ProductionStatus = (typeof productionStatuses)[number];

export type FlowStage = { active: boolean; id: string; name: string };

export type SentFlowStage = { id: string; name: string };

export type ProductionState = {
	stageId: string | null;
	stageIds: string[] | null;
	status: ProductionStatus;
};

export function mergeFlowStages(
	current: readonly FlowStage[],
	sent: readonly SentFlowStage[]
): FlowStage[] {
	const sentIds = new Set(sent.map((stage) => stage.id));
	return [
		...sent.map(({ id, name }) => ({ active: true, id, name })),
		...current
			.filter((stage) => !sentIds.has(stage.id))
			.map((stage) => ({ ...stage, active: false })),
	];
}

export function sameFlowStages(
	a: readonly FlowStage[],
	b: readonly FlowStage[]
): boolean {
	return (
		a.length === b.length &&
		a.every((stage, index) => {
			const other = b[index];
			return (
				other !== undefined &&
				stage.id === other.id &&
				stage.name === other.name &&
				stage.active === other.active
			);
		})
	);
}

export function startProduction(
	state: ProductionState,
	flowStages: readonly FlowStage[],
	chosen: readonly string[]
): ProductionState | null {
	if (state.status !== "notStarted") {
		return null;
	}
	const chosenIds = new Set(chosen);
	const stageIds = flowStages
		.filter((stage) => stage.active && chosenIds.has(stage.id))
		.map((stage) => stage.id);
	const [first] = stageIds;
	if (first === undefined) {
		return null;
	}
	return { stageId: first, stageIds, status: "inProgress" };
}

export function advanceProduction(
	state: ProductionState,
	hasPlannedMaterials: boolean
): ProductionState | null {
	if (
		state.status !== "inProgress" ||
		state.stageIds === null ||
		state.stageId === null
	) {
		return null;
	}
	const next = state.stageIds[state.stageIds.indexOf(state.stageId) + 1];
	if (next !== undefined) {
		return { ...state, stageId: next };
	}
	if (hasPlannedMaterials) {
		return null;
	}
	return { stageId: null, stageIds: state.stageIds, status: "ready" };
}

export function backProduction(state: ProductionState): ProductionState | null {
	if (state.stageIds === null) {
		return null;
	}
	if (state.status === "ready") {
		const last = state.stageIds.at(-1);
		return last === undefined
			? null
			: { stageId: last, stageIds: state.stageIds, status: "inProgress" };
	}
	if (state.status !== "inProgress" || state.stageId === null) {
		return null;
	}
	const previous = state.stageIds[state.stageIds.indexOf(state.stageId) - 1];
	if (previous === undefined) {
		return { stageId: null, stageIds: null, status: "notStarted" };
	}
	return { ...state, stageId: previous };
}

export function suggestedStageIds(
	flowStages: readonly FlowStage[],
	suggestions: readonly (readonly string[])[]
): string[] {
	const suggested = new Set(suggestions.flat());
	const active = flowStages.filter((stage) => stage.active);
	const chosen = active.filter((stage) => suggested.has(stage.id));
	return (chosen.length > 0 ? chosen : active).map((stage) => stage.id);
}

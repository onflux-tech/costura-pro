import { describe, expect, test } from "bun:test";

import {
	advanceProduction,
	backProduction,
	type FlowStage,
	initialProductionStages,
	mergeFlowStages,
	type ProductionState,
	productionLimits,
	productionStatuses,
	sameFlowStages,
	startProduction,
	suggestedStageIds,
} from "./production";

const cut = "c0000000-0000-4000-8000-000000000001";
const assembly = "c0000000-0000-4000-8000-000000000002";
const fitting = "c0000000-0000-4000-8000-000000000003";
const finishing = "c0000000-0000-4000-8000-000000000004";
const pressing = "c0000000-0000-4000-8000-000000000005";
const stranger = "c0000000-0000-4000-8000-000000000009";

const v1: FlowStage[] = [
	{ active: true, id: cut, name: "Corte" },
	{ active: true, id: assembly, name: "Montagem" },
	{ active: true, id: fitting, name: "Prova" },
	{ active: true, id: finishing, name: "Acabamento" },
];

const v2 = mergeFlowStages(v1, [
	{ id: cut, name: "Corte" },
	{ id: assembly, name: "Costura" },
	{ id: finishing, name: "Acabamento" },
	{ id: pressing, name: "Passadoria" },
]);

const notStarted: ProductionState = {
	stageId: null,
	stageIds: null,
	status: "notStarted",
};

function inProgress(stageIds: string[], stageId: string): ProductionState {
	return { stageId, stageIds, status: "inProgress" };
}

function ready(stageIds: string[]): ProductionState {
	return { stageId: null, stageIds, status: "ready" };
}

describe("constantes de produção", () => {
	test("limites, etapas iniciais e estados", () => {
		expect(productionLimits).toEqual({
			activeStages: { max: 12, min: 1 },
			stageName: { max: 30, min: 1 },
		});
		expect(initialProductionStages).toEqual([
			"Corte",
			"Montagem",
			"Prova",
			"Acabamento",
		]);
		expect(productionStatuses).toEqual(["notStarted", "inProgress", "ready"]);
	});
});

describe("mergeFlowStages", () => {
	test("as enviadas ficam ativas na ordem e as ausentes ficam ocultas depois", () => {
		expect(v2).toEqual([
			{ active: true, id: cut, name: "Corte" },
			{ active: true, id: assembly, name: "Costura" },
			{ active: true, id: finishing, name: "Acabamento" },
			{ active: true, id: pressing, name: "Passadoria" },
			{ active: false, id: fitting, name: "Prova" },
		]);
	});

	test("reativa uma oculta e oculta as que não vieram, na ordem atual", () => {
		expect(
			mergeFlowStages(v2, [
				{ id: fitting, name: "Prova" },
				{ id: cut, name: "Corte" },
			])
		).toEqual([
			{ active: true, id: fitting, name: "Prova" },
			{ active: true, id: cut, name: "Corte" },
			{ active: false, id: assembly, name: "Costura" },
			{ active: false, id: finishing, name: "Acabamento" },
			{ active: false, id: pressing, name: "Passadoria" },
		]);
	});
});

describe("sameFlowStages", () => {
	test("cópia igual é a mesma lista", () => {
		expect(
			sameFlowStages(
				v1,
				v1.map((stage) => ({ ...stage }))
			)
		).toBe(true);
	});

	test("nome, ativa, ordem ou tamanho diferentes mudam a lista", () => {
		expect(
			sameFlowStages(
				v1,
				v1.map((stage) =>
					stage.id === assembly ? { ...stage, name: "Costura" } : stage
				)
			)
		).toBe(false);
		expect(
			sameFlowStages(
				v1,
				v1.map((stage) =>
					stage.id === fitting ? { ...stage, active: false } : stage
				)
			)
		).toBe(false);
		expect(sameFlowStages(v1, [...v1].reverse())).toBe(false);
		expect(sameFlowStages(v1, v1.slice(0, -1))).toBe(false);
	});
});

describe("startProduction", () => {
	test("aplicáveis seguem a ordem do fluxo e a atual é a primeira", () => {
		expect(startProduction(notStarted, v1, [finishing, cut])).toEqual(
			inProgress([cut, finishing], cut)
		);
	});

	test("ignora etapa oculta no fluxo", () => {
		expect(startProduction(notStarted, v2, [fitting, cut])).toEqual(
			inProgress([cut], cut)
		);
	});

	test("sem efeito sem aplicáveis ou fora de a iniciar", () => {
		expect(startProduction(notStarted, v1, [stranger])).toBeNull();
		expect(startProduction(notStarted, [], [cut])).toBeNull();
		expect(startProduction(inProgress([cut], cut), v1, [cut])).toBeNull();
		expect(startProduction(ready([cut]), v1, [cut])).toBeNull();
	});
});

describe("advanceProduction", () => {
	test("anda para a etapa seguinte", () => {
		expect(
			advanceProduction(
				inProgress([cut, assembly, fitting, finishing], cut),
				false
			)
		).toEqual(inProgress([cut, assembly, fitting, finishing], assembly));
	});

	test("na última sem material planejado fica pronto", () => {
		expect(
			advanceProduction(inProgress([fitting, finishing], finishing), false)
		).toEqual(ready([fitting, finishing]));
	});

	test("na última com material planejado não tem efeito", () => {
		expect(
			advanceProduction(inProgress([cut, assembly, finishing], finishing), true)
		).toBeNull();
	});

	test("sem efeito em a iniciar e pronto", () => {
		expect(advanceProduction(notStarted, false)).toBeNull();
		expect(advanceProduction(ready([fitting, finishing]), false)).toBeNull();
	});
});

describe("backProduction", () => {
	test("volta para a etapa anterior", () => {
		expect(
			backProduction(inProgress([cut, assembly, fitting, finishing], assembly))
		).toEqual(inProgress([cut, assembly, fitting, finishing], cut));
	});

	test("na primeira volta a a iniciar", () => {
		expect(backProduction(inProgress([fitting, finishing], fitting))).toEqual(
			notStarted
		);
	});

	test("de pronto volta à última etapa", () => {
		expect(backProduction(ready([fitting, finishing]))).toEqual(
			inProgress([fitting, finishing], finishing)
		);
	});

	test("sem efeito em a iniciar", () => {
		expect(backProduction(notStarted)).toBeNull();
	});
});

describe("suggestedStageIds", () => {
	test("união das sugestões na ordem do fluxo", () => {
		expect(suggestedStageIds(v1, [[fitting, finishing]])).toEqual([
			fitting,
			finishing,
		]);
		expect(suggestedStageIds(v1, [[finishing], [cut, fitting]])).toEqual([
			cut,
			fitting,
			finishing,
		]);
	});

	test("sem sugestão vale todas as ativas", () => {
		expect(suggestedStageIds(v1, [])).toEqual([
			cut,
			assembly,
			fitting,
			finishing,
		]);
		expect(suggestedStageIds(v1, [[]])).toEqual([
			cut,
			assembly,
			fitting,
			finishing,
		]);
	});

	test("filtra às ativas e cai em todas quando nada sobra", () => {
		expect(suggestedStageIds(v2, [[fitting, finishing]])).toEqual([finishing]);
		expect(suggestedStageIds(v2, [[fitting]])).toEqual([
			cut,
			assembly,
			finishing,
			pressing,
		]);
		expect(suggestedStageIds(v1, [[stranger, finishing]])).toEqual([finishing]);
	});
});

describe("produção de ponta a ponta", () => {
	test("serviço anda até pronto e volta; peça com material para na última", () => {
		const service = startProduction(notStarted, v1, [fitting, finishing]);
		expect(service).toEqual(inProgress([fitting, finishing], fitting));
		const serviceAtFinishing = advanceProduction(
			service as ProductionState,
			false
		);
		expect(serviceAtFinishing).toEqual(
			inProgress([fitting, finishing], finishing)
		);
		const serviceReady = advanceProduction(
			serviceAtFinishing as ProductionState,
			false
		);
		expect(serviceReady).toEqual(ready([fitting, finishing]));
		expect(backProduction(serviceReady as ProductionState)).toEqual(
			inProgress([fitting, finishing], finishing)
		);

		const piece = startProduction(notStarted, v1, [cut, assembly, finishing]);
		expect(piece).toEqual(inProgress([cut, assembly, finishing], cut));
		const pieceAtAssembly = advanceProduction(piece as ProductionState, true);
		expect(pieceAtAssembly).toEqual(
			inProgress([cut, assembly, finishing], assembly)
		);
		const pieceAtFinishing = advanceProduction(
			pieceAtAssembly as ProductionState,
			true
		);
		expect(pieceAtFinishing).toEqual(
			inProgress([cut, assembly, finishing], finishing)
		);
		expect(
			advanceProduction(pieceAtFinishing as ProductionState, true)
		).toBeNull();
	});
});

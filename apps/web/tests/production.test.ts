import { describe, expect, test } from "bun:test";
import { commandMessages } from "@costura-pro/api/command-messages";
import {
	advanceProduction,
	mergeFlowStages,
	type ProductionState,
	sameFlowStages,
	startProduction,
} from "@costura-pro/domain/production";

import {
	addStage,
	type BoardItemView,
	boardColumns,
	boardDueLabel,
	boardTab,
	type FlowDraft,
	type FlowStageView,
	flowAdoptionInput,
	flowAdoptionOpKey,
	flowChanged,
	flowDraftOf,
	flowErrors,
	flowPayload,
	hasFlowErrors,
	hideStage,
	itemProduction,
	moveStage,
	type ProductionAction,
	productionBlocked,
	productionFailureMessage,
	productionLate,
	productionOpKey,
	productionOutcome,
	productionStartInput,
	productionStepInput,
	renameStage,
	serviceOrderFlow,
	showStage,
	staleItemMessage,
	startStageIds,
	unchangedItemMessage,
} from "../src/lib/production";
import type { FrozenLineView, QuoteLineView } from "../src/lib/quotes";
import type { WorkLineView } from "../src/lib/service-orders";

const cut = "c0000000-0000-4000-8000-000000000001";
const assembly = "c0000000-0000-4000-8000-000000000002";
const fitting = "c0000000-0000-4000-8000-000000000003";
const finishing = "c0000000-0000-4000-8000-000000000004";
const pressing = "c0000000-0000-4000-8000-000000000005";

const id = (n: number) =>
	`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const crepe = id(81);
const zipper = id(89);

const v1: FlowStageView[] = [
	{ active: true, id: cut, name: "Corte" },
	{ active: true, id: assembly, name: "Montagem" },
	{ active: true, id: fitting, name: "Prova" },
	{ active: true, id: finishing, name: "Acabamento" },
];

const v2: FlowStageView[] = mergeFlowStages(v1, [
	{ id: cut, name: "Corte" },
	{ id: assembly, name: "Costura" },
	{ id: finishing, name: "Acabamento" },
	{ id: pressing, name: "Passadoria" },
]);

function frozen(line: QuoteLineView): WorkLineView {
	const result: FrozenLineView = {
		...line,
		costCents: null,
		discountCents: "0",
		grossCents: "0",
		totalCents: "0",
	};
	if (result.kind === "free") {
		throw new Error("linha livre não é trabalho");
	}
	return result;
}

const serviceLine = frozen({
	catalogPriceCents: "16000",
	discount: null,
	estimatedMinutes: 90,
	id: id(1),
	kind: "service",
	note: null,
	outsourced: false,
	profileId: id(50),
	quantity: 1,
	receivedItemId: null,
	serviceId: id(70),
	serviceName: "Ajuste de cava",
	serviceVersion: 1,
	unitCostCents: "6000",
	unitPriceCents: "16000",
});

const pieceLine = frozen({
	components: [
		{
			baseUnit: "m",
			code: "CRP-PT",
			displayPrecision: 2,
			id: id(11),
			kind: "material",
			materialName: "Crepe",
			materialVariantId: crepe,
			quantityMicros: "3400000",
			unitCostCents: "3000",
			variantName: "Preto",
		},
		{
			baseUnit: "un",
			code: null,
			displayPrecision: 0,
			id: id(12),
			kind: "material",
			materialName: "Zíper",
			materialVariantId: zipper,
			quantityMicros: "1000000",
			unitCostCents: "370",
			variantName: "20 cm",
		},
	],
	description: "Vestido de festa",
	discount: null,
	id: id(2),
	kind: "custom",
	note: null,
	profileId: id(50),
	quantity: 1,
	source: null,
	unitPriceCents: "98000",
});

const materialLine = frozen({
	baseUnit: "un",
	code: null,
	discount: null,
	displayPrecision: 0,
	id: id(3),
	kind: "material",
	materialName: "Zíper",
	materialVariantId: zipper,
	note: null,
	quantityMicros: "2000000",
	unitCostCents: "370",
	unitPriceCents: "800",
	variantName: "20 cm",
});

const shortReservations = [
	{ reservedMicros: "1500000", variantId: crepe },
	{ reservedMicros: "1000000", variantId: zipper },
];

const fullReservations = [
	{ reservedMicros: "3400000", variantId: crepe },
	{ reservedMicros: "1000000", variantId: zipper },
];

function card(
	n: number,
	overrides: Partial<BoardItemView> = {}
): BoardItemView {
	return {
		dueOn: "2026-10-12",
		id: id(800 + n),
		kind: "service",
		line: serviceLine,
		position: 0,
		productionStatus: "notStarted",
		reservations: [],
		serviceOrderId: id(600),
		stageId: null,
		stageIds: null,
		suggestedStageIds: [fitting, finishing],
		version: 1,
		...overrides,
	};
}

function draftOf(names: string[]): FlowDraft {
	return {
		active: names.map((name, index) => ({ id: id(900 + index), name })),
		hidden: [],
	};
}

describe("rascunho do fluxo", () => {
	test("separa ativas e ocultas na ordem da lista", () => {
		expect(flowDraftOf(v2)).toEqual({
			active: [
				{ id: cut, name: "Corte" },
				{ id: assembly, name: "Costura" },
				{ id: finishing, name: "Acabamento" },
				{ id: pressing, name: "Passadoria" },
			],
			hidden: [{ id: fitting, name: "Prova" }],
		});
	});

	test("renomeia, sobe e desce uma etapa", () => {
		const draft = flowDraftOf(v2);
		expect(renameStage(draft, 1, "Montagem").active[1]).toEqual({
			id: assembly,
			name: "Montagem",
		});
		expect(moveStage(draft, 1, -1).active.map((stage) => stage.id)).toEqual([
			assembly,
			cut,
			finishing,
			pressing,
		]);
		expect(moveStage(draft, 1, 1).active.map((stage) => stage.id)).toEqual([
			cut,
			finishing,
			assembly,
			pressing,
		]);
		expect(moveStage(draft, 0, -1).active.map((stage) => stage.id)).toEqual([
			cut,
			assembly,
			finishing,
			pressing,
		]);
		expect(draft.active[1]?.name).toBe("Costura");
	});

	test("oculta na ordem que o servidor grava, mostra no fim das ativas e acrescenta vazia", () => {
		const hidden = hideStage(flowDraftOf(v2), 0, v2);
		expect(hidden).toEqual({
			active: [
				{ id: assembly, name: "Costura" },
				{ id: finishing, name: "Acabamento" },
				{ id: pressing, name: "Passadoria" },
			],
			hidden: [
				{ id: cut, name: "Corte" },
				{ id: fitting, name: "Prova" },
			],
		});
		expect(showStage(hidden, fitting)).toEqual({
			active: [
				{ id: assembly, name: "Costura" },
				{ id: finishing, name: "Acabamento" },
				{ id: pressing, name: "Passadoria" },
				{ id: fitting, name: "Prova" },
			],
			hidden: [{ id: cut, name: "Corte" }],
		});
		expect(addStage(flowDraftOf(v1), pressing).active).toEqual([
			{ id: cut, name: "Corte" },
			{ id: assembly, name: "Montagem" },
			{ id: fitting, name: "Prova" },
			{ id: finishing, name: "Acabamento" },
			{ id: pressing, name: "" },
		]);
	});

	test("mudança pelos ids e nomes aparados das ativas", () => {
		const draft = flowDraftOf(v1);
		expect(flowChanged(v1, draft)).toBe(false);
		expect(flowChanged(v1, renameStage(draft, 1, "Costura"))).toBe(true);
		expect(flowChanged(v1, renameStage(draft, 1, "Montagem "))).toBe(false);
		expect(flowChanged(v1, moveStage(draft, 1, 1))).toBe(true);
		expect(flowChanged(v1, hideStage(draft, 2, v1))).toBe(true);
		expect(flowChanged(v1, addStage(draft, pressing))).toBe(true);
		expect(flowChanged(v2, flowDraftOf(v2))).toBe(false);
	});

	test("ocultar etapa salva mostra o nome salvo, e Mostrar traz o nome salvo de volta", () => {
		const renamed = hideStage(
			renameStage(flowDraftOf(v1), 2, "Prova final"),
			2,
			v1
		);
		expect(renamed.hidden).toEqual([{ id: fitting, name: "Prova" }]);
		expect(
			hideStage(renameStage(flowDraftOf(v1), 2, ""), 2, v1).hidden
		).toEqual([{ id: fitting, name: "Prova" }]);
		expect(showStage(renamed, fitting).active.at(-1)).toEqual({
			id: fitting,
			name: "Prova",
		});
	});

	test("ocultar etapa nova ainda não salva tira a etapa do rascunho", () => {
		expect(hideStage(addStage(flowDraftOf(v1), pressing), 4, v1)).toEqual(
			flowDraftOf(v1)
		);
	});

	test("o rascunho mostra o que o servidor grava", () => {
		const drafts: [FlowStageView[], FlowDraft][] = [
			[v1, hideStage(renameStage(flowDraftOf(v1), 2, "Prova final"), 2, v1)],
			[v2, hideStage(renameStage(flowDraftOf(v2), 0, "Corte reto"), 0, v2)],
			[
				v1,
				hideStage(
					hideStage(
						renameStage(moveStage(flowDraftOf(v1), 3, -1), 3, ""),
						3,
						v1
					),
					0,
					v1
				),
			],
		];
		for (const [saved, draft] of drafts) {
			expect(
				flowDraftOf(mergeFlowStages(saved, flowPayload(draft).stages))
			).toEqual(draft);
		}
	});

	test("mudança é o que o servidor gravaria como versão nova", () => {
		const middle: FlowStageView[] = [
			{ active: true, id: cut, name: "Corte" },
			{ active: false, id: fitting, name: "Prova" },
			{ active: true, id: finishing, name: "Acabamento" },
		];
		const draft = flowDraftOf(v1);
		const cases: [FlowStageView[], FlowDraft][] = [
			[v1, draft],
			[v1, renameStage(draft, 1, "Costura")],
			[v1, renameStage(draft, 1, "Montagem ")],
			[v1, moveStage(draft, 1, 1)],
			[v1, hideStage(draft, 2, v1)],
			[v1, addStage(draft, pressing)],
			[v2, flowDraftOf(v2)],
			[v2, showStage(flowDraftOf(v2), fitting)],
			[middle, flowDraftOf(middle)],
		];
		for (const [saved, edited] of cases) {
			expect(flowChanged(saved, edited)).toBe(
				!sameFlowStages(
					saved,
					mergeFlowStages(saved, flowPayload(edited).stages)
				)
			);
		}
	});
});

describe("erros do fluxo", () => {
	test("nome repetido por acento, caixa ou espaço marca a repetida", () => {
		expect(flowErrors(draftOf(["Prova", " prova"]))).toEqual({
			list: null,
			names: [null, "Já existe uma etapa com esse nome."],
		});
		expect(flowErrors(draftOf(["Acabamento", "Corte", "acabaménto"]))).toEqual({
			list: null,
			names: [null, null, "Já existe uma etapa com esse nome."],
		});
		expect(
			flowErrors(draftOf(["Prova", "PROVA", "Corte", "prova  "])).names
		).toEqual([
			null,
			"Já existe uma etapa com esse nome.",
			null,
			"Já existe uma etapa com esse nome.",
		]);
	});

	test("nome vazio, só de espaços ou longo", () => {
		expect(flowErrors(draftOf(["   "])).names).toEqual(["Dê um nome à etapa."]);
		expect(flowErrors(draftOf([""])).names).toEqual(["Dê um nome à etapa."]);
		expect(flowErrors(draftOf(["a".repeat(31)])).names).toEqual([
			"Use até 30 caracteres.",
		]);
		expect(flowErrors(draftOf([` ${"a".repeat(30)} `])).names).toEqual([null]);
	});

	test("lista vazia ou acima de 12 etapas", () => {
		expect(flowErrors(draftOf([]))).toEqual({
			list: "Mantenha ao menos uma etapa.",
			names: [],
		});
		const thirteen = draftOf(
			Array.from({ length: 13 }, (_, index) => `Etapa ${index + 1}`)
		);
		expect(flowErrors(thirteen).list).toBe("Use até 12 etapas.");
		expect(
			flowErrors(
				draftOf(Array.from({ length: 12 }, (_, index) => `Etapa ${index + 1}`))
			).list
		).toBeNull();
	});

	test("o rascunho do fluxo gravado não tem erro", () => {
		const errors = flowErrors(flowDraftOf(v1));
		expect(errors).toEqual({ list: null, names: [null, null, null, null] });
		expect(hasFlowErrors(errors)).toBe(false);
		expect(hasFlowErrors(flowErrors(draftOf(["Prova", "prova"])))).toBe(true);
		expect(hasFlowErrors(flowErrors(draftOf([])))).toBe(true);
	});

	test("o payload leva só as ativas com o nome aparado", () => {
		const draft = renameStage(
			hideStage(flowDraftOf(v1), 2, v1),
			1,
			"  Costura "
		);
		expect(flowPayload(draft)).toEqual({
			stages: [
				{ id: cut, name: "Corte" },
				{ id: assembly, name: "Costura" },
				{ id: finishing, name: "Acabamento" },
			],
		});
	});
});

describe("colunas do quadro", () => {
	const waiting = card(1);
	const cutting = card(2, {
		productionStatus: "inProgress",
		stageId: cut,
		stageIds: [cut, finishing],
	});
	const done = card(3, {
		productionStatus: "ready",
		stageIds: [finishing],
	});
	const cutting2 = card(4, {
		productionStatus: "inProgress",
		stageId: cut,
		stageIds: [cut, assembly],
	});

	test("A iniciar, as ativas do fluxo e Pronto, com os cartões na ordem recebida", () => {
		const columns = boardColumns(v2, [cutting2, waiting, cutting, done]);
		expect(
			columns.map((column) => [column.id, column.kind, column.label])
		).toEqual([
			["a-iniciar", "notStarted", "A iniciar"],
			[cut, "stage", "Corte"],
			[assembly, "stage", "Costura"],
			[finishing, "stage", "Acabamento"],
			[pressing, "stage", "Passadoria"],
			["pronto", "ready", "Pronto"],
		]);
		expect(
			columns.map((column) => column.items.map((item) => item.id))
		).toEqual([[waiting.id], [cutting2.id, cutting.id], [], [], [], [done.id]]);
	});

	test("etapa oculta aparece só com cartão, na posição dela na lista", () => {
		const proving = card(5, {
			productionStatus: "inProgress",
			stageId: fitting,
			stageIds: [fitting, finishing],
		});
		expect(
			boardColumns(v2, [waiting, proving]).map((column) => column.label)
		).toEqual([
			"A iniciar",
			"Corte",
			"Costura",
			"Acabamento",
			"Passadoria",
			"Prova (oculta)",
			"Pronto",
		]);
		const middle: FlowStageView[] = [
			{ active: true, id: cut, name: "Corte" },
			{ active: true, id: assembly, name: "Costura" },
			{ active: false, id: fitting, name: "Prova" },
			{ active: true, id: finishing, name: "Acabamento" },
		];
		const columns = boardColumns(middle, [proving]);
		expect(columns.map((column) => column.label)).toEqual([
			"A iniciar",
			"Corte",
			"Costura",
			"Prova (oculta)",
			"Acabamento",
			"Pronto",
		]);
		expect(columns[3]?.items.map((item) => item.id)).toEqual([proving.id]);
		const namesake = mergeFlowStages(v1, [
			{ id: cut, name: "Corte" },
			{ id: assembly, name: "Montagem" },
			{ id: pressing, name: "Prova" },
			{ id: finishing, name: "Acabamento" },
		]);
		expect(
			boardColumns(namesake, [proving]).map((column) => column.label)
		).toEqual([
			"A iniciar",
			"Corte",
			"Montagem",
			"Prova",
			"Acabamento",
			"Prova (oculta)",
			"Pronto",
		]);
		expect(
			boardColumns(middle, [waiting]).map((column) => column.label)
		).toEqual(["A iniciar", "Corte", "Costura", "Acabamento", "Pronto"]);
	});
});

describe("aba e prazo do quadro", () => {
	const waiting = card(1);
	const cutting = card(2, {
		productionStatus: "inProgress",
		stageId: cut,
		stageIds: [cut, finishing],
	});

	test("a aba da URL vale só quando a coluna existe", () => {
		const columns = boardColumns(v2, [waiting, cutting]);
		expect(boardTab(columns, cut)).toBe(cut);
		expect(boardTab(columns, "pronto")).toBe("pronto");
		expect(boardTab(columns, fitting)).toBe("a-iniciar");
		expect(boardTab(columns, "qualquer")).toBe("a-iniciar");
	});

	test("sem aba na URL abre a primeira coluna com cartão, ou A iniciar", () => {
		expect(boardTab(boardColumns(v2, [cutting]), undefined)).toBe(cut);
		expect(boardTab(boardColumns(v2, [waiting, cutting]), undefined)).toBe(
			"a-iniciar"
		);
		expect(boardTab(boardColumns(v2, []), undefined)).toBe("a-iniciar");
		expect(boardTab(boardColumns(v2, [cutting]), fitting)).toBe(cut);
	});

	test("prazo em dia e mês, ou a combinar", () => {
		expect(boardDueLabel("2026-10-02")).toBe("prazo 02/10");
		expect(boardDueLabel(null)).toBe("a combinar");
	});
});

describe("produção do subitem", () => {
	test("material fica só na entrega", () => {
		expect(
			itemProduction(
				{
					kind: "material",
					line: materialLine,
					productionStatus: "notStarted",
					stageId: null,
					stageIds: null,
				},
				v1
			)
		).toEqual({
			back: false,
			label: "Só entrega, sem produção",
			next: { kind: "none" },
			track: null,
		});
	});

	test("OS sem fluxo oferece usar o fluxo, e a iniciar oferece iniciar", () => {
		expect(itemProduction(card(1), null)).toEqual({
			back: false,
			label: "A iniciar",
			next: { kind: "useFlow" },
			track: null,
		});
		expect(itemProduction(card(1), v1)).toEqual({
			back: false,
			label: "A iniciar",
			next: { kind: "start" },
			track: null,
		});
	});

	test("em etapa mostra a trilha das aplicáveis e avança para a próxima", () => {
		expect(
			itemProduction(
				card(1, {
					productionStatus: "inProgress",
					stageId: fitting,
					stageIds: [fitting, finishing],
				}),
				v1
			)
		).toEqual({
			back: true,
			label: "Prova",
			next: { kind: "advance", label: "Avançar para Acabamento" },
			track: {
				current: 0,
				stages: [
					{ id: fitting, label: "Prova" },
					{ id: finishing, label: "Acabamento" },
					{ id: "pronto", label: "Pronto" },
				],
			},
		});
	});

	test("na última etapa, pronto sem material e barrado com material", () => {
		const service = itemProduction(
			card(1, {
				productionStatus: "inProgress",
				stageId: finishing,
				stageIds: [fitting, finishing],
			}),
			v1
		);
		expect(service.next).toEqual({ kind: "ready" });
		expect(service.track?.current).toBe(1);
		const piece = itemProduction(
			card(2, {
				kind: "custom",
				line: pieceLine,
				productionStatus: "inProgress",
				reservations: fullReservations,
				stageId: finishing,
				stageIds: [cut, assembly, finishing],
			}),
			v1
		);
		expect(piece.next).toEqual({ kind: "blocked" });
		expect(piece.label).toBe("Acabamento");
		expect(piece.back).toBe(true);
	});

	test("pronto marca a última posição da trilha e só volta", () => {
		expect(
			itemProduction(
				card(1, { productionStatus: "ready", stageIds: [fitting, finishing] }),
				v1
			)
		).toEqual({
			back: true,
			label: "Pronto",
			next: { kind: "none" },
			track: {
				current: 2,
				stages: [
					{ id: fitting, label: "Prova" },
					{ id: finishing, label: "Acabamento" },
					{ id: "pronto", label: "Pronto" },
				],
			},
		});
	});

	test("OS na versão velha mostra os nomes da própria versão", () => {
		const item = card(1, {
			productionStatus: "inProgress",
			stageId: assembly,
			stageIds: [cut, assembly, finishing],
		});
		const old = itemProduction(item, v1);
		expect(old.label).toBe("Montagem");
		expect(old.track?.stages.map((stage) => stage.label)).toEqual([
			"Corte",
			"Montagem",
			"Acabamento",
			"Pronto",
		]);
		expect(itemProduction(item, v2).label).toBe("Costura");
		expect(
			itemProduction(
				card(1, {
					productionStatus: "inProgress",
					stageId: cut,
					stageIds: [cut, assembly],
				}),
				v1
			).next
		).toEqual({ kind: "advance", label: "Avançar para Montagem" });
	});
});

describe("atraso e bloqueio", () => {
	test("atrasado é o subitem de produção não pronto com prazo antes de hoje", () => {
		const today = "2026-10-11";
		expect(productionLate(card(1, { dueOn: "2026-10-10" }), today)).toBe(true);
		expect(
			productionLate(
				card(1, {
					dueOn: "2026-10-10",
					productionStatus: "inProgress",
					stageId: cut,
					stageIds: [cut],
				}),
				today
			)
		).toBe(true);
		expect(productionLate(card(1, { dueOn: "2026-10-11" }), today)).toBe(false);
		expect(
			productionLate(
				card(1, {
					dueOn: "2026-10-10",
					productionStatus: "ready",
					stageIds: [cut],
				}),
				today
			)
		).toBe(false);
		expect(
			productionLate(
				{
					dueOn: "2026-10-10",
					kind: "material",
					productionStatus: "notStarted",
				},
				today
			)
		).toBe(false);
		expect(productionLate(card(1, { dueOn: null }), today)).toBe(false);
	});

	test("bloqueado pelo primeiro material em falta, fora do pronto e do material", () => {
		const piece = card(2, {
			kind: "custom",
			line: pieceLine,
			reservations: shortReservations,
		});
		expect(productionBlocked(piece)).toBe("Crepe · Preto");
		expect(
			productionBlocked({ ...piece, productionStatus: "inProgress" })
		).toBe("Crepe · Preto");
		expect(productionBlocked({ ...piece, productionStatus: "ready" })).toBe(
			null
		);
		expect(
			productionBlocked({ ...piece, reservations: fullReservations })
		).toBeNull();
		expect(
			productionBlocked({
				kind: "material",
				line: materialLine,
				productionStatus: "notStarted",
				reservations: [],
			})
		).toBeNull();
		expect(productionBlocked(card(1))).toBeNull();
	});
});

describe("chave e falha das ações", () => {
	test("a chave leva o subitem, a ação, a versão e as etapas do início", () => {
		expect(productionOpKey("i", "advance", 2)).toBe("i:advance:2");
		expect(productionOpKey("i", "back", 2)).toBe("i:back:2");
		expect(productionOpKey("i", "start", 1, [fitting, finishing])).toBe(
			`i:start:1:${fitting},${finishing}`
		);
		expect(productionOpKey("i", "advance", 3)).not.toBe(
			productionOpKey("i", "advance", 2)
		);
		expect(productionOpKey("i", "start", 1, [fitting])).not.toBe(
			productionOpKey("i", "start", 1, [fitting, finishing])
		);
		expect(productionOpKey("i", "advance", 2)).toBe(
			productionOpKey("i", "advance", 2)
		);
	});

	test("versão velha pede para conferir, o resto mostra a mensagem recebida", () => {
		expect(staleItemMessage).toBe(
			"Este subitem mudou em outra janela. Confira e tente de novo."
		);
		expect(
			productionFailureMessage({
				kind: "stale",
				message: commandMessages.staleVersion,
			})
		).toBe(staleItemMessage);
		expect(
			productionFailureMessage({
				kind: "other",
				message: commandMessages.productionItemNotFound,
			})
		).toBe(commandMessages.productionItemNotFound);
		expect(
			productionFailureMessage({
				kind: "exists",
				message: commandMessages.aggregateExists,
			})
		).toBe(commandMessages.aggregateExists);
	});
});

function recordedOpIds() {
	const keys: string[] = [];
	return {
		keys,
		opIdFor: (key: string) => {
			keys.push(key);
			return `op ${key}`;
		},
	};
}

describe("entrada das ações", () => {
	const item = { id: id(801), version: 2 };

	test("avançar e voltar mandam a versão-base e o opId da chave do subitem", () => {
		const { keys, opIdFor } = recordedOpIds();
		expect(productionStepInput(item, "advance", opIdFor)).toEqual({
			baseVersion: 2,
			itemId: item.id,
			opId: `op ${productionOpKey(item.id, "advance", 2)}`,
		});
		expect(productionStepInput(item, "back", opIdFor).opId).toBe(
			`op ${productionOpKey(item.id, "back", 2)}`
		);
		expect(keys).toEqual([
			productionOpKey(item.id, "advance", 2),
			productionOpKey(item.id, "back", 2),
		]);
	});

	test("iniciar manda as etapas e o opId da chave com elas", () => {
		const { opIdFor } = recordedOpIds();
		expect(productionStartInput(item, [fitting, finishing], opIdFor)).toEqual({
			baseVersion: 2,
			itemId: item.id,
			opId: `op ${productionOpKey(item.id, "start", 2, [fitting, finishing])}`,
			stageIds: [fitting, finishing],
		});
	});

	test("usar o fluxo vigente manda a OS, a versão e o opId da chave da OS", () => {
		const { opIdFor } = recordedOpIds();
		const order = { id: id(600), version: 3 };
		expect(flowAdoptionInput(order, opIdFor)).toEqual({
			baseVersion: 3,
			opId: `op ${flowAdoptionOpKey(order.id, 3)}`,
			serviceOrderId: order.id,
		});
	});

	test("a mesma ação na mesma versão repete a chave, e versão, ação ou subitem novos trocam", () => {
		const { keys, opIdFor } = recordedOpIds();
		productionStepInput(item, "advance", opIdFor);
		productionStepInput(item, "advance", opIdFor);
		productionStepInput({ ...item, version: 3 }, "advance", opIdFor);
		productionStepInput(item, "back", opIdFor);
		productionStepInput({ id: id(802), version: 2 }, "advance", opIdFor);
		productionStartInput(item, [fitting], opIdFor);
		productionStartInput(item, [fitting], opIdFor);
		productionStartInput(item, [fitting, finishing], opIdFor);
		expect(keys[0]).toBe(keys[1]);
		expect(keys[5]).toBe(keys[6]);
		expect(new Set(keys).size).toBe(keys.length - 2);
	});
});

describe("resposta das ações do subitem", () => {
	test("versão nova é sucesso, e a mesma versão enviada é sem efeito", () => {
		expect(productionOutcome({ version: 3 }, 2)).toBe("applied");
		expect(productionOutcome({ version: 2 }, 2)).toBe("unchanged");
		expect(unchangedItemMessage).toBe(
			"Nada mudou: este subitem ou o fluxo da OS mudou em outra janela. Confira e tente de novo."
		);
	});
});

describe("fluxo da OS", () => {
	test("a chave da troca de fluxo leva a OS e a versão dela", () => {
		expect(flowAdoptionOpKey("o", 3)).toBe("o:adoptCurrentFlow:3");
		expect(flowAdoptionOpKey("o", 4)).not.toBe(flowAdoptionOpKey("o", 3));
	});

	test("OS na versão vigente mostra só a versão", () => {
		expect(serviceOrderFlow({ flowVersion: 2 }, 2)).toEqual({
			action: null,
			text: "Fluxo de produção v2",
		});
	});

	test("OS numa versão velha oferece a versão nova", () => {
		expect(serviceOrderFlow({ flowVersion: 1 }, 3)).toEqual({
			action: "Usar a versão nova (v3)",
			text: "Fluxo de produção v1",
		});
	});

	test("OS anterior ao fluxo oferece o fluxo vigente", () => {
		expect(serviceOrderFlow({ flowVersion: null }, 1)).toEqual({
			action: "Usar o fluxo v1",
			text: "Esta OS é anterior ao fluxo de produção.",
		});
	});
});

describe("etapas do início", () => {
	test("ficam as ativas do fluxo, na ordem do fluxo, sem oculta nem estranha", () => {
		const strange = "c0000000-0000-4000-8000-000000000009";
		expect(
			startStageIds(v2, [pressing, fitting, strange, finishing, cut])
		).toEqual([cut, finishing, pressing]);
	});

	test("sem escolha nenhuma a lista fica vazia", () => {
		expect(startStageIds(v1, [])).toEqual([]);
	});

	test("seguem o início do domínio", () => {
		const strange = "c0000000-0000-4000-8000-000000000009";
		const notStarted: ProductionState = {
			stageId: null,
			stageIds: null,
			status: "notStarted",
		};
		const choices = [
			[],
			[strange],
			[fitting],
			[pressing, fitting, strange, finishing, cut],
			[finishing, assembly, cut],
		];
		for (const flow of [v1, v2]) {
			for (const chosen of choices) {
				expect(startStageIds(flow, chosen)).toEqual(
					startProduction(notStarted, flow, chosen)?.stageIds ?? []
				);
			}
		}
	});
});

describe("próxima ação do subitem", () => {
	const nameOf = (stageId: string) =>
		v1.find((stage) => stage.id === stageId)?.name ?? "";

	function domainNext(next: ProductionState | null): ProductionAction {
		if (next === null) {
			return { kind: "blocked" };
		}
		return next.stageId === null
			? { kind: "ready" }
			: { kind: "advance", label: `Avançar para ${nameOf(next.stageId)}` };
	}

	test("segue o avanço do domínio em cada etapa, com e sem material", () => {
		const lines = [
			{ kind: "service" as const, line: serviceLine },
			{ kind: "custom" as const, line: pieceLine },
		];
		const lists = [[fitting, finishing], [cut], [cut, assembly, finishing]];
		const cases = lines.flatMap(({ kind, line }) =>
			lists.flatMap((stageIds) =>
				stageIds.map((stageId) => ({ kind, line, stageId, stageIds }))
			)
		);
		for (const { kind, line, stageId, stageIds } of cases) {
			const state: ProductionState = {
				stageId,
				stageIds,
				status: "inProgress",
			};
			expect(
				itemProduction(
					card(1, {
						kind,
						line,
						productionStatus: "inProgress",
						stageId,
						stageIds,
					}),
					v1
				).next
			).toEqual(domainNext(advanceProduction(state, kind === "custom")));
		}
	});
});

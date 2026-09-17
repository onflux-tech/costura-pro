import { describe, expect, test } from "bun:test";

import {
	blockingError,
	changedMeasurement,
	changedTemplate,
	compareMeasurements,
	correctionFields,
	currentByTemplate,
	defaultTemplateId,
	describeDelta,
	draftFields,
	fieldDelta,
	formatDay,
	historyOf,
	localDay,
	type MeasurementView,
	measuredTemplates,
	moveField,
	moveFocusTarget,
	parseDraft,
	profileSummaries,
	selectedProfileId,
	type TemplateView,
	templateDraftErrors,
} from "../src/lib/measurements";

function measurement(
	overrides: Partial<MeasurementView> & Pick<MeasurementView, "id">
): MeasurementView {
	return {
		archivedAt: null,
		createdAt: "2026-09-02T12:00:00.000Z",
		fields: [],
		notes: null,
		profileId: "p1",
		takenOn: "2026-09-02",
		templateId: "vestido",
		templateName: "Vestido",
		templateVersion: 1,
		version: 1,
		...overrides,
	};
}

function template(overrides: Partial<TemplateView> & Pick<TemplateView, "id">) {
	return {
		archivedAt: null,
		fields: [],
		name: overrides.id,
		version: 1,
		...overrides,
	} satisfies TemplateView;
}

const cava = (valueMm: number | null) => ({
	fieldId: "cava",
	label: "Cava",
	valueMm,
});

describe("medição atual por modelo", () => {
	test("a mais recente por data vence, arquivada não conta e cada modelo aparece uma vez", () => {
		const items = [
			measurement({ fields: [cava(405)], id: "a", takenOn: "2026-08-12" }),
			measurement({ fields: [cava(420)], id: "b", takenOn: "2026-09-02" }),
			measurement({
				archivedAt: "2026-09-03T00:00:00.000Z",
				fields: [cava(999)],
				id: "c",
				takenOn: "2026-09-03",
			}),
			measurement({ id: "d", takenOn: "2026-07-01", templateId: "saia" }),
			measurement({ id: "e", profileId: "p2", takenOn: "2026-09-09" }),
		];
		const pairs = currentByTemplate(items, "p1");
		expect(
			pairs.map((pair) => [pair.current.id, pair.previous?.id ?? null])
		).toEqual([
			["b", "a"],
			["d", null],
		]);
	});

	test("empate de data e chegada decide pelo id decrescente", () => {
		const items = [measurement({ id: "m1" }), measurement({ id: "m2" })];
		expect(currentByTemplate(items, "p1")[0]?.current.id).toBe("m2");
		expect(
			historyOf(items, "p1", "vestido").map((pair) => pair.current.id)
		).toEqual(["m2", "m1"]);
	});

	test("histórico calcula a anterior pulando as arquivadas", () => {
		const items = [
			measurement({ id: "a", takenOn: "2026-08-01" }),
			measurement({
				archivedAt: "2026-08-20T00:00:00.000Z",
				id: "b",
				takenOn: "2026-08-15",
			}),
			measurement({ id: "c", takenOn: "2026-09-01" }),
		];
		expect(
			historyOf(items, "p1", "vestido").map((pair) => [
				pair.current.id,
				pair.previous?.id ?? null,
			])
		).toEqual([
			["c", "a"],
			["b", "a"],
			["a", null],
		]);
		expect(measuredTemplates(items, "p1")).toEqual([
			{ id: "vestido", name: "Vestido" },
		]);
	});
});

describe("diferença entre medições", () => {
	test("só existe quando os dois valores existem e mudaram", () => {
		const current = measurement({ fields: [cava(420)], id: "b" });
		expect(
			fieldDelta(current, measurement({ fields: [cava(405)], id: "a" }), "cava")
		).toBe(15);
		expect(
			fieldDelta(current, measurement({ fields: [cava(420)], id: "a" }), "cava")
		).toBeNull();
		expect(fieldDelta(current, null, "cava")).toBeNull();
		expect(
			fieldDelta(
				current,
				measurement({ fields: [cava(null)], id: "a" }),
				"cava"
			)
		).toBeNull();
	});

	test("descreve com seta e com texto para leitor de tela", () => {
		expect(describeDelta(15)).toEqual({
			label: "aumentou 1,5 cm",
			text: "↑ 1,5",
		});
		expect(describeDelta(-5)).toEqual({
			label: "diminuiu 0,5 cm",
			text: "↓ 0,5",
		});
	});
});

describe("escolhas padrão", () => {
	test("perfil pedido, senão o primeiro ativo, senão o primeiro", () => {
		const profiles = [
			{ archivedAt: "2026-09-01T00:00:00.000Z", id: "arquivado" },
			{ archivedAt: null, id: "ativo" },
		];
		expect(selectedProfileId(profiles, "arquivado")).toBe("arquivado");
		expect(selectedProfileId(profiles, "outro")).toBe("ativo");
		expect(
			selectedProfileId(
				[{ archivedAt: "2026-09-01T00:00:00.000Z", id: "arquivado" }],
				undefined
			)
		).toBe("arquivado");
		expect(selectedProfileId([], undefined)).toBeNull();
	});

	test("modelo pedido e ativo, senão o da medição mais recente, senão o primeiro ativo", () => {
		const templates = [
			template({ id: "calca" }),
			template({ archivedAt: "2026-09-01T00:00:00.000Z", id: "saia" }),
			template({ id: "vestido" }),
		];
		const recentSaia = [measurement({ id: "m", templateId: "saia" })];
		const recentVestido = [measurement({ id: "m", templateId: "vestido" })];
		expect(defaultTemplateId(templates, recentVestido, "p1", "calca")).toBe(
			"calca"
		);
		expect(defaultTemplateId(templates, recentVestido, "p1", "saia")).toBe(
			"vestido"
		);
		expect(defaultTemplateId(templates, recentSaia, "p1", undefined)).toBe(
			"calca"
		);
		expect(
			defaultTemplateId(
				[template({ archivedAt: "2026-09-01T00:00:00.000Z", id: "saia" })],
				[],
				"p1",
				undefined
			)
		).toBeNull();
	});
});

describe("rascunho de medição", () => {
	const vestido = template({
		fields: [
			{ active: true, id: "busto", label: "Busto" },
			{ active: false, id: "antigo", label: "Antigo" },
			{ active: true, id: "cava", label: "Cava da manga" },
			{ active: true, id: "novo", label: "Punho" },
		],
		id: "vestido",
		version: 3,
	});

	test("usa os campos ativos e casa o valor anterior pelo id, mesmo renomeado", () => {
		const previous = measurement({
			fields: [
				{ fieldId: "busto", label: "Busto", valueMm: 920 },
				{ fieldId: "cava", label: "Cava", valueMm: 405 },
			],
			id: "a",
		});
		expect(draftFields(vestido, previous)).toEqual([
			{ fieldId: "busto", label: "Busto", previousMm: 920, text: "92,0" },
			{
				fieldId: "cava",
				label: "Cava da manga",
				previousMm: 405,
				text: "40,5",
			},
			{ fieldId: "novo", label: "Punho", previousMm: null, text: "" },
		]);
	});

	test("correção usa os campos gravados da própria medição", () => {
		const current = measurement({
			fields: [cava(420), { fieldId: "punho", label: "Punho", valueMm: null }],
			id: "b",
		});
		expect(
			correctionFields(current, measurement({ fields: [cava(405)], id: "a" }))
		).toEqual([
			{ fieldId: "cava", label: "Cava", previousMm: 405, text: "42,0" },
			{ fieldId: "punho", label: "Punho", previousMm: null, text: "" },
		]);
	});

	test("converte o texto e aponta os inválidos", () => {
		const parsed = parseDraft([
			{ fieldId: "a", label: "A", previousMm: null, text: "74,5" },
			{ fieldId: "b", label: "B", previousMm: null, text: " " },
			{ fieldId: "c", label: "C", previousMm: null, text: "74,55" },
		]);
		expect(parsed.fields.map((field) => field.valueMm)).toEqual([
			745,
			null,
			null,
		]);
		expect(parsed.errors).toEqual({
			c: "Use centímetros com até uma casa, de 0,1 a 999,9",
		});
	});

	test("patch de correção só com o que mudou", () => {
		const current = measurement({ fields: [cava(420)], id: "b", notes: "x" });
		expect(
			changedMeasurement(current, {
				fields: [cava(420)],
				notes: "x",
				takenOn: "2026-09-02",
			})
		).toEqual({});
		expect(
			changedMeasurement(current, {
				fields: [cava(425)],
				notes: null,
				takenOn: "2026-09-03",
			})
		).toEqual({ fields: [cava(425)], notes: null, takenOn: "2026-09-03" });
	});
});

describe("editor de modelo", () => {
	test("move com o vizinho e devolve igual nas pontas", () => {
		expect(moveField(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
		expect(moveField(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
		expect(moveField(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
		expect(moveFocusTarget(0, 3, -1)).toBe("down");
		expect(moveFocusTarget(1, 3, -1)).toBe("up");
		expect(moveFocusTarget(2, 3, 1)).toBe("up");
		expect(moveFocusTarget(1, 3, 1)).toBe("down");
	});

	test("aponta nome vazio, rótulo vazio, rótulo repetido e lista vazia", () => {
		expect(
			templateDraftErrors(" ", [
				{ id: "a", label: "Cintura" },
				{ id: "b", label: " " },
				{ id: "c", label: "cintura" },
			])
		).toEqual({
			fields: {
				b: "Dê um nome ao campo",
				c: "Já existe um campo ativo com este nome",
			},
			form: null,
			name: "Dê um nome ao modelo",
		});
		expect(templateDraftErrors("Saia", []).form).toBe(
			"Mantenha pelo menos um campo ativo"
		);
	});

	test("patch do modelo só com nome ou campos alterados", () => {
		const saia = template({
			fields: [
				{ active: true, id: "a", label: "Cintura" },
				{ active: false, id: "b", label: "Quadril" },
			],
			id: "saia",
			name: "Saia",
		});
		expect(
			changedTemplate(saia, {
				fields: [{ id: "a", label: "Cintura" }],
				name: "Saia",
			})
		).toEqual({});
		expect(
			changedTemplate(saia, {
				fields: [
					{ id: "a", label: "Cintura" },
					{ id: "b", label: "Quadril" },
				],
				name: "Saia reta",
			})
		).toEqual({
			fields: [
				{ id: "a", label: "Cintura" },
				{ id: "b", label: "Quadril" },
			],
			name: "Saia reta",
		});
	});
});

describe("datas", () => {
	test("dia local em Recife e formato dd/mm/aaaa", () => {
		expect(localDay(new Date("2026-09-17T02:00:00Z"))).toBe("2026-09-16");
		expect(formatDay("2026-09-02")).toBe("02/09/2026");
	});
});

describe("revisão: carga, teto e ordem", () => {
	test("erro só bloqueia a tela quando a consulta ainda não tem dados", () => {
		const failure = new Error("rede");
		expect(
			blockingError([
				{ data: { ok: true }, error: failure },
				{ data: { ok: true }, error: null },
			])
		).toBeNull();
		expect(
			blockingError([
				{ data: { ok: true }, error: null },
				{ data: undefined, error: failure },
			])
		).toBe(failure);
		expect(blockingError([{ data: undefined, error: null }])).toBeNull();
	});

	test("modelo com mais de 60 campos ativos aponta erro no formulário", () => {
		const fields = Array.from({ length: 61 }, (_, index) => ({
			id: `c${index}`,
			label: `Campo ${index}`,
		}));
		expect(templateDraftErrors("Vestido", fields).form).toBe(
			"Mantenha no máximo 60 campos ativos"
		);
		expect(templateDraftErrors("Vestido", fields.slice(0, 60)).form).toBeNull();
	});

	test("mesma data decide pela chegada antes do id, como o servidor", () => {
		const items = [
			measurement({ createdAt: "2026-09-02T12:00:01.000Z", id: "a" }),
			measurement({ createdAt: "2026-09-02T12:00:00.000Z", id: "z" }),
		];
		expect(currentByTemplate(items, "p1")[0]?.current.id).toBe("a");
		expect([...items].sort(compareMeasurements).map((item) => item.id)).toEqual(
			["a", "z"]
		);
	});
});

describe("resumo dos perfis", () => {
	test("sem lista carregada não afirma nada; com lista mostra a medição mais recente", () => {
		const profiles = [
			{ archivedAt: null, id: "p1" },
			{ archivedAt: null, id: "p2" },
		];
		expect(profileSummaries(profiles, undefined)).toBeNull();
		const summaries = profileSummaries(profiles, [
			measurement({ id: "a", takenOn: "2026-08-01" }),
			measurement({ id: "b", takenOn: "2026-09-02", templateName: "Saia" }),
		]);
		expect(summaries?.get("p1")).toBe("Saia · 02/09/2026");
		expect(summaries?.has("p2")).toBe(false);
	});
});

import { describe, expect, test } from "bun:test";

import {
	countError,
	countRows,
	type DraftPoint,
	draftPointOf,
	draftSummary,
	expectedAt,
	extraLines,
	finalizeErrors,
	type InventoryPointView,
	invalidLabels,
	inventoryFields,
	inventoryOpKey,
	linesByLocation,
	locationProgress,
	locationsError,
	lockedLocationIds,
	parseDraft,
	pointKey,
	pointLabel,
	pointMatches,
	reviewOf,
	serializeDraft,
	sessionSummary,
	startDraft,
	surplusSuggestion,
	surplusValueText,
	valueHint,
	withCount,
	withDetails,
	withLocations,
	withoutLine,
	withSurplusValue,
	withZeroCount,
} from "../src/lib/inventory";

const armario = "11111111-1111-4111-8111-111111111111";
const prateleira = "22222222-2222-4222-8222-222222222222";
const oxfordId = "33333333-3333-4333-8333-333333333333";
const linhaId = "44444444-4444-4444-8444-444444444444";
const tricolineId = "55555555-5555-4555-8555-555555555555";
const ziperId = "66666666-6666-4666-8666-666666666666";
const botaoId = "77777777-7777-4777-8777-777777777777";
const fitaId = "88888888-8888-4888-8888-888888888888";
const rolo1 = "99999999-9999-4999-8999-999999999999";
const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function point(overrides: Partial<InventoryPointView>): InventoryPointView {
	return {
		archived: false,
		baseUnit: "m",
		code: null,
		displayPrecision: 2,
		locationId: armario,
		locationName: "Armário 1",
		lotId: null,
		lotLabel: null,
		materialId: "material",
		materialName: "Oxford",
		quantityMicros: "10000000",
		referenceCostCents: "2500",
		tracksLots: false,
		valueCents: "25000",
		variantId: oxfordId,
		variantName: "Azul",
		...overrides,
	};
}

const oxfordPoint = point({});
const linhaPoint = point({
	baseUnit: "un",
	displayPrecision: 0,
	materialName: "Linha 120",
	quantityMicros: "5000000",
	referenceCostCents: "200",
	valueCents: "1000",
	variantId: linhaId,
	variantName: "Preta",
});
const tricolinePoint = point({
	locationId: prateleira,
	locationName: "Prateleira 2",
	lotId: rolo1,
	lotLabel: "Rolo 1",
	materialName: "Tricoline",
	quantityMicros: "8000000",
	referenceCostCents: "2000",
	tracksLots: true,
	valueCents: "16000",
	variantId: tricolineId,
	variantName: "Floral",
});
const ziperPoint = point({
	baseUnit: "un",
	displayPrecision: 0,
	locationId: prateleira,
	locationName: "Prateleira 2",
	materialName: "Zíper 20 cm",
	quantityMicros: "3000000",
	referenceCostCents: null,
	valueCents: "900",
	variantId: ziperId,
	variantName: "Azul",
});
const botaoPoint: DraftPoint = draftPointOf(
	point({
		baseUnit: "un",
		displayPrecision: 0,
		materialName: "Botão 12 mm",
		quantityMicros: "0",
		referenceCostCents: "30",
		valueCents: "0",
		variantId: botaoId,
		variantName: "Branco",
	})
);
const fitaPoint: DraftPoint = draftPointOf(
	point({
		materialName: "Fita",
		quantityMicros: "0",
		referenceCostCents: null,
		valueCents: "0",
		variantId: fitaId,
		variantName: "Cetim",
	})
);

const points = [linhaPoint, oxfordPoint, tricolinePoint, ziperPoint];

const base = startDraft({
	locationIds: [armario, prateleira],
	now: new Date("2026-09-23T13:00:00.000Z"),
	sessionId,
	today: "2026-09-23",
});

const counted = [
	(draft: typeof base) =>
		withCount(draft, draftPointOf(oxfordPoint), "12", "10000000", "mov-oxford"),
	(draft: typeof base) =>
		withCount(draft, draftPointOf(linhaPoint), "3", "5000000", "mov-linha"),
	(draft: typeof base) =>
		withCount(
			draft,
			draftPointOf(tricolinePoint),
			"8",
			"8000000",
			"mov-tricoline"
		),
	(draft: typeof base) => withCount(draft, botaoPoint, "30", "0", "mov-botao"),
].reduce((draft, step) => step(draft), base);

const current = [
	linhaPoint,
	{ ...oxfordPoint, quantityMicros: "15000000", valueCents: "37500" },
	tricolinePoint,
	ziperPoint,
];

describe("rascunho da contagem", () => {
	test("começa vazio, com a data do dia e o momento do início", () => {
		expect(base).toEqual({
			lines: {},
			locationIds: [armario, prateleira],
			notes: "",
			occurredOn: "2026-09-23",
			reason: "",
			sessionId,
			startedAt: "2026-09-23T13:00:00.000Z",
			version: 1,
		});
	});

	test("contar grava o esperado do momento e o id do movimento", () => {
		const key = pointKey(oxfordPoint);
		const first = withCount(
			base,
			draftPointOf(oxfordPoint),
			"12",
			"10000000",
			"mov-a"
		);
		expect(first.lines[key]).toEqual({
			countedText: "12",
			expectedMicros: "10000000",
			movementId: "mov-a",
			point: draftPointOf(oxfordPoint),
			valueText: null,
		});
		const valued = withSurplusValue(first, key, "55,00");
		const recounted = withCount(
			valued,
			draftPointOf(oxfordPoint),
			"11",
			"15000000",
			"mov-b"
		);
		expect(recounted.lines[key]).toMatchObject({
			countedText: "11",
			expectedMicros: "15000000",
			movementId: "mov-a",
			valueText: null,
		});
		expect(
			withCount(valued, draftPointOf(oxfordPoint), "12", "15000000", "mov-b")
				.lines[key]?.valueText
		).toBe("55,00");
		expect(
			withCount(recounted, draftPointOf(oxfordPoint), "  ", "15000000", "mov-c")
				.lines
		).toEqual({});
	});

	test("tirar uma linha acrescentada apaga só ela", () => {
		const key = pointKey(botaoPoint);
		expect(Object.keys(withoutLine(counted, key).lines)).not.toContain(key);
		expect(Object.keys(withoutLine(counted, key).lines)).toHaveLength(3);
	});

	test("não tira local com linha contada", () => {
		const onlyOxford = withCount(
			base,
			draftPointOf(oxfordPoint),
			"12",
			"10000000",
			"mov"
		);
		expect([...lockedLocationIds(onlyOxford)]).toEqual([armario]);
		expect(withLocations(onlyOxford, [prateleira]).locationIds).toEqual([
			prateleira,
			armario,
		]);
		expect(withLocations(base, [prateleira]).locationIds).toEqual([prateleira]);
	});

	test("guarda motivo, data e notas", () => {
		expect(
			withDetails(base, { notes: "Faltou o depósito", reason: "Anual" })
		).toMatchObject({ notes: "Faltou o depósito", reason: "Anual" });
	});
});

describe("draftSummary", () => {
	test("resume a contagem em andamento", () => {
		expect(draftSummary(base)).toBe("Nenhum item contado ainda em 2 locais");
		expect(
			draftSummary(
				withLocations(
					withCount(base, draftPointOf(oxfordPoint), "12", "10000000", "a"),
					[armario]
				)
			)
		).toBe("1 item contado em 1 local");
		expect(draftSummary(counted)).toBe("4 itens contados em 2 locais");
	});
});

describe("pointMatches", () => {
	test("acha pelo material, variante, código e lote, sem acento nem caixa", () => {
		const tricoline = draftPointOf({ ...tricolinePoint, code: "TRI-FL" });
		expect(pointMatches(tricoline, "")).toBe(true);
		expect(pointMatches(tricoline, "floral")).toBe(true);
		expect(pointMatches(tricoline, "TRICO")).toBe(true);
		expect(pointMatches(tricoline, "tri-fl")).toBe(true);
		expect(pointMatches(tricoline, "floral rolo")).toBe(true);
		expect(pointMatches(draftPointOf(ziperPoint), "ziper")).toBe(true);
		expect(pointMatches(tricoline, "oxford")).toBe(false);
	});
});

describe("countError", () => {
	test("aceita vazio, zero e decimal com vírgula", () => {
		expect(countError("")).toBeNull();
		expect(countError("0")).toBeNull();
		expect(countError("12,5")).toBeNull();
	});

	test("recusa texto fora do formato", () => {
		expect(countError("1,1234567")).toBe("Use no máximo 6 casas decimais");
		expect(countError("abc")).toBe("Use só número, com vírgula");
		expect(countError("1,5,0")).toBe("Use só número, com vírgula");
		expect(countError("-1")).toBe("Use só número, com vírgula");
	});
});

describe("surplusSuggestion", () => {
	test("usa a média do ponto quando ele tem saldo", () => {
		expect(
			surplusSuggestion(
				{ quantityMicros: "10000000", valueCents: "25000" },
				"9999",
				2_000_000n
			)
		).toEqual({ cents: 5000n, source: "average" });
		expect(
			surplusSuggestion(
				{ quantityMicros: "3000000", valueCents: "1000" },
				null,
				1_000_000n
			)
		).toEqual({ cents: 333n, source: "average" });
	});

	test("cai no custo de referência sem saldo e não inventa sem os dois", () => {
		expect(surplusSuggestion(null, "30", 30_000_000n)).toEqual({
			cents: 900n,
			source: "reference",
		});
		expect(
			surplusSuggestion(
				{ quantityMicros: "0", valueCents: "0" },
				"2000",
				3_000_000n
			)
		).toEqual({ cents: 6000n, source: "reference" });
		expect(surplusSuggestion(null, null, 1_000_000n)).toEqual({
			source: "none",
		});
	});

	test("ponto com valor negativo não tem média e cai no custo de referência", () => {
		expect(
			surplusSuggestion(
				{ quantityMicros: "100000", valueCents: "-700" },
				"3000",
				50_000n
			)
		).toEqual({ cents: 150n, source: "reference" });
		expect(
			surplusSuggestion(
				{ quantityMicros: "5000000", valueCents: "0" },
				"3000",
				1_000_000n
			)
		).toEqual({ cents: 0n, source: "average" });
	});
});

describe("reviewOf", () => {
	const review = reviewOf(counted, current);
	const byMaterial = (name: string) =>
		review.divergent.find((line) => line.line.point.materialName === name);

	test("separa divergências, as que bateram e os não contados, em ordem", () => {
		expect(
			review.divergent.map((line) => line.line.point.materialName)
		).toEqual(["Botão 12 mm", "Linha 120", "Oxford"]);
		expect(review.matched.map((line) => line.line.point.materialName)).toEqual([
			"Tricoline",
		]);
		expect(review.uncounted.map((item) => item.materialName)).toEqual([
			"Zíper 20 cm",
		]);
		expect(review.invalid).toEqual([]);
	});

	test("mede a sobra contra o esperado da contagem e avisa o saldo que mudou", () => {
		expect(byMaterial("Oxford")).toMatchObject({
			changedSinceCount: true,
			countedMicros: 12_000_000n,
			currentMicros: 15_000_000n,
			exitEstimateCents: null,
			expectedMicros: 10_000_000n,
			outcome: { kind: "surplus", quantityMicros: 2_000_000n },
			suggestion: { cents: 5000n, source: "average" },
		});
		expect(byMaterial("Botão 12 mm")).toMatchObject({
			changedSinceCount: false,
			currentMicros: 0n,
			suggestion: { cents: 900n, source: "reference" },
		});
	});

	test("estima a falta pela média do ponto", () => {
		expect(byMaterial("Linha 120")).toMatchObject({
			changedSinceCount: false,
			exitEstimateCents: 400n,
			outcome: { kind: "shortage", quantityMicros: -2_000_000n },
		});
	});

	test("põe a contagem fora do formato em inválidas e não a trata como zero", () => {
		const invalid = reviewOf(
			withCount(counted, draftPointOf(ziperPoint), "abc", "3000000", "mov"),
			current
		);
		expect(invalid.invalid).toEqual([pointKey(ziperPoint)]);
		expect(invalid.uncounted).toEqual([]);
		expect(
			invalid.divergent.some((line) => line.key === pointKey(ziperPoint))
		).toBe(false);
	});

	test("mantém a linha de um ponto que sumiu da lista, com saldo atual zero", () => {
		const gone = reviewOf(
			withCount(base, draftPointOf(linhaPoint), "3", "4000000", "mov"),
			[]
		);
		expect(gone.divergent[0]).toMatchObject({
			changedSinceCount: true,
			currentMicros: 0n,
			exitEstimateCents: 0n,
			outcome: { kind: "shortage", quantityMicros: -1_000_000n },
		});
	});

	test("mostra o valor digitado, senão a sugestão, senão vazio", () => {
		const oxford = byMaterial("Oxford");
		expect(oxford ? surplusValueText(oxford) : "").toBe("50,00");
		const edited = reviewOf(
			withSurplusValue(counted, pointKey(oxfordPoint), "55,00"),
			current
		).divergent.find((line) => line.key === pointKey(oxfordPoint));
		expect(edited ? surplusValueText(edited) : "").toBe("55,00");
		const [noSuggestion] = reviewOf(
			withCount(base, fitaPoint, "4", "0", "mov"),
			[]
		).divergent;
		expect(noSuggestion ? surplusValueText(noSuggestion) : "x").toBe("");
	});
});

describe("progresso por local", () => {
	const draft = withCount(
		withCount(base, draftPointOf(oxfordPoint), "12", "10000000", "a"),
		botaoPoint,
		"30",
		"0",
		"b"
	);

	test("conta os itens da lista e os acrescentados", () => {
		expect(locationProgress(draft, points, armario)).toEqual({
			counted: 2,
			total: 3,
		});
		expect(locationProgress(draft, points, prateleira)).toEqual({
			counted: 0,
			total: 2,
		});
	});

	test("devolve só as linhas fora da lista do servidor", () => {
		expect(extraLines(draft, points, armario).map(([key]) => key)).toEqual([
			pointKey(botaoPoint),
		]);
		expect(extraLines(draft, points, prateleira)).toEqual([]);
	});
});

describe("finalização", () => {
	const complete = withDetails(counted, { reason: "Inventário anual" });

	test("rascunho completo não tem erro", () => {
		expect(finalizeErrors(complete, reviewOf(complete, current))).toEqual({});
	});

	test("cobra motivo, data e notas", () => {
		const check = (draft: typeof base) =>
			finalizeErrors(draft, reviewOf(draft, current));
		expect(check(counted).reason).toBe("Diga o motivo da contagem");
		expect(
			check(withDetails(complete, { reason: "x".repeat(201) })).reason
		).toBe("Use até 200 caracteres");
		expect(
			check(withDetails(complete, { occurredOn: "23/09/2026" })).occurredOn
		).toBe("Data inválida");
		expect(
			check(withDetails(complete, { notes: "x".repeat(2001) })).notes
		).toBe("Use até 2000 caracteres");
	});

	test("cobra pelo menos uma linha e contagens no formato", () => {
		const empty = withDetails(base, { reason: "Anual" });
		expect(finalizeErrors(empty, reviewOf(empty, current)).lines).toBe(
			"Conte pelo menos um item"
		);
		const bad = withCount(
			complete,
			draftPointOf(ziperPoint),
			"abc",
			"3000000",
			"z"
		);
		expect(finalizeErrors(bad, reviewOf(bad, current)).lines).toBe(
			"Volte à contagem e corrija os números fora do formato"
		);
	});

	test("cobra o valor da sobra sem sugestão", () => {
		const draft = withCount(complete, fitaPoint, "4", "0", "f");
		expect(finalizeErrors(draft, reviewOf(draft, current))).toEqual({
			[`value:${pointKey(fitaPoint)}`]: "Informe o valor da entrada",
		});
	});

	test("monta o payload com movimento só nas divergentes", () => {
		const draft = withDetails(complete, {
			notes: "  ",
			reason: "  Inventário anual  ",
		});
		expect(inventoryFields(draft, reviewOf(draft, current))).toEqual({
			lines: [
				{
					countedMicros: "30000000",
					expectedMicros: "0",
					locationId: armario,
					lotId: null,
					movementId: "mov-botao",
					valueCents: "900",
					variantId: botaoId,
				},
				{
					countedMicros: "3000000",
					expectedMicros: "5000000",
					locationId: armario,
					lotId: null,
					movementId: "mov-linha",
					valueCents: null,
					variantId: linhaId,
				},
				{
					countedMicros: "12000000",
					expectedMicros: "10000000",
					locationId: armario,
					lotId: null,
					movementId: "mov-oxford",
					valueCents: "5000",
					variantId: oxfordId,
				},
				{
					countedMicros: "8000000",
					expectedMicros: "8000000",
					locationId: prateleira,
					lotId: rolo1,
					movementId: null,
					valueCents: null,
					variantId: tricolineId,
				},
			],
			notes: null,
			occurredOn: "2026-09-23",
			reason: "Inventário anual",
		});
	});

	test("contagem em que tudo bateu não leva nenhum movimento", () => {
		const draft = withDetails(
			withCount(base, draftPointOf(tricolinePoint), "8", "8000000", "t"),
			{ reason: "Conferência" }
		);
		expect(
			inventoryFields(draft, reviewOf(draft, current)).lines.map(
				(line) => line.movementId
			)
		).toEqual([null]);
	});
});

describe("guarda do rascunho", () => {
	test("lê o que gravou", () => {
		expect(parseDraft(serializeDraft(counted))).toEqual(counted);
	});

	test("ignora rascunho ausente, corrompido ou de outro formato", () => {
		expect(parseDraft(null)).toBeNull();
		expect(parseDraft("{")).toBeNull();
		expect(parseDraft('{"version":2}')).toBeNull();
		expect(parseDraft(JSON.stringify({ ...counted, version: 2 }))).toBeNull();
		expect(
			parseDraft(JSON.stringify({ ...counted, sessionId: undefined }))
		).toBeNull();
	});
});

describe("contagem finalizada", () => {
	test("soma entradas e saídas e conta as divergências", () => {
		expect(
			sessionSummary([
				{ movementId: "a", valueCents: "5000" },
				{ movementId: "b", valueCents: "-400" },
				{ movementId: "c", valueCents: "0" },
				{ movementId: null, valueCents: null },
			])
		).toEqual({ divergent: 3, entryCents: 5000n, exitCents: 400n });
	});

	test("agrupa as linhas por local em ordem de nome, mantendo a ordem delas", () => {
		const groups = linesByLocation([
			{ id: 1, locationId: "b", locationName: "Prateleira 2" },
			{ id: 2, locationId: "a", locationName: "Armário 1" },
			{ id: 3, locationId: "b", locationName: "Prateleira 2" },
		]);
		expect(
			groups.map((group) => [
				group.locationName,
				group.lines.map((line) => line.id),
			])
		).toEqual([
			["Armário 1", [2]],
			["Prateleira 2", [1, 3]],
		]);
	});
});

describe("linhas da contagem", () => {
	const draft = withCount(
		withCount(base, draftPointOf(oxfordPoint), "12", "10000000", "a"),
		botaoPoint,
		"30",
		"0",
		"b"
	);

	test("lista os pontos do local com o saldo atual como esperado e os acrescentados com zero", () => {
		expect(countRows(draft, points, armario)).toEqual([
			{
				expectedMicros: "5000000",
				key: pointKey(linhaPoint),
				point: draftPointOf(linhaPoint),
				removable: false,
			},
			{
				expectedMicros: "10000000",
				key: pointKey(oxfordPoint),
				point: draftPointOf(oxfordPoint),
				removable: false,
			},
			{
				expectedMicros: "0",
				key: pointKey(botaoPoint),
				point: botaoPoint,
				removable: true,
			},
		]);
		expect(countRows(draft, points, prateleira).map((row) => row.key)).toEqual([
			pointKey(tricolinePoint),
			pointKey(ziperPoint),
		]);
	});

	test("acha o saldo do ponto acrescentado no local e no lote, senão zero", () => {
		const balance = [
			{ locationId: prateleira, lotId: rolo1, quantityMicros: "8000000" },
			{ locationId: armario, lotId: null, quantityMicros: "2000000" },
		];
		expect(expectedAt(balance, prateleira, rolo1)).toBe("8000000");
		expect(expectedAt(balance, armario, null)).toBe("2000000");
		expect(expectedAt(balance, prateleira, null)).toBe("0");
	});

	test("contar como zero usa o saldo atual do ponto como esperado", () => {
		expect(
			withZeroCount(base, ziperPoint, "mov-z").lines[pointKey(ziperPoint)]
		).toMatchObject({
			countedText: "0",
			expectedMicros: "3000000",
			movementId: "mov-z",
		});
	});

	test("nomeia o ponto com o lote", () => {
		expect(pointLabel(draftPointOf(tricolinePoint))).toBe(
			"Tricoline · Floral · lote Rolo 1"
		);
		expect(pointLabel(draftPointOf(oxfordPoint))).toBe("Oxford · Azul");
	});
});

describe("locais da contagem", () => {
	test("pede pelo menos um local e no máximo cem", () => {
		const ids = (count: number) =>
			Array.from({ length: count }, (_, index) => `local-${index}`);
		expect(locationsError([])).toBe("Escolha pelo menos um local");
		expect(locationsError(ids(1))).toBeNull();
		expect(locationsError(ids(100))).toBeNull();
		expect(locationsError(ids(101))).toBe(
			"Escolha até 100 locais por contagem"
		);
	});
});

describe("revisão e finalização", () => {
	const complete = withDetails(counted, { reason: "Inventário anual" });
	const oxfordOf = (review: ReturnType<typeof reviewOf>) =>
		review.divergent.find((line) => line.key === pointKey(oxfordPoint));

	test("diz de onde veio o valor da sobra", () => {
		const review = reviewOf(counted, current);
		const oxford = oxfordOf(review);
		const botao = review.divergent.find(
			(line) => line.key === pointKey(botaoPoint)
		);
		expect(oxford ? valueHint(oxford) : "").toBe("Média do ponto");
		expect(botao ? valueHint(botao) : "").toBe("Custo de referência");
		const edited = oxfordOf(
			reviewOf(
				withSurplusValue(counted, pointKey(oxfordPoint), "55,00"),
				current
			)
		);
		expect(edited ? valueHint(edited) : "").toBe(
			"Valor digitado; a média do ponto dá R$ 50,00"
		);
		const [fita] = reviewOf(
			withCount(base, fitaPoint, "4", "0", "f"),
			[]
		).divergent;
		expect(fita ? valueHint(fita) : "").toBe("Sem sugestão: informe o valor");
	});

	test("a chave da operação muda com a contagem", () => {
		const other = {
			...complete,
			sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
		};
		const fields = inventoryFields(complete, reviewOf(complete, current));
		expect(inventoryOpKey(complete, fields)).toBe(
			inventoryOpKey(complete, fields)
		);
		expect(inventoryOpKey(complete, fields)).not.toBe(
			inventoryOpKey(other, fields)
		);
	});

	test("nomeia as contagens fora do formato", () => {
		const bad = withCount(
			complete,
			draftPointOf(ziperPoint),
			"abc",
			"3000000",
			"z"
		);
		expect(invalidLabels(bad, reviewOf(bad, current))).toEqual([
			"Zíper 20 cm · Azul em Prateleira 2",
		]);
	});

	test("recusa mais de 500 linhas", () => {
		const draft = Array.from({ length: 501 }, (_, index) => index).reduce(
			(accumulated, index) =>
				withCount(
					accumulated,
					{ ...draftPointOf(oxfordPoint), variantId: `variante-${index}` },
					"1",
					"1000000",
					`movimento-${index}`
				),
			withDetails(base, { reason: "Anual" })
		);
		expect(finalizeErrors(draft, reviewOf(draft, [])).lines).toBe(
			"No máximo 500 itens por contagem; divida em duas"
		);
	});
});

import { describe, expect, test } from "bun:test";
import { commandMessages } from "@costura-pro/api/command-messages";
import { reconciliationLimits } from "@costura-pro/domain/reconciliation";
import { ORPCError } from "@orpc/client";

import {
	hasReconciliationErrors,
	type LineDraft,
	type LinePreview,
	lineOutcomeText,
	negativeText,
	type ReconciliationDraft,
	reconcileCommandFailure,
	reconcileSettlement,
	reconciliationDraftOf,
	reconciliationErrors,
	reconciliationFailure,
	reconciliationFields,
	reconciliationOpKey,
	reconciliationPreview,
	removePart,
	reverseCommandFailure,
	reverseDialogNotice,
	reverseOpKey,
	reverseReconciliationErrors,
	reverseReconciliationFields,
	reverseSettlement,
	splitPart,
	swapUnitHint,
	type VariantPointsView,
	withPart,
	withQuantities,
	withSwap,
	withSwapReason,
} from "../src/lib/reconciliation";
import { reconciliationDrafts } from "../src/lib/reconciliation-drafts";
import type { MaterialRowView } from "../src/lib/service-orders";

const id = (n: number) =>
	`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function sequence(start: number): () => string {
	let next = start;
	return () => {
		next += 1;
		return id(next);
	};
}

const crepe = id(81);
const zipper = id(89);
const lining = id(90);
const closet = id(31);
const drawer = id(32);
const shelf = id(33);
const oldLot = id(41);
const newLot = id(42);
const itemId = id(801);

const rows: MaterialRowView[] = [
	{
		baseUnit: "m",
		displayPrecision: 2,
		label: "Crepe · Preto",
		plannedMicros: 3_400_000n,
		reservedMicros: 2_500_000n,
		shortageMicros: 900_000n,
		variantId: crepe,
	},
	{
		baseUnit: "un",
		displayPrecision: 0,
		label: "Zíper · 20 cm",
		plannedMicros: 1_000_000n,
		reservedMicros: 1_000_000n,
		shortageMicros: 0n,
		variantId: zipper,
	},
];

const crepePoints: VariantPointsView = {
	baseUnit: "m",
	displayPrecision: 2,
	points: [
		{
			locationId: closet,
			locationName: "Armário",
			lotCreatedAt: null,
			lotId: null,
			lotLabel: null,
			quantityMicros: "2500000",
			valueCents: "7500",
		},
	],
	referenceCostCents: "3000",
	tracksLots: false,
	variantId: crepe,
};

const zipperPoints: VariantPointsView = {
	baseUnit: "un",
	displayPrecision: 0,
	points: [
		{
			locationId: drawer,
			locationName: "Gaveta",
			lotCreatedAt: null,
			lotId: null,
			lotLabel: null,
			quantityMicros: "5000000",
			valueCents: "1850",
		},
	],
	referenceCostCents: "370",
	tracksLots: false,
	variantId: zipper,
};

const liningPoints: VariantPointsView = {
	baseUnit: "m",
	displayPrecision: 2,
	points: [
		{
			locationId: shelf,
			locationName: "Prateleira",
			lotCreatedAt: "2026-09-01T12:00:00.000Z",
			lotId: newLot,
			lotLabel: "Rolo 2",
			quantityMicros: "5000000",
			valueCents: "10000",
		},
		{
			locationId: closet,
			locationName: "Armário",
			lotCreatedAt: "2026-08-01T12:00:00.000Z",
			lotId: oldLot,
			lotLabel: "Rolo 1",
			quantityMicros: "1000000",
			valueCents: "2000",
		},
	],
	referenceCostCents: null,
	tracksLots: true,
	variantId: lining,
};

const points = [crepePoints, zipperPoints, liningPoints];

const liningVariant: LineDraft["variant"] = {
	baseUnit: "m",
	displayPrecision: 2,
	id: lining,
	label: "Forro · Bege",
	tracksLots: true,
};

const crepeVariant: LineDraft["variant"] = {
	baseUnit: "m",
	displayPrecision: 2,
	id: crepe,
	label: "Crepe · Preto",
	tracksLots: false,
};

const twoLines: MaterialRowView[] = [
	{
		baseUnit: "m",
		displayPrecision: 2,
		label: "Crepe · Preto",
		plannedMicros: 2_000_000n,
		reservedMicros: 2_000_000n,
		shortageMicros: 0n,
		variantId: crepe,
	},
	{
		baseUnit: "m",
		displayPrecision: 2,
		label: "Forro · Bege",
		plannedMicros: 1_000_000n,
		reservedMicros: 1_000_000n,
		shortageMicros: 0n,
		variantId: lining,
	},
];

const bounds = { openedOn: "2026-09-22", today: "2026-09-25" };

function freshDraft(): ReconciliationDraft {
	return reconciliationDraftOf(rows, points, "2026-09-25", sequence(500));
}

function previewOf(
	current: LineDraft,
	variantPoints?: VariantPointsView
): LinePreview {
	const [preview] = reconciliationPreview(
		{ lines: [current] },
		variantPoints ? [variantPoints] : []
	);
	if (preview === undefined) {
		throw new Error("prévia ausente");
	}
	return preview;
}

function line(draft: ReconciliationDraft, index = 0): LineDraft {
	const found = draft.lines[index];
	if (found === undefined) {
		throw new Error("linha ausente");
	}
	return found;
}

describe("rascunho da reconciliação", () => {
	test("parte do previsto com a sugestão de saída por ponto", () => {
		expect(freshDraft()).toEqual({
			lines: [
				{
					consumed: "3,40",
					label: "Crepe · Preto",
					lost: "0",
					parts: [
						{
							locationId: closet,
							lotId: null,
							movementId: id(501),
							quantity: "3,40",
						},
					],
					plannedMicros: "3400000",
					plannedVariantId: crepe,
					swapReason: "",
					variant: {
						baseUnit: "m",
						displayPrecision: 2,
						id: crepe,
						label: "Crepe · Preto",
						tracksLots: false,
					},
				},
				{
					consumed: "1",
					label: "Zíper · 20 cm",
					lost: "0",
					parts: [
						{
							locationId: drawer,
							lotId: null,
							movementId: id(502),
							quantity: "1",
						},
					],
					plannedMicros: "1000000",
					plannedVariantId: zipper,
					swapReason: "",
					variant: {
						baseUnit: "un",
						displayPrecision: 0,
						id: zipper,
						label: "Zíper · 20 cm",
						tracksLots: false,
					},
				},
			],
			note: "",
			occurredOn: "2026-09-25",
		});
	});

	test("sem ponto positivo, uma parte no primeiro ponto ou sem local", () => {
		const negative: VariantPointsView = {
			...crepePoints,
			points: [
				{
					...(crepePoints.points[0] as VariantPointsView["points"][number]),
					quantityMicros: "-500000",
					valueCents: "-1500",
				},
			],
		};
		const [onPoint] = reconciliationDraftOf(
			rows.slice(0, 1),
			[negative],
			"2026-09-25",
			sequence(500)
		).lines;
		expect(onPoint?.parts).toEqual([
			{
				locationId: closet,
				lotId: null,
				movementId: id(501),
				quantity: "3,40",
			},
		]);
		const [nowhere] = reconciliationDraftOf(
			rows.slice(0, 1),
			[],
			"2026-09-25",
			sequence(500)
		).lines;
		expect(nowhere?.parts).toEqual([
			{ locationId: "", lotId: null, movementId: id(501), quantity: "3,40" },
		]);
		expect(nowhere?.variant.tracksLots).toBe(false);
	});

	test("mudar consumido ou perdido refaz a sugestão com ids novos", () => {
		const draft = withQuantities(
			freshDraft(),
			0,
			"3,00",
			"0,20",
			points,
			sequence(600)
		);
		expect(line(draft)).toMatchObject({
			consumed: "3,00",
			lost: "0,20",
			parts: [
				{
					locationId: closet,
					lotId: null,
					movementId: id(601),
					quantity: "3,20",
				},
			],
		});
		expect(line(draft, 1)).toEqual(line(freshDraft(), 1));
	});

	test("editar a parte à mão e depois a nota não refaz a sugestão", () => {
		const edited = withPart(freshDraft(), 0, 0, { quantity: "3,10" });
		const noted = { ...edited, note: "Sobrou retalho" };
		expect(line(noted).parts).toEqual([
			{
				locationId: closet,
				lotId: null,
				movementId: id(501),
				quantity: "3,10",
			},
		]);
		expect(line(noted).consumed).toBe("3,40");
	});

	test("quantidade inválida mantém as partes", () => {
		const draft = withQuantities(
			freshDraft(),
			0,
			"3,4a",
			"0",
			points,
			sequence(600)
		);
		expect(line(draft).consumed).toBe("3,4a");
		expect(line(draft).parts).toEqual(line(freshDraft()).parts);
	});

	test("troca para o forro sugere pelo lote mais antigo e pede o motivo", () => {
		const swapped = withSwap(
			freshDraft(),
			0,
			liningVariant,
			points,
			sequence(700)
		);
		expect(line(swapped).variant).toEqual(liningVariant);
		expect(line(swapped).plannedVariantId).toBe(crepe);
		expect(line(swapped).parts).toEqual([
			{
				locationId: closet,
				lotId: oldLot,
				movementId: id(701),
				quantity: "1,00",
			},
			{
				locationId: shelf,
				lotId: newLot,
				movementId: id(702),
				quantity: "2,40",
			},
		]);
		expect(reconciliationErrors(swapped, bounds).lines[0]?.swap).toBe(
			"Diga o motivo da troca."
		);
		const explained = withSwapReason(swapped, 0, "Crepe acabou");
		expect(reconciliationErrors(explained, bounds).lines[0]?.swap).toBeNull();
		expect(
			hasReconciliationErrors(reconciliationErrors(explained, bounds))
		).toBe(false);
	});

	test("a sugestão da linha seguinte desconta o que a anterior tira do ponto", () => {
		const withShelf: VariantPointsView = {
			...crepePoints,
			points: [
				...crepePoints.points,
				{
					locationId: shelf,
					locationName: "Prateleira",
					lotCreatedAt: null,
					lotId: null,
					lotLabel: null,
					quantityMicros: "1000000",
					valueCents: "3000",
				},
			],
		};
		const available = [withShelf, liningPoints];
		const draft = reconciliationDraftOf(
			twoLines,
			available,
			"2026-09-25",
			sequence(500)
		);
		const swapped = withSwap(draft, 1, crepeVariant, available, sequence(600));
		expect(line(swapped, 1).parts).toEqual([
			{
				locationId: closet,
				lotId: null,
				movementId: id(601),
				quantity: "0,50",
			},
			{ locationId: shelf, lotId: null, movementId: id(602), quantity: "0,50" },
		]);
		const resized = withQuantities(
			swapped,
			1,
			"0,80",
			"0",
			available,
			sequence(700)
		);
		expect(line(resized, 1).parts).toEqual([
			{
				locationId: closet,
				lotId: null,
				movementId: id(701),
				quantity: "0,50",
			},
			{
				locationId: shelf,
				lotId: null,
				movementId: id(702),
				quantity: "0,30",
			},
		]);
	});

	test("o lote mais antigo vem primeiro mesmo no local de nome maior", () => {
		const lots: VariantPointsView = {
			...liningPoints,
			points: [
				{
					locationId: closet,
					locationName: "Armário",
					lotCreatedAt: "2026-09-01T12:00:00.000Z",
					lotId: newLot,
					lotLabel: "Rolo 1",
					quantityMicros: "5000000",
					valueCents: "10000",
				},
				{
					locationId: shelf,
					locationName: "Prateleira",
					lotCreatedAt: "2026-08-01T12:00:00.000Z",
					lotId: oldLot,
					lotLabel: "Rolo 2",
					quantityMicros: "1000000",
					valueCents: "2000",
				},
			],
		};
		const [lined] = reconciliationDraftOf(
			[{ ...(twoLines[1] as MaterialRowView), plannedMicros: 1_500_000n }],
			[lots],
			"2026-09-25",
			sequence(500)
		).lines;
		expect(lined?.parts).toEqual([
			{
				locationId: shelf,
				lotId: oldLot,
				movementId: id(501),
				quantity: "1,00",
			},
			{
				locationId: closet,
				lotId: newLot,
				movementId: id(502),
				quantity: "0,50",
			},
		]);
	});

	test("previsto e ponto com mais casas que a precisão da variante", () => {
		const small = reconciliationDraftOf(
			[{ ...(twoLines[0] as MaterialRowView), plannedMicros: 125_000n }],
			[crepePoints],
			"2026-09-25",
			sequence(500)
		);
		expect(line(small).consumed).toBe("0,125");
		expect(hasReconciliationErrors(reconciliationErrors(small, bounds))).toBe(
			false
		);
		expect(reconciliationFields(small, itemId).lines[0]).toMatchObject({
			consumedMicros: "125000",
			parts: [{ quantityMicros: "125000" }],
		});
		const thin: VariantPointsView = {
			...crepePoints,
			points: [
				{
					...(crepePoints.points[0] as VariantPointsView["points"][number]),
					quantityMicros: "144000",
					valueCents: "432",
				},
				{
					locationId: shelf,
					locationName: "Prateleira",
					lotCreatedAt: null,
					lotId: null,
					lotLabel: null,
					quantityMicros: "5000000",
					valueCents: "15000",
				},
			],
		};
		const split = reconciliationDraftOf(
			rows.slice(0, 1),
			[thin],
			"2026-09-25",
			sequence(500)
		);
		expect(line(split).parts.map((part) => part.quantity)).toEqual([
			"0,144",
			"3,256",
		]);
		expect(hasReconciliationErrors(reconciliationErrors(split, bounds))).toBe(
			false
		);
	});

	test("dividir acrescenta uma saída vazia e remover tira a escolhida", () => {
		const split = splitPart(freshDraft(), 0, sequence(800));
		expect(line(split).parts).toEqual([
			{
				locationId: closet,
				lotId: null,
				movementId: id(501),
				quantity: "3,40",
			},
			{ locationId: "", lotId: null, movementId: id(801), quantity: "" },
		]);
		expect(line(removePart(split, 0, 0)).parts).toEqual([
			{ locationId: "", lotId: null, movementId: id(801), quantity: "" },
		]);
	});

	test("dividir não passa de 20 saídas", () => {
		const draft = freshDraft();
		const full: ReconciliationDraft = {
			...draft,
			lines: [
				{
					...line(draft),
					parts: Array.from({ length: 20 }, (_, n) => ({
						locationId: id(100 + n),
						lotId: null,
						movementId: id(200 + n),
						quantity: "0,17",
					})),
				},
			],
		};
		expect(splitPart(full, 0, sequence(800))).toEqual(full);
	});
});

describe("erros da reconciliação", () => {
	const valid = freshDraft();

	function withLine(change: Partial<LineDraft>): ReconciliationDraft {
		return {
			...valid,
			lines: valid.lines.map((current, index) =>
				index === 0 ? { ...current, ...change } : current
			),
		};
	}

	test("o rascunho sugerido não tem erro", () => {
		const errors = reconciliationErrors(valid, bounds);
		expect(errors).toEqual({
			date: null,
			lines: [
				{ parts: null, quantities: null, swap: null },
				{ parts: null, quantities: null, swap: null },
			],
			note: null,
		});
		expect(hasReconciliationErrors(errors)).toBe(false);
	});

	test("data fora do formato", () => {
		const errors = reconciliationErrors(
			{ ...valid, occurredOn: "2026-02-30" },
			bounds
		);
		expect(errors.date).toBe("Data inválida");
		expect(hasReconciliationErrors(errors)).toBe(true);
	});

	test("data antes da abertura da OS", () => {
		expect(
			reconciliationErrors({ ...valid, occurredOn: "2026-09-21" }, bounds).date
		).toBe("A data não pode ser antes da abertura da OS.");
		expect(
			reconciliationErrors({ ...valid, occurredOn: "2026-09-22" }, bounds).date
		).toBeNull();
	});

	test("data no futuro", () => {
		expect(
			reconciliationErrors({ ...valid, occurredOn: "2026-09-26" }, bounds).date
		).toBe("A data não pode ser no futuro.");
	});

	test("quantidade inválida", () => {
		const errors = reconciliationErrors(
			withLine({ lost: "0,1234567" }),
			bounds
		);
		expect(errors.lines[0]?.quantities).toBe("Confira as quantidades.");
		expect(
			reconciliationErrors(withLine({ consumed: "3,4a" }), bounds).lines[0]
				?.quantities
		).toBe("Confira as quantidades.");
		expect(
			reconciliationErrors(withLine({ consumed: "" }), bounds).lines[0]
				?.quantities
		).toBe("Confira as quantidades.");
		expect(hasReconciliationErrors(errors)).toBe(true);
		expect(
			reconciliationErrors(withLine({ lost: "0,123" }), bounds).lines[0]
				?.quantities
		).toBeNull();
	});

	test("partes que não somam a saída", () => {
		const errors = reconciliationErrors(withLine({ lost: "0,20" }), bounds);
		expect(errors.lines[0]?.parts).toBe(
			"As saídas somam 3,40 m, e a saída é 3,60 m."
		);
		expect(hasReconciliationErrors(errors)).toBe(true);
	});

	test("saída sem local, ou sem lote em variante com lote", () => {
		const noPlace = withPart(valid, 0, 0, { locationId: "" });
		expect(reconciliationErrors(noPlace, bounds).lines[0]?.parts).toBe(
			"Escolha o local e o lote de cada saída."
		);
		const swapped = withSwapReason(
			withSwap(valid, 0, liningVariant, points, sequence(700)),
			0,
			"Crepe acabou"
		);
		const noLot = withPart(swapped, 0, 1, { lotId: null });
		expect(reconciliationErrors(noLot, bounds).lines[0]?.parts).toBe(
			"Escolha o local e o lote de cada saída."
		);
	});

	test("local e lote repetidos", () => {
		const repeated = withLine({
			parts: [
				{
					locationId: closet,
					lotId: null,
					movementId: id(501),
					quantity: "3,00",
				},
				{
					locationId: closet,
					lotId: null,
					movementId: id(502),
					quantity: "0,40",
				},
			],
		});
		expect(reconciliationErrors(repeated, bounds).lines[0]?.parts).toBe(
			"Local e lote repetidos."
		);
	});

	test("mais de 20 saídas", () => {
		const many = withLine({
			consumed: "3,57",
			parts: Array.from({ length: 21 }, (_, n) => ({
				locationId: id(100 + n),
				lotId: null,
				movementId: id(200 + n),
				quantity: "0,17",
			})),
		});
		expect(reconciliationErrors(many, bounds).lines[0]?.parts).toBe(
			"Use até 20 saídas."
		);
	});

	test("troca sem motivo", () => {
		const swapped = withSwap(valid, 0, liningVariant, points, sequence(700));
		const errors = reconciliationErrors(
			withSwapReason(swapped, 0, "   "),
			bounds
		);
		expect(errors.lines[0]?.swap).toBe("Diga o motivo da troca.");
		expect(hasReconciliationErrors(errors)).toBe(true);
	});

	test("motivo da troca acima do limite depois de aparado", () => {
		const swapped = withSwap(valid, 0, liningVariant, points, sequence(700));
		const limit = reconciliationLimits.reason.max;
		const long = reconciliationErrors(
			withSwapReason(swapped, 0, "a".repeat(limit + 1)),
			bounds
		);
		expect(long.lines[0]?.swap).toBe("Use até 200 caracteres no motivo.");
		expect(hasReconciliationErrors(long)).toBe(true);
		expect(
			reconciliationErrors(
				withSwapReason(swapped, 0, ` ${"a".repeat(limit)} `),
				bounds
			).lines[0]?.swap
		).toBeNull();
	});

	test("nota acima do limite depois de aparada", () => {
		const limit = reconciliationLimits.note;
		const long = reconciliationErrors(
			{ ...valid, note: "a".repeat(limit + 1) },
			bounds
		);
		expect(long.note).toBe("Use até 200 caracteres na nota.");
		expect(hasReconciliationErrors(long)).toBe(true);
		const fits = reconciliationErrors(
			{ ...valid, note: ` ${"a".repeat(limit)} ` },
			bounds
		);
		expect(fits.note).toBeNull();
		expect(hasReconciliationErrors(fits)).toBe(false);
	});
});

describe("erros do estorno da reconciliação", () => {
	const reverseBounds = { reconciledOn: "2026-09-23", today: "2026-09-25" };
	const input = { occurredOn: "2026-09-24", reason: "Lançado errado" };

	test("estorno válido não tem erro", () => {
		expect(reverseReconciliationErrors(input, reverseBounds)).toEqual({
			date: null,
			reason: null,
		});
		expect(
			reverseReconciliationErrors(
				{ ...input, occurredOn: "2026-09-23" },
				reverseBounds
			).date
		).toBeNull();
	});

	test("data fora do formato, antes da reconciliação e no futuro", () => {
		expect(
			reverseReconciliationErrors(
				{ ...input, occurredOn: "2026-9-24" },
				reverseBounds
			).date
		).toBe("Data inválida");
		expect(
			reverseReconciliationErrors(
				{ ...input, occurredOn: "2026-09-22" },
				reverseBounds
			).date
		).toBe("A data não pode ser antes da reconciliação.");
		expect(
			reverseReconciliationErrors(
				{ ...input, occurredOn: "2026-09-26" },
				reverseBounds
			).date
		).toBe("A data não pode ser no futuro.");
	});

	test("motivo vazio ou acima do limite depois de aparado", () => {
		const limit = reconciliationLimits.reason.max;
		expect(
			reverseReconciliationErrors({ ...input, reason: "   " }, reverseBounds)
				.reason
		).toBe("Diga o motivo do estorno.");
		expect(
			reverseReconciliationErrors(
				{ ...input, reason: "a".repeat(limit + 1) },
				reverseBounds
			).reason
		).toBe("Use até 200 caracteres no motivo.");
		expect(
			reverseReconciliationErrors(
				{ ...input, reason: ` ${"a".repeat(limit)} ` },
				reverseBounds
			).reason
		).toBeNull();
	});
});

describe("payload e chave da reconciliação", () => {
	test("monta os campos do comando com micros e sem troca", () => {
		const draft = withQuantities(
			{ ...freshDraft(), note: "  Sobrou retalho " },
			0,
			"3,00",
			"0,20",
			points,
			sequence(600)
		);
		expect(reconciliationFields(draft, itemId)).toEqual({
			itemId,
			lines: [
				{
					consumedMicros: "3000000",
					lostMicros: "200000",
					parts: [
						{
							locationId: closet,
							lotId: null,
							movementId: id(601),
							quantityMicros: "3200000",
						},
					],
					plannedVariantId: crepe,
					swapReason: null,
					variantId: crepe,
				},
				{
					consumedMicros: "1000000",
					lostMicros: "0",
					parts: [
						{
							locationId: drawer,
							lotId: null,
							movementId: id(502),
							quantityMicros: "1000000",
						},
					],
					plannedVariantId: zipper,
					swapReason: null,
					variantId: zipper,
				},
			],
			note: "Sobrou retalho",
			occurredOn: "2026-09-25",
		});
		expect(reconciliationFields(freshDraft(), itemId).note).toBeNull();
	});

	test("a troca leva a variante nova e o motivo aparado", () => {
		const fields = reconciliationFields(
			withSwapReason(
				withSwap(freshDraft(), 0, liningVariant, points, sequence(700)),
				0,
				" Crepe acabou "
			),
			itemId
		);
		expect(fields.lines[0]).toMatchObject({
			plannedVariantId: crepe,
			swapReason: "Crepe acabou",
			variantId: lining,
		});
	});

	test("a chave é a mesma em outra ordem de chaves e muda com o conteúdo", () => {
		const fields = reconciliationFields(freshDraft(), itemId);
		const reordered = JSON.parse(
			JSON.stringify(
				Object.fromEntries(
					Object.entries({
						...fields,
						lines: fields.lines.map((current) =>
							Object.fromEntries(Object.entries(current).reverse())
						),
					}).reverse()
				)
			)
		);
		expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(fields));
		expect(reconciliationOpKey(id(900), reordered)).toBe(
			reconciliationOpKey(id(900), fields)
		);
		expect(reconciliationOpKey(id(900), fields)).toStartWith(`${id(900)}:`);
		const changed = reconciliationFields(
			withQuantities(freshDraft(), 0, "3,00", "0", points, () => id(501)),
			itemId
		);
		expect(reconciliationOpKey(id(900), changed)).not.toBe(
			reconciliationOpKey(id(900), fields)
		);
	});

	test("estorno com motivo aparado e chave pelo conteúdo", () => {
		const fields = reverseReconciliationFields({
			movementIds: [id(501), id(502)],
			occurredOn: "2026-09-25",
			reason: " Lançado errado ",
			reconciliationId: id(900),
		});
		expect(fields).toEqual({
			movementIds: [id(501), id(502)],
			occurredOn: "2026-09-25",
			reason: "Lançado errado",
			reconciliationId: id(900),
		});
		expect(reverseOpKey(fields)).toStartWith(`${id(900)}:reverse:`);
		expect(reverseOpKey({ ...fields, reason: "Outro" })).not.toBe(
			reverseOpKey(fields)
		);
		expect(
			reverseOpKey(
				JSON.parse(
					JSON.stringify({ ...fields, movementIds: fields.movementIds })
				)
			)
		).toBe(reverseOpKey(fields));
	});
});

describe("prévia da linha", () => {
	test("3,40 m sobre 2,50 m e R$ 75,00 fica negativo pela média", () => {
		expect(previewOf(line(freshDraft()), crepePoints)).toEqual({
			extraMicros: 0n,
			leftoverMicros: 0n,
			negative: {
				kind: "overdraw",
				micros: 900_000n,
				source: "average",
				unitCents: 3000n,
			},
			valueCents: 10_200n,
		});
	});

	test("sobre ponto zerado usa a referência, sem referência fica sem custo", () => {
		const empty = { ...crepePoints, points: [] };
		expect(previewOf(line(freshDraft()), empty)).toEqual({
			extraMicros: 0n,
			leftoverMicros: 0n,
			negative: {
				kind: "overdraw",
				micros: 3_400_000n,
				source: "reference",
				unitCents: 3000n,
			},
			valueCents: 10_200n,
		});
		expect(
			previewOf(line(freshDraft()), { ...empty, referenceCostCents: null })
		).toEqual({
			extraMicros: 0n,
			leftoverMicros: 0n,
			negative: {
				kind: "overdraw",
				micros: 3_400_000n,
				source: "none",
				unitCents: null,
			},
			valueCents: 0n,
		});
		expect(previewOf(line(freshDraft()), undefined).negative).toEqual({
			kind: "overdraw",
			micros: 3_400_000n,
			source: "none",
			unitCents: null,
		});
	});

	test("coberto pelo ponto não fica negativo, com sobra e a mais", () => {
		const less = withQuantities(
			freshDraft(),
			0,
			"2,00",
			"0",
			points,
			sequence(600)
		);
		expect(previewOf(line(less), crepePoints)).toEqual({
			extraMicros: 0n,
			leftoverMicros: 1_400_000n,
			negative: null,
			valueCents: 6000n,
		});
		const more = withQuantities(
			freshDraft(),
			1,
			"1",
			"1",
			points,
			sequence(600)
		);
		expect(previewOf(line(more, 1), zipperPoints)).toEqual({
			extraMicros: 1_000_000n,
			leftoverMicros: 0n,
			negative: null,
			valueCents: 740n,
		});
	});

	test("ponto com quantidade e sem valor positivo usa a referência", () => {
		const noValue: VariantPointsView = {
			...crepePoints,
			points: [
				{
					...(crepePoints.points[0] as VariantPointsView["points"][number]),
					quantityMicros: "100000",
					valueCents: "-700",
				},
			],
		};
		expect(previewOf(line(freshDraft()), noValue)).toEqual({
			extraMicros: 0n,
			leftoverMicros: 0n,
			negative: {
				kind: "noAverage",
				micros: 3_400_000n,
				source: "reference",
				unitCents: 3000n,
			},
			valueCents: 10_200n,
		});
	});

	test("a linha seguinte parte do saldo que a anterior deixou no ponto", () => {
		const draft = withSwapReason(
			withSwap(
				reconciliationDraftOf(twoLines, points, "2026-09-25", sequence(500)),
				1,
				crepeVariant,
				points,
				sequence(600)
			),
			1,
			"Forro manchou"
		);
		expect(line(draft).parts).toEqual([
			{
				locationId: closet,
				lotId: null,
				movementId: id(501),
				quantity: "2,00",
			},
		]);
		expect(line(draft, 1).parts).toEqual([
			{
				locationId: closet,
				lotId: null,
				movementId: id(601),
				quantity: "1,00",
			},
		]);
		expect(reconciliationPreview(draft, points)).toEqual([
			{
				extraMicros: 0n,
				leftoverMicros: 0n,
				negative: null,
				valueCents: 6000n,
			},
			{
				extraMicros: 0n,
				leftoverMicros: 0n,
				negative: {
					kind: "overdraw",
					micros: 500_000n,
					source: "average",
					unitCents: 3000n,
				},
				valueCents: 3000n,
			},
		]);
	});
});

describe("falha da reconciliação", () => {
	test("traduz as recusas de outra janela e repassa o resto", () => {
		expect(
			reconciliationFailure({
				kind: "exists",
				message: commandMessages.reconciliationExists,
			})
		).toBe(
			"Esta peça já foi reconciliada em outra janela. Confira os materiais."
		);
		expect(
			reconciliationFailure({
				kind: "exists",
				message: commandMessages.aggregateExists,
			})
		).toBe(
			"Esta reconciliação já tinha sido registrada. Confira os materiais."
		);
		expect(
			reconciliationFailure({
				kind: "other",
				message: commandMessages.reconciliationNotAtLastStage,
			})
		).toBe(
			"Esta peça mudou de etapa em outra janela. Confira e tente de novo."
		);
		expect(
			reconciliationFailure({
				kind: "other",
				message: commandMessages.reconciliationSwapUnit,
			})
		).toBe(commandMessages.reconciliationSwapUnit);
	});
});

describe("textos do diálogo de reconciliação", () => {
	test("sobra, a mais e a sobra zerada", () => {
		const exact = line(freshDraft());
		expect(lineOutcomeText(exact, previewOf(exact, crepePoints))).toBe(
			"sem sobra"
		);
		const less = line(
			withQuantities(freshDraft(), 0, "2,00", "0", points, sequence(600))
		);
		expect(lineOutcomeText(less, previewOf(less, crepePoints))).toBe(
			"Sobra 1,40 m"
		);
		const more = line(
			withQuantities(freshDraft(), 1, "1", "1", points, sequence(600)),
			1
		);
		expect(lineOutcomeText(more, previewOf(more, zipperPoints))).toBe(
			"1 un a mais"
		);
	});

	test("aviso de ponto negativo pela média, pela referência e sem custo", () => {
		const crepeLine = line(freshDraft());
		expect(negativeText(crepeLine, previewOf(crepeLine, crepePoints))).toBe(
			"Fica negativo em 0,90 m: custo provisório R$ 30,00/m (média do ponto)"
		);
		const empty = { ...crepePoints, points: [] };
		expect(negativeText(crepeLine, previewOf(crepeLine, empty))).toBe(
			"Fica negativo em 3,40 m: custo provisório R$ 30,00/m (custo de referência)"
		);
		expect(
			negativeText(
				crepeLine,
				previewOf(crepeLine, { ...empty, referenceCostCents: null })
			)
		).toBe("Fica negativo em 3,40 m: sem custo");
		const zipperLine = line(freshDraft(), 1);
		expect(
			negativeText(zipperLine, previewOf(zipperLine, zipperPoints))
		).toBeNull();
	});

	test("aviso de ponto sem custo médio, com e sem referência", () => {
		const crepeLine = line(freshDraft());
		const noAverage: VariantPointsView = {
			...crepePoints,
			points: [
				{
					...(crepePoints.points[0] as VariantPointsView["points"][number]),
					quantityMicros: "100000",
					valueCents: "0",
				},
			],
		};
		expect(negativeText(crepeLine, previewOf(crepeLine, noAverage))).toBe(
			"Ponto sem custo médio: 3,40 m a custo provisório R$ 30,00/m (custo de referência)"
		);
		expect(
			negativeText(
				crepeLine,
				previewOf(crepeLine, { ...noAverage, referenceCostCents: null })
			)
		).toBe("Ponto sem custo médio: 3,40 m sem custo");
	});

	test("troca só com a mesma unidade", () => {
		const crepeLine = line(freshDraft());
		expect(swapUnitHint({ baseUnit: "m" }, crepeLine)).toBeNull();
		expect(swapUnitHint({ baseUnit: "un" }, crepeLine)).toBe(
			"Outra unidade: a troca precisa ser em m."
		);
	});
});

describe("falhas dos comandos da reconciliação", () => {
	test("recusas de outra janela e registro já existente viram aviso", () => {
		expect(
			reconcileCommandFailure(
				new ORPCError("CONFLICT", {
					message: commandMessages.reconciliationExists,
				})
			)
		).toEqual({
			kind: "exists",
			message:
				"Esta peça já foi reconciliada em outra janela. Confira os materiais.",
		});
		expect(
			reconcileCommandFailure(
				new ORPCError("CONFLICT", { message: commandMessages.aggregateExists })
			)
		).toEqual({
			kind: "exists",
			message:
				"Esta reconciliação já tinha sido registrada. Confira os materiais.",
		});
		expect(
			reconcileCommandFailure(
				new ORPCError("NOT_FOUND", {
					message: commandMessages.reconciliationNotAtLastStage,
				})
			)
		).toEqual({
			kind: "other",
			message:
				"Esta peça mudou de etapa em outra janela. Confira e tente de novo.",
		});
		expect(
			reconcileCommandFailure(
				new ORPCError("NOT_FOUND", {
					message: commandMessages.reconciliationSwapUnit,
				})
			)
		).toEqual({
			kind: "other",
			message: commandMessages.reconciliationSwapUnit,
		});
		expect(
			reconcileCommandFailure(
				new ORPCError("PRECONDITION_FAILED", {
					message: commandMessages.clientAnonymized,
				})
			).kind
		).toBe("anonymized");
	});

	test("estorno repetido ou já feito em outra janela vira aviso", () => {
		expect(
			reverseCommandFailure(
				new ORPCError("CONFLICT", { message: commandMessages.aggregateExists })
			)
		).toEqual({
			kind: "exists",
			message: "Este estorno já tinha sido registrado. Confira os materiais.",
		});
		expect(
			reverseCommandFailure(
				new ORPCError("CONFLICT", {
					message: commandMessages.reconciliationReversed,
				})
			)
		).toEqual({
			kind: "exists",
			message: "Esta reconciliação já foi estornada em outra janela.",
		});
		expect(
			reverseCommandFailure(
				new ORPCError("NOT_FOUND", {
					message: commandMessages.reconciliationNotFound,
				})
			)
		).toEqual({
			kind: "other",
			message: commandMessages.reconciliationNotFound,
		});
	});
});

describe("desfecho dos comandos da reconciliação", () => {
	test("registro já existente do próprio id vira aviso, e o de outra janela, falha", () => {
		expect(
			reconcileSettlement(
				new ORPCError("CONFLICT", { message: commandMessages.aggregateExists })
			)
		).toEqual({
			kind: "notice",
			message:
				"Esta reconciliação já tinha sido registrada. Confira os materiais.",
		});
		expect(
			reconcileSettlement(
				new ORPCError("CONFLICT", {
					message: commandMessages.reconciliationExists,
				})
			)
		).toEqual({
			failure: {
				kind: "exists",
				message:
					"Esta peça já foi reconciliada em outra janela. Confira os materiais.",
			},
			kind: "failed",
		});
		expect(
			reconcileSettlement(
				new ORPCError("NOT_FOUND", {
					message: commandMessages.reconciliationSwapUnit,
				})
			)
		).toEqual({
			failure: {
				kind: "other",
				message: commandMessages.reconciliationSwapUnit,
			},
			kind: "failed",
		});
	});

	test("estorno já registrado ou já feito em outra janela vira aviso", () => {
		expect(
			reverseSettlement(
				new ORPCError("CONFLICT", {
					message: commandMessages.reconciliationReversed,
				})
			)
		).toEqual({
			kind: "notice",
			message: "Esta reconciliação já foi estornada em outra janela.",
		});
		expect(
			reverseSettlement(
				new ORPCError("CONFLICT", { message: commandMessages.aggregateExists })
			)
		).toEqual({
			kind: "notice",
			message: "Este estorno já tinha sido registrado. Confira os materiais.",
		});
		expect(
			reverseSettlement(
				new ORPCError("NOT_FOUND", {
					message: commandMessages.reconciliationNotFound,
				})
			)
		).toEqual({
			failure: {
				kind: "other",
				message: commandMessages.reconciliationNotFound,
			},
			kind: "failed",
		});
	});

	test("estorno aberto cuja reconciliação sumiu da leitura fecha com aviso, fora do envio", () => {
		expect(
			reverseDialogNotice({ open: true, reconciliation: null, sending: false })
		).toBe("Esta reconciliação já tinha sido estornada.");
		expect(
			reverseDialogNotice({ open: true, reconciliation: null, sending: true })
		).toBeNull();
		expect(
			reverseDialogNotice({ open: false, reconciliation: null, sending: false })
		).toBeNull();
		expect(
			reverseDialogNotice({
				open: true,
				reconciliation: { id: id(900) },
				sending: false,
			})
		).toBeNull();
	});
});

function movementIdsOf(draft: ReconciliationDraft): string[] {
	return draft.lines.flatMap((current) =>
		current.parts.map((part) => part.movementId)
	);
}

describe("rascunho guardado da página", () => {
	const open = { id: itemId, reconciled: false };

	test("reabrir devolve o mesmo id, as mesmas saídas e o mesmo opId", () => {
		const drafts = reconciliationDrafts(sequence(900));
		const kept = drafts.keep(itemId, freshDraft());
		const opId = kept.opIdFor("chave");
		expect(drafts.draftOf(open)).toEqual(kept.draft);
		const again = drafts.keep(itemId, drafts.draftOf(open) ?? freshDraft());
		expect(again.reconciliationId).toBe(kept.reconciliationId);
		expect(movementIdsOf(again.draft)).toEqual(movementIdsOf(kept.draft));
		expect(again.opIdFor("chave")).toBe(opId);
	});

	test("a leitura reconciliada e o registro já existente descartam a entrada", () => {
		const other = { id: id(802), reconciled: false };
		const drafts = reconciliationDrafts(sequence(900));
		drafts.keep(itemId, freshDraft());
		drafts.keep(other.id, freshDraft());
		drafts.forgetSettled([{ ...open, reconciled: true }, other]);
		expect(drafts.draftOf(open)).toBeNull();
		expect(drafts.draftOf(other)).not.toBeNull();
		drafts.forget(other.id);
		expect(drafts.draftOf(other)).toBeNull();
		drafts.keep(itemId, freshDraft());
		expect(drafts.draftOf({ ...open, reconciled: true })).toBeNull();
		expect(drafts.draftOf(open)).toBeNull();
	});

	test("depois do descarte, o id, as saídas e o opId são novos", () => {
		const drafts = reconciliationDrafts(sequence(900));
		const first = drafts.keep(itemId, freshDraft());
		const opId = first.opIdFor("chave");
		drafts.forget(itemId);
		const second = drafts.keep(itemId, first.draft);
		expect(second.reconciliationId).not.toBe(first.reconciliationId);
		expect(
			movementIdsOf(second.draft).some((movementId) =>
				movementIdsOf(first.draft).includes(movementId)
			)
		).toBe(false);
		expect(second.opIdFor("chave")).not.toBe(opId);
		expect(second.draft.lines.map((current) => current.consumed)).toEqual(
			first.draft.lines.map((current) => current.consumed)
		);
	});
});

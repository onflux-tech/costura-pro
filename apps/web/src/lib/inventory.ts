import {
	formatMoney,
	formatMoneyInput,
	parseMoney,
} from "@costura-pro/domain/money";
import {
	displayPrecision,
	multiplyHalfUp,
	parseQuantity,
} from "@costura-pro/domain/quantity";
import {
	balancePointId,
	type CountOutcome,
	countOutcome,
	exitValueCents,
	inventoryLimits,
} from "@costura-pro/domain/stock";
import { type BaseUnitCode, baseUnitCodes } from "@costura-pro/domain/unit";
import z from "zod";

import { dateError } from "./stock";

export type InventoryPointView = {
	archived: boolean;
	baseUnit: BaseUnitCode;
	code: string | null;
	displayPrecision: number;
	locationId: string;
	locationName: string;
	lotId: string | null;
	lotLabel: string | null;
	materialId: string;
	materialName: string;
	quantityMicros: string;
	referenceCostCents: string | null;
	tracksLots: boolean;
	valueCents: string;
	variantId: string;
	variantName: string;
};

export type DraftPoint = Omit<
	InventoryPointView,
	"quantityMicros" | "valueCents"
>;

export type DraftLine = {
	countedText: string;
	expectedMicros: string;
	movementId: string;
	point: DraftPoint;
	valueText: string | null;
};

export type InventoryDraft = {
	lines: Record<string, DraftLine>;
	locationIds: string[];
	notes: string;
	occurredOn: string;
	reason: string;
	sessionId: string;
	startedAt: string;
	version: 1;
};

export type Suggestion =
	| { cents: bigint; source: "average" | "reference" }
	| { source: "none" };

export type ReviewLine = {
	changedSinceCount: boolean;
	countedMicros: bigint;
	currentMicros: bigint;
	exitEstimateCents: bigint | null;
	expectedMicros: bigint;
	key: string;
	line: DraftLine;
	outcome: CountOutcome;
	suggestion: Suggestion;
};

export type InventoryReview = {
	divergent: ReviewLine[];
	invalid: string[];
	matched: ReviewLine[];
	uncounted: InventoryPointView[];
};

export type FinalizeField =
	| "lines"
	| "notes"
	| "occurredOn"
	| "reason"
	| `value:${string}`;

type PointIdentity = {
	locationId: string;
	lotId: string | null;
	variantId: string;
};

type PointBalance = { quantityMicros: string; valueCents: string };

const tooManyDecimals = /^\d+[.,]\d{7,}$/;

const combiningMarks = /\p{M}/gu;

const whitespace = /\s+/;

const signedInteger = /^-?\d{1,17}$/;

export function pointKey(point: PointIdentity): string {
	return balancePointId(point.variantId, point.locationId, point.lotId);
}

export function draftPointOf({
	quantityMicros,
	valueCents,
	...point
}: InventoryPointView): DraftPoint {
	return point;
}

export function startDraft({
	locationIds,
	now,
	sessionId,
	today,
}: {
	locationIds: readonly string[];
	now: Date;
	sessionId: string;
	today: string;
}): InventoryDraft {
	return {
		lines: {},
		locationIds: [...locationIds],
		notes: "",
		occurredOn: today,
		reason: "",
		sessionId,
		startedAt: now.toISOString(),
		version: 1,
	};
}

export function withoutLine(
	draft: InventoryDraft,
	key: string
): InventoryDraft {
	return {
		...draft,
		lines: Object.fromEntries(
			Object.entries(draft.lines).filter(([candidate]) => candidate !== key)
		),
	};
}

export function withCount(
	draft: InventoryDraft,
	point: DraftPoint,
	text: string,
	expectedMicros: string,
	movementId: string
): InventoryDraft {
	const key = pointKey(point);
	if (text.trim() === "") {
		return withoutLine(draft, key);
	}
	const current = draft.lines[key];
	const sameCount = current?.countedText === text;
	return {
		...draft,
		lines: {
			...draft.lines,
			[key]: {
				countedText: text,
				expectedMicros,
				movementId: current?.movementId ?? movementId,
				point,
				valueText: sameCount ? (current?.valueText ?? null) : null,
			},
		},
	};
}

export function withZeroCount(
	draft: InventoryDraft,
	point: InventoryPointView,
	movementId: string
): InventoryDraft {
	return withCount(
		draft,
		draftPointOf(point),
		"0",
		point.quantityMicros,
		movementId
	);
}

export function expectedAt(
	balance: readonly {
		locationId: string;
		lotId: string | null;
		quantityMicros: string;
	}[],
	locationId: string,
	lotId: string | null
): string {
	return (
		balance.find(
			(point) => point.locationId === locationId && point.lotId === lotId
		)?.quantityMicros ?? "0"
	);
}

export function pointLabel(
	point: Pick<DraftPoint, "lotLabel" | "materialName" | "variantName">
): string {
	const name = `${point.materialName} · ${point.variantName}`;
	return point.lotLabel ? `${name} · lote ${point.lotLabel}` : name;
}

export function locationsError(locationIds: readonly string[]): string | null {
	if (locationIds.length < inventoryLimits.locations.min) {
		return "Escolha pelo menos um local";
	}
	return locationIds.length > inventoryLimits.locations.max
		? `Escolha até ${inventoryLimits.locations.max} locais por contagem`
		: null;
}

export function lockedLocationIds(draft: InventoryDraft): Set<string> {
	return new Set(
		Object.values(draft.lines).map((line) => line.point.locationId)
	);
}

export function withLocations(
	draft: InventoryDraft,
	locationIds: readonly string[]
): InventoryDraft {
	const chosen = [...new Set(locationIds)];
	const kept = [...lockedLocationIds(draft)].filter(
		(locationId) => !chosen.includes(locationId)
	);
	return { ...draft, locationIds: [...chosen, ...kept] };
}

export function withSurplusValue(
	draft: InventoryDraft,
	key: string,
	text: string
): InventoryDraft {
	const current = draft.lines[key];
	return current
		? {
				...draft,
				lines: { ...draft.lines, [key]: { ...current, valueText: text } },
			}
		: draft;
}

export function withDetails(
	draft: InventoryDraft,
	details: Partial<Pick<InventoryDraft, "notes" | "occurredOn" | "reason">>
): InventoryDraft {
	return { ...draft, ...details };
}

function normalized(text: string): string {
	return text.normalize("NFD").replace(combiningMarks, "").toLowerCase().trim();
}

export function pointMatches(point: DraftPoint, filter: string): boolean {
	const wanted = normalized(filter);
	if (wanted === "") {
		return true;
	}
	const haystack = normalized(
		[
			point.materialName,
			point.variantName,
			point.code ?? "",
			point.lotLabel ?? "",
		].join(" ")
	);
	return wanted.split(whitespace).every((token) => haystack.includes(token));
}

export function draftSummary(draft: InventoryDraft): string {
	const lines = Object.keys(draft.lines).length;
	const locations = draft.locationIds.length;
	const where = locations === 1 ? "1 local" : `${locations} locais`;
	if (lines === 0) {
		return `Nenhum item contado ainda em ${where}`;
	}
	return lines === 1
		? `1 item contado em ${where}`
		: `${lines} itens contados em ${where}`;
}

export function countError(text: string): string | null {
	const trimmed = text.trim();
	if (trimmed === "" || parseQuantity(trimmed, displayPrecision.max) !== null) {
		return null;
	}
	return tooManyDecimals.test(trimmed)
		? `Use no máximo ${displayPrecision.max} casas decimais`
		: "Use só número, com vírgula";
}

export function surplusSuggestion(
	point: PointBalance | null,
	referenceCostCents: string | null,
	surplusMicros: bigint
): Suggestion {
	if (point && BigInt(point.quantityMicros) > 0n) {
		return {
			cents: exitValueCents(
				BigInt(point.quantityMicros),
				BigInt(point.valueCents),
				surplusMicros
			),
			source: "average",
		};
	}
	if (referenceCostCents !== null) {
		return {
			cents: multiplyHalfUp(surplusMicros, BigInt(referenceCostCents)),
			source: "reference",
		};
	}
	return { source: "none" };
}

function comparePoints(left: DraftPoint, right: DraftPoint): number {
	return (
		left.locationName.localeCompare(right.locationName, "pt-BR") ||
		left.materialName.localeCompare(right.materialName, "pt-BR") ||
		left.variantName.localeCompare(right.variantName, "pt-BR") ||
		(left.lotLabel ?? "").localeCompare(right.lotLabel ?? "", "pt-BR")
	);
}

function sortedLines(
	lines: readonly [string, DraftLine][]
): [string, DraftLine][] {
	return [...lines].sort(([, left], [, right]) =>
		comparePoints(left.point, right.point)
	);
}

function exitEstimate(
	outcome: CountOutcome,
	point: PointBalance | null
): bigint | null {
	if (outcome.kind !== "shortage") {
		return null;
	}
	return point
		? exitValueCents(
				BigInt(point.quantityMicros),
				BigInt(point.valueCents),
				-outcome.quantityMicros
			)
		: 0n;
}

function reviewLine(
	key: string,
	line: DraftLine,
	countedMicros: bigint,
	point: InventoryPointView | null
): ReviewLine {
	const expectedMicros = BigInt(line.expectedMicros);
	const outcome = countOutcome(expectedMicros, countedMicros);
	const currentMicros = point ? BigInt(point.quantityMicros) : 0n;
	return {
		changedSinceCount: currentMicros !== expectedMicros,
		countedMicros,
		currentMicros,
		exitEstimateCents: exitEstimate(outcome, point),
		expectedMicros,
		key,
		line,
		outcome,
		suggestion:
			outcome.kind === "surplus"
				? surplusSuggestion(
						point,
						line.point.referenceCostCents,
						outcome.quantityMicros
					)
				: { source: "none" },
	};
}

export function reviewOf(
	draft: InventoryDraft,
	points: readonly InventoryPointView[]
): InventoryReview {
	const current = new Map(points.map((point) => [pointKey(point), point]));
	const review: InventoryReview = {
		divergent: [],
		invalid: [],
		matched: [],
		uncounted: points.filter(
			(point) => !Object.hasOwn(draft.lines, pointKey(point))
		),
	};
	for (const [key, line] of sortedLines(Object.entries(draft.lines))) {
		const counted = parseQuantity(
			line.countedText.trim(),
			displayPrecision.max
		);
		if (counted === null) {
			review.invalid.push(key);
		} else {
			const reviewed = reviewLine(key, line, counted, current.get(key) ?? null);
			(reviewed.outcome.kind === "match"
				? review.matched
				: review.divergent
			).push(reviewed);
		}
	}
	return review;
}

export function surplusValueText(line: ReviewLine): string {
	if (line.line.valueText !== null) {
		return line.line.valueText;
	}
	return line.suggestion.source === "none"
		? ""
		: formatMoneyInput(line.suggestion.cents);
}

export function extraLines(
	draft: InventoryDraft,
	points: readonly InventoryPointView[],
	locationId: string
): [string, DraftLine][] {
	const listed = new Set(points.map(pointKey));
	return sortedLines(
		Object.entries(draft.lines).filter(
			([key, line]) => line.point.locationId === locationId && !listed.has(key)
		)
	);
}

export function locationProgress(
	draft: InventoryDraft,
	points: readonly InventoryPointView[],
	locationId: string
): { counted: number; total: number } {
	const listed = points.filter((point) => point.locationId === locationId);
	return {
		counted: Object.values(draft.lines).filter(
			(line) => line.point.locationId === locationId
		).length,
		total: listed.length + extraLines(draft, points, locationId).length,
	};
}

function reasonError(reason: string): string | null {
	const trimmed = reason.trim();
	if (trimmed === "") {
		return "Diga o motivo da contagem";
	}
	return trimmed.length > inventoryLimits.reason.max
		? `Use até ${inventoryLimits.reason.max} caracteres`
		: null;
}

function linesError(review: InventoryReview): string | null {
	const counted = review.divergent.length + review.matched.length;
	if (review.invalid.length > 0) {
		return "Volte à contagem e corrija os números fora do formato";
	}
	if (counted === 0) {
		return "Conte pelo menos um item";
	}
	return counted > inventoryLimits.lines.max
		? `No máximo ${inventoryLimits.lines.max} itens por contagem; divida em duas`
		: null;
}

function valueErrors(
	review: InventoryReview
): Partial<Record<FinalizeField, string>> {
	return Object.fromEntries(
		review.divergent
			.filter(
				(line) =>
					line.outcome.kind === "surplus" &&
					parseMoney(surplusValueText(line)) === null
			)
			.map((line) => [`value:${line.key}`, "Informe o valor da entrada"])
	);
}

export function finalizeErrors(
	draft: InventoryDraft,
	review: InventoryReview
): Partial<Record<FinalizeField, string>> {
	const reason = reasonError(draft.reason);
	const occurredOn = dateError(draft.occurredOn);
	const lines = linesError(review);
	const notes =
		draft.notes.trim().length > inventoryLimits.notes
			? `Use até ${inventoryLimits.notes} caracteres`
			: null;
	return {
		...(reason ? { reason } : {}),
		...(occurredOn ? { occurredOn } : {}),
		...(notes ? { notes } : {}),
		...(lines ? { lines } : {}),
		...valueErrors(review),
	};
}

export function inventoryFields(
	draft: InventoryDraft,
	review: InventoryReview
): {
	lines: {
		countedMicros: string;
		expectedMicros: string;
		locationId: string;
		lotId: string | null;
		movementId: string | null;
		valueCents: string | null;
		variantId: string;
	}[];
	notes: string | null;
	occurredOn: string;
	reason: string;
} {
	const notes = draft.notes.trim();
	return {
		lines: [...review.divergent, ...review.matched]
			.sort((left, right) => comparePoints(left.line.point, right.line.point))
			.map((line) => ({
				countedMicros: line.countedMicros.toString(),
				expectedMicros: line.expectedMicros.toString(),
				locationId: line.line.point.locationId,
				lotId: line.line.point.lotId,
				movementId: line.outcome.kind === "match" ? null : line.line.movementId,
				valueCents:
					line.outcome.kind === "surplus"
						? (parseMoney(surplusValueText(line)) ?? 0n).toString()
						: null,
				variantId: line.line.point.variantId,
			})),
		notes: notes === "" ? null : notes,
		occurredOn: draft.occurredOn,
		reason: draft.reason.trim(),
	};
}

const draftPointSchema = z.object({
	archived: z.boolean(),
	baseUnit: z.enum(baseUnitCodes),
	code: z.string().nullable(),
	displayPrecision: z.number().int().min(0).max(6),
	locationId: z.string(),
	locationName: z.string(),
	lotId: z.string().nullable(),
	lotLabel: z.string().nullable(),
	materialId: z.string(),
	materialName: z.string(),
	referenceCostCents: z.string().nullable(),
	tracksLots: z.boolean(),
	variantId: z.string(),
	variantName: z.string(),
});

const draftSchema = z.object({
	lines: z.record(
		z.string(),
		z.object({
			countedText: z.string(),
			expectedMicros: z.string().regex(signedInteger),
			movementId: z.string(),
			point: draftPointSchema,
			valueText: z.string().nullable(),
		})
	),
	locationIds: z.array(z.string()),
	notes: z.string(),
	occurredOn: z.string(),
	reason: z.string(),
	sessionId: z.string(),
	startedAt: z.string(),
	version: z.literal(1),
});

export function parseDraft(raw: string | null): InventoryDraft | null {
	if (raw === null) {
		return null;
	}
	try {
		const parsed = draftSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export function serializeDraft(draft: InventoryDraft): string {
	return JSON.stringify(draft);
}

export function sessionSummary(
	lines: readonly { movementId: string | null; valueCents: string | null }[]
): { divergent: number; entryCents: bigint; exitCents: bigint } {
	return lines.reduce(
		(summary, line) => {
			if (line.movementId === null || line.valueCents === null) {
				return summary;
			}
			const value = BigInt(line.valueCents);
			return {
				divergent: summary.divergent + 1,
				entryCents:
					value > 0n ? summary.entryCents + value : summary.entryCents,
				exitCents: value < 0n ? summary.exitCents - value : summary.exitCents,
			};
		},
		{ divergent: 0, entryCents: 0n, exitCents: 0n }
	);
}

export function linesByLocation<
	Line extends { locationId: string; locationName: string },
>(
	lines: readonly Line[]
): { lines: Line[]; locationId: string; locationName: string }[] {
	const groups = new Map<
		string,
		{ lines: Line[]; locationId: string; locationName: string }
	>();
	for (const line of lines) {
		const group = groups.get(line.locationId) ?? {
			lines: [],
			locationId: line.locationId,
			locationName: line.locationName,
		};
		group.lines.push(line);
		groups.set(line.locationId, group);
	}
	return [...groups.values()].sort((left, right) =>
		left.locationName.localeCompare(right.locationName, "pt-BR")
	);
}

export type CountLine = {
	expectedMicros: string;
	key: string;
	point: DraftPoint;
	removable: boolean;
};

export function countRows(
	draft: InventoryDraft,
	points: readonly InventoryPointView[],
	locationId: string
): CountLine[] {
	return [
		...points
			.filter((point) => point.locationId === locationId)
			.map((point) => ({
				expectedMicros: point.quantityMicros,
				key: pointKey(point),
				point: draftPointOf(point),
				removable: false,
			})),
		...extraLines(draft, points, locationId).map(([key, line]) => ({
			expectedMicros: "0",
			key,
			point: line.point,
			removable: true,
		})),
	];
}

const suggestionHints: Record<Suggestion["source"], string> = {
	average: "Média do ponto",
	none: "Sem sugestão: informe o valor",
	reference: "Custo de referência",
};

const suggestionSources = {
	average: "a média do ponto",
	reference: "o custo de referência",
} as const;

export function valueHint(line: ReviewLine): string {
	const { suggestion } = line;
	if (line.line.valueText === null) {
		return suggestionHints[suggestion.source];
	}
	if (suggestion.source === "none") {
		return "Valor digitado";
	}
	return `Valor digitado; ${suggestionSources[suggestion.source]} dá R$ ${formatMoney(suggestion.cents)}`;
}

export function inventoryOpKey(
	draft: InventoryDraft,
	fields: ReturnType<typeof inventoryFields>
): string {
	return JSON.stringify({ fields, sessionId: draft.sessionId });
}

export function invalidLabels(
	draft: InventoryDraft,
	review: InventoryReview
): string[] {
	return review.invalid.flatMap((key) => {
		const line = draft.lines[key];
		return line
			? [`${pointLabel(line.point)} em ${line.point.locationName}`]
			: [];
	});
}

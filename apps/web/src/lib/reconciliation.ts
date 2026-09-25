import { commandMessages } from "@costura-pro/api/command-messages";
import { canonicalJson } from "@costura-pro/domain/canonical-json";
import {
	formatQuantityInput,
	parseQuantity,
	quantityScale,
} from "@costura-pro/domain/quantity";
import {
	consumptionPartValue,
	reconciliationLimits,
	reconciliationOutcome,
	suggestConsumptionParts,
} from "@costura-pro/domain/reconciliation";
import { exitValueCents } from "@costura-pro/domain/stock";
import type { BaseUnitCode } from "@costura-pro/domain/unit";

import { dayError } from "./quote-drafts";
import type { MaterialRowView } from "./service-orders";
import { pointQuantity } from "./stock";

export type VariantPointsView = {
	baseUnit: BaseUnitCode;
	displayPrecision: number;
	points: {
		locationId: string;
		locationName: string;
		lotCreatedAt: string | null;
		lotId: string | null;
		lotLabel: string | null;
		quantityMicros: string;
		valueCents: string;
	}[];
	referenceCostCents: string | null;
	tracksLots: boolean;
	variantId: string;
};

export type PartDraft = {
	locationId: string;
	lotId: string | null;
	movementId: string;
	quantity: string;
};

export type LineDraft = {
	consumed: string;
	label: string;
	lost: string;
	parts: PartDraft[];
	plannedMicros: string;
	plannedVariantId: string;
	swapReason: string;
	variant: {
		baseUnit: BaseUnitCode;
		displayPrecision: number;
		id: string;
		label: string;
		tracksLots: boolean;
	};
};

export type ReconciliationDraft = {
	lines: LineDraft[];
	note: string;
	occurredOn: string;
};

export type ReconcileFields = {
	itemId: string;
	lines: {
		consumedMicros: string;
		lostMicros: string;
		parts: {
			locationId: string;
			lotId: string | null;
			movementId: string;
			quantityMicros: string;
		}[];
		plannedVariantId: string;
		swapReason: string | null;
		variantId: string;
	}[];
	note: string | null;
	occurredOn: string;
};

export type ReverseFields = {
	movementIds: string[];
	occurredOn: string;
	reason: string;
	reconciliationId: string;
};

function outMicros(line: LineDraft): bigint | null {
	const consumed = parseQuantity(line.consumed, line.variant.displayPrecision);
	const lost = parseQuantity(line.lost, line.variant.displayPrecision);
	return consumed === null || lost === null ? null : consumed + lost;
}

function suggestedParts(
	variant: LineDraft["variant"],
	need: bigint,
	points: readonly VariantPointsView[],
	newId: () => string
): PartDraft[] {
	if (need === 0n) {
		return [];
	}
	const list =
		points.find((entry) => entry.variantId === variant.id)?.points ?? [];
	const suggested = suggestConsumptionParts(
		list.map((point) => ({
			locationId: point.locationId,
			locationName: point.locationName,
			lotCreatedAt: point.lotCreatedAt,
			lotId: point.lotId,
			quantityMicros: BigInt(point.quantityMicros),
		})),
		need
	);
	const [first] = list;
	const parts =
		suggested.length > 0
			? suggested
			: [
					{
						locationId: first?.locationId ?? "",
						lotId: first?.lotId ?? null,
						quantityMicros: need,
					},
				];
	return parts.map((part) => ({
		locationId: part.locationId,
		lotId: part.lotId,
		movementId: newId(),
		quantity: formatQuantityInput(
			part.quantityMicros,
			variant.displayPrecision
		),
	}));
}

function withLine(
	draft: ReconciliationDraft,
	index: number,
	change: (line: LineDraft) => LineDraft
): ReconciliationDraft {
	return {
		...draft,
		lines: draft.lines.map((line, position) =>
			position === index ? change(line) : line
		),
	};
}

function resuggested(
	line: LineDraft,
	points: readonly VariantPointsView[],
	newId: () => string
): LineDraft {
	const need = outMicros(line);
	return need === null
		? line
		: { ...line, parts: suggestedParts(line.variant, need, points, newId) };
}

export function reconciliationDraftOf(
	rows: readonly MaterialRowView[],
	points: readonly VariantPointsView[],
	today: string,
	newId: () => string
): ReconciliationDraft {
	return {
		lines: rows.map((row) => {
			const variant = {
				baseUnit: row.baseUnit,
				displayPrecision: row.displayPrecision,
				id: row.variantId,
				label: row.label,
				tracksLots:
					points.find((entry) => entry.variantId === row.variantId)
						?.tracksLots ?? false,
			};
			return {
				consumed: formatQuantityInput(row.plannedMicros, row.displayPrecision),
				label: row.label,
				lost: "0",
				parts: suggestedParts(variant, row.plannedMicros, points, newId),
				plannedMicros: row.plannedMicros.toString(),
				plannedVariantId: row.variantId,
				swapReason: "",
				variant,
			};
		}),
		note: "",
		occurredOn: today,
	};
}

export function withQuantities(
	draft: ReconciliationDraft,
	index: number,
	consumed: string,
	lost: string,
	points: readonly VariantPointsView[],
	newId: () => string
): ReconciliationDraft {
	return withLine(draft, index, (line) =>
		resuggested({ ...line, consumed, lost }, points, newId)
	);
}

export function withSwap(
	draft: ReconciliationDraft,
	index: number,
	variant: LineDraft["variant"],
	points: readonly VariantPointsView[],
	newId: () => string
): ReconciliationDraft {
	return withLine(draft, index, (line) =>
		resuggested({ ...line, variant }, points, newId)
	);
}

export function withSwapReason(
	draft: ReconciliationDraft,
	index: number,
	swapReason: string
): ReconciliationDraft {
	return withLine(draft, index, (line) => ({ ...line, swapReason }));
}

export function withPart(
	draft: ReconciliationDraft,
	index: number,
	part: number,
	change: Partial<PartDraft>
): ReconciliationDraft {
	return withLine(draft, index, (line) => ({
		...line,
		parts: line.parts.map((current, position) =>
			position === part ? { ...current, ...change } : current
		),
	}));
}

export function splitPart(
	draft: ReconciliationDraft,
	index: number,
	newId: () => string
): ReconciliationDraft {
	const line = draft.lines[index];
	if (
		line === undefined ||
		line.parts.length >= reconciliationLimits.parts.max
	) {
		return draft;
	}
	return withLine(draft, index, (current) => ({
		...current,
		parts: [
			...current.parts,
			{ locationId: "", lotId: null, movementId: newId(), quantity: "" },
		],
	}));
}

export function removePart(
	draft: ReconciliationDraft,
	index: number,
	part: number
): ReconciliationDraft {
	return withLine(draft, index, (line) => ({
		...line,
		parts: line.parts.filter((_, position) => position !== part),
	}));
}

export type ReconciliationErrors = {
	date: string | null;
	lines: {
		parts: string | null;
		quantities: string | null;
		swap: string | null;
	}[];
	note: string | null;
};

function dateError(
	occurredOn: string,
	earliest: { day: string; message: string },
	today: string
): string | null {
	if (dayError(occurredOn, "9999-12-31")) {
		return "Data inválida";
	}
	if (occurredOn < earliest.day) {
		return earliest.message;
	}
	return occurredOn > today ? "A data não pode ser no futuro." : null;
}

const reasonTooLong = `Use até ${reconciliationLimits.reason.max} caracteres no motivo.`;

function reasonError(reason: string, missing: string): string | null {
	const trimmed = reason.trim();
	if (trimmed.length < reconciliationLimits.reason.min) {
		return missing;
	}
	return trimmed.length > reconciliationLimits.reason.max
		? reasonTooLong
		: null;
}

function partsError(line: LineDraft): string | null {
	const { baseUnit, displayPrecision, tracksLots } = line.variant;
	if (line.parts.length > reconciliationLimits.parts.max) {
		return `Use até ${reconciliationLimits.parts.max} saídas.`;
	}
	if (
		line.parts.some(
			(part) => part.locationId === "" || (tracksLots && part.lotId === null)
		)
	) {
		return "Escolha o local e o lote de cada saída.";
	}
	const quantities = line.parts.map((part) =>
		parseQuantity(part.quantity, displayPrecision)
	);
	if (quantities.some((quantity) => quantity === null || quantity <= 0n)) {
		return "Confira as quantidades.";
	}
	const points = line.parts.map(
		(part) => `${part.locationId}|${part.lotId ?? ""}`
	);
	if (new Set(points).size !== points.length) {
		return "Local e lote repetidos.";
	}
	const need = outMicros(line);
	const total = quantities.reduce<bigint>(
		(sum, quantity) => sum + (quantity ?? 0n),
		0n
	);
	if (need === null || total === need) {
		return null;
	}
	const text = (value: bigint) =>
		pointQuantity(value.toString(), baseUnit, displayPrecision);
	return `As saídas somam ${text(total)}, e a saída é ${text(need)}.`;
}

export function reconciliationErrors(
	draft: ReconciliationDraft,
	bounds: { openedOn: string; today: string }
): ReconciliationErrors {
	return {
		date: dateError(
			draft.occurredOn,
			{
				day: bounds.openedOn,
				message: "A data não pode ser antes da abertura da OS.",
			},
			bounds.today
		),
		lines: draft.lines.map((line) => ({
			parts: partsError(line),
			quantities: outMicros(line) === null ? "Confira as quantidades." : null,
			swap:
				line.variant.id === line.plannedVariantId
					? null
					: reasonError(line.swapReason, "Diga o motivo da troca."),
		})),
		note:
			draft.note.trim().length > reconciliationLimits.note
				? `Use até ${reconciliationLimits.note} caracteres na nota.`
				: null,
	};
}

export function hasReconciliationErrors(errors: ReconciliationErrors): boolean {
	return (
		errors.date !== null ||
		errors.note !== null ||
		errors.lines.some(
			(line) =>
				line.parts !== null || line.quantities !== null || line.swap !== null
		)
	);
}

export function reconciliationFields(
	draft: ReconciliationDraft,
	itemId: string
): ReconcileFields {
	const note = draft.note.trim();
	return {
		itemId,
		lines: draft.lines.map((line) => {
			const { displayPrecision, id } = line.variant;
			const text = (value: string) =>
				(parseQuantity(value, displayPrecision) ?? 0n).toString();
			return {
				consumedMicros: text(line.consumed),
				lostMicros: text(line.lost),
				parts: line.parts.map((part) => ({
					locationId: part.locationId,
					lotId: part.lotId,
					movementId: part.movementId,
					quantityMicros: text(part.quantity),
				})),
				plannedVariantId: line.plannedVariantId,
				swapReason:
					id === line.plannedVariantId ? null : line.swapReason.trim(),
				variantId: id,
			};
		}),
		note: note === "" ? null : note,
		occurredOn: draft.occurredOn,
	};
}

export function reconciliationOpKey(
	reconciliationId: string,
	fields: ReconcileFields
): string {
	return `${reconciliationId}:${canonicalJson(fields)}`;
}

export type LinePreview = {
	extraMicros: bigint;
	leftoverMicros: bigint;
	negative: {
		micros: bigint;
		source: "average" | "none" | "reference";
		unitCents: bigint | null;
	} | null;
	valueCents: bigint;
};

type PointBalance = { quantityMicros: bigint; valueCents: bigint };

function negativeSource(
	balance: PointBalance,
	referenceCostCents: bigint | null
): Omit<NonNullable<LinePreview["negative"]>, "micros"> {
	if (balance.quantityMicros > 0n) {
		return {
			source: "average",
			unitCents: exitValueCents(
				balance.quantityMicros,
				balance.valueCents,
				quantityScale
			),
		};
	}
	return referenceCostCents === null
		? { source: "none", unitCents: null }
		: { source: "reference", unitCents: referenceCostCents };
}

export function linePreview(
	line: LineDraft,
	points: VariantPointsView | undefined
): LinePreview {
	const { displayPrecision } = line.variant;
	const outcome = reconciliationOutcome(
		BigInt(line.plannedMicros),
		parseQuantity(line.consumed, displayPrecision) ?? 0n,
		parseQuantity(line.lost, displayPrecision) ?? 0n
	);
	const reference =
		points === undefined || points.referenceCostCents === null
			? null
			: BigInt(points.referenceCostCents);
	const balances = new Map<string, PointBalance>(
		(points?.points ?? []).map((point) => [
			`${point.locationId}|${point.lotId ?? ""}`,
			{
				quantityMicros: BigInt(point.quantityMicros),
				valueCents: BigInt(point.valueCents),
			},
		])
	);
	let valueCents = 0n;
	let negativeMicros = 0n;
	let source: ReturnType<typeof negativeSource> | null = null;
	for (const part of line.parts) {
		const quantity = parseQuantity(part.quantity, displayPrecision);
		if (quantity === null || quantity <= 0n) {
			continue;
		}
		const key = `${part.locationId}|${part.lotId ?? ""}`;
		const balance = balances.get(key) ?? { quantityMicros: 0n, valueCents: 0n };
		const value = consumptionPartValue(
			balance.quantityMicros,
			balance.valueCents,
			quantity,
			reference
		);
		if (value.provisionalMicros > 0n) {
			negativeMicros += value.provisionalMicros;
			source ??= negativeSource(balance, reference);
		}
		valueCents += value.valueCents;
		balances.set(key, {
			quantityMicros: balance.quantityMicros - quantity,
			valueCents: balance.valueCents - value.valueCents,
		});
	}
	return {
		extraMicros: outcome.extraMicros,
		leftoverMicros: outcome.leftoverMicros,
		negative: source === null ? null : { micros: negativeMicros, ...source },
		valueCents,
	};
}

export function reconciliationFailure(failure: {
	kind: "anonymized" | "exists" | "other" | "stale";
	message: string;
}): string {
	if (failure.kind === "exists") {
		return failure.message === commandMessages.reconciliationExists
			? "Esta peça já foi reconciliada em outra janela. Confira os materiais."
			: "Esta reconciliação já tinha sido registrada. Confira os materiais.";
	}
	if (
		failure.kind === "other" &&
		failure.message === commandMessages.reconciliationNotAtLastStage
	) {
		return "Esta peça mudou de etapa em outra janela. Confira e tente de novo.";
	}
	return failure.message;
}

export function reverseReconciliationFields(input: {
	movementIds: string[];
	occurredOn: string;
	reason: string;
	reconciliationId: string;
}): ReverseFields {
	return {
		movementIds: [...input.movementIds],
		occurredOn: input.occurredOn,
		reason: input.reason.trim(),
		reconciliationId: input.reconciliationId,
	};
}

export function reverseOpKey(fields: ReverseFields): string {
	return `${fields.reconciliationId}:reverse:${canonicalJson(fields)}`;
}

export function reverseReconciliationErrors(
	input: { occurredOn: string; reason: string },
	bounds: { reconciledOn: string; today: string }
): { date: string | null; reason: string | null } {
	return {
		date: dateError(
			input.occurredOn,
			{
				day: bounds.reconciledOn,
				message: "A data não pode ser antes da reconciliação.",
			},
			bounds.today
		),
		reason: reasonError(input.reason, "Diga o motivo do estorno."),
	};
}

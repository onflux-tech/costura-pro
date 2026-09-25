import { commandMessages } from "@costura-pro/api/command-messages";
import { canonicalJson } from "@costura-pro/domain/canonical-json";
import {
	displayPrecision,
	formatQuantityInput,
	parseQuantity,
	quantityScale,
} from "@costura-pro/domain/quantity";
import {
	hasAverageCost,
	type PointBalance,
	reconciliationLimits,
	reconciliationOutcome,
	suggestConsumptionParts,
	valueConsumptionParts,
} from "@costura-pro/domain/reconciliation";
import { exitValueCents } from "@costura-pro/domain/stock";
import type { BaseUnitCode } from "@costura-pro/domain/unit";
import { ORPCError } from "@orpc/client";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "./client-command-error";
import { moneyLabel } from "./finance";
import { unitAbbreviation } from "./materials";
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

export function quantityOf(text: string): bigint | null {
	return parseQuantity(text, displayPrecision.max);
}

function outMicros(line: LineDraft): bigint | null {
	const consumed = quantityOf(line.consumed);
	const lost = quantityOf(line.lost);
	return consumed === null || lost === null ? null : consumed + lost;
}

function pointKey(
	variantId: string,
	locationId: string,
	lotId: string | null
): string {
	return `${variantId}|${locationId}|${lotId ?? ""}`;
}

function takenBy(lines: readonly LineDraft[]): Map<string, bigint> {
	const taken = new Map<string, bigint>();
	for (const line of lines) {
		for (const part of line.parts) {
			const quantity = quantityOf(part.quantity);
			if (quantity !== null && quantity > 0n) {
				const key = pointKey(line.variant.id, part.locationId, part.lotId);
				taken.set(key, (taken.get(key) ?? 0n) + quantity);
			}
		}
	}
	return taken;
}

function suggestedParts(
	variant: LineDraft["variant"],
	need: bigint,
	points: readonly VariantPointsView[],
	earlier: readonly LineDraft[],
	newId: () => string
): PartDraft[] {
	if (need === 0n) {
		return [];
	}
	const list =
		points.find((entry) => entry.variantId === variant.id)?.points ?? [];
	const taken = takenBy(earlier);
	const suggested = suggestConsumptionParts(
		list.map((point) => ({
			locationId: point.locationId,
			locationName: point.locationName,
			lotCreatedAt: point.lotCreatedAt,
			lotId: point.lotId,
			quantityMicros:
				BigInt(point.quantityMicros) -
				(taken.get(pointKey(variant.id, point.locationId, point.lotId)) ?? 0n),
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
	draft: ReconciliationDraft,
	index: number,
	change: Partial<LineDraft>,
	points: readonly VariantPointsView[],
	newId: () => string
): ReconciliationDraft {
	const earlier = draft.lines.slice(0, index);
	return withLine(draft, index, (current) => {
		const line = { ...current, ...change };
		const need = outMicros(line);
		return need === null
			? line
			: {
					...line,
					parts: suggestedParts(line.variant, need, points, earlier, newId),
				};
	});
}

export function reconciliationDraftOf(
	rows: readonly MaterialRowView[],
	points: readonly VariantPointsView[],
	today: string,
	newId: () => string
): ReconciliationDraft {
	const lines: LineDraft[] = [];
	for (const row of rows) {
		const variant = {
			baseUnit: row.baseUnit,
			displayPrecision: row.displayPrecision,
			id: row.variantId,
			label: row.label,
			tracksLots:
				points.find((entry) => entry.variantId === row.variantId)?.tracksLots ??
				false,
		};
		lines.push({
			consumed: formatQuantityInput(row.plannedMicros, row.displayPrecision),
			label: row.label,
			lost: "0",
			parts: suggestedParts(variant, row.plannedMicros, points, lines, newId),
			plannedMicros: row.plannedMicros.toString(),
			plannedVariantId: row.variantId,
			swapReason: "",
			variant,
		});
	}
	return { lines, note: "", occurredOn: today };
}

export function withQuantities(
	draft: ReconciliationDraft,
	index: number,
	consumed: string,
	lost: string,
	points: readonly VariantPointsView[],
	newId: () => string
): ReconciliationDraft {
	return resuggested(draft, index, { consumed, lost }, points, newId);
}

export function withSwap(
	draft: ReconciliationDraft,
	index: number,
	variant: LineDraft["variant"],
	points: readonly VariantPointsView[],
	newId: () => string
): ReconciliationDraft {
	return resuggested(draft, index, { variant }, points, newId);
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
	const { baseUnit, tracksLots } = line.variant;
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
	const quantities = line.parts.map((part) => quantityOf(part.quantity));
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
		pointQuantity(value.toString(), baseUnit, line.variant.displayPrecision);
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
			const { id } = line.variant;
			const text = (value: string) => (quantityOf(value) ?? 0n).toString();
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

export type ProvisionalExit = {
	kind: "noAverage" | "overdraw";
	micros: bigint;
	part: number;
	source: "average" | "none" | "reference";
	unitCents: bigint | null;
};

export type LinePreview = {
	extraMicros: bigint;
	leftoverMicros: bigint;
	provisional: ProvisionalExit[];
	valueCents: bigint;
};

function negativeSource(
	before: PointBalance,
	referenceCostCents: bigint | null
): Omit<ProvisionalExit, "micros" | "part"> {
	if (hasAverageCost(before.quantityMicros, before.valueCents)) {
		return {
			kind: "overdraw",
			source: "average",
			unitCents: exitValueCents(
				before.quantityMicros,
				before.valueCents,
				quantityScale
			),
		};
	}
	const kind = before.quantityMicros > 0n ? "noAverage" : "overdraw";
	return referenceCostCents === null
		? { kind, source: "none", unitCents: null }
		: { kind, source: "reference", unitCents: referenceCostCents };
}

function pointBalances(
	points: readonly VariantPointsView[]
): Map<string, PointBalance> {
	return new Map(
		points.flatMap((variant) =>
			variant.points.map((point): [string, PointBalance] => [
				pointKey(variant.variantId, point.locationId, point.lotId),
				{
					quantityMicros: BigInt(point.quantityMicros),
					valueCents: BigInt(point.valueCents),
				},
			])
		)
	);
}

function referenceOf(
	points: readonly VariantPointsView[],
	variantId: string
): bigint | null {
	const reference = points.find(
		(entry) => entry.variantId === variantId
	)?.referenceCostCents;
	return reference === undefined || reference === null
		? null
		: BigInt(reference);
}

export function reconciliationPreview(
	draft: Pick<ReconciliationDraft, "lines">,
	points: readonly VariantPointsView[]
): LinePreview[] {
	const valued = valueConsumptionParts(
		pointBalances(points),
		draft.lines.flatMap((line, index) => {
			const referenceCostCents = referenceOf(points, line.variant.id);
			return line.parts.flatMap((part, position) => {
				const quantity = quantityOf(part.quantity);
				return quantity === null || quantity <= 0n
					? []
					: [
							{
								line: index,
								part: position,
								pointKey: pointKey(
									line.variant.id,
									part.locationId,
									part.lotId
								),
								quantityMicros: quantity,
								referenceCostCents,
							},
						];
			});
		})
	);
	return draft.lines.map((line, index) => {
		const outcome = reconciliationOutcome(
			BigInt(line.plannedMicros),
			quantityOf(line.consumed) ?? 0n,
			quantityOf(line.lost) ?? 0n
		);
		const parts = valued.filter((part) => part.line === index);
		return {
			extraMicros: outcome.extraMicros,
			leftoverMicros: outcome.leftoverMicros,
			provisional: parts
				.filter((part) => part.provisionalMicros > 0n)
				.map((part) => ({
					micros: part.provisionalMicros,
					part: part.part,
					...negativeSource(part.before, part.referenceCostCents),
				})),
			valueCents: parts.reduce((total, part) => total + part.valueCents, 0n),
		};
	});
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

function lineQuantity(line: LineDraft, micros: bigint): string {
	return pointQuantity(
		micros.toString(),
		line.variant.baseUnit,
		line.variant.displayPrecision
	);
}

export function lineOutcomeText(line: LineDraft, preview: LinePreview): string {
	if (preview.extraMicros > 0n) {
		return `${lineQuantity(line, preview.extraMicros)} a mais`;
	}
	return preview.leftoverMicros > 0n
		? `Sobra ${lineQuantity(line, preview.leftoverMicros)}`
		: "sem sobra";
}

const negativeSources: Record<
	Exclude<ProvisionalExit["source"], "none">,
	string
> = {
	average: "média do ponto",
	reference: "custo de referência",
};

export type ExitLabels = {
	locations: ReadonlyMap<string, string>;
	lots: ReadonlyMap<string, string>;
};

function provisionalText(line: LineDraft, exit: ProvisionalExit): string {
	const quantity = lineQuantity(line, exit.micros);
	const cost =
		exit.source === "none" || exit.unitCents === null
			? null
			: `custo provisório ${moneyLabel(exit.unitCents)}/${unitAbbreviation(line.variant.baseUnit)} (${negativeSources[exit.source]})`;
	if (exit.kind === "noAverage") {
		return cost === null
			? `Ponto sem custo médio: ${quantity} sem custo`
			: `Ponto sem custo médio: ${quantity} a ${cost}`;
	}
	return `Fica negativo em ${quantity}: ${cost ?? "sem custo"}`;
}

function exitLabel(
	part: PartDraft | undefined,
	index: number,
	labels: ExitLabels
): string {
	const location =
		part === undefined ? undefined : labels.locations.get(part.locationId);
	if (part === undefined || location === undefined) {
		return `Saída ${index + 1}`;
	}
	const lot = part.lotId === null ? undefined : labels.lots.get(part.lotId);
	return lot === undefined ? location : `${location} · lote ${lot}`;
}

export function provisionalTexts(
	line: LineDraft,
	preview: LinePreview,
	labels: ExitLabels
): string[] {
	return preview.provisional.map((exit) => {
		const text = provisionalText(line, exit);
		return line.parts.length > 1
			? `${exitLabel(line.parts[exit.part], exit.part, labels)}: ${text}`
			: text;
	});
}

export function swapUnitHint(
	option: { baseUnit: BaseUnitCode },
	line: Pick<LineDraft, "variant">
): string | null {
	return option.baseUnit === line.variant.baseUnit
		? null
		: `Outra unidade: a troca precisa ser em ${unitAbbreviation(line.variant.baseUnit)}.`;
}

function conflictMessage(error: unknown): string | null {
	return error instanceof ORPCError && error.code === "CONFLICT"
		? error.message
		: null;
}

export function reconcileCommandFailure(error: unknown): ClientCommandFailure {
	const conflict = conflictMessage(error);
	if (
		conflict === commandMessages.aggregateExists ||
		conflict === commandMessages.reconciliationExists
	) {
		return {
			kind: "exists",
			message: reconciliationFailure({ kind: "exists", message: conflict }),
		};
	}
	const failure = clientCommandFailure(error, "OS");
	return { kind: failure.kind, message: reconciliationFailure(failure) };
}

export function reverseCommandFailure(error: unknown): ClientCommandFailure {
	const conflict = conflictMessage(error);
	if (conflict === commandMessages.aggregateExists) {
		return {
			kind: "exists",
			message: "Este estorno já tinha sido registrado. Confira os materiais.",
		};
	}
	if (conflict === commandMessages.reconciliationReversed) {
		return {
			kind: "exists",
			message: "Esta reconciliação já foi estornada em outra janela.",
		};
	}
	return clientCommandFailure(error, "OS");
}

export type CommandSettlement =
	| { failure: ClientCommandFailure; kind: "failed" }
	| { kind: "notice"; message: string };

export function reconcileSettlement(error: unknown): CommandSettlement {
	const failure = reconcileCommandFailure(error);
	return conflictMessage(error) === commandMessages.aggregateExists
		? { kind: "notice", message: failure.message }
		: { failure, kind: "failed" };
}

export function reverseSettlement(error: unknown): CommandSettlement {
	const failure = reverseCommandFailure(error);
	return failure.kind === "exists"
		? { kind: "notice", message: failure.message }
		: { failure, kind: "failed" };
}

export function reverseDialogNotice(state: {
	open: boolean;
	reconciliation: { id: string } | null;
	sending: boolean;
}): string | null {
	return state.open && !state.sending && state.reconciliation === null
		? "Esta reconciliação já tinha sido estornada."
		: null;
}

export function reconcileDialogNotice(state: {
	open: boolean;
	reconciled: boolean;
	sending: boolean;
}): string | null {
	return state.open && !state.sending && state.reconciled
		? "Esta peça já foi reconciliada."
		: null;
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

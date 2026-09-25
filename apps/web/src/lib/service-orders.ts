import { type Pricing, pricingOf } from "@costura-pro/domain/pricing";
import type { ProductionStatus } from "@costura-pro/domain/production";
import { quoteLineOfText } from "@costura-pro/domain/quote";
import { reconciliationOutcome } from "@costura-pro/domain/reconciliation";
import { planReservations } from "@costura-pro/domain/reservation";
import {
	type ApprovalChannel,
	approvalLimits,
	approvalWindowError,
	isWorkLine,
	linePlannedMaterials,
	suggestedDueOn,
	type WorkLineKind,
} from "@costura-pro/domain/service-order";
import type { BaseUnitCode } from "@costura-pro/domain/unit";

import { moneyLabel } from "./finance";
import {
	currentByTemplate,
	formatDay,
	type MeasurementFieldView,
	type MeasurementView,
} from "./measurements";
import {
	type FlowStageView,
	productionBlocked,
	productionLate,
} from "./production";
import { dayError } from "./quote-drafts";
import {
	type FrozenLineView,
	lineTitle,
	type QuoteDetailView,
	type QuoteRevisionView,
} from "./quotes";
import { pointQuantity } from "./stock";

export const approvalChannelLabels: Record<ApprovalChannel, string> = {
	email: "E-mail",
	inPerson: "Presencial",
	other: "Outro",
	phone: "Telefone",
	whatsapp: "WhatsApp",
};

export type WorkLineView = Exclude<FrozenLineView, { kind: "free" }>;

export type MeasurementSnapshotView = {
	fields: MeasurementFieldView[];
	measurementId: string;
	notes: string | null;
	takenOn: string;
	templateId: string;
	templateName: string;
	templateVersion: number;
};

export type MaterialRowView = {
	baseUnit: BaseUnitCode;
	displayPrecision: number;
	label: string;
	plannedMicros: bigint;
	reservedMicros: bigint;
	shortageMicros: bigint;
	variantId: string;
};

export type ApprovalPreviewItem = {
	kind: WorkLineKind;
	line: WorkLineView;
	measurements: MeasurementSnapshotView[];
	missingMeasurements: boolean;
	reservations: MaterialRowView[];
	title: string;
};

export type ApprovalPreview = {
	freeLines: string[];
	items: ApprovalPreviewItem[];
	receivableCents: bigint;
	shortage: boolean;
};

function workLinesOf(revision: QuoteRevisionView): WorkLineView[] {
	return revision.content.lines.filter((line): line is WorkLineView =>
		isWorkLine(line)
	);
}

function profileOf(line: WorkLineView): string | null {
	return line.kind === "material" ? null : line.profileId;
}

function citation(
	line: WorkLineView,
	variantId: string
): Pick<MaterialRowView, "baseUnit" | "displayPrecision" | "label"> {
	if (line.kind === "material") {
		return {
			baseUnit: line.baseUnit,
			displayPrecision: line.displayPrecision,
			label: lineTitle(line),
		};
	}
	const component =
		line.kind === "custom"
			? line.components.find(
					(item) =>
						item.kind === "material" && item.materialVariantId === variantId
				)
			: undefined;
	if (component?.kind === "material") {
		return {
			baseUnit: component.baseUnit,
			displayPrecision: component.displayPrecision,
			label: `${component.materialName} · ${component.variantName}`,
		};
	}
	return { baseUnit: "un", displayPrecision: 0, label: variantId };
}

function snapshotOf(measurement: MeasurementView): MeasurementSnapshotView {
	return {
		fields: measurement.fields.map((field) => ({ ...field })),
		measurementId: measurement.id,
		notes: measurement.notes,
		takenOn: measurement.takenOn,
		templateId: measurement.templateId,
		templateName: measurement.templateName,
		templateVersion: measurement.templateVersion,
	};
}

export function approvalPreview(
	revision: QuoteRevisionView,
	measurements: readonly MeasurementView[] | null,
	stock: QuoteDetailView["stock"]
): ApprovalPreview {
	const work = workLinesOf(revision);
	const outcomes = planReservations(
		work.flatMap((line) =>
			linePlannedMaterials(quoteLineOfText(line)).map((material) => ({
				key: line.id,
				quantityMicros: material.quantityMicros,
				variantId: material.variantId,
			}))
		),
		new Map(stock.map((row) => [row.variantId, BigInt(row.quantityMicros)])),
		new Map(stock.map((row) => [row.variantId, BigInt(row.reservedMicros)]))
	);
	const items = work.map((line): ApprovalPreviewItem => {
		const profileId = profileOf(line);
		const current =
			profileId === null || measurements === null
				? []
				: currentByTemplate(measurements, profileId).map((pair) =>
						snapshotOf(pair.current)
					);
		return {
			kind: line.kind,
			line,
			measurements: current,
			missingMeasurements:
				profileId !== null && measurements !== null && current.length === 0,
			reservations: outcomes
				.filter((outcome) => outcome.key === line.id)
				.map((outcome) => ({
					...citation(line, outcome.variantId),
					plannedMicros: outcome.quantityMicros,
					reservedMicros: outcome.reservedMicros,
					shortageMicros: outcome.shortageMicros,
					variantId: outcome.variantId,
				})),
			title: lineTitle(line),
		};
	});
	return {
		freeLines: revision.content.lines
			.filter((line) => !isWorkLine(line))
			.map(lineTitle),
		items,
		receivableCents: BigInt(revision.totalCents),
		shortage: outcomes.some((outcome) => outcome.shortageMicros > 0n),
	};
}

export type ApprovalIds = {
	approvalId: string;
	items: ReadonlyMap<
		string,
		{ itemId: string; reservations: ReadonlyMap<string, string> }
	>;
	receivableId: string;
	serviceOrderId: string;
};

export function approvalIds(
	revision: QuoteRevisionView,
	newId: () => string
): ApprovalIds {
	return {
		approvalId: newId(),
		items: new Map(
			workLinesOf(revision).map((line) => [
				line.id,
				{
					itemId: newId(),
					reservations: new Map(
						linePlannedMaterials(quoteLineOfText(line)).map((material) => [
							material.variantId,
							newId(),
						])
					),
				},
			])
		),
		receivableId: newId(),
		serviceOrderId: newId(),
	};
}

export type ApprovalDraft = {
	approvedOn: string;
	channel: ApprovalChannel | null;
	dueOn: string;
	note: string;
};

export function approvalDraft(
	revision: QuoteRevisionView,
	today: string
): ApprovalDraft {
	const capped = today > revision.validUntil ? revision.validUntil : today;
	const approvedOn = capped < revision.emittedOn ? revision.emittedOn : capped;
	return {
		approvedOn,
		channel: null,
		dueOn: suggestedDueOn(approvedOn, revision.content.leadTimeDays) ?? "",
		note: "",
	};
}

export function approvalBlocker(read: {
	failed: boolean;
	fresh: boolean;
}): string | null {
	if (read.fresh) {
		return null;
	}
	return read.failed
		? "Não foi possível ler as medidas atuais do cliente. Tente de novo."
		: "Conferindo as medidas atuais do cliente.";
}

export function acceptanceHint(
	revision: Pick<QuoteRevisionView, "emittedOn" | "validUntil">,
	today: string
): string {
	const lastDay = today < revision.validUntil ? today : revision.validUntil;
	return lastDay === revision.emittedOn
		? `Só ${formatDay(lastDay)}, o dia da emissão.`
		: `Entre ${formatDay(revision.emittedOn)} e ${formatDay(lastDay)}.`;
}

export type ApprovalErrors = Partial<
	Record<"approvedOn" | "channel" | "dueOn" | "note", string>
>;

function acceptanceError(
	approvedOn: string,
	revision: QuoteRevisionView,
	today: string
): string | null {
	const invalid = dayError(approvedOn, today);
	if (invalid) {
		return invalid;
	}
	const window = approvalWindowError(approvedOn, revision);
	if (window === "beforeEmission") {
		return "O aceite não pode ser antes da emissão da revisão";
	}
	if (window === "afterValidity") {
		return `A revisão valia até ${formatDay(revision.validUntil)}. Emita uma revisão nova para registrar este aceite.`;
	}
	return null;
}

function dueError(draft: ApprovalDraft): string | null {
	const dueOn = draft.dueOn.trim();
	if (dueOn === "") {
		return null;
	}
	if (dayError(dueOn, "9999-12-31")) {
		return "Data inválida";
	}
	return dueOn < draft.approvedOn
		? "O prazo não pode ser antes do aceite"
		: null;
}

export function approvalErrors(
	draft: ApprovalDraft,
	revision: QuoteRevisionView,
	today: string
): ApprovalErrors {
	const errors: ApprovalErrors = {};
	const approvedOn = acceptanceError(draft.approvedOn, revision, today);
	if (approvedOn) {
		errors.approvedOn = approvedOn;
	}
	if (draft.channel === null) {
		errors.channel = "Escolha o canal";
	}
	if (draft.note.trim().length > approvalLimits.note) {
		errors.note = `Use até ${approvalLimits.note} caracteres`;
	}
	const due = dueError(draft);
	if (due) {
		errors.dueOn = due;
	}
	return errors;
}

export type ApproveInput = {
	approvalId: string;
	approvedOn: string;
	channel: ApprovalChannel;
	dueOn: string | null;
	items: {
		itemId: string;
		lineId: string;
		measurements: MeasurementSnapshotView[];
		reservations: { reservationId: string; variantId: string }[];
	}[];
	note: string | null;
	quoteId: string;
	receivableId: string;
	revisionId: string;
	serviceOrderId: string;
};

export function approvalFields({
	draft,
	ids,
	preview,
	quoteId,
	revisionId,
}: {
	draft: ApprovalDraft & { channel: ApprovalChannel };
	ids: ApprovalIds;
	preview: ApprovalPreview;
	quoteId: string;
	revisionId: string;
}): ApproveInput {
	const note = draft.note.trim();
	const dueOn = draft.dueOn.trim();
	return {
		approvalId: ids.approvalId,
		approvedOn: draft.approvedOn,
		channel: draft.channel,
		dueOn: dueOn === "" ? null : dueOn,
		items: preview.items.map((item) => {
			const planned = ids.items.get(item.line.id);
			return {
				itemId: planned?.itemId ?? "",
				lineId: item.line.id,
				measurements: item.measurements,
				reservations: item.reservations.map((reservation) => ({
					reservationId: planned?.reservations.get(reservation.variantId) ?? "",
					variantId: reservation.variantId,
				})),
			};
		}),
		note: note === "" ? null : note,
		quoteId,
		receivableId: ids.receivableId,
		revisionId,
		serviceOrderId: ids.serviceOrderId,
	};
}

export type ReconciliationPartView = {
	locationId: string;
	locationName: string;
	lotId: string | null;
	lotLabel: string | null;
	movementId: string;
	provisionalCents: string;
	provisionalMicros: string;
	quantityMicros: string;
	valueCents: string;
};

export type ReconciliationLineView = {
	baseUnit: BaseUnitCode;
	consumedMicros: string;
	displayPrecision: number;
	lostMicros: string;
	materialName: string;
	parts: ReconciliationPartView[];
	plannedCostCents: string | null;
	plannedMicros: string;
	plannedVariantId: string;
	swapReason: string | null;
	variantId: string;
	variantName: string;
};

export type ReconciliationView = {
	id: string;
	lines: ReconciliationLineView[];
	note: string | null;
	occurredOn: string;
};

export type ServiceOrderItemView = {
	createdAt: string;
	dueOn: string | null;
	id: string;
	kind: WorkLineKind;
	line: WorkLineView;
	lineId: string;
	measurements: MeasurementSnapshotView[];
	position: number;
	productionStatus: ProductionStatus;
	reconciled: boolean;
	reconciliation: ReconciliationView | null;
	reservations: { reservedMicros: string; variantId: string }[];
	serviceOrderId: string;
	stageId: string | null;
	stageIds: string[] | null;
	suggestedStageIds: string[];
	version: number;
};

export type ReceivableView = {
	amountCents: string;
	clientId: string;
	createdAt: string;
	id: string;
	kind: "serviceOrder";
	occurredOn: string;
	serviceOrderId: string | null;
	version: number;
};

export type ServiceOrderRevisionView = {
	costCents: string | null;
	discountCents: string;
	emittedOn: string;
	grossCents: string;
	id: string;
	number: number;
	targetMarginBasisPoints: number;
	totalCents: string;
	validUntil: string;
};

export type ServiceOrderDetailView = {
	approval: {
		approvedOn: string;
		channel: ApprovalChannel;
		createdAt: string;
		id: string;
		note: string | null;
		quoteId: string;
		revisionId: string;
		serviceOrderId: string;
		version: number;
	};
	client: { anonymized: boolean; archived: boolean; id: string; name: string };
	currentFlowVersion: number | null;
	items: ServiceOrderItemView[];
	quote: { code: string; id: string };
	receivable: ReceivableView | null;
	revision: ServiceOrderRevisionView;
	serviceOrder: {
		clientId: string;
		code: string;
		createdAt: string;
		flowStages: FlowStageView[] | null;
		flowVersion: number | null;
		id: string;
		openedOn: string;
		quoteId: string;
		updatedAt: string;
		version: number;
	};
};

export type ServiceOrderListItemView = {
	clientId: string;
	clientName: string;
	code: string;
	dueOn: string | null;
	id: string;
	itemCount: number;
	openedOn: string;
	productionCount: number;
	readyCount: number;
	shortage: boolean;
	startedCount: number;
	totalCents: string;
};

export function itemMaterials(
	item: Pick<ServiceOrderItemView, "line" | "reconciled" | "reservations">
): MaterialRowView[] {
	const reserved = new Map(
		item.reservations.map((row) => [row.variantId, BigInt(row.reservedMicros)])
	);
	return linePlannedMaterials(quoteLineOfText(item.line)).map((material) => {
		const reservedMicros = reserved.get(material.variantId) ?? 0n;
		const shortageMicros = material.quantityMicros - reservedMicros;
		return {
			...citation(item.line, material.variantId),
			plannedMicros: material.quantityMicros,
			reservedMicros,
			shortageMicros:
				shortageMicros > 0n && !item.reconciled ? shortageMicros : 0n,
			variantId: material.variantId,
		};
	});
}

export type ReconciledRow = {
	consumed: string;
	extra: string | null;
	label: string;
	leftover: string | null;
	lost: string;
	planned: string;
	swap: string | null;
};

function plannedName(line: WorkLineView, variantId: string): string {
	const component =
		line.kind === "custom"
			? line.components.find(
					(item) =>
						item.kind === "material" && item.materialVariantId === variantId
				)
			: undefined;
	return component?.kind === "material"
		? `${component.materialName} ${component.variantName}`
		: variantId;
}

export function reconciledRows(
	item: Pick<ServiceOrderItemView, "line" | "reconciliation">
): ReconciledRow[] {
	return (item.reconciliation?.lines ?? []).map((row) => {
		const quantity = (micros: bigint) =>
			pointQuantity(micros.toString(), row.baseUnit, row.displayPrecision);
		const outcome = reconciliationOutcome(
			BigInt(row.plannedMicros),
			BigInt(row.consumedMicros),
			BigInt(row.lostMicros)
		);
		return {
			consumed: quantity(BigInt(row.consumedMicros)),
			extra: outcome.extraMicros > 0n ? quantity(outcome.extraMicros) : null,
			label: `${row.materialName} · ${row.variantName}`,
			leftover:
				outcome.leftoverMicros > 0n ? quantity(outcome.leftoverMicros) : null,
			lost: quantity(BigInt(row.lostMicros)),
			planned: quantity(BigInt(row.plannedMicros)),
			swap:
				row.swapReason === null
					? null
					: `${plannedName(item.line, row.plannedVariantId)} → ${row.materialName} ${row.variantName} · ${row.swapReason}`,
		};
	});
}

export type MaterialCostRow = {
	label: string;
	plannedCents: bigint | null;
	provisional: boolean;
	realCents: bigint;
};

export type MaterialCosts = {
	plannedTotal: bigint | null;
	realTotal: bigint;
	rows: MaterialCostRow[];
};

function addCents(left: bigint | null, right: bigint | null): bigint | null {
	return left === null || right === null ? null : left + right;
}

export function materialCostRows(
	items: readonly Pick<ServiceOrderItemView, "reconciliation">[]
): MaterialCosts {
	const rows = new Map<string, MaterialCostRow>();
	for (const line of items.flatMap(
		(item) => item.reconciliation?.lines ?? []
	)) {
		const planned =
			line.plannedCostCents === null ? null : BigInt(line.plannedCostCents);
		const real = line.parts.reduce(
			(total, part) => total + BigInt(part.valueCents),
			0n
		);
		const provisional = line.parts.some(
			(part) => BigInt(part.provisionalMicros) > 0n
		);
		const current = rows.get(line.variantId);
		rows.set(
			line.variantId,
			current === undefined
				? {
						label: `${line.materialName} · ${line.variantName}`,
						plannedCents: planned,
						provisional,
						realCents: real,
					}
				: {
						label: current.label,
						plannedCents: addCents(current.plannedCents, planned),
						provisional: current.provisional || provisional,
						realCents: current.realCents + real,
					}
		);
	}
	const list = [...rows.values()];
	return {
		plannedTotal: list.reduce<bigint | null>(
			(total, row) => addCents(total, row.plannedCents),
			0n
		),
		realTotal: list.reduce((total, row) => total + row.realCents, 0n),
		rows: list,
	};
}

function plannedCostText(cents: bigint | null): string {
	return cents === null
		? "sem custo previsto"
		: `previsto ${moneyLabel(cents)}`;
}

export function materialCostText(row: MaterialCostRow): string {
	return `${row.label}: ${plannedCostText(row.plannedCents)} · real ${moneyLabel(row.realCents)}`;
}

export function materialCostTotalText(costs: MaterialCosts): string {
	return `Total: ${plannedCostText(costs.plannedTotal)} · real ${moneyLabel(costs.realTotal)}`;
}

export function costDifferenceText(costs: MaterialCosts): string | null {
	if (costs.plannedTotal === null) {
		return null;
	}
	const difference = costs.realTotal - costs.plannedTotal;
	if (difference === 0n) {
		return moneyLabel(difference);
	}
	return difference > 0n
		? `+${moneyLabel(difference)}`
		: `−${moneyLabel(-difference)}`;
}

export function subitemsLabel(count: number): string {
	if (count === 0) {
		return "sem subitens";
	}
	return count === 1 ? "1 subitem" : `${count} subitens`;
}

export function receivableLabel(totalCents: string): string {
	return BigInt(totalCents) > 0n ? moneyLabel(totalCents) : "sem cobrança";
}

export type ClosingStep = { label: string; state: "done" | "pending" };

export function closingSteps({
	items,
	receivable,
}: Pick<ServiceOrderDetailView, "items" | "receivable">): ClosingStep[] {
	const reconciled = items.every(
		(item) =>
			item.kind !== "custom" ||
			item.reconciled ||
			linePlannedMaterials(quoteLineOfText(item.line)).length === 0
	);
	return [
		{
			label: "Todos os subitens reconciliados",
			state: reconciled ? "done" : "pending",
		},
		{
			label: "Todos entregues ou cancelados",
			state: items.length === 0 ? "done" : "pending",
		},
		{
			label: "Financeiro resolvido",
			state: receivable === null ? "done" : "pending",
		},
	];
}

function productionStage(counts: {
	production: number;
	ready: number;
	started: number;
}): string {
	if (counts.production === 0) {
		return "sem produção";
	}
	if (counts.ready === counts.production) {
		return "pronta";
	}
	return counts.started === 0 && counts.ready === 0
		? "não iniciada"
		: "em produção";
}

export function productionSummary(
	items: readonly Pick<
		ServiceOrderItemView,
		| "dueOn"
		| "kind"
		| "line"
		| "productionStatus"
		| "reconciled"
		| "reservations"
	>[],
	today: string
): { text: string; tone: "danger" | "default" | "success" } {
	const production = items.filter((item) => item.kind !== "material");
	const count = (status: ProductionStatus) =>
		production.filter((item) => item.productionStatus === status).length;
	const stage = productionStage({
		production: production.length,
		ready: count("ready"),
		started: count("inProgress"),
	});
	const late = production.filter((item) => productionLate(item, today)).length;
	const blocked = production.some((item) => productionBlocked(item) !== null);
	const lateText = late === 1 ? " · 1 atrasado" : ` · ${late} atrasados`;
	const text = `${stage}${late > 0 ? lateText : ""}${blocked ? " · bloqueado" : ""}`;
	if (late > 0 || blocked) {
		return { text, tone: "danger" };
	}
	return { text, tone: stage === "pronta" ? "success" : "default" };
}

export function listProductionSummary(item: ServiceOrderListItemView): string {
	return productionStage({
		production: item.productionCount,
		ready: item.readyCount,
		started: item.startedCount,
	});
}

export function deliverySummary(items: readonly unknown[]): string {
	if (items.length === 0) {
		return "nada a entregar";
	}
	return items.length === 1
		? "0 de 1 entregue"
		: `0 de ${items.length} entregues`;
}

export function financialSummary(
	receivable: Pick<ReceivableView, "amountCents"> | null
): string {
	return receivable === null
		? "sem cobrança"
		: `a receber · ${moneyLabel(receivable.amountCents)}`;
}

export function dueLabel(
	dueOn: string | null,
	today: string
): { late: boolean; text: string } {
	return dueOn === null
		? { late: false, text: "a combinar" }
		: { late: dueOn < today, text: formatDay(dueOn) };
}

export function estimatedMargin(
	revision: Pick<
		ServiceOrderRevisionView,
		"costCents" | "targetMarginBasisPoints" | "totalCents"
	>
): Pricing | null {
	return revision.costCents === null
		? null
		: pricingOf({
				costCents: BigInt(revision.costCents),
				priceCents: BigInt(revision.totalCents),
				targetMarginBasisPoints: revision.targetMarginBasisPoints,
			});
}

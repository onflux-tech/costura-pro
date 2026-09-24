import { canonicalJson } from "@costura-pro/domain/canonical-json";
import {
	formatMarginPercent,
	type Pricing,
	pricingOf,
} from "@costura-pro/domain/pricing";
import { formatQuantity } from "@costura-pro/domain/quantity";
import {
	plannedMaterials,
	type QuoteStatus,
	type QuoteTotals,
	quoteLineOfText,
	quoteStatus,
	quoteTotalsOfText,
} from "@costura-pro/domain/quote";
import { planReservation } from "@costura-pro/domain/reservation";
import { formatMinutes } from "@costura-pro/domain/service";
import type { ApprovalChannel } from "@costura-pro/domain/service-order";
import type { BaseUnitCode } from "@costura-pro/domain/unit";

import { moneyLabel } from "./finance";
import { unitAbbreviation } from "./materials";

export type QuoteDiscountView =
	| { amountCents: string; kind: "amount"; reason: string | null }
	| { basisPoints: number; kind: "percent"; reason: string | null };

export type MaterialComponentView = {
	baseUnit: BaseUnitCode;
	code: string | null;
	displayPrecision: number;
	id: string;
	kind: "material";
	materialName: string;
	materialVariantId: string;
	quantityMicros: string;
	unitCostCents: string | null;
	variantName: string;
};

export type ServiceComponentView = {
	count: number;
	estimatedMinutes: number | null;
	id: string;
	kind: "service";
	outsourced: boolean;
	serviceId: string;
	serviceName: string;
	serviceVersion: number;
	unitCostCents: string;
};

export type QuoteComponentView = MaterialComponentView | ServiceComponentView;

export type QuoteSourceView = {
	productId: string;
	productName: string;
	productVersion: number;
	variantId: string | null;
	variantName: string | null;
};

export type ServiceLineView = {
	catalogPriceCents: string;
	discount: QuoteDiscountView | null;
	estimatedMinutes: number | null;
	id: string;
	kind: "service";
	note: string | null;
	outsourced: boolean;
	profileId: string | null;
	quantity: number;
	receivedItemId: string | null;
	serviceId: string;
	serviceName: string;
	serviceVersion: number;
	unitCostCents: string;
	unitPriceCents: string;
};

export type CustomLineView = {
	components: QuoteComponentView[];
	description: string;
	discount: QuoteDiscountView | null;
	id: string;
	kind: "custom";
	note: string | null;
	profileId: string | null;
	quantity: number;
	source: QuoteSourceView | null;
	unitPriceCents: string;
};

export type MaterialLineView = {
	baseUnit: BaseUnitCode;
	code: string | null;
	discount: QuoteDiscountView | null;
	displayPrecision: number;
	id: string;
	kind: "material";
	materialName: string;
	materialVariantId: string;
	note: string | null;
	quantityMicros: string;
	unitCostCents: string | null;
	unitPriceCents: string;
	variantName: string;
};

export type FreeLineView = {
	description: string;
	discount: QuoteDiscountView | null;
	id: string;
	kind: "free";
	note: string | null;
	quantity: number;
	unitCostCents: string | null;
	unitPriceCents: string;
};

export type QuoteLineView =
	| ServiceLineView
	| CustomLineView
	| MaterialLineView
	| FreeLineView;

export type QuoteContentView = {
	discount: QuoteDiscountView | null;
	leadTimeDays: number | null;
	lines: QuoteLineView[];
	notes: string | null;
	validityDays: number;
};

export type QuoteView = QuoteContentView & {
	archivedAt: string | null;
	clientId: string;
	code: string;
	createdAt: string;
	createdOn: string;
	id: string;
	refusalReason: string | null;
	refusedOn: string | null;
	updatedAt: string;
	version: number;
};

export type FrozenLineView = QuoteLineView & {
	costCents: string | null;
	discountCents: string;
	grossCents: string;
	totalCents: string;
};

export type QuoteRevisionView = {
	content: Omit<QuoteContentView, "lines"> & {
		lines: FrozenLineView[];
	};
	costCents: string | null;
	createdAt: string;
	discountCents: string;
	emittedOn: string;
	grossCents: string;
	id: string;
	number: number;
	quoteId: string;
	reason: string | null;
	targetMarginBasisPoints: number;
	totalCents: string;
	validUntil: string;
	version: number;
};

export type QuoteApprovalView = {
	approvedOn: string;
	channel: ApprovalChannel;
	id: string;
	note: string | null;
	revisionId: string;
	revisionNumber: number;
	serviceOrderCode: string;
	serviceOrderId: string;
};

export type QuoteDetailView = {
	approval: QuoteApprovalView | null;
	client: { anonymized: boolean; archived: boolean; id: string; name: string };
	quote: QuoteView;
	revisions: readonly QuoteRevisionView[];
	stock: readonly {
		quantityMicros: string;
		reservedMicros: string;
		variantId: string;
	}[];
};

export type QuoteListItemView = {
	approvedOn: string | null;
	archivedAt: string | null;
	clientId: string;
	clientName: string;
	code: string;
	createdOn: string;
	emittedOn: string | null;
	id: string;
	lineCount: number;
	refusedOn: string | null;
	revisionNumber: number | null;
	serviceOrderCode: string | null;
	status: QuoteStatus;
	totalCents: string;
	validUntil: string | null;
};

export type CostStatus = "complete" | "empty" | "incomplete";

export type QuoteSummary = {
	costStatus: CostStatus;
	missing: readonly string[];
	pricing: Pricing | null;
	shortOfTargetCents: bigint | null;
	totals: QuoteTotals;
};

function materialTitle(item: {
	materialName: string;
	variantName: string;
}): string {
	return `${item.materialName} · ${item.variantName}`;
}

export function lineTitle(line: QuoteLineView): string {
	switch (line.kind) {
		case "service":
			return line.serviceName;
		case "material":
			return materialTitle(line);
		default:
			return line.description;
	}
}

function missingCosts(line: QuoteLineView): string[] {
	switch (line.kind) {
		case "service":
			return [];
		case "custom":
			if (line.components.length === 0) {
				return [`${line.description} · sem componentes`];
			}
			return line.components.flatMap((component) =>
				component.kind === "material" && component.unitCostCents === null
					? [`${line.description} · ${component.materialName}`]
					: []
			);
		default:
			return line.unitCostCents === null ? [lineTitle(line)] : [];
	}
}

export function quoteSummary(
	content: Pick<QuoteContentView, "discount" | "lines">,
	targetMarginBasisPoints: number
): QuoteSummary {
	const totals = quoteTotalsOfText(content.lines, content.discount);
	const missing = content.lines.flatMap(missingCosts);
	if (content.lines.length === 0 || totals.costCents === null) {
		return {
			costStatus: content.lines.length === 0 ? "empty" : "incomplete",
			missing,
			pricing: null,
			shortOfTargetCents: null,
			totals,
		};
	}
	const pricing = pricingOf({
		costCents: totals.costCents,
		priceCents: totals.totalCents,
		targetMarginBasisPoints,
	});
	return {
		costStatus: "complete",
		missing,
		pricing,
		shortOfTargetCents: pricing.belowTarget
			? pricing.suggestedCents - totals.totalCents
			: null,
		totals,
	};
}

export function latestRevisionOf(
	revisions: readonly QuoteRevisionView[]
): QuoteRevisionView | undefined {
	return revisions.reduce<QuoteRevisionView | undefined>(
		(latest, revision) =>
			latest === undefined || revision.number > latest.number
				? revision
				: latest,
		undefined
	);
}

export function quoteStatusOf(
	quote: Pick<QuoteView, "refusedOn">,
	revisions: readonly QuoteRevisionView[],
	today: string,
	approved: boolean
): QuoteStatus {
	return quoteStatus({
		approved,
		refused: quote.refusedOn !== null,
		today,
		validUntil: latestRevisionOf(revisions)?.validUntil ?? null,
	});
}

export const statusLabels: Record<QuoteStatus, string> = {
	approved: "aprovado",
	draft: "rascunho",
	emitted: "emitido",
	expired: "vencido",
	refused: "recusado",
};

const statusTones = {
	approved: "success",
	draft: "neutral",
	emitted: "success",
	expired: "warning",
	refused: "danger",
} as const satisfies Record<QuoteStatus, string>;

export function statusTone(
	status: QuoteStatus
): "danger" | "neutral" | "success" | "warning" {
	return statusTones[status];
}

export function revisionLabel(code: string, number: number): string {
	return `${code} · rev. ${number}`;
}

export function nextRevisionNumber(
	revisions: readonly QuoteRevisionView[]
): number {
	return (latestRevisionOf(revisions)?.number ?? 0) + 1;
}

export type PeopleNames = {
	profiles: ReadonlyMap<string, string>;
	receivedItems: ReadonlyMap<string, string>;
};

function namedPart(
	names: ReadonlyMap<string, string>,
	id: string | null,
	prefix: string
): string | null {
	const name = id === null ? undefined : names.get(id);
	return name === undefined ? null : `${prefix} ${name}`;
}

function sourceParts(source: QuoteSourceView | null): string[] {
	if (source === null) {
		return ["montada no orçamento"];
	}
	const sheet = `ficha ${source.productName} v${source.productVersion}`;
	return source.variantName === null
		? [sheet]
		: [sheet, `variante ${source.variantName}`];
}

function componentCount(count: number): string {
	if (count === 0) {
		return "sem componentes";
	}
	return count === 1 ? "1 componente" : `${count} componentes`;
}

function joined(parts: readonly (string | null)[]): string {
	return parts.filter((part): part is string => part !== null).join(" · ");
}

export function lineDetail(line: QuoteLineView, people: PeopleNames): string {
	switch (line.kind) {
		case "service":
			return joined([
				"serviço",
				namedPart(people.profiles, line.profileId, "para"),
				namedPart(people.receivedItems, line.receivedItemId, "peça"),
				line.estimatedMinutes === null
					? null
					: formatMinutes(line.estimatedMinutes),
			]);
		case "custom":
			return joined([
				"sob medida",
				namedPart(people.profiles, line.profileId, "para"),
				...sourceParts(line.source),
				componentCount(line.components.length),
			]);
		case "material":
			return joined(["material", line.code]);
		default:
			return "linha livre";
	}
}

export function lineQuantityLabel(line: QuoteLineView): string {
	return line.kind === "material"
		? `${formatQuantity(BigInt(line.quantityMicros), line.displayPrecision)} ${unitAbbreviation(line.baseUnit)}`
		: `${line.quantity} un`;
}

export function discountLabel(
	discount: QuoteDiscountView | null
): string | null {
	if (discount === null) {
		return null;
	}
	return discount.kind === "percent"
		? formatMarginPercent(discount.basisPoints)
		: moneyLabel(discount.amountCents);
}

function lineInput({
	costCents,
	discountCents,
	grossCents,
	totalCents,
	...input
}: FrozenLineView): QuoteLineView {
	return input;
}

export function revisionContent(revision: QuoteRevisionView): QuoteContentView {
	const { discount, leadTimeDays, lines, notes, validityDays } =
		revision.content;
	return {
		discount,
		leadTimeDays,
		lines: lines.map(lineInput),
		notes,
		validityDays,
	};
}

function contentKey({
	discount,
	leadTimeDays,
	lines,
	notes,
	validityDays,
}: QuoteContentView): string {
	return canonicalJson({ discount, leadTimeDays, lines, notes, validityDays });
}

export function sameContent(
	draft: QuoteContentView,
	revision: QuoteRevisionView | undefined
): boolean {
	return (
		revision !== undefined &&
		contentKey(draft) === contentKey(revisionContent(revision))
	);
}

export type PlannedMaterialView = {
	availableMicros: bigint;
	baseUnit: BaseUnitCode;
	code: string | null;
	displayPrecision: number;
	label: string;
	plannedMicros: bigint;
	reservedMicros: bigint;
	shortageMicros: bigint;
	stockMicros: bigint;
	variantId: string;
};

type MaterialCitation = Pick<
	MaterialComponentView,
	| "baseUnit"
	| "code"
	| "displayPrecision"
	| "materialName"
	| "materialVariantId"
	| "variantName"
>;

function citationsOf(lines: readonly QuoteLineView[]): MaterialCitation[] {
	return lines.flatMap((line): MaterialCitation[] => {
		if (line.kind === "material") {
			return [line];
		}
		if (line.kind === "custom") {
			return line.components.flatMap((component) =>
				component.kind === "material" ? [component] : []
			);
		}
		return [];
	});
}

export function plannedMaterialsView(
	lines: readonly QuoteLineView[],
	stock: QuoteDetailView["stock"]
): PlannedMaterialView[] {
	const citations = citationsOf(lines);
	const balances = new Map(
		stock.map((row) => [row.variantId, BigInt(row.quantityMicros)])
	);
	const reservations = new Map(
		stock.map((row) => [row.variantId, BigInt(row.reservedMicros)])
	);
	return [...plannedMaterials(lines.map(quoteLineOfText))].flatMap(
		([variantId, plannedMicros]) => {
			const citation = citations.find(
				(item) => item.materialVariantId === variantId
			);
			if (citation === undefined) {
				return [];
			}
			const stockMicros = balances.get(variantId) ?? 0n;
			const reservedMicros = reservations.get(variantId) ?? 0n;
			const { shortageMicros } = planReservation(
				stockMicros,
				reservedMicros,
				plannedMicros
			);
			return [
				{
					availableMicros: stockMicros - reservedMicros,
					baseUnit: citation.baseUnit,
					code: citation.code,
					displayPrecision: citation.displayPrecision,
					label: materialTitle(citation),
					plannedMicros,
					reservedMicros,
					shortageMicros,
					stockMicros,
					variantId,
				},
			];
		}
	);
}

export type EmissionWarning = "belowCost" | "belowTarget" | "incomplete";

export function emissionWarnings(summary: QuoteSummary): EmissionWarning[] {
	if (summary.pricing === null) {
		return ["incomplete"];
	}
	const warnings: EmissionWarning[] = [];
	if (summary.pricing.belowCost) {
		warnings.push("belowCost");
	}
	if (summary.pricing.belowTarget) {
		warnings.push("belowTarget");
	}
	return warnings;
}

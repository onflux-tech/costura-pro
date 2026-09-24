import { formatMoneyInput, parseMoney } from "@costura-pro/domain/money";
import { formatMarginInput } from "@costura-pro/domain/pricing";
import { effectiveSheet } from "@costura-pro/domain/product";
import {
	formatQuantityInput,
	parseQuantity,
} from "@costura-pro/domain/quantity";
import {
	lineTotals,
	quoteLimits,
	quoteLineOfText,
	quoteTotalsOfText,
} from "@costura-pro/domain/quote";
import type { BaseUnitCode } from "@costura-pro/domain/unit";

import { type ProductDetailView, plannedMicros } from "./products";
import type { VariantOptionView } from "./purchases";
import type {
	CustomLineView,
	FreeLineView,
	MaterialLineView,
	QuoteComponentView,
	QuoteContentView,
	QuoteDiscountView,
	QuoteLineView,
	QuoteSourceView,
	ServiceLineView,
} from "./quotes";
import type { ServiceView } from "./services";

const moneyFormat = "Use valor com até 2 casas";
const materialQuantityMessage =
	"Use quantidade maior que zero, com até 6 casas";
const quantityDecimals = 6;

function optionalText(text: string): string | null {
	const trimmed = text.trim();
	return trimmed === "" ? null : trimmed;
}

function centsInput(cents: string | null): string {
	return cents === null ? "" : formatMoneyInput(BigInt(cents));
}

function centsOf(text: string): string {
	return String(parseMoney(text) ?? 0n);
}

function optionalCents(text: string): string | null {
	return text.trim() === "" ? null : centsOf(text);
}

function microsOf(text: string): string {
	return String(parseQuantity(text, quantityDecimals) ?? 0n);
}

function present<Field extends string>(
	entries: readonly (readonly [Field, string | null | undefined])[]
): Partial<Record<Field, string>> {
	const errors: Partial<Record<Field, string>> = {};
	for (const [field, message] of entries) {
		if (typeof message === "string") {
			errors[field] = message;
		}
	}
	return errors;
}

function textError(text: string, max: number): string | null {
	return text.trim().length > max ? `Use até ${max} caracteres` : null;
}

function descriptionError(text: string): string | null {
	return text.trim() === ""
		? "Informe a descrição"
		: textError(text, quoteLimits.description.max);
}

function priceError(text: string): string | null {
	if (text.trim() === "") {
		return "Informe o preço";
	}
	return parseMoney(text) === null ? moneyFormat : null;
}

function costError(text: string): string | null {
	return text.trim() === "" || parseMoney(text) !== null ? null : moneyFormat;
}

const wholeNumber = /^\d{1,6}$/;

function rangeError(
	text: string,
	limits: { max: number; min: number },
	unit = ""
): string | null {
	const trimmed = text.trim();
	const value = wholeNumber.test(trimmed) ? Number(trimmed) : null;
	return value === null || value < limits.min || value > limits.max
		? `Use de ${limits.min} a ${limits.max}${unit}`
		: null;
}

function materialQuantityError(text: string): string | null {
	const micros = parseQuantity(text, quantityDecimals);
	return micros !== null && micros > 0n ? null : materialQuantityMessage;
}

export type DiscountKind = "amount" | "none" | "percent";

export type DiscountDraft = {
	kind: DiscountKind;
	reason: string;
	value: string;
};

export const noDiscount: DiscountDraft = {
	kind: "none",
	reason: "",
	value: "",
};

const percentInput = /^(?<whole>\d{1,3})(?:[.,](?<fraction>\d{1,2}))?$/;
const percentIgnored = /[\s%]/g;

export function parseDiscountPercent(text: string): number | null {
	const groups = percentInput.exec(text.replace(percentIgnored, ""))?.groups;
	if (!groups) {
		return null;
	}
	const { fraction = "", whole = "0" } = groups;
	const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
	return basisPoints >= quoteLimits.percentDiscount.min &&
		basisPoints <= quoteLimits.percentDiscount.max
		? basisPoints
		: null;
}

export function discountDraftOf(
	discount: QuoteDiscountView | null
): DiscountDraft {
	if (discount === null) {
		return noDiscount;
	}
	return {
		kind: discount.kind,
		reason: discount.reason ?? "",
		value:
			discount.kind === "amount"
				? formatMoneyInput(BigInt(discount.amountCents))
				: formatMarginInput(discount.basisPoints),
	};
}

export function discountOf(draft: DiscountDraft): QuoteDiscountView | null {
	const reason = optionalText(draft.reason);
	if (draft.kind === "amount") {
		return { amountCents: centsOf(draft.value), kind: "amount", reason };
	}
	if (draft.kind === "percent") {
		return {
			basisPoints: parseDiscountPercent(draft.value) ?? 0,
			kind: "percent",
			reason,
		};
	}
	return null;
}

export type DiscountErrors = { discount?: string; reason?: string };

const overLine = "O desconto passa do valor da linha";

function amountError(
	text: string,
	baseCents: bigint | null,
	overBase: string
): string | null {
	if (text.trim() === "") {
		return "Informe o desconto";
	}
	const cents = parseMoney(text);
	if (cents === null) {
		return moneyFormat;
	}
	if (cents === 0n) {
		return "Use um desconto maior que zero";
	}
	return baseCents !== null && cents > baseCents ? overBase : null;
}

function percentError(text: string): string | null {
	return parseDiscountPercent(text) === null ? "Use de 0,01 a 100%" : null;
}

function discountErrorsOver(
	draft: DiscountDraft,
	baseCents: bigint | null,
	overBase: string
): DiscountErrors {
	if (draft.kind === "none") {
		return {};
	}
	const discount =
		draft.kind === "amount"
			? amountError(draft.value, baseCents, overBase)
			: percentError(draft.value);
	return present([
		["discount", discount],
		["reason", textError(draft.reason, quoteLimits.discountReason)],
	]);
}

export function discountErrors(
	draft: DiscountDraft,
	baseCents: bigint
): DiscountErrors {
	return discountErrorsOver(draft, baseCents, overLine);
}

export type LineField =
	| "components"
	| "cost"
	| "description"
	| "discount"
	| "note"
	| "price"
	| "quantity"
	| "reason";

export type LineErrors = Partial<Record<LineField, string>>;

function grossOf(line: QuoteLineView): bigint {
	return lineTotals(quoteLineOfText(line)).grossCents;
}

function lineErrors(
	fields: readonly (readonly [LineField, string | null])[],
	discount: DiscountDraft,
	line: () => QuoteLineView
): LineErrors {
	const found = present(fields);
	const gross =
		found.price === undefined && found.quantity === undefined
			? grossOf(line())
			: null;
	const discountFound = discountErrorsOver(discount, gross, overLine);
	return { ...found, ...discountFound };
}

export type ServiceCopy = {
	catalogPriceCents: string;
	estimatedMinutes: number | null;
	name: string;
	outsourced: boolean;
	serviceId: string;
	unitCostCents: string;
	version: number;
};

export type ServiceLineDraft = {
	discount: DiscountDraft;
	note: string;
	price: string;
	profileId: string | null;
	quantity: string;
	receivedItemId: string | null;
	service: ServiceCopy;
};

export function serviceCopyOf(service: ServiceView): ServiceCopy {
	return {
		catalogPriceCents: service.priceCents,
		estimatedMinutes: service.estimatedMinutes,
		name: service.name,
		outsourced: service.outsourced,
		serviceId: service.id,
		unitCostCents: service.costCents,
		version: service.version,
	};
}

export function serviceLineDraft(service: ServiceCopy): ServiceLineDraft {
	return {
		discount: noDiscount,
		note: "",
		price: formatMoneyInput(BigInt(service.catalogPriceCents)),
		profileId: null,
		quantity: "1",
		receivedItemId: null,
		service,
	};
}

export function serviceLineDraftOf(line: ServiceLineView): ServiceLineDraft {
	return {
		discount: discountDraftOf(line.discount),
		note: line.note ?? "",
		price: formatMoneyInput(BigInt(line.unitPriceCents)),
		profileId: line.profileId,
		quantity: String(line.quantity),
		receivedItemId: line.receivedItemId,
		service: {
			catalogPriceCents: line.catalogPriceCents,
			estimatedMinutes: line.estimatedMinutes,
			name: line.serviceName,
			outsourced: line.outsourced,
			serviceId: line.serviceId,
			unitCostCents: line.unitCostCents,
			version: line.serviceVersion,
		},
	};
}

export function serviceLineOf(
	draft: ServiceLineDraft,
	id: string
): ServiceLineView {
	return {
		catalogPriceCents: draft.service.catalogPriceCents,
		discount: discountOf(draft.discount),
		estimatedMinutes: draft.service.estimatedMinutes,
		id,
		kind: "service",
		note: optionalText(draft.note),
		outsourced: draft.service.outsourced,
		profileId: draft.profileId,
		quantity: Number(draft.quantity),
		receivedItemId: draft.receivedItemId,
		serviceId: draft.service.serviceId,
		serviceName: draft.service.name,
		serviceVersion: draft.service.version,
		unitCostCents: draft.service.unitCostCents,
		unitPriceCents: centsOf(draft.price),
	};
}

export function serviceLineErrors(draft: ServiceLineDraft): LineErrors {
	return lineErrors(
		[
			["note", textError(draft.note, quoteLimits.lineNote)],
			["price", priceError(draft.price)],
			["quantity", rangeError(draft.quantity, quoteLimits.quantity)],
		],
		draft.discount,
		() => serviceLineOf(draft, "")
	);
}

export type MaterialCopy = {
	baseUnit: BaseUnitCode;
	code: string | null;
	displayPrecision: number;
	materialName: string;
	materialVariantId: string;
	variantName: string;
};

export type MaterialLineDraft = {
	cost: string;
	discount: DiscountDraft;
	material: MaterialCopy;
	note: string;
	price: string;
	quantity: string;
};

export function materialCopyOf(option: VariantOptionView): MaterialCopy {
	return {
		baseUnit: option.baseUnit,
		code: option.code,
		displayPrecision: option.displayPrecision,
		materialName: option.materialName,
		materialVariantId: option.id,
		variantName: option.name,
	};
}

function materialCopyFrom(item: MaterialCopy): MaterialCopy {
	return {
		baseUnit: item.baseUnit,
		code: item.code,
		displayPrecision: item.displayPrecision,
		materialName: item.materialName,
		materialVariantId: item.materialVariantId,
		variantName: item.variantName,
	};
}

function quantityInput(micros: string, precision: number): string {
	return formatQuantityInput(BigInt(micros), precision);
}

export function materialLineDraft(
	option: VariantOptionView
): MaterialLineDraft {
	return {
		cost: centsInput(option.referenceCostCents),
		discount: noDiscount,
		material: materialCopyOf(option),
		note: "",
		price: "",
		quantity: "",
	};
}

export function materialLineDraftOf(line: MaterialLineView): MaterialLineDraft {
	return {
		cost: centsInput(line.unitCostCents),
		discount: discountDraftOf(line.discount),
		material: materialCopyFrom(line),
		note: line.note ?? "",
		price: formatMoneyInput(BigInt(line.unitPriceCents)),
		quantity: quantityInput(line.quantityMicros, line.displayPrecision),
	};
}

export function materialLineOf(
	draft: MaterialLineDraft,
	id: string
): MaterialLineView {
	return {
		...draft.material,
		discount: discountOf(draft.discount),
		id,
		kind: "material",
		note: optionalText(draft.note),
		quantityMicros: microsOf(draft.quantity),
		unitCostCents: optionalCents(draft.cost),
		unitPriceCents: centsOf(draft.price),
	};
}

export function materialLineErrors(draft: MaterialLineDraft): LineErrors {
	return lineErrors(
		[
			["cost", costError(draft.cost)],
			["note", textError(draft.note, quoteLimits.lineNote)],
			["price", priceError(draft.price)],
			["quantity", materialQuantityError(draft.quantity)],
		],
		draft.discount,
		() => materialLineOf(draft, "")
	);
}

export type FreeLineDraft = {
	cost: string;
	description: string;
	discount: DiscountDraft;
	note: string;
	price: string;
	quantity: string;
};

export const emptyFreeLine: FreeLineDraft = {
	cost: "",
	description: "",
	discount: noDiscount,
	note: "",
	price: "",
	quantity: "1",
};

export function freeLineDraftOf(line: FreeLineView): FreeLineDraft {
	return {
		cost: centsInput(line.unitCostCents),
		description: line.description,
		discount: discountDraftOf(line.discount),
		note: line.note ?? "",
		price: formatMoneyInput(BigInt(line.unitPriceCents)),
		quantity: String(line.quantity),
	};
}

export function freeLineOf(draft: FreeLineDraft, id: string): FreeLineView {
	return {
		description: draft.description.trim(),
		discount: discountOf(draft.discount),
		id,
		kind: "free",
		note: optionalText(draft.note),
		quantity: Number(draft.quantity),
		unitCostCents: optionalCents(draft.cost),
		unitPriceCents: centsOf(draft.price),
	};
}

export function freeLineErrors(draft: FreeLineDraft): LineErrors {
	return lineErrors(
		[
			["cost", costError(draft.cost)],
			["description", descriptionError(draft.description)],
			["note", textError(draft.note, quoteLimits.lineNote)],
			["price", priceError(draft.price)],
			["quantity", rangeError(draft.quantity, quoteLimits.quantity)],
		],
		draft.discount,
		() => freeLineOf(draft, "")
	);
}

export type PieceDraft = {
	components: QuoteComponentView[];
	description: string;
	discount: DiscountDraft;
	note: string;
	price: string;
	profileId: string | null;
	quantity: string;
	source: QuoteSourceView | null;
};

export const emptyPiece: PieceDraft = {
	components: [],
	description: "",
	discount: noDiscount,
	note: "",
	price: "",
	profileId: null,
	quantity: "1",
	source: null,
};

export function pieceDraftOf(line: CustomLineView): PieceDraft {
	return {
		components: [...line.components],
		description: line.description,
		discount: discountDraftOf(line.discount),
		note: line.note ?? "",
		price: formatMoneyInput(BigInt(line.unitPriceCents)),
		profileId: line.profileId,
		quantity: String(line.quantity),
		source: line.source,
	};
}

export function pieceLineOf(draft: PieceDraft, id: string): CustomLineView {
	return {
		components: draft.components,
		description: draft.description.trim(),
		discount: discountOf(draft.discount),
		id,
		kind: "custom",
		note: optionalText(draft.note),
		profileId: draft.profileId,
		quantity: Number(draft.quantity),
		source: draft.source,
		unitPriceCents: centsOf(draft.price),
	};
}

export function pieceErrors(draft: PieceDraft): LineErrors {
	return lineErrors(
		[
			[
				"components",
				draft.components.length > quoteLimits.components
					? `Use até ${quoteLimits.components} componentes`
					: null,
			],
			["description", descriptionError(draft.description)],
			["note", textError(draft.note, quoteLimits.lineNote)],
			["price", priceError(draft.price)],
			["quantity", rangeError(draft.quantity, quoteLimits.quantity)],
		],
		draft.discount,
		() => pieceLineOf(draft, "")
	);
}

export function pieceCostOf(
	components: readonly QuoteComponentView[]
): bigint | null {
	return lineTotals(
		quoteLineOfText({
			components,
			discount: null,
			kind: "custom",
			quantity: 1,
			unitPriceCents: "0",
		})
	).costCents;
}

export type SheetCopy = {
	components: QuoteComponentView[];
	priceCents: string | null;
	skipped: number;
	source: QuoteSourceView;
};

export function copyFromProduct(
	detail: ProductDetailView,
	variantId: string | null,
	newId: () => string
): SheetCopy {
	const variant = detail.variants.find((item) => item.id === variantId);
	const entries = effectiveSheet(
		detail.product.sheet,
		variant?.sheetChanges ?? []
	);
	const components: QuoteComponentView[] = [];
	for (const { item } of entries) {
		if (item.kind === "material") {
			const reference = detail.references.materialVariants.find(
				(candidate) => candidate.id === item.materialVariantId
			);
			if (reference) {
				components.push({
					baseUnit: reference.baseUnit,
					code: reference.code,
					displayPrecision: reference.displayPrecision,
					id: newId(),
					kind: "material",
					materialName: reference.materialName,
					materialVariantId: reference.id,
					quantityMicros: String(plannedMicros(item)),
					unitCostCents: reference.referenceCostCents,
					variantName: reference.name,
				});
			}
		} else {
			const reference = detail.references.services.find(
				(candidate) => candidate.id === item.serviceId
			);
			if (reference) {
				components.push({
					count: item.count,
					estimatedMinutes: reference.estimatedMinutes,
					id: newId(),
					kind: "service",
					outsourced: reference.outsourced,
					serviceId: reference.id,
					serviceName: reference.name,
					serviceVersion: reference.version,
					unitCostCents: reference.costCents,
				});
			}
		}
	}
	return {
		components,
		priceCents: variant?.priceCents ?? null,
		skipped: entries.length - components.length,
		source: {
			productId: detail.product.id,
			productName: detail.product.name,
			productVersion: detail.product.version,
			variantId: variant?.id ?? null,
			variantName: variant?.name ?? null,
		},
	};
}

export type ServiceComponentCopy = Omit<ServiceCopy, "catalogPriceCents">;

export type MaterialComponentDraft = {
	cost: string;
	kind: "material";
	material: MaterialCopy;
	quantity: string;
};

export type ServiceComponentDraft = {
	count: string;
	kind: "service";
	service: ServiceComponentCopy;
};

export type ComponentDraft = MaterialComponentDraft | ServiceComponentDraft;

export function materialComponentDraft(
	option: VariantOptionView
): MaterialComponentDraft {
	return {
		cost: centsInput(option.referenceCostCents),
		kind: "material",
		material: materialCopyOf(option),
		quantity: "",
	};
}

export function serviceComponentDraft(
	service: ServiceComponentCopy
): ServiceComponentDraft {
	return {
		count: "1",
		kind: "service",
		service: {
			estimatedMinutes: service.estimatedMinutes,
			name: service.name,
			outsourced: service.outsourced,
			serviceId: service.serviceId,
			unitCostCents: service.unitCostCents,
			version: service.version,
		},
	};
}

export function componentDraftOf(
	component: QuoteComponentView
): ComponentDraft {
	if (component.kind === "material") {
		return {
			cost: centsInput(component.unitCostCents),
			kind: "material",
			material: materialCopyFrom(component),
			quantity: quantityInput(
				component.quantityMicros,
				component.displayPrecision
			),
		};
	}
	return {
		count: String(component.count),
		kind: "service",
		service: {
			estimatedMinutes: component.estimatedMinutes,
			name: component.serviceName,
			outsourced: component.outsourced,
			serviceId: component.serviceId,
			unitCostCents: component.unitCostCents,
			version: component.serviceVersion,
		},
	};
}

export function componentErrors(
	draft: ComponentDraft
): Partial<Record<"cost" | "count" | "quantity", string>> {
	if (draft.kind === "service") {
		return present([
			["count", rangeError(draft.count, quoteLimits.componentCount)],
		]);
	}
	return present([
		["cost", costError(draft.cost)],
		["quantity", materialQuantityError(draft.quantity)],
	]);
}

export function componentOf(
	draft: ComponentDraft,
	id: string
): QuoteComponentView {
	if (draft.kind === "material") {
		return {
			...draft.material,
			id,
			kind: "material",
			quantityMicros: microsOf(draft.quantity),
			unitCostCents: optionalCents(draft.cost),
		};
	}
	return {
		count: Number(draft.count),
		estimatedMinutes: draft.service.estimatedMinutes,
		id,
		kind: "service",
		outsourced: draft.service.outsourced,
		serviceId: draft.service.serviceId,
		serviceName: draft.service.name,
		serviceVersion: draft.service.version,
		unitCostCents: draft.service.unitCostCents,
	};
}

export function withItem<T extends { id: string }>(
	items: readonly T[],
	item: T
): T[] {
	return items.some((current) => current.id === item.id)
		? items.map((current) => (current.id === item.id ? item : current))
		: [...items, item];
}

export function withoutItem<T extends { id: string }>(
	items: readonly T[],
	id: string
): T[] {
	return items.filter((item) => item.id !== id);
}

export type ConditionsDraft = {
	discount: DiscountDraft;
	leadTime: string;
	notes: string;
	validity: string;
};

function contentOf(content: QuoteContentView): QuoteContentView {
	return {
		discount: content.discount,
		leadTimeDays: content.leadTimeDays,
		lines: content.lines,
		notes: content.notes,
		validityDays: content.validityDays,
	};
}

export function conditionsDraftOf(content: QuoteContentView): ConditionsDraft {
	return {
		discount: discountDraftOf(content.discount),
		leadTime: content.leadTimeDays === null ? "" : String(content.leadTimeDays),
		notes: content.notes ?? "",
		validity: String(content.validityDays),
	};
}

const days = " dias";

export function conditionsErrors(
	draft: ConditionsDraft,
	subtotalCents: bigint
): Partial<
	Record<"discount" | "leadTime" | "notes" | "reason" | "validity", string>
> {
	const discount = discountErrorsOver(
		draft.discount,
		subtotalCents,
		"O desconto passa do subtotal"
	);
	return present([
		["discount", discount.discount],
		[
			"leadTime",
			draft.leadTime.trim() === ""
				? null
				: rangeError(draft.leadTime, quoteLimits.leadTimeDays, days),
		],
		["notes", textError(draft.notes, quoteLimits.notes)],
		["reason", discount.reason],
		["validity", rangeError(draft.validity, quoteLimits.validityDays, days)],
	]);
}

export function contentWithConditions(
	content: QuoteContentView,
	draft: ConditionsDraft
): QuoteContentView {
	const leadTime = draft.leadTime.trim();
	return {
		...contentOf(content),
		discount: discountOf(draft.discount),
		leadTimeDays: leadTime === "" ? null : Number(leadTime),
		notes: optionalText(draft.notes),
		validityDays: Number(draft.validity.trim()),
	};
}

export function contentWithLines(
	content: QuoteContentView,
	lines: readonly QuoteLineView[]
): QuoteContentView {
	return { ...contentOf(content), lines: [...lines] };
}

export function documentDiscountFits(content: QuoteContentView): boolean {
	const totals = quoteTotalsOfText(content.lines, content.discount);
	return totals.documentDiscountCents <= totals.subtotalCents;
}

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;

export function dayError(text: string, today: string): string | null {
	const date = new Date(`${text}T00:00:00Z`);
	const valid =
		dayPattern.test(text) &&
		!Number.isNaN(date.getTime()) &&
		date.toISOString().slice(0, 10) === text;
	if (!valid) {
		return "Data inválida";
	}
	return text > today ? "Use uma data até hoje" : null;
}

export function createQuoteFields(
	clientId: string,
	createdOn: string
): { clientId: string; createdOn: string } {
	return { clientId, createdOn };
}

export function emissionFields(
	content: QuoteContentView,
	emittedOn: string,
	reason: string
): { content: QuoteContentView; emittedOn: string; reason: string | null } {
	return {
		content: contentOf(content),
		emittedOn,
		reason: optionalText(reason),
	};
}

export function refusalFields(
	refusedOn: string,
	reason: string
): { reason: string | null; refusedOn: string } {
	return { reason: optionalText(reason), refusedOn };
}

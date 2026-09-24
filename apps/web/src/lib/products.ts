import { formatMoneyInput, parseMoney } from "@costura-pro/domain/money";
import {
	formatMarginInput,
	formatMarginPercent,
	parseMarginPercent,
} from "@costura-pro/domain/pricing";
import {
	type EffectiveItem,
	effectiveSheet,
	plannedQuantity,
	productLimits,
	type SheetChange,
	type SheetItem,
	type SheetLoss,
	type SheetPrices,
	sheetCost,
} from "@costura-pro/domain/product";
import {
	formatQuantity,
	formatQuantityInput,
	parseQuantity,
} from "@costura-pro/domain/quantity";
import type { BaseUnitCode } from "@costura-pro/domain/unit";

import { moneyLabel } from "./finance";
import { unitAbbreviation } from "./materials";
import type { PhotoView } from "./photos";
import {
	ownTargetOf,
	type PricingPreview,
	pricingPreview,
	targetMarginError,
} from "./pricing";
import type { VariantOptionView } from "./purchases";
import type { ServiceView } from "./services";

export type SheetLossView =
	| { kind: "fixed"; quantityMicros: string }
	| { basisPoints: number; kind: "percent" };

export type SheetMaterialView = {
	id: string;
	kind: "material";
	loss: SheetLossView | null;
	materialVariantId: string;
	note: string | null;
	quantityMicros: string;
};

export type SheetServiceView = {
	count: number;
	id: string;
	kind: "service";
	note: string | null;
	serviceId: string;
};

export type SheetItemView = SheetMaterialView | SheetServiceView;

export type SheetChangeView = SheetChange<SheetItemView>;

export type ProductView = {
	archivedAt: string | null;
	category: string | null;
	createdAt: string;
	id: string;
	name: string;
	notes: string | null;
	photos: readonly PhotoView[];
	sheet: readonly SheetItemView[];
	targetMarginBasisPoints: number | null;
	version: number;
};

export type ProductVariantView = {
	archivedAt: string | null;
	code: string | null;
	coverPhotoHash: string | null;
	createdAt: string;
	id: string;
	name: string;
	priceCents: string;
	productId: string;
	sheetChanges: readonly SheetChangeView[];
	version: number;
};

export type MaterialVariantReference = {
	archived: boolean;
	baseUnit: BaseUnitCode;
	code: string | null;
	displayPrecision: number;
	id: string;
	materialId: string;
	materialName: string;
	name: string;
	referenceCostCents: string | null;
};

export type ServiceReference = {
	archived: boolean;
	costCents: string;
	estimatedMinutes: number | null;
	id: string;
	name: string;
	outsourced: boolean;
	version: number;
};

export type ProductReferences = {
	materialVariants: readonly MaterialVariantReference[];
	services: readonly ServiceReference[];
};

export type ProductDetailView = {
	product: ProductView;
	references: ProductReferences;
	variants: readonly ProductVariantView[];
};

export type CostedLine = {
	cost: bigint | null;
	item: SheetItemView;
	origin: EffectiveItem<SheetItemView>["origin"];
};

export type EstimateStatus = "complete" | "empty" | "incomplete";

export type SheetEstimate = {
	lines: CostedLine[];
	missing: CostedLine[];
	status: EstimateStatus;
	totalCents: bigint;
};

function domainLoss(loss: SheetLossView | null): SheetLoss | null {
	if (loss === null) {
		return null;
	}
	return loss.kind === "fixed"
		? { kind: "fixed", quantityMicros: BigInt(loss.quantityMicros) }
		: loss;
}

function domainItem(item: SheetItemView): SheetItem {
	if (item.kind === "service") {
		return item;
	}
	return {
		...item,
		loss: domainLoss(item.loss),
		quantityMicros: BigInt(item.quantityMicros),
	};
}

function sheetPricesOf(references: ProductReferences): SheetPrices {
	return {
		materials: new Map(
			references.materialVariants.map((variant) => [
				variant.id,
				variant.referenceCostCents === null
					? null
					: BigInt(variant.referenceCostCents),
			])
		),
		services: new Map(
			references.services.map((service) => [
				service.id,
				BigInt(service.costCents),
			])
		),
	};
}

function statusOf(lineCount: number, complete: boolean): EstimateStatus {
	if (lineCount === 0) {
		return "empty";
	}
	return complete ? "complete" : "incomplete";
}

function estimateOf(
	entries: readonly EffectiveItem<SheetItemView>[],
	references: ProductReferences
): SheetEstimate {
	const cost = sheetCost(
		entries.map(({ item }) => domainItem(item)),
		sheetPricesOf(references)
	);
	const lines = entries.map((entry, index) => ({
		cost: cost.lines[index] ?? null,
		item: entry.item,
		origin: entry.origin,
	}));
	return {
		lines,
		missing: lines.filter((line) => line.cost === null),
		status: statusOf(lines.length, cost.complete),
		totalCents: cost.totalCents,
	};
}

export function baseEstimate(
	sheet: readonly SheetItemView[],
	references: ProductReferences
): SheetEstimate {
	return estimateOf(
		sheet.map((item) => ({ item, origin: "base" as const })),
		references
	);
}

export function variantEstimate(
	sheet: readonly SheetItemView[],
	changes: readonly SheetChangeView[],
	references: ProductReferences
): SheetEstimate {
	return estimateOf(effectiveSheet(sheet, changes), references);
}

export function variantPricing(
	product: Pick<ProductView, "targetMarginBasisPoints">,
	estimate: SheetEstimate,
	priceCents: string | null,
	atelierTarget: number
): PricingPreview | null {
	if (estimate.status !== "complete") {
		return null;
	}
	return pricingPreview(
		{
			costCents: estimate.totalCents.toString(),
			priceCents,
			targetMarginBasisPoints: product.targetMarginBasisPoints,
		},
		atelierTarget
	);
}

export function materialReferenceFor(
	references: ProductReferences,
	materialVariantId: string
): MaterialVariantReference | undefined {
	return references.materialVariants.find(
		(variant) => variant.id === materialVariantId
	);
}

export function serviceReferenceFor(
	references: ProductReferences,
	serviceId: string
): ServiceReference | undefined {
	return references.services.find((service) => service.id === serviceId);
}

export function plannedMicros(item: SheetMaterialView): bigint {
	return plannedQuantity(BigInt(item.quantityMicros), domainLoss(item.loss));
}

export function quantityLabel(
	item: SheetMaterialView,
	reference: MaterialVariantReference | undefined
): string {
	const planned = plannedMicros(item);
	return reference
		? `${formatQuantity(planned, reference.displayPrecision)} ${unitAbbreviation(reference.baseUnit)}`
		: formatQuantity(planned, 0);
}

export function lossLabel(
	item: SheetMaterialView,
	reference: MaterialVariantReference | undefined
): string | null {
	if (item.loss === null) {
		return null;
	}
	const precision = reference?.displayPrecision ?? 0;
	const unit = reference ? ` ${unitAbbreviation(reference.baseUnit)}` : "";
	const base = `${formatQuantity(BigInt(item.quantityMicros), precision)}${unit}`;
	const loss =
		item.loss.kind === "fixed"
			? `${formatQuantity(BigInt(item.loss.quantityMicros), precision)}${unit}`
			: formatMarginPercent(item.loss.basisPoints);
	return `${base} mais ${loss} de perda`;
}

export function itemTitle(
	item: SheetItemView,
	references: ProductReferences
): string {
	if (item.kind === "service") {
		const service = serviceReferenceFor(references, item.serviceId);
		if (!service) {
			return "Serviço não encontrado";
		}
		return item.count === 1 ? service.name : `${service.name} × ${item.count}`;
	}
	const variant = materialReferenceFor(references, item.materialVariantId);
	return variant
		? `${variant.materialName} · ${variant.name}`
		: "Material não encontrado";
}

export function priceRangeLabel(
	minPriceCents: string | null,
	maxPriceCents: string | null
): string {
	if (minPriceCents === null || maxPriceCents === null) {
		return "Sem variante";
	}
	return minPriceCents === maxPriceCents
		? moneyLabel(minPriceCents)
		: `${moneyLabel(minPriceCents)} a ${moneyLabel(maxPriceCents)}`;
}

export function coverOf(
	photos: readonly PhotoView[],
	coverPhotoHash: string | null
): PhotoView | null {
	if (coverPhotoHash === null) {
		return null;
	}
	return photos.find((photo) => photo.photoHash === coverPhotoHash) ?? null;
}

export function displayPhotoOf(
	photos: readonly PhotoView[],
	coverPhotoHash: string | null
): PhotoView | null {
	return coverOf(photos, coverPhotoHash) ?? photos[0] ?? null;
}

export function withMaterial(
	references: ProductReferences,
	reference: MaterialVariantReference
): ProductReferences {
	return {
		...references,
		materialVariants: [
			...references.materialVariants.filter(
				(variant) => variant.id !== reference.id
			),
			reference,
		],
	};
}

export function withService(
	references: ProductReferences,
	reference: ServiceReference
): ProductReferences {
	return {
		...references,
		services: [
			...references.services.filter((service) => service.id !== reference.id),
			reference,
		],
	};
}

export function materialReferenceOf(
	option: VariantOptionView
): MaterialVariantReference {
	return {
		archived: false,
		baseUnit: option.baseUnit,
		code: option.code,
		displayPrecision: option.displayPrecision,
		id: option.id,
		materialId: option.materialId,
		materialName: option.materialName,
		name: option.name,
		referenceCostCents: option.referenceCostCents,
	};
}

export function serviceReferenceOf(service: ServiceView): ServiceReference {
	return {
		archived: service.archivedAt !== null,
		costCents: service.costCents,
		estimatedMinutes: service.estimatedMinutes,
		id: service.id,
		name: service.name,
		outsourced: service.outsourced,
		version: service.version,
	};
}

export const productPhotoLimit = {
	limit: productLimits.photos,
	owner: "produto",
};

export type ProductFormValues = {
	category: string;
	name: string;
	notes: string;
	targetMargin: string;
};

export type ProductField = keyof ProductFormValues;

export const productFieldOrder: readonly ProductField[] = [
	"name",
	"category",
	"targetMargin",
	"notes",
];

export const emptyProductValues: ProductFormValues = {
	category: "",
	name: "",
	notes: "",
	targetMargin: "",
};

export type ProductFields = {
	category: string | null;
	name: string;
	notes: string | null;
	photos: PhotoView[];
	targetMarginBasisPoints: number | null;
};

const emptyToNull = (value: string) => {
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
};

const tooLong = (max: number) => `Use até ${max} caracteres`;

export function productFormValues(product: ProductView): ProductFormValues {
	return {
		category: product.category ?? "",
		name: product.name,
		notes: product.notes ?? "",
		targetMargin:
			product.targetMarginBasisPoints === null
				? ""
				: formatMarginInput(product.targetMarginBasisPoints),
	};
}

export function productFormErrors(
	values: ProductFormValues
): Partial<Record<ProductField, string>> {
	const name = values.name.trim();
	const targetMargin = targetMarginError(values.targetMargin);
	return {
		...(name === "" ? { name: "Informe o nome do produto" } : {}),
		...(name.length > productLimits.name.max
			? { name: tooLong(productLimits.name.max) }
			: {}),
		...(values.category.trim().length > productLimits.category
			? { category: tooLong(productLimits.category) }
			: {}),
		...(targetMargin ? { targetMargin } : {}),
		...(values.notes.trim().length > productLimits.notes
			? { notes: tooLong(productLimits.notes) }
			: {}),
	};
}

export function productFields(
	values: ProductFormValues,
	photos: readonly PhotoView[]
): ProductFields {
	return {
		category: emptyToNull(values.category),
		name: values.name.trim(),
		notes: emptyToNull(values.notes),
		photos: [...photos],
		targetMarginBasisPoints: ownTargetOf(values.targetMargin),
	};
}

const productScalarKeys = [
	"category",
	"name",
	"notes",
	"targetMarginBasisPoints",
] as const;

export function productPatch(
	opened: ProductView,
	fields: ProductFields
): Partial<ProductFields> | null {
	const patch: Partial<ProductFields> = Object.fromEntries(
		productScalarKeys
			.filter((key) => fields[key] !== opened[key])
			.map((key) => [key, fields[key]])
	);
	const photosChanged =
		JSON.stringify(fields.photos) !== JSON.stringify(opened.photos);
	const full = photosChanged ? { ...patch, photos: fields.photos } : patch;
	return Object.keys(full).length === 0 ? null : full;
}

export type LossKind = "fixed" | "none" | "percent";

export type MaterialItemDraft = {
	kind: "material";
	loss: string;
	lossKind: LossKind;
	note: string;
	quantity: string;
	variant: MaterialVariantReference;
};

export type ServiceItemDraft = {
	count: string;
	kind: "service";
	note: string;
	service: ServiceReference;
};

export type SheetItemDraft = MaterialItemDraft | ServiceItemDraft;

export type SheetItemField = "count" | "loss" | "note" | "quantity";

const quantityError = "Use quantidade maior que zero, com até 6 casas";
const countPattern = /^\d{1,2}$/;

function positiveQuantityOf(text: string): bigint | null {
	const parsed = parseQuantity(text, 6);
	return parsed !== null && parsed > 0n ? parsed : null;
}

function lossPercentOf(text: string): number | null {
	const parsed = parseMarginPercent(text);
	return parsed !== null && parsed >= productLimits.lossBasisPoints.min
		? parsed
		: null;
}

function countOf(text: string): number | null {
	const trimmed = text.trim();
	if (!countPattern.test(trimmed)) {
		return null;
	}
	const value = Number(trimmed);
	return value >= productLimits.serviceCount.min &&
		value <= productLimits.serviceCount.max
		? value
		: null;
}

export function materialDraft(
	variant: MaterialVariantReference
): MaterialItemDraft {
	return {
		kind: "material",
		loss: "",
		lossKind: "none",
		note: "",
		quantity: "",
		variant,
	};
}

export function serviceDraft(service: ServiceReference): ServiceItemDraft {
	return { count: "1", kind: "service", note: "", service };
}

function lossInput(loss: SheetLossView | null, precision: number): string {
	if (loss === null) {
		return "";
	}
	return loss.kind === "fixed"
		? formatQuantityInput(BigInt(loss.quantityMicros), precision)
		: formatMarginInput(loss.basisPoints);
}

export function draftOf(
	item: SheetItemView,
	references: ProductReferences
): SheetItemDraft | null {
	if (item.kind === "service") {
		const service = serviceReferenceFor(references, item.serviceId);
		return service
			? {
					count: String(item.count),
					kind: "service",
					note: item.note ?? "",
					service,
				}
			: null;
	}
	const variant = materialReferenceFor(references, item.materialVariantId);
	if (!variant) {
		return null;
	}
	return {
		kind: "material",
		loss: lossInput(item.loss, variant.displayPrecision),
		lossKind: item.loss?.kind ?? "none",
		note: item.note ?? "",
		quantity: formatQuantityInput(
			BigInt(item.quantityMicros),
			variant.displayPrecision
		),
		variant,
	};
}

function lossError(
	draft: MaterialItemDraft
): Partial<Record<SheetItemField, string>> {
	if (draft.lossKind === "fixed" && positiveQuantityOf(draft.loss) === null) {
		return { loss: quantityError };
	}
	if (draft.lossKind === "percent" && lossPercentOf(draft.loss) === null) {
		return { loss: "Use de 0,01 a 99,99%" };
	}
	return {};
}

export function sheetItemErrors(
	draft: SheetItemDraft
): Partial<Record<SheetItemField, string>> {
	const note =
		draft.note.trim().length > productLimits.itemNote
			? { note: tooLong(productLimits.itemNote) }
			: {};
	if (draft.kind === "service") {
		return {
			...(countOf(draft.count) === null ? { count: "Use de 1 a 99" } : {}),
			...note,
		};
	}
	return {
		...(positiveQuantityOf(draft.quantity) === null
			? { quantity: quantityError }
			: {}),
		...lossError(draft),
		...note,
	};
}

function lossOf(draft: MaterialItemDraft): SheetLossView | null {
	if (draft.lossKind === "fixed") {
		return {
			kind: "fixed",
			quantityMicros: (positiveQuantityOf(draft.loss) ?? 0n).toString(),
		};
	}
	if (draft.lossKind === "percent") {
		return { basisPoints: lossPercentOf(draft.loss) ?? 0, kind: "percent" };
	}
	return null;
}

export function sheetItemOf(draft: SheetItemDraft, id: string): SheetItemView {
	const note = emptyToNull(draft.note);
	if (draft.kind === "service") {
		return {
			count: countOf(draft.count) ?? productLimits.serviceCount.min,
			id,
			kind: "service",
			note,
			serviceId: draft.service.id,
		};
	}
	return {
		id,
		kind: "material",
		loss: lossOf(draft),
		materialVariantId: draft.variant.id,
		note,
		quantityMicros: (positiveQuantityOf(draft.quantity) ?? 0n).toString(),
	};
}

export function upsertItem(
	sheet: readonly SheetItemView[],
	item: SheetItemView
): SheetItemView[] {
	return sheet.some((current) => current.id === item.id)
		? sheet.map((current) => (current.id === item.id ? item : current))
		: [...sheet, item];
}

export function withoutItem(
	sheet: readonly SheetItemView[],
	itemId: string
): SheetItemView[] {
	return sheet.filter((item) => item.id !== itemId);
}

export type VariantSheetRow =
	| { item: SheetItemView; state: "added" | "base" | "removed" }
	| { item: SheetItemView; original: SheetItemView; state: "replaced" };

function changedIdOf(change: SheetChangeView): string {
	return change.kind === "remove" ? change.itemId : change.item.id;
}

export function variantSheetRows(
	base: readonly SheetItemView[],
	changes: readonly SheetChangeView[]
): VariantSheetRow[] {
	const byId = new Map(
		changes
			.filter((change) => change.kind !== "add")
			.map((change) => [changedIdOf(change), change])
	);
	const baseRows = base.map((item): VariantSheetRow => {
		const change = byId.get(item.id);
		if (change?.kind === "replace") {
			return { item: change.item, original: item, state: "replaced" };
		}
		return { item, state: change?.kind === "remove" ? "removed" : "base" };
	});
	const added = changes.flatMap((change): VariantSheetRow[] =>
		change.kind === "add" ? [{ item: change.item, state: "added" }] : []
	);
	return [...baseRows, ...added];
}

export function withReplacement(
	changes: readonly SheetChangeView[],
	item: SheetItemView
): SheetChangeView[] {
	return [
		...changes.filter((change) => changedIdOf(change) !== item.id),
		{ item, kind: "replace" },
	];
}

export function withRemoval(
	changes: readonly SheetChangeView[],
	itemId: string
): SheetChangeView[] {
	return [
		...changes.filter((change) => changedIdOf(change) !== itemId),
		{ itemId, kind: "remove" },
	];
}

export function withoutChange(
	changes: readonly SheetChangeView[],
	itemId: string
): SheetChangeView[] {
	return changes.filter((change) => changedIdOf(change) !== itemId);
}

export function withAdded(
	changes: readonly SheetChangeView[],
	item: SheetItemView
): SheetChangeView[] {
	const exists = changes.some(
		(change) => change.kind === "add" && change.item.id === item.id
	);
	return exists
		? changes.map((change) =>
				change.kind === "add" && change.item.id === item.id
					? { item, kind: "add" }
					: change
			)
		: [...changes, { item, kind: "add" }];
}

export function liveChanges(
	base: readonly SheetItemView[],
	changes: readonly SheetChangeView[]
): SheetChangeView[] {
	const ids = new Set(base.map((item) => item.id));
	return changes.filter(
		(change) => change.kind === "add" || ids.has(changedIdOf(change))
	);
}

export function changesFull(
	base: readonly SheetItemView[],
	changes: readonly SheetChangeView[]
): boolean {
	return liveChanges(base, changes).length >= productLimits.sheetChanges;
}

export type ProductVariantFormValues = {
	code: string;
	coverPhotoHash: string | null;
	name: string;
	price: string;
};

export type ProductVariantField = "code" | "name" | "price";

export const productVariantFieldOrder: readonly ProductVariantField[] = [
	"name",
	"code",
	"price",
];

export const emptyProductVariantValues: ProductVariantFormValues = {
	code: "",
	coverPhotoHash: null,
	name: "",
	price: "",
};

export type ProductVariantFields = {
	code: string | null;
	coverPhotoHash: string | null;
	name: string;
	priceCents: string;
	sheetChanges: SheetChangeView[];
};

export function productVariantFormValues(
	variant: ProductVariantView
): ProductVariantFormValues {
	return {
		code: variant.code ?? "",
		coverPhotoHash: variant.coverPhotoHash,
		name: variant.name,
		price: formatMoneyInput(BigInt(variant.priceCents)),
	};
}

function priceError(text: string): string | null {
	if (text.trim() === "") {
		return "Informe o preço praticado";
	}
	return parseMoney(text) === null ? "Use valor com até 2 casas" : null;
}

export function productVariantFormErrors(
	values: ProductVariantFormValues
): Partial<Record<ProductVariantField, string>> {
	const name = values.name.trim();
	const price = priceError(values.price);
	return {
		...(name === "" ? { name: "Informe o nome da variante" } : {}),
		...(name.length > productLimits.variantName.max
			? { name: tooLong(productLimits.variantName.max) }
			: {}),
		...(values.code.trim().length > productLimits.code
			? { code: tooLong(productLimits.code) }
			: {}),
		...(price ? { price } : {}),
	};
}

export function productVariantFields(
	values: ProductVariantFormValues,
	changes: readonly SheetChangeView[],
	base: readonly SheetItemView[]
): ProductVariantFields {
	return {
		code: emptyToNull(values.code),
		coverPhotoHash: values.coverPhotoHash,
		name: values.name.trim(),
		priceCents: String(parseMoney(values.price) ?? 0n),
		sheetChanges: liveChanges(base, changes),
	};
}

const variantScalarKeys = [
	"code",
	"coverPhotoHash",
	"name",
	"priceCents",
] as const;

export function productVariantPatch(
	opened: ProductVariantView,
	fields: ProductVariantFields
): Partial<ProductVariantFields> | null {
	const patch: Partial<ProductVariantFields> = Object.fromEntries(
		variantScalarKeys
			.filter((key) => fields[key] !== opened[key])
			.map((key) => [key, fields[key]])
	);
	const changesChanged =
		JSON.stringify(fields.sheetChanges) !== JSON.stringify(opened.sheetChanges);
	const full = changesChanged
		? { ...patch, sheetChanges: fields.sheetChanges }
		: patch;
	return Object.keys(full).length === 0 ? null : full;
}

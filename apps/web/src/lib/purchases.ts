import { formatPhone, normalizePhone } from "@costura-pro/domain/client";
import { materialLimits } from "@costura-pro/domain/material";
import { formatMoney, parseMoney } from "@costura-pro/domain/money";
import {
	type PurchaseProblem,
	type PurchaseTotalsResult,
	purchaseLimits,
	purchaseTotals,
} from "@costura-pro/domain/purchase";
import {
	displayPrecision,
	formatQuantity,
	formatQuantityInput,
	parseQuantity,
	quantityScale,
} from "@costura-pro/domain/quantity";
import { supplierLimits } from "@costura-pro/domain/supplier";
import type { BaseUnitCode } from "@costura-pro/domain/unit";
import z from "zod";

import { unitAbbreviation } from "./materials";
import { dateError, emptyToNull, quantityError } from "./stock";

export type VariantOptionView = {
	baseUnit: BaseUnitCode;
	code: string | null;
	displayPrecision: number;
	id: string;
	materialId: string;
	materialName: string;
	name: string;
	packaging: { label: string; quantityMicros: string } | null;
	referenceCostCents: string | null;
	tracksLots: boolean;
};

export type PurchaseItemDraft = {
	key: string;
	locationId: string;
	lotId: string | null;
	movementId: string;
	packageCount: string;
	packagingLabel: string;
	packagingQuantity: string;
	unitPrice: string;
	variant: VariantOptionView;
};

export type PaymentKind = "later" | "now";

export type PurchaseFormValues = {
	accountId: string;
	discount: string;
	dueOn: string;
	freight: string;
	items: PurchaseItemDraft[];
	notes: string;
	occurredOn: string;
	paymentKind: PaymentKind;
	reference: string;
	supplierId: string;
};

export type ItemDraftField =
	| "locationId"
	| "lotId"
	| "packageCount"
	| "packagingLabel"
	| "packagingQuantity"
	| "unitPrice";

export type PurchaseFormField =
	| "accountId"
	| "discount"
	| "dueOn"
	| "freight"
	| "items"
	| "notes"
	| "occurredOn"
	| "reference"
	| "supplierId"
	| "totals";

export type PurchaseStatus = "open" | "paid" | "reversed";

export function defaultPackaging(variant: VariantOptionView): {
	label: string;
	quantity: string;
} {
	if (variant.packaging) {
		return {
			label: variant.packaging.label,
			quantity: formatQuantityInput(
				BigInt(variant.packaging.quantityMicros),
				0
			),
		};
	}
	return { label: unitAbbreviation(variant.baseUnit), quantity: "1" };
}

function micros(text: string): bigint | null {
	return parseQuantity(text.trim(), displayPrecision.max);
}

function priceError(text: string): string | null {
	if (text.trim() === "") {
		return "Informe o preço da embalagem";
	}
	return parseMoney(text.trim()) === null
		? "Use só número, com vírgula e até 2 casas"
		: null;
}

function optionalMoneyError(text: string): string | null {
	return text.trim() === "" || parseMoney(text.trim()) !== null
		? null
		: "Use só número, com vírgula e até 2 casas";
}

function optionalMoney(text: string): bigint | null {
	return text.trim() === "" ? 0n : parseMoney(text.trim());
}

export function itemDraftErrors(
	draft: PurchaseItemDraft
): Partial<Record<ItemDraftField, string>> {
	const label = draft.packagingLabel.trim();
	const labelError = (() => {
		if (label === "") {
			return "Informe a embalagem";
		}
		return label.length > materialLimits.packagingLabel.max
			? `Use até ${materialLimits.packagingLabel.max} caracteres`
			: null;
	})();
	const packageCount = quantityError(draft.packageCount);
	const packagingQuantity = quantityError(draft.packagingQuantity);
	const unitPrice = priceError(draft.unitPrice);
	return {
		...(draft.locationId === "" ? { locationId: "Escolha o local" } : {}),
		...(draft.variant.tracksLots && draft.lotId === null
			? { lotId: "Escolha o lote" }
			: {}),
		...(packageCount ? { packageCount } : {}),
		...(labelError ? { packagingLabel: labelError } : {}),
		...(packagingQuantity ? { packagingQuantity } : {}),
		...(unitPrice ? { unitPrice } : {}),
	};
}

function lineOf(draft: PurchaseItemDraft) {
	const packageCountMicros = micros(draft.packageCount);
	const packagingQuantityMicros = micros(draft.packagingQuantity);
	const unitPriceCents =
		draft.unitPrice.trim() === "" ? null : parseMoney(draft.unitPrice.trim());
	if (
		packageCountMicros === null ||
		packagingQuantityMicros === null ||
		unitPriceCents === null
	) {
		return null;
	}
	return { packageCountMicros, packagingQuantityMicros, unitPriceCents };
}

export function purchasePreview(
	values: Pick<PurchaseFormValues, "discount" | "freight" | "items">
): PurchaseTotalsResult | null {
	const lines = values.items.map(lineOf);
	const freight = optionalMoney(values.freight);
	const discount = optionalMoney(values.discount);
	if (
		values.items.length === 0 ||
		freight === null ||
		discount === null ||
		lines.some((line) => line === null)
	) {
		return null;
	}
	return purchaseTotals(
		lines.filter((line) => line !== null),
		freight,
		discount
	);
}

const problemMessages: Record<PurchaseProblem, string> = {
	allocationWithoutGross: "Frete e desconto precisam de algum item com preço",
	negativeLine:
		"O desconto deixa algum item com custo negativo; confira os valores",
	nonPositiveTotal: "O total da compra precisa ser maior que zero",
	tooLarge: "Valor alto demais; confira as quantidades e os preços",
	zeroQuantity: "Algum item ficou com quantidade zero na unidade base",
};

export function purchaseProblemMessage(problem: PurchaseProblem): string {
	return problemMessages[problem];
}

function paymentErrors(
	values: PurchaseFormValues
): Partial<Record<"accountId" | "dueOn", string>> {
	if (values.paymentKind === "now") {
		return values.accountId === ""
			? { accountId: "Escolha a conta que pagou" }
			: {};
	}
	const invalid = dateError(values.dueOn);
	if (invalid) {
		return { dueOn: invalid };
	}
	return values.dueOn < values.occurredOn
		? { dueOn: "O vencimento não pode ser antes da compra" }
		: {};
}

function occurredOnError(occurredOn: string, today: string): string | null {
	return (
		dateError(occurredOn) ??
		(occurredOn > today ? "A data da compra não pode ser futura" : null)
	);
}

function itemsError(items: PurchaseItemDraft[]): string | null {
	if (items.length === 0) {
		return "Inclua pelo menos um item";
	}
	if (items.length > purchaseLimits.items.max) {
		return `Use até ${purchaseLimits.items.max} itens`;
	}
	return items.some((item) => Object.keys(itemDraftErrors(item)).length > 0)
		? "Corrija os itens marcados"
		: null;
}

function textErrors(
	values: PurchaseFormValues
): Partial<Record<"notes" | "reference", string>> {
	return {
		...(values.reference.trim().length > purchaseLimits.reference
			? { reference: `Use até ${purchaseLimits.reference} caracteres` }
			: {}),
		...(values.notes.trim().length > purchaseLimits.notes
			? { notes: `Use até ${purchaseLimits.notes} caracteres` }
			: {}),
	};
}

export function purchaseFormErrors(
	values: PurchaseFormValues,
	today: string
): Partial<Record<PurchaseFormField, string>> {
	const occurredOn = occurredOnError(values.occurredOn, today);
	const items = itemsError(values.items);
	const freight = optionalMoneyError(values.freight);
	const discount = optionalMoneyError(values.discount);
	const preview = items ? null : purchasePreview(values);
	const totals =
		preview && !preview.ok ? purchaseProblemMessage(preview.problem) : null;
	return {
		...(values.supplierId === "" ? { supplierId: "Escolha o fornecedor" } : {}),
		...(occurredOn ? { occurredOn } : {}),
		...(items ? { items } : {}),
		...(freight ? { freight } : {}),
		...(discount ? { discount } : {}),
		...(occurredOn ? {} : paymentErrors(values)),
		...textErrors(values),
		...(totals ? { totals } : {}),
	};
}

export function purchaseFields(
	values: PurchaseFormValues,
	ids: { obligationId: string; paymentMovementId: string }
) {
	return {
		discountCents: (optionalMoney(values.discount) ?? 0n).toString(),
		freightCents: (optionalMoney(values.freight) ?? 0n).toString(),
		items: values.items.map((item) => ({
			locationId: item.locationId,
			lotId: item.lotId,
			movementId: item.movementId,
			packageCountMicros: (micros(item.packageCount) ?? 0n).toString(),
			packagingLabel: item.packagingLabel.trim(),
			packagingQuantityMicros: (
				micros(item.packagingQuantity) ?? 0n
			).toString(),
			unitPriceCents: (parseMoney(item.unitPrice.trim()) ?? 0n).toString(),
			variantId: item.variant.id,
		})),
		notes: emptyToNull(values.notes),
		obligationId: ids.obligationId,
		occurredOn: values.occurredOn,
		payment:
			values.paymentKind === "now"
				? {
						accountId: values.accountId,
						kind: "now" as const,
						movementId: ids.paymentMovementId,
					}
				: { dueOn: values.dueOn, kind: "later" as const },
		reference: emptyToNull(values.reference),
		supplierId: values.supplierId,
	};
}

const statusLabels: Record<PurchaseStatus, string> = {
	open: "A pagar",
	paid: "Paga",
	reversed: "Estornada",
};

export function purchaseStatusLabel(status: PurchaseStatus): string {
	return statusLabels[status];
}

export function unitCostLabel(
	valueCents: bigint,
	quantityMicros: bigint,
	unit: BaseUnitCode
): string {
	const perUnit =
		quantityMicros <= 0n
			? 0n
			: (valueCents * quantityScale * 2n + quantityMicros) /
				(quantityMicros * 2n);
	return `R$ ${formatMoney(perUnit)} por ${unitAbbreviation(unit)}`;
}

export function plusDays(day: string, days: number): string {
	const date = new Date(`${day}T12:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

export type SupplierOptionView = {
	archivedAt: string | null;
	id: string;
	name: string;
};

export function supplierSelectItems(
	options: readonly SupplierOptionView[],
	selectedId: string
): { label: string; value: string }[] {
	return options
		.filter((option) => option.archivedAt === null || option.id === selectedId)
		.map((option) => ({
			label:
				option.archivedAt === null ? option.name : `${option.name} (arquivado)`,
			value: option.id,
		}));
}

export type SupplierView = {
	archivedAt: string | null;
	createdAt: string;
	email: string | null;
	id: string;
	name: string;
	notes: string | null;
	phone: string | null;
	updatedAt: string;
	version: number;
};

export type SupplierFormValues = {
	email: string;
	name: string;
	notes: string;
	phone: string;
};

export type SupplierField = keyof SupplierFormValues;

export function supplierFormValues(
	supplier: SupplierView | null
): SupplierFormValues {
	return {
		email: supplier?.email ?? "",
		name: supplier?.name ?? "",
		notes: supplier?.notes ?? "",
		phone: supplier?.phone ? formatPhone(supplier.phone) : "",
	};
}

export function supplierFormErrors(
	values: SupplierFormValues
): Partial<Record<SupplierField, string>> {
	const name = values.name.trim();
	const email = values.email.trim();
	const phone = values.phone.trim();
	const nameError = (() => {
		if (name === "") {
			return "Informe o nome do fornecedor";
		}
		return name.length > supplierLimits.name.max
			? `Use até ${supplierLimits.name.max} caracteres`
			: null;
	})();
	const emailError =
		email === "" ||
		(email.length <= supplierLimits.email && z.email().safeParse(email).success)
			? null
			: "E-mail inválido";
	return {
		...(nameError ? { name: nameError } : {}),
		...(phone === "" || normalizePhone(phone) !== null
			? {}
			: { phone: "Telefone com DDD, como (81) 99815-4402" }),
		...(emailError ? { email: emailError } : {}),
		...(values.notes.trim().length > supplierLimits.notes
			? { notes: `Use até ${supplierLimits.notes} caracteres` }
			: {}),
	};
}

export function supplierFields(values: SupplierFormValues): {
	email: string | null;
	name: string;
	notes: string | null;
	phone: string | null;
} {
	const phone = values.phone.trim();
	return {
		email: emptyToNull(values.email),
		name: values.name.trim(),
		notes: emptyToNull(values.notes),
		phone: phone === "" ? null : normalizePhone(phone),
	};
}

export function supplierPatch(
	supplier: SupplierView,
	values: SupplierFormValues
): Partial<ReturnType<typeof supplierFields>> {
	const next = supplierFields(values);
	return Object.fromEntries(
		Object.entries(next).filter(
			([key, value]) => supplier[key as keyof typeof next] !== value
		)
	);
}

export function packagingSummary(item: {
	baseUnit: BaseUnitCode;
	displayPrecision: number;
	packageCountMicros: bigint;
	packagingLabel: string;
	packagingQuantityMicros: bigint;
}): string {
	const unit = unitAbbreviation(item.baseUnit);
	const count = formatQuantity(item.packageCountMicros, 0);
	if (
		item.packagingLabel === unit &&
		item.packagingQuantityMicros === quantityScale
	) {
		return `${count} ${unit}`;
	}
	const content = formatQuantity(
		item.packagingQuantityMicros,
		item.displayPrecision
	);
	return `${count} × ${item.packagingLabel} (${content} ${unit})`;
}

export function draftSummary(draft: PurchaseItemDraft): string {
	const packageCountMicros = micros(draft.packageCount);
	const packagingQuantityMicros = micros(draft.packagingQuantity);
	if (packageCountMicros === null || packagingQuantityMicros === null) {
		return `${draft.packageCount} × ${draft.packagingLabel}`;
	}
	return packagingSummary({
		baseUnit: draft.variant.baseUnit,
		displayPrecision: draft.variant.displayPrecision,
		packageCountMicros,
		packagingLabel: draft.packagingLabel.trim(),
		packagingQuantityMicros,
	});
}

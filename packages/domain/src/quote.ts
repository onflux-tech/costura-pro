import { multiplyHalfUp } from "./quantity";
import { normalizeText } from "./search";

export const quoteLimits = {
	componentCount: { max: 99, min: 1 },
	components: 60,
	description: { max: 120, min: 1 },
	discountReason: 120,
	leadTimeDays: { max: 365, min: 1 },
	lineNote: 200,
	lines: 100,
	notes: 2000,
	percentDiscount: { max: 10_000, min: 1 },
	quantity: { max: 9999, min: 1 },
	refusalReason: 200,
	revisionReason: 200,
	validityDays: { max: 365, min: 1 },
} as const;

export const defaultQuoteValidityDays = 15;

export const quoteCodePrefix = "ORC";

export const serverDeviceCode = "PC";

export const anonymizedQuoteItemDescription = "Item anonimizado";

export function documentCode({
	device,
	number,
	prefix,
	year,
}: {
	device: string;
	number: number;
	prefix: string;
	year: number;
}): string {
	return `${prefix}-${year}-${device}-${String(number).padStart(4, "0")}`;
}

export function addDays(day: string, days: number): string {
	const date = new Date(`${day}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

export type QuoteDiscount =
	| { amountCents: bigint; kind: "amount" }
	| { basisPoints: number; kind: "percent" };

export type QuoteComponent =
	| {
			kind: "material";
			materialVariantId: string;
			quantityMicros: bigint;
			unitCostCents: bigint | null;
	  }
	| { count: number; kind: "service"; unitCostCents: bigint };

export type QuoteLine =
	| {
			discount: QuoteDiscount | null;
			kind: "service";
			quantity: number;
			unitCostCents: bigint;
			unitPriceCents: bigint;
	  }
	| {
			components: readonly QuoteComponent[];
			discount: QuoteDiscount | null;
			kind: "custom";
			quantity: number;
			unitPriceCents: bigint;
	  }
	| {
			discount: QuoteDiscount | null;
			kind: "material";
			materialVariantId: string;
			quantityMicros: bigint;
			unitCostCents: bigint | null;
			unitPriceCents: bigint;
	  }
	| {
			discount: QuoteDiscount | null;
			kind: "free";
			quantity: number;
			unitCostCents: bigint | null;
			unitPriceCents: bigint;
	  };

export type QuoteDiscountText =
	| { amountCents: string; kind: "amount" }
	| { basisPoints: number; kind: "percent" };

export type QuoteComponentText =
	| {
			kind: "material";
			materialVariantId: string;
			quantityMicros: string;
			unitCostCents: string | null;
	  }
	| { count: number; kind: "service"; unitCostCents: string };

export type QuoteLineText =
	| {
			discount: QuoteDiscountText | null;
			kind: "service";
			quantity: number;
			unitCostCents: string;
			unitPriceCents: string;
	  }
	| {
			components: readonly QuoteComponentText[];
			discount: QuoteDiscountText | null;
			kind: "custom";
			quantity: number;
			unitPriceCents: string;
	  }
	| {
			discount: QuoteDiscountText | null;
			kind: "material";
			materialVariantId: string;
			quantityMicros: string;
			unitCostCents: string | null;
			unitPriceCents: string;
	  }
	| {
			discount: QuoteDiscountText | null;
			kind: "free";
			quantity: number;
			unitCostCents: string | null;
			unitPriceCents: string;
	  };

export type LineTotals = {
	costCents: bigint | null;
	discountCents: bigint;
	grossCents: bigint;
	totalCents: bigint;
};

export type QuoteTotals = {
	costCents: bigint | null;
	documentDiscountCents: bigint;
	grossCents: bigint;
	lineDiscountCents: bigint;
	lines: LineTotals[];
	subtotalCents: bigint;
	totalCents: bigint;
};

function optionalCents(value: string | null): bigint | null {
	return value === null ? null : BigInt(value);
}

export function quoteDiscountOfText(
	discount: QuoteDiscountText | null
): QuoteDiscount | null {
	if (discount === null) {
		return null;
	}
	return discount.kind === "amount"
		? { amountCents: BigInt(discount.amountCents), kind: "amount" }
		: { basisPoints: discount.basisPoints, kind: "percent" };
}

function componentOfText(component: QuoteComponentText): QuoteComponent {
	return component.kind === "material"
		? {
				kind: "material",
				materialVariantId: component.materialVariantId,
				quantityMicros: BigInt(component.quantityMicros),
				unitCostCents: optionalCents(component.unitCostCents),
			}
		: {
				count: component.count,
				kind: "service",
				unitCostCents: BigInt(component.unitCostCents),
			};
}

export function quoteLineOfText(line: QuoteLineText): QuoteLine {
	const discount = quoteDiscountOfText(line.discount);
	const unitPriceCents = BigInt(line.unitPriceCents);
	switch (line.kind) {
		case "service":
			return {
				discount,
				kind: "service",
				quantity: line.quantity,
				unitCostCents: BigInt(line.unitCostCents),
				unitPriceCents,
			};
		case "custom":
			return {
				components: line.components.map(componentOfText),
				discount,
				kind: "custom",
				quantity: line.quantity,
				unitPriceCents,
			};
		case "material":
			return {
				discount,
				kind: "material",
				materialVariantId: line.materialVariantId,
				quantityMicros: BigInt(line.quantityMicros),
				unitCostCents: optionalCents(line.unitCostCents),
				unitPriceCents,
			};
		case "free":
			return {
				discount,
				kind: "free",
				quantity: line.quantity,
				unitCostCents: optionalCents(line.unitCostCents),
				unitPriceCents,
			};
		default:
			return line satisfies never;
	}
}

export function discountCents(
	baseCents: bigint,
	discount: QuoteDiscount | null
): bigint {
	if (discount === null) {
		return 0n;
	}
	return discount.kind === "amount"
		? discount.amountCents
		: (baseCents * BigInt(discount.basisPoints) + 5000n) / 10_000n;
}

function materialCost(
	quantityMicros: bigint,
	unitCostCents: bigint | null
): bigint | null {
	return unitCostCents === null
		? null
		: multiplyHalfUp(quantityMicros, unitCostCents);
}

function componentCost(component: QuoteComponent): bigint | null {
	return component.kind === "material"
		? materialCost(component.quantityMicros, component.unitCostCents)
		: BigInt(component.count) * component.unitCostCents;
}

function sumKnown(costs: readonly (bigint | null)[]): bigint | null {
	if (costs.length === 0 || costs.some((cost) => cost === null)) {
		return null;
	}
	return costs.reduce<bigint>((total, cost) => total + (cost ?? 0n), 0n);
}

export function pieceCost(
	components: readonly QuoteComponent[]
): bigint | null {
	return sumKnown(components.map(componentCost));
}

function times(quantity: number, cost: bigint | null): bigint | null {
	return cost === null ? null : BigInt(quantity) * cost;
}

function lineGross(line: QuoteLine): bigint {
	return line.kind === "material"
		? multiplyHalfUp(line.quantityMicros, line.unitPriceCents)
		: BigInt(line.quantity) * line.unitPriceCents;
}

function lineCost(line: QuoteLine): bigint | null {
	switch (line.kind) {
		case "service":
			return BigInt(line.quantity) * line.unitCostCents;
		case "custom":
			return times(line.quantity, pieceCost(line.components));
		case "material":
			return materialCost(line.quantityMicros, line.unitCostCents);
		case "free":
			return times(line.quantity, line.unitCostCents);
		default:
			return line satisfies never;
	}
}

export function lineTotals(line: QuoteLine): LineTotals {
	const grossCents = lineGross(line);
	const discount = discountCents(grossCents, line.discount);
	return {
		costCents: lineCost(line),
		discountCents: discount,
		grossCents,
		totalCents: grossCents - discount,
	};
}

function sumOf(values: readonly bigint[]): bigint {
	return values.reduce((total, value) => total + value, 0n);
}

export function quoteTotals(
	lines: readonly QuoteLine[],
	discount: QuoteDiscount | null
): QuoteTotals {
	const perLine = lines.map(lineTotals);
	const subtotalCents = sumOf(perLine.map((line) => line.totalCents));
	const documentDiscountCents = discountCents(subtotalCents, discount);
	return {
		costCents: sumKnown(perLine.map((line) => line.costCents)),
		documentDiscountCents,
		grossCents: sumOf(perLine.map((line) => line.grossCents)),
		lineDiscountCents: sumOf(perLine.map((line) => line.discountCents)),
		lines: perLine,
		subtotalCents,
		totalCents: subtotalCents - documentDiscountCents,
	};
}

export function quoteTotalsOfText(
	lines: readonly QuoteLineText[],
	discount: QuoteDiscountText | null
): QuoteTotals {
	return quoteTotals(lines.map(quoteLineOfText), quoteDiscountOfText(discount));
}

export function plannedMaterials(
	lines: readonly QuoteLine[]
): Map<string, bigint> {
	const planned = new Map<string, bigint>();
	const add = (variantId: string, quantityMicros: bigint) => {
		planned.set(variantId, (planned.get(variantId) ?? 0n) + quantityMicros);
	};
	for (const line of lines) {
		if (line.kind === "material") {
			add(line.materialVariantId, line.quantityMicros);
		}
		if (line.kind === "custom") {
			for (const component of line.components) {
				if (component.kind === "material") {
					add(
						component.materialVariantId,
						component.quantityMicros * BigInt(line.quantity)
					);
				}
			}
		}
	}
	return planned;
}

export type QuoteStatus =
	| "approved"
	| "draft"
	| "emitted"
	| "expired"
	| "refused";

export function quoteStatus({
	approved,
	refused,
	today,
	validUntil,
}: {
	approved: boolean;
	refused: boolean;
	today: string;
	validUntil: string | null;
}): QuoteStatus {
	if (approved) {
		return "approved";
	}
	if (refused) {
		return "refused";
	}
	if (validUntil === null) {
		return "draft";
	}
	return validUntil < today ? "expired" : "emitted";
}

const nonDigits = /\D/g;

export function documentSearchKey({
	code,
	titles,
}: {
	code: string;
	titles: readonly string[];
}): string {
	return normalizeText(
		[code, code.replace(nonDigits, ""), ...titles].join(" ")
	);
}

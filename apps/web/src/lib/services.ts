import { formatMoneyInput, parseMoney } from "@costura-pro/domain/money";
import {
	formatMarginInput,
	marginOfPrice,
	parseMarginPercent,
} from "@costura-pro/domain/pricing";
import { serviceLimits } from "@costura-pro/domain/service";

import {
	ownTargetOf,
	type PricingPreview,
	pricingPreview,
	targetMarginError,
} from "./pricing";

export type ServiceView = {
	archivedAt: string | null;
	category: string | null;
	costCents: string;
	createdAt: string;
	estimatedMinutes: number | null;
	id: string;
	name: string;
	notes: string | null;
	outsourced: boolean;
	priceCents: string;
	suggestedStageIds: string[];
	targetMarginBasisPoints: number | null;
	version: number;
};

export type ServiceKind = "outsourced" | "own";

export type ServiceFormValues = {
	category: string;
	cost: string;
	estimatedMinutes: string;
	kind: ServiceKind;
	name: string;
	notes: string;
	price: string;
	suggestedStageIds: string[];
	targetMargin: string;
};

export type ServiceFields = {
	category: string | null;
	costCents: string;
	estimatedMinutes: number | null;
	name: string;
	notes: string | null;
	outsourced: boolean;
	priceCents: string;
	suggestedStageIds: string[];
	targetMarginBasisPoints: number | null;
};

export type ServiceField =
	| "category"
	| "cost"
	| "estimatedMinutes"
	| "name"
	| "notes"
	| "price"
	| "suggestedStageIds"
	| "targetMargin";

export const serviceFieldOrder: readonly ServiceField[] = [
	"name",
	"category",
	"cost",
	"price",
	"targetMargin",
	"estimatedMinutes",
	"suggestedStageIds",
	"notes",
];

export const emptyServiceValues: ServiceFormValues = {
	category: "",
	cost: "",
	estimatedMinutes: "",
	kind: "own",
	name: "",
	notes: "",
	price: "",
	suggestedStageIds: [],
	targetMargin: "",
};

const minutesInput = /^\d{1,4}$/;

const emptyToNull = (value: string) => {
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
};

function parseMinutes(text: string): number | null {
	const trimmed = text.trim();
	if (!minutesInput.test(trimmed)) {
		return null;
	}
	const minutes = Number(trimmed);
	return minutes < serviceLimits.estimatedMinutes.min ||
		minutes > serviceLimits.estimatedMinutes.max
		? null
		: minutes;
}

export function targetMarginFields(
	text: string
): { targetMarginBasisPoints: number } | null {
	const targetMarginBasisPoints = parseMarginPercent(text);
	return targetMarginBasisPoints === null ? null : { targetMarginBasisPoints };
}

function moneyError(text: string, missing: string): string | null {
	if (text.trim() === "") {
		return missing;
	}
	return parseMoney(text) === null ? "Use valor com até 2 casas" : null;
}

export function serviceFormValues(service: ServiceView): ServiceFormValues {
	return {
		category: service.category ?? "",
		cost: formatMoneyInput(BigInt(service.costCents)),
		estimatedMinutes:
			service.estimatedMinutes === null ? "" : String(service.estimatedMinutes),
		kind: service.outsourced ? "outsourced" : "own",
		name: service.name,
		notes: service.notes ?? "",
		price: formatMoneyInput(BigInt(service.priceCents)),
		suggestedStageIds: [...service.suggestedStageIds],
		targetMargin:
			service.targetMarginBasisPoints === null
				? ""
				: formatMarginInput(service.targetMarginBasisPoints),
	};
}

export function serviceFormErrors(
	values: ServiceFormValues
): Partial<Record<ServiceField, string>> {
	const name = values.name.trim();
	const cost = moneyError(values.cost, "Informe o custo");
	const price = moneyError(values.price, "Informe o preço praticado");
	const targetMargin = targetMarginError(values.targetMargin);
	const minutes =
		values.estimatedMinutes.trim() !== "" &&
		parseMinutes(values.estimatedMinutes) === null;
	return {
		...(name === "" ? { name: "Informe o nome do serviço" } : {}),
		...(name.length > serviceLimits.name.max
			? { name: `Use até ${serviceLimits.name.max} caracteres` }
			: {}),
		...(values.category.trim().length > serviceLimits.category
			? { category: `Use até ${serviceLimits.category} caracteres` }
			: {}),
		...(cost ? { cost } : {}),
		...(price ? { price } : {}),
		...(targetMargin ? { targetMargin } : {}),
		...(minutes
			? {
					estimatedMinutes: `Use minutos inteiros de ${serviceLimits.estimatedMinutes.min} a ${serviceLimits.estimatedMinutes.max}`,
				}
			: {}),
		...(values.suggestedStageIds.length > serviceLimits.suggestedStages
			? {
					suggestedStageIds: `Até ${serviceLimits.suggestedStages} etapas sugeridas.`,
				}
			: {}),
		...(values.notes.trim().length > serviceLimits.notes
			? { notes: `Use até ${serviceLimits.notes} caracteres` }
			: {}),
	};
}

export function serviceFields(values: ServiceFormValues): ServiceFields {
	return {
		category: emptyToNull(values.category),
		costCents: String(parseMoney(values.cost) ?? 0n),
		estimatedMinutes: parseMinutes(values.estimatedMinutes),
		name: values.name.trim(),
		notes: emptyToNull(values.notes),
		outsourced: values.kind === "outsourced",
		priceCents: String(parseMoney(values.price) ?? 0n),
		suggestedStageIds: [...values.suggestedStageIds],
		targetMarginBasisPoints: ownTargetOf(values.targetMargin),
	};
}

const serviceKeys = [
	"category",
	"costCents",
	"estimatedMinutes",
	"name",
	"notes",
	"outsourced",
	"priceCents",
	"targetMarginBasisPoints",
] as const;

function sameStages(a: readonly string[], b: readonly string[]): boolean {
	const chosen = new Set(a);
	return a.length === b.length && b.every((id) => chosen.has(id));
}

const formKeys = [
	"category",
	"cost",
	"estimatedMinutes",
	"kind",
	"name",
	"notes",
	"price",
	"targetMargin",
] as const satisfies readonly (keyof ServiceFormValues)[];

export function sameServiceValues(
	left: ServiceFormValues,
	right: ServiceFormValues
): boolean {
	return (
		formKeys.every((key) => left[key] === right[key]) &&
		sameStages(left.suggestedStageIds, right.suggestedStageIds)
	);
}

export function servicePatch(
	opened: ServiceView,
	fields: ServiceFields
): Partial<ServiceFields> | null {
	const patch: Partial<ServiceFields> = {
		...Object.fromEntries(
			serviceKeys
				.filter((key) => fields[key] !== opened[key])
				.map((key) => [key, fields[key]])
		),
		...(sameStages(fields.suggestedStageIds, opened.suggestedStageIds)
			? {}
			: { suggestedStageIds: fields.suggestedStageIds }),
	};
	return Object.keys(patch).length === 0 ? null : patch;
}

export function formPricing(
	values: ServiceFormValues,
	atelierTarget: number
): PricingPreview | null {
	const cost = parseMoney(values.cost);
	const own = ownTargetOf(values.targetMargin);
	if (cost === null || (values.targetMargin.trim() !== "" && own === null)) {
		return null;
	}
	const price = parseMoney(values.price);
	return pricingPreview(
		{
			costCents: cost.toString(),
			priceCents: price === null ? null : price.toString(),
			targetMarginBasisPoints: own,
		},
		atelierTarget
	);
}

export function formPricingHint(values: ServiceFormValues): string {
	return parseMoney(values.cost) === null
		? "Informe o custo para ver o preço sugerido."
		: "Corrija a meta própria, de 0 a 99,99%, para ver o preço sugerido.";
}

export function servicePriceFacts(service: {
	costCents: string;
	priceCents: string;
}): { belowCost: boolean; marginBasisPoints: number | null } {
	const costCents = BigInt(service.costCents);
	const priceCents = BigInt(service.priceCents);
	return {
		belowCost: priceCents < costCents,
		marginBasisPoints: marginOfPrice(costCents, priceCents),
	};
}

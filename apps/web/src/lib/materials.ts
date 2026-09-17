import { materialLimits } from "@costura-pro/domain/material";
import {
	formatMoney,
	formatMoneyInput,
	parseMoney,
} from "@costura-pro/domain/money";
import {
	displayPrecision,
	formatQuantity,
	formatQuantityInput,
	parseQuantity,
} from "@costura-pro/domain/quantity";
import {
	type BaseUnitCode,
	baseUnitByCode,
	baseUnits,
} from "@costura-pro/domain/unit";

export type VariantPhotoView = { photoHash: string; thumbnailHash: string };

export type VariantPackagingView = { label: string; quantityMicros: string };

export type MaterialView = {
	archivedAt: string | null;
	category: string | null;
	createdAt: string;
	id: string;
	name: string;
	notes: string | null;
	version: number;
};

export type VariantView = {
	archivedAt: string | null;
	baseUnit: BaseUnitCode;
	code: string | null;
	createdAt: string;
	displayPrecision: number;
	id: string;
	materialId: string;
	minQuantityMicros: string | null;
	name: string;
	packaging: VariantPackagingView | null;
	photo: VariantPhotoView | null;
	referenceCostCents: string | null;
	targetQuantityMicros: string | null;
	version: number;
};

export type MaterialFormValues = {
	category: string;
	name: string;
	notes: string;
};

export type MaterialFields = {
	category: string | null;
	name: string;
	notes: string | null;
};

export type VariantFormValues = {
	baseUnit: BaseUnitCode;
	code: string;
	displayPrecision: string;
	minQuantity: string;
	name: string;
	packagingLabel: string;
	packagingQuantity: string;
	referenceCost: string;
	targetQuantity: string;
};

export type VariantFields = {
	baseUnit: BaseUnitCode;
	code: string | null;
	displayPrecision: number;
	minQuantityMicros: string | null;
	name: string;
	packaging: VariantPackagingView | null;
	photo: VariantPhotoView | null;
	referenceCostCents: string | null;
	targetQuantityMicros: string | null;
};

export type MaterialField = "category" | "name" | "notes";

export type VariantField =
	| "code"
	| "minQuantity"
	| "name"
	| "packagingLabel"
	| "packagingQuantity"
	| "referenceCost"
	| "targetQuantity";

export const unitOptions = baseUnits.map((unit) => ({
	label: `${unit.label} (${unit.abbreviation})`,
	value: unit.code,
}));

export const precisionOptions = Array.from(
	{ length: displayPrecision.max - displayPrecision.min + 1 },
	(_, index) => {
		const value = displayPrecision.min + index;
		return {
			label: value === 1 ? "1 casa decimal" : `${value} casas decimais`,
			value: String(value),
		};
	}
);

export function unitAbbreviation(code: BaseUnitCode): string {
	return baseUnitByCode(code)?.abbreviation ?? code;
}

const emptyToNull = (value: string) => {
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
};

export function materialFormValues(material: MaterialView): MaterialFormValues {
	return {
		category: material.category ?? "",
		name: material.name,
		notes: material.notes ?? "",
	};
}

export function materialFormErrors(
	values: MaterialFormValues
): Partial<Record<MaterialField, string>> {
	const name = values.name.trim();
	return {
		...(name === "" ? { name: "Informe o nome do material" } : {}),
		...(name.length > materialLimits.name.max
			? { name: `Use até ${materialLimits.name.max} caracteres` }
			: {}),
		...(values.category.trim().length > materialLimits.category
			? { category: `Use até ${materialLimits.category} caracteres` }
			: {}),
		...(values.notes.trim().length > materialLimits.notes
			? { notes: `Use até ${materialLimits.notes} caracteres` }
			: {}),
	};
}

export function materialFields(values: MaterialFormValues): MaterialFields {
	return {
		category: emptyToNull(values.category),
		name: values.name.trim(),
		notes: emptyToNull(values.notes),
	};
}

export function changedMaterial(
	opened: MaterialView,
	fields: MaterialFields
): Partial<MaterialFields> | null {
	const patch: Partial<MaterialFields> = Object.fromEntries(
		(["category", "name", "notes"] as const)
			.filter((key) => fields[key] !== opened[key])
			.map((key) => [key, fields[key]])
	);
	return Object.keys(patch).length === 0 ? null : patch;
}

export function variantFormValues(variant: VariantView): VariantFormValues {
	return {
		baseUnit: variant.baseUnit,
		code: variant.code ?? "",
		displayPrecision: String(variant.displayPrecision),
		minQuantity:
			variant.minQuantityMicros === null
				? ""
				: formatQuantityInput(
						BigInt(variant.minQuantityMicros),
						variant.displayPrecision
					),
		name: variant.name,
		packagingLabel: variant.packaging?.label ?? "",
		packagingQuantity:
			variant.packaging === null
				? ""
				: formatQuantityInput(
						BigInt(variant.packaging.quantityMicros),
						variant.displayPrecision
					),
		referenceCost:
			variant.referenceCostCents === null
				? ""
				: formatMoneyInput(BigInt(variant.referenceCostCents)),
		targetQuantity:
			variant.targetQuantityMicros === null
				? ""
				: formatQuantityInput(
						BigInt(variant.targetQuantityMicros),
						variant.displayPrecision
					),
	};
}

export function emptyVariantValues(
	baseUnit: BaseUnitCode,
	precision: number
): VariantFormValues {
	return {
		baseUnit,
		code: "",
		displayPrecision: String(precision),
		minQuantity: "",
		name: "",
		packagingLabel: "",
		packagingQuantity: "",
		referenceCost: "",
		targetQuantity: "",
	};
}

function quantityError(text: string): string | null {
	const trimmed = text.trim();
	if (trimmed === "") {
		return null;
	}
	if (parseQuantity(trimmed, displayPrecision.max) !== null) {
		return null;
	}
	return parseQuantity(trimmed, 0) === null && trimmed.includes(",")
		? `Use no máximo ${displayPrecision.max} casas decimais`
		: "Use só número, com vírgula";
}

export function variantFormErrors(
	values: VariantFormValues
): Partial<Record<VariantField, string>> {
	const name = values.name.trim();
	const min = quantityError(values.minQuantity);
	const target = quantityError(values.targetQuantity);
	const packagingQuantity = quantityError(values.packagingQuantity);
	const cost =
		values.referenceCost.trim() !== "" &&
		parseMoney(values.referenceCost) === null
			? "Use valor com até 2 casas"
			: null;
	const label = values.packagingLabel.trim();
	const quantity = values.packagingQuantity.trim();
	return {
		...(name === "" ? { name: "Informe o nome da variante" } : {}),
		...(name.length > materialLimits.variantName.max
			? { name: `Use até ${materialLimits.variantName.max} caracteres` }
			: {}),
		...(values.code.trim().length > materialLimits.code
			? { code: `Use até ${materialLimits.code} caracteres` }
			: {}),
		...(min ? { minQuantity: min } : {}),
		...(target ? { targetQuantity: target } : {}),
		...(cost ? { referenceCost: cost } : {}),
		...(packagingQuantity ? { packagingQuantity } : {}),
		...(label !== "" && quantity === ""
			? { packagingQuantity: "Informe quanto a embalagem tem" }
			: {}),
		...(label === "" && quantity !== ""
			? { packagingLabel: "Dê um nome à embalagem" }
			: {}),
	};
}

export function variantFields(
	values: VariantFormValues,
	photo: VariantPhotoView | null
): VariantFields {
	const quantity = (text: string) => {
		const micros =
			text.trim() === "" ? null : parseQuantity(text, displayPrecision.max);
		return micros === null ? null : micros.toString();
	};
	const label = values.packagingLabel.trim();
	const packagingMicros = quantity(values.packagingQuantity);
	const cost =
		values.referenceCost.trim() === ""
			? null
			: parseMoney(values.referenceCost);
	return {
		baseUnit: values.baseUnit,
		code: emptyToNull(values.code),
		displayPrecision: Number(values.displayPrecision),
		minQuantityMicros: quantity(values.minQuantity),
		name: values.name.trim(),
		packaging:
			label === "" || packagingMicros === null
				? null
				: { label, quantityMicros: packagingMicros },
		photo,
		referenceCostCents: cost === null ? null : cost.toString(),
		targetQuantityMicros: quantity(values.targetQuantity),
	};
}

const samePhoto = (
	left: VariantPhotoView | null,
	right: VariantPhotoView | null
) =>
	left === null || right === null
		? left === right
		: left.photoHash === right.photoHash &&
			left.thumbnailHash === right.thumbnailHash;

const samePackaging = (
	left: VariantPackagingView | null,
	right: VariantPackagingView | null
) =>
	left === null || right === null
		? left === right
		: left.label === right.label &&
			left.quantityMicros === right.quantityMicros;

export function changedVariant(
	opened: VariantView,
	fields: VariantFields
): Partial<VariantFields> | null {
	const scalars: Partial<VariantFields> = Object.fromEntries(
		(
			[
				"code",
				"displayPrecision",
				"minQuantityMicros",
				"name",
				"referenceCostCents",
				"targetQuantityMicros",
			] as const
		)
			.filter((key) => fields[key] !== opened[key])
			.map((key) => [key, fields[key]])
	);
	const patch: Partial<VariantFields> = {
		...scalars,
		...(samePackaging(fields.packaging, opened.packaging)
			? {}
			: { packaging: fields.packaging }),
		...(samePhoto(fields.photo, opened.photo) ? {} : { photo: fields.photo }),
	};
	return Object.keys(patch).length === 0 ? null : patch;
}

export function quantityWithUnit(
	micros: string | null,
	variant: Pick<VariantView, "baseUnit" | "displayPrecision">
): string | null {
	return micros === null
		? null
		: `${formatQuantity(BigInt(micros), variant.displayPrecision)} ${unitAbbreviation(variant.baseUnit)}`;
}

export function variantSummary(variant: VariantView): string {
	const parts = [
		quantityWithUnit(variant.minQuantityMicros, variant)
			? `mínimo ${quantityWithUnit(variant.minQuantityMicros, variant)}`
			: null,
		quantityWithUnit(variant.targetQuantityMicros, variant)
			? `alvo ${quantityWithUnit(variant.targetQuantityMicros, variant)}`
			: null,
		variant.referenceCostCents === null
			? null
			: `R$ ${formatMoney(BigInt(variant.referenceCostCents))} por ${unitAbbreviation(variant.baseUnit)}`,
		variant.packaging === null
			? null
			: `${variant.packaging.label} de ${quantityWithUnit(variant.packaging.quantityMicros, variant)}`,
	].filter((part): part is string => part !== null);
	return parts.length === 0
		? `Medido em ${unitAbbreviation(variant.baseUnit)}`
		: parts.join(" · ");
}

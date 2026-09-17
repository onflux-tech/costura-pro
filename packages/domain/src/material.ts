import { normalizeText } from "./client";

export const materialLimits = {
	category: 40,
	code: 40,
	name: { max: 120, min: 1 },
	notes: 2000,
	packagingLabel: { max: 40, min: 1 },
	variantName: { max: 80, min: 1 },
} as const;

export const materialCategorySuggestions = [
	"Tecido",
	"Linha",
	"Zíper",
	"Botão",
	"Aviamento",
	"Franja",
	"Bainha",
	"Forro",
	"Elástico",
	"Etiqueta",
] as const;

function keyOf(parts: readonly (string | null)[]): string {
	return normalizeText(
		parts.filter((part): part is string => Boolean(part)).join(" ")
	);
}

export function materialSearchKey(parts: {
	category: string | null;
	name: string;
}): string {
	return keyOf([parts.name, parts.category]);
}

export function variantSearchKey(parts: {
	code: string | null;
	name: string;
}): string {
	return keyOf([parts.name, parts.code]);
}

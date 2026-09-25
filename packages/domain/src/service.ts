import { normalizeText } from "./search";

export const serviceLimits = {
	category: 40,
	estimatedMinutes: { max: 9999, min: 1 },
	name: { max: 120, min: 1 },
	notes: 2000,
	suggestedStages: 50,
} as const;

export const serviceCategorySuggestions = [
	"Ajuste",
	"Barra",
	"Conserto",
	"Confecção",
	"Bordado",
	"Aplicação",
	"Customização",
] as const;

export function serviceSearchKey(parts: {
	category: string | null;
	name: string;
}): string {
	return normalizeText(
		[parts.name, parts.category]
			.filter((part): part is string => Boolean(part))
			.join(" ")
	);
}

export function formatMinutes(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (hours === 0) {
		return `${rest} min`;
	}
	return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

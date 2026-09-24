import { normalizeText } from "./search";

export const measurementLimits = {
	fieldLabel: { max: 60, min: 1 },
	fields: { max: 60, min: 1 },
	notes: 2000,
	templateName: { max: 60, min: 1 },
	valueMm: { max: 9999, min: 1 },
} as const;

export type InitialMeasurementTemplate = {
	fields: readonly string[];
	name: string;
};

export type TemplateField = { active: boolean; id: string; label: string };

export type SentTemplateField = { id: string; label: string };

export const initialMeasurementTemplates: readonly InitialMeasurementTemplate[] =
	[
		{
			fields: [
				"Busto",
				"Abaixo do busto",
				"Cintura",
				"Quadril",
				"Altura do quadril",
				"Ombro",
				"Costas",
				"Frente",
				"Altura do busto",
				"Separação do busto",
				"Altura da frente",
				"Altura das costas",
				"Cava",
				"Braço",
				"Comprimento da manga",
				"Comprimento do vestido",
			],
			name: "Vestido",
		},
		{
			fields: [
				"Cintura",
				"Quadril",
				"Altura do quadril",
				"Comprimento da saia",
			],
			name: "Saia",
		},
		{
			fields: [
				"Cintura",
				"Quadril",
				"Altura do quadril",
				"Coxa",
				"Joelho",
				"Boca",
				"Gancho",
				"Entrepernas",
				"Comprimento da calça",
			],
			name: "Calça",
		},
		{
			fields: [
				"Pescoço",
				"Ombro",
				"Busto ou tórax",
				"Cintura",
				"Quadril",
				"Costas",
				"Frente",
				"Cava",
				"Braço",
				"Punho",
				"Comprimento da manga",
				"Comprimento da blusa",
			],
			name: "Blusa e camisa",
		},
		{
			fields: [
				"Pescoço",
				"Ombro",
				"Busto ou tórax",
				"Cintura",
				"Quadril",
				"Costas",
				"Frente",
				"Cava",
				"Braço",
				"Comprimento da manga",
				"Comprimento do paletó",
			],
			name: "Blazer e paletó",
		},
	];

const centimeters = /^(?<whole>\d{1,3})(?:[.,](?<tenth>\d))?$/;

export function parseCentimeters(input: string): number | null {
	const groups = centimeters.exec(input.trim())?.groups;
	if (!groups) {
		return null;
	}
	const valueMm = Number(groups.whole) * 10 + Number(groups.tenth ?? "0");
	return valueMm < measurementLimits.valueMm.min ? null : valueMm;
}

export function formatCentimeters(valueMm: number): string {
	return `${Math.trunc(valueMm / 10)},${valueMm % 10}`;
}

export function duplicateLabelIndex(labels: readonly string[]): number | null {
	const seen = new Set<string>();
	for (const [index, label] of labels.entries()) {
		const key = normalizeText(label);
		if (seen.has(key)) {
			return index;
		}
		seen.add(key);
	}
	return null;
}

export function mergeTemplateFields(
	current: readonly TemplateField[],
	sent: readonly SentTemplateField[]
): TemplateField[] {
	const sentIds = new Set(sent.map((field) => field.id));
	return [
		...sent.map(({ id, label }) => ({ active: true, id, label })),
		...current
			.filter((field) => !sentIds.has(field.id))
			.map((field) => ({ ...field, active: false })),
	];
}

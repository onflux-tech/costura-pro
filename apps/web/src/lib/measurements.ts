import { normalizeText } from "@costura-pro/domain/client";
import {
	formatCentimeters,
	measurementLimits,
	parseCentimeters,
} from "@costura-pro/domain/measurement";

export type MeasurementFieldView = {
	fieldId: string;
	label: string;
	valueMm: number | null;
};

export type MeasurementView = {
	archivedAt: string | null;
	createdAt: string;
	fields: readonly MeasurementFieldView[];
	id: string;
	notes: string | null;
	profileId: string;
	takenOn: string;
	templateId: string;
	templateName: string;
	templateVersion: number;
	version: number;
};

export type TemplateFieldView = { active: boolean; id: string; label: string };

export type TemplateView = {
	archivedAt: string | null;
	fields: readonly TemplateFieldView[];
	id: string;
	name: string;
	version: number;
};

export type ProfileView = { archivedAt: string | null; id: string };

export type MeasurementPair = {
	current: MeasurementView;
	previous: MeasurementView | null;
};

export type DraftField = {
	fieldId: string;
	label: string;
	previousMm: number | null;
	text: string;
};

export type MeasurementValues = {
	fields: MeasurementFieldView[];
	notes: string | null;
	takenOn: string;
};

export type MeasurementPatchView = Partial<MeasurementValues>;

export type TemplateDraftField = { id: string; label: string };

export type TemplateDraftErrors = {
	fields: Readonly<Record<string, string>>;
	form: string | null;
	name: string | null;
};

export const invalidMeasureMessage =
	"Use centímetros com até uma casa, de 0,1 a 999,9";

function descending(left: string, right: string): number {
	if (left === right) {
		return 0;
	}
	return left < right ? 1 : -1;
}

export function compareMeasurements(
	a: MeasurementView,
	b: MeasurementView
): number {
	return (
		descending(a.takenOn, b.takenOn) ||
		descending(a.createdAt, b.createdAt) ||
		descending(a.id, b.id)
	);
}

function ofProfile(
	measurements: readonly MeasurementView[],
	profileId: string
) {
	return measurements
		.filter((item) => item.profileId === profileId)
		.sort(compareMeasurements);
}

export function currentByTemplate(
	measurements: readonly MeasurementView[],
	profileId: string
): MeasurementPair[] {
	const pairs = new Map<string, MeasurementPair>();
	for (const item of ofProfile(measurements, profileId)) {
		if (item.archivedAt !== null) {
			continue;
		}
		const pair = pairs.get(item.templateId);
		if (!pair) {
			pairs.set(item.templateId, { current: item, previous: null });
		} else if (pair.previous === null) {
			pairs.set(item.templateId, { ...pair, previous: item });
		}
	}
	return [...pairs.values()];
}

export function historyOf(
	measurements: readonly MeasurementView[],
	profileId: string,
	templateId: string
): MeasurementPair[] {
	const ordered = ofProfile(measurements, profileId).filter(
		(item) => item.templateId === templateId
	);
	return ordered.map((item, index) => ({
		current: item,
		previous:
			ordered.slice(index + 1).find((older) => older.archivedAt === null) ??
			null,
	}));
}

export function previousMeasurement(
	measurements: readonly MeasurementView[],
	measurement: MeasurementView
): MeasurementView | null {
	return (
		historyOf(measurements, measurement.profileId, measurement.templateId).find(
			(pair) => pair.current.id === measurement.id
		)?.previous ?? null
	);
}

export function measuredTemplates(
	measurements: readonly MeasurementView[],
	profileId: string
): { id: string; name: string }[] {
	const names = new Map<string, string>();
	for (const item of ofProfile(measurements, profileId)) {
		if (!names.has(item.templateId)) {
			names.set(item.templateId, item.templateName);
		}
	}
	return [...names].map(([id, name]) => ({ id, name }));
}

function measuredValueOf(measurement: MeasurementView | null, fieldId: string) {
	return (
		measurement?.fields.find((field) => field.fieldId === fieldId)?.valueMm ??
		null
	);
}

export function fieldDelta(
	current: MeasurementView,
	previous: MeasurementView | null,
	fieldId: string
): number | null {
	const now = measuredValueOf(current, fieldId);
	const before = measuredValueOf(previous, fieldId);
	if (now === null || before === null || now === before) {
		return null;
	}
	return now - before;
}

export function describeDelta(deltaMm: number): {
	label: string;
	text: string;
} {
	const amount = formatCentimeters(Math.abs(deltaMm));
	return deltaMm > 0
		? { label: `aumentou ${amount} cm`, text: `↑ ${amount}` }
		: { label: `diminuiu ${amount} cm`, text: `↓ ${amount}` };
}

export function selectedProfileId(
	profiles: readonly ProfileView[],
	requested: string | undefined
): string | null {
	if (requested && profiles.some((profile) => profile.id === requested)) {
		return requested;
	}
	return (
		(profiles.find((profile) => profile.archivedAt === null) ?? profiles[0])
			?.id ?? null
	);
}

export function defaultTemplateId(
	templates: readonly TemplateView[],
	measurements: readonly MeasurementView[],
	profileId: string,
	requested: string | undefined
): string | null {
	const active = templates.filter((item) => item.archivedAt === null);
	const isActive = (id: string) => active.some((item) => item.id === id);
	if (requested && isActive(requested)) {
		return requested;
	}
	const latest = currentByTemplate(measurements, profileId)[0]?.current
		.templateId;
	if (latest && isActive(latest)) {
		return latest;
	}
	return active[0]?.id ?? null;
}

function textOf(valueMm: number | null) {
	return valueMm === null ? "" : formatCentimeters(valueMm);
}

export function draftFields(
	template: TemplateView,
	previous: MeasurementView | null
): DraftField[] {
	return template.fields
		.filter((field) => field.active)
		.map((field) => {
			const previousMm = measuredValueOf(previous, field.id);
			return {
				fieldId: field.id,
				label: field.label,
				previousMm,
				text: textOf(previousMm),
			};
		});
}

export function correctionFields(
	measurement: MeasurementView,
	previous: MeasurementView | null
): DraftField[] {
	return measurement.fields.map((field) => ({
		fieldId: field.fieldId,
		label: field.label,
		previousMm: measuredValueOf(previous, field.fieldId),
		text: textOf(field.valueMm),
	}));
}

export function parseDraft(draft: readonly DraftField[]): {
	errors: Readonly<Record<string, string>>;
	fields: MeasurementFieldView[];
} {
	const errors: Record<string, string> = {};
	const fields = draft.map((field) => {
		const text = field.text.trim();
		const valueMm = text === "" ? null : parseCentimeters(text);
		if (text !== "" && valueMm === null) {
			errors[field.fieldId] = invalidMeasureMessage;
		}
		return { fieldId: field.fieldId, label: field.label, valueMm };
	});
	return { errors, fields };
}

export function changedMeasurement(
	measurement: MeasurementView,
	values: MeasurementValues
): MeasurementPatchView {
	const valuesChanged =
		values.fields.length !== measurement.fields.length ||
		values.fields.some(
			(field, index) => field.valueMm !== measurement.fields[index]?.valueMm
		);
	return {
		...(valuesChanged ? { fields: values.fields } : {}),
		...(values.notes === measurement.notes ? {} : { notes: values.notes }),
		...(values.takenOn === measurement.takenOn
			? {}
			: { takenOn: values.takenOn }),
	};
}

export function moveField<T>(
	fields: readonly T[],
	index: number,
	direction: -1 | 1
): T[] {
	const target = index + direction;
	const moved = fields[index];
	const other = fields[target];
	if (moved === undefined || other === undefined) {
		return [...fields];
	}
	return fields.map((field, position) => {
		if (position === index) {
			return other;
		}
		return position === target ? moved : field;
	});
}

export function moveFocusTarget(
	target: number,
	length: number,
	direction: -1 | 1
): "down" | "up" {
	if (direction === -1) {
		return target === 0 ? "down" : "up";
	}
	return target === length - 1 ? "up" : "down";
}

export function profileSummaries(
	profiles: readonly ProfileView[],
	measurements: readonly MeasurementView[] | undefined
): ReadonlyMap<string, string> | null {
	if (!measurements) {
		return null;
	}
	const summaries = new Map<string, string>();
	for (const profile of profiles) {
		const latest = currentByTemplate(measurements, profile.id)[0]?.current;
		if (latest) {
			summaries.set(
				profile.id,
				`${latest.templateName} · ${formatDay(latest.takenOn)}`
			);
		}
	}
	return summaries;
}

export function blockingError(
	queries: readonly { data: unknown; error: unknown }[]
): unknown {
	return (
		queries.find((query) => query.data === undefined && query.error)?.error ??
		null
	);
}

export function templateDraftErrors(
	name: string,
	fields: readonly TemplateDraftField[]
): TemplateDraftErrors {
	const errors: Record<string, string> = {};
	const seen = new Set<string>();
	for (const field of fields) {
		const key = normalizeText(field.label);
		if (key === "") {
			errors[field.id] = "Dê um nome ao campo";
		} else if (seen.has(key)) {
			errors[field.id] = "Já existe um campo ativo com este nome";
		}
		seen.add(key);
	}
	return {
		fields: errors,
		form: templateSizeError(fields.length),
		name: name.trim() === "" ? "Dê um nome ao modelo" : null,
	};
}

function templateSizeError(activeCount: number): string | null {
	if (activeCount < measurementLimits.fields.min) {
		return "Mantenha pelo menos um campo ativo";
	}
	if (activeCount > measurementLimits.fields.max) {
		return `Mantenha no máximo ${measurementLimits.fields.max} campos ativos`;
	}
	return null;
}

export function hasTemplateErrors(errors: TemplateDraftErrors): boolean {
	return (
		errors.form !== null ||
		errors.name !== null ||
		Object.keys(errors.fields).length > 0
	);
}

export function changedTemplate(
	template: TemplateView,
	values: { fields: TemplateDraftField[]; name: string }
): { fields?: TemplateDraftField[]; name?: string } {
	const active = template.fields.filter((field) => field.active);
	const sameFields =
		active.length === values.fields.length &&
		active.every(
			(field, index) =>
				field.id === values.fields[index]?.id &&
				field.label === values.fields[index]?.label
		);
	return {
		...(sameFields ? {} : { fields: values.fields }),
		...(values.name === template.name ? {} : { name: values.name }),
	};
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
	day: "2-digit",
	month: "2-digit",
	timeZone: "America/Recife",
	year: "numeric",
});

export function localDay(date: Date): string {
	return dayFormatter.format(date);
}

export function formatDay(day: string): string {
	const [year, month, date] = day.split("-");
	return `${date}/${month}/${year}`;
}

import {
	type ReceivedItemCondition,
	receivedItemLimits,
} from "@costura-pro/domain/received-item";

import { formatDay } from "./measurements";
import type { PhotoView } from "./photos";

export type ReceivedItemView = {
	accessories: string | null;
	archivedAt: string | null;
	clientId: string;
	condition: ReceivedItemCondition;
	createdAt: string;
	description: string;
	expectedReturnOn: string | null;
	id: string;
	notes: string | null;
	photos: readonly PhotoView[];
	quantity: number;
	receivedOn: string;
	returnedOn: string | null;
	version: number;
};

export type ReceivedItemFormValues = {
	accessories: string;
	condition: ReceivedItemCondition | null;
	description: string;
	expectedReturnOn: string;
	notes: string;
	photos: readonly PhotoView[];
	quantity: string;
	receivedOn: string;
};

export type ReceivedItemFields = {
	accessories: string | null;
	condition: ReceivedItemCondition;
	description: string;
	expectedReturnOn: string | null;
	notes: string | null;
	photos: PhotoView[];
	quantity: number;
	receivedOn: string;
};

export type ReceivedItemField =
	| "condition"
	| "description"
	| "expectedReturnOn"
	| "quantity"
	| "receivedOn"
	| "returnedOn";

export type ReceivedItemFieldErrors = Partial<
	Record<ReceivedItemField, string>
>;

export const receivedItemPhotoLimit = {
	limit: receivedItemLimits.photos,
	owner: "peça",
};

export const conditionLabels: Record<ReceivedItemCondition, string> = {
	damaged: "Com avaria",
	good: "Bom",
	worn: "Desgastada",
};

const quantityPattern = /^\d{1,3}$/;

const fieldOrder: readonly ReceivedItemField[] = [
	"description",
	"condition",
	"quantity",
	"receivedOn",
	"expectedReturnOn",
	"returnedOn",
];

const scalarFields = [
	"accessories",
	"condition",
	"description",
	"expectedReturnOn",
	"notes",
	"quantity",
	"receivedOn",
] as const;

export function custodyGroups(items: readonly ReceivedItemView[]) {
	const inCustody = items.filter(
		(item) => item.archivedAt === null && item.returnedOn === null
	);
	return {
		inCustody,
		others: items.filter((item) => !inCustody.includes(item)),
	};
}

export function parseQuantity(text: string): number | null {
	const trimmed = text.trim();
	if (!quantityPattern.test(trimmed)) {
		return null;
	}
	const value = Number(trimmed);
	return value >= receivedItemLimits.quantity.min &&
		value <= receivedItemLimits.quantity.max
		? value
		: null;
}

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;

const invalidDateMessage = "Data inválida";

function returnError(receivedOn: string, returnedOn: string, today: string) {
	if (returnedOn === "") {
		return "Informe a data da devolução";
	}
	if (!dayPattern.test(returnedOn)) {
		return invalidDateMessage;
	}
	if (returnedOn > today) {
		return "Devolução no futuro";
	}
	return returnedOn < receivedOn ? "Devolução antes da recepção" : null;
}

function expectedReturnError(receivedOn: string, expectedReturnOn: string) {
	if (expectedReturnOn === "") {
		return null;
	}
	if (!dayPattern.test(expectedReturnOn)) {
		return invalidDateMessage;
	}
	return expectedReturnOn < receivedOn
		? "Devolução prevista antes da recepção"
		: null;
}

export function receivedItemDateErrors(
	values: { expectedReturnOn: string; receivedOn: string; returnedOn?: string },
	today: string
): ReceivedItemFieldErrors {
	const validReception =
		dayPattern.test(values.receivedOn) && values.receivedOn <= today;
	const expected = expectedReturnError(
		values.receivedOn,
		values.expectedReturnOn
	);
	const returned =
		values.returnedOn === undefined
			? null
			: returnError(values.receivedOn, values.returnedOn, today);
	return {
		...(validReception ? {} : { receivedOn: "Data de recepção inválida" }),
		...(expected ? { expectedReturnOn: expected } : {}),
		...(returned ? { returnedOn: returned } : {}),
	};
}

function receptionAfterReturn(
	receivedOn: string,
	returnedOn: string | null
): boolean {
	return (
		returnedOn !== null &&
		dayPattern.test(receivedOn) &&
		receivedOn > returnedOn
	);
}

export function receivedItemFormErrors(
	values: ReceivedItemFormValues,
	today: string,
	returnedOn: string | null = null
): ReceivedItemFieldErrors {
	return {
		...(values.description.trim() === ""
			? { description: "Descreva a peça" }
			: {}),
		...(values.condition === null
			? { condition: "Escolha o estado da peça" }
			: {}),
		...(parseQuantity(values.quantity) === null
			? { quantity: "Informe de 1 a 999 unidades" }
			: {}),
		...receivedItemDateErrors(values, today),
		...(receptionAfterReturn(values.receivedOn, returnedOn)
			? { receivedOn: "Recepção depois da devolução" }
			: {}),
	};
}

export function firstInvalidField(
	errors: ReceivedItemFieldErrors
): ReceivedItemField | null {
	return fieldOrder.find((field) => errors[field] !== undefined) ?? null;
}

function blankToNull(text: string): string | null {
	const trimmed = text.trim();
	return trimmed === "" ? null : trimmed;
}

export function receivedItemFields(
	values: ReceivedItemFormValues
): ReceivedItemFields | null {
	const quantity = parseQuantity(values.quantity);
	if (values.condition === null || quantity === null) {
		return null;
	}
	return {
		accessories: blankToNull(values.accessories),
		condition: values.condition,
		description: values.description.trim(),
		expectedReturnOn:
			values.expectedReturnOn === "" ? null : values.expectedReturnOn,
		notes: blankToNull(values.notes),
		photos: values.photos.map((photo) => ({ ...photo })),
		quantity,
		receivedOn: values.receivedOn,
	};
}

export function emptyFormValues(today: string): ReceivedItemFormValues {
	return {
		accessories: "",
		condition: null,
		description: "",
		expectedReturnOn: "",
		notes: "",
		photos: [],
		quantity: "1",
		receivedOn: today,
	};
}

export function formValuesOf(item: ReceivedItemView): ReceivedItemFormValues {
	return {
		accessories: item.accessories ?? "",
		condition: item.condition,
		description: item.description,
		expectedReturnOn: item.expectedReturnOn ?? "",
		notes: item.notes ?? "",
		photos: item.photos,
		quantity: String(item.quantity),
		receivedOn: item.receivedOn,
	};
}

export function changedReceivedItem(
	opened: ReceivedItemView,
	fields: ReceivedItemFields
): Partial<ReceivedItemFields> | null {
	const patch: Partial<ReceivedItemFields> = Object.fromEntries(
		scalarFields
			.filter((key) => fields[key] !== opened[key])
			.map((key) => [key, fields[key]])
	);
	const photosChanged =
		JSON.stringify(fields.photos) !== JSON.stringify(opened.photos);
	const full = photosChanged ? { ...patch, photos: fields.photos } : patch;
	return Object.keys(full).length === 0 ? null : full;
}

function shortDay(day: string): string {
	return formatDay(day).slice(0, 5);
}

export function custodyLine(item: ReceivedItemView): string {
	const received = `recebida ${shortDay(item.receivedOn)}`;
	if (item.returnedOn) {
		return `${received} · devolvida ${shortDay(item.returnedOn)}`;
	}
	return item.expectedReturnOn
		? `${received} · devolução prevista ${shortDay(item.expectedReturnOn)}`
		: received;
}

export function itemSummary(item: ReceivedItemView): string {
	return [
		conditionLabels[item.condition].toLowerCase(),
		`${item.quantity} un`,
		item.accessories,
	]
		.filter(Boolean)
		.join(" · ");
}

import { formatMoney, parseMoney } from "@costura-pro/domain/money";
import {
	displayPrecision,
	formatQuantity,
	parseQuantity,
	quantityScale,
} from "@costura-pro/domain/quantity";
import { type StockMovementKind, stockLimits } from "@costura-pro/domain/stock";
import type { BaseUnitCode } from "@costura-pro/domain/unit";

import { unitAbbreviation } from "./materials";

export type StockLocationView = {
	archivedAt: string | null;
	createdAt: string;
	id: string;
	name: string;
	notes: string | null;
	updatedAt: string;
	version: number;
};

export type StockLotView = {
	archivedAt: string | null;
	createdAt: string;
	id: string;
	label: string;
	notes: string | null;
	updatedAt: string;
	variantId: string;
	version: number;
};

export type BalanceItemView = {
	baseUnit: BaseUnitCode;
	code: string | null;
	displayPrecision: number;
	materialId: string;
	materialName: string;
	quantityMicros: string;
	referenceCostCents: string | null;
	reservedMicros: string;
	tracksLots: boolean;
	valueCents: string;
	variantId: string;
	variantName: string;
};

export type Direction = "in" | "out";

export type PlaceFormValues = {
	name: string;
	notes: string;
};

export type LotFormValues = {
	label: string;
	notes: string;
};

export type OpeningFormValues = {
	locationId: string;
	lotId: string | null;
	occurredOn: string;
	quantity: string;
	value: string;
};

export type AdjustmentFormValues = {
	direction: Direction;
	locationId: string;
	lotId: string | null;
	occurredOn: string;
	quantity: string;
	reason: string;
	value: string;
};

export type TransferFormValues = {
	fromLocationId: string;
	lotId: string | null;
	occurredOn: string;
	quantity: string;
	reason: string;
	toLocationId: string;
};

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

const kindLabels: Record<StockMovementKind, string> = {
	adjustment: "Ajuste",
	consumption: "Consumo",
	inventory: "Inventário",
	opening: "Saldo de abertura",
	purchase: "Compra",
	reversal: "Estorno",
	transferIn: "Transferência (entrada)",
	transferOut: "Transferência (saída)",
};

export function movementKindLabel(kind: StockMovementKind): string {
	return kindLabels[kind];
}

export function movementTitle(movement: {
	itemPosition: number | null;
	kind: StockMovementKind;
	serviceOrderCode: string | null;
}): string {
	const label = movementKindLabel(movement.kind);
	if (
		movement.kind !== "consumption" ||
		movement.serviceOrderCode === null ||
		movement.itemPosition === null
	) {
		return label;
	}
	return `${label} · ${movement.serviceOrderCode} · subitem ${movement.itemPosition + 1}`;
}

export function openingValueCents(
	referenceCostCents: string | null,
	micros: bigint
): bigint {
	if (referenceCostCents === null) {
		return 0n;
	}
	const total = BigInt(referenceCostCents) * micros;
	return (total * 2n + quantityScale) / (quantityScale * 2n);
}

export const emptyToNull = (value: string) => {
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
};

export function locationFormErrors(
	values: PlaceFormValues
): Partial<Record<"name" | "notes", string>> {
	const name = values.name.trim();
	return {
		...(name === "" ? { name: "Informe o nome do local" } : {}),
		...(name.length > stockLimits.locationName.max
			? { name: `Use até ${stockLimits.locationName.max} caracteres` }
			: {}),
		...(values.notes.trim().length > stockLimits.notes
			? { notes: `Use até ${stockLimits.notes} caracteres` }
			: {}),
	};
}

export function lotFormErrors(
	values: LotFormValues
): Partial<Record<"label" | "notes", string>> {
	const label = values.label.trim();
	return {
		...(label === "" ? { label: "Informe o nome do lote" } : {}),
		...(label.length > stockLimits.lotLabel.max
			? { label: `Use até ${stockLimits.lotLabel.max} caracteres` }
			: {}),
		...(values.notes.trim().length > stockLimits.notes
			? { notes: `Use até ${stockLimits.notes} caracteres` }
			: {}),
	};
}

function quantityMicros(text: string): bigint | null {
	const trimmed = text.trim();
	return trimmed === "" ? null : parseQuantity(trimmed, displayPrecision.max);
}

export function quantityError(text: string): string | null {
	const trimmed = text.trim();
	if (trimmed === "") {
		return "Informe uma quantidade maior que zero";
	}
	const micros = parseQuantity(trimmed, displayPrecision.max);
	if (micros === null) {
		return parseQuantity(trimmed, 0) === null && trimmed.includes(",")
			? `Use no máximo ${displayPrecision.max} casas decimais`
			: "Use só número, com vírgula";
	}
	return micros > 0n ? null : "Informe uma quantidade maior que zero";
}

export function dateError(value: string): string | null {
	return isoDate.test(value) ? null : "Data inválida";
}

export type OpeningField = "locationId" | "occurredOn" | "quantity" | "value";

export function openingFormErrors(
	values: OpeningFormValues
): Partial<Record<OpeningField, string>> {
	const quantity = quantityError(values.quantity);
	const occurredOn = dateError(values.occurredOn);
	const value =
		values.value.trim() === "" || parseMoney(values.value) === null
			? "Informe o valor do estoque que entra"
			: null;
	return {
		...(values.locationId === "" ? { locationId: "Escolha o local" } : {}),
		...(quantity ? { quantity } : {}),
		...(occurredOn ? { occurredOn } : {}),
		...(value ? { value } : {}),
	};
}

export type AdjustmentField = OpeningField | "reason";

export function adjustmentFormErrors(
	values: AdjustmentFormValues
): Partial<Record<AdjustmentField, string>> {
	const quantity = quantityError(values.quantity);
	const occurredOn = dateError(values.occurredOn);
	const value =
		values.direction === "in" &&
		(values.value.trim() === "" || parseMoney(values.value) === null)
			? "Informe o valor que entra"
			: null;
	return {
		...(values.locationId === "" ? { locationId: "Escolha o local" } : {}),
		...(quantity ? { quantity } : {}),
		...(occurredOn ? { occurredOn } : {}),
		...(values.reason.trim() === ""
			? { reason: "Diga o motivo do ajuste" }
			: {}),
		...(values.reason.trim().length > stockLimits.reason.max
			? { reason: `Use até ${stockLimits.reason.max} caracteres` }
			: {}),
		...(value ? { value } : {}),
	};
}

export function adjustmentFields(values: AdjustmentFormValues): {
	kind: "adjustment";
	locationId: string;
	lotId: string | null;
	occurredOn: string;
	quantityMicros: string;
	reason: string;
	valueCents?: string;
} {
	const micros = quantityMicros(values.quantity) ?? 0n;
	const cents = parseMoney(values.value);
	return {
		kind: "adjustment",
		locationId: values.locationId,
		lotId: values.lotId,
		occurredOn: values.occurredOn,
		quantityMicros: (values.direction === "in" ? micros : -micros).toString(),
		reason: values.reason.trim(),
		...(values.direction === "in" && cents !== null
			? { valueCents: cents.toString() }
			: {}),
	};
}

export function openingFields(values: OpeningFormValues): {
	kind: "opening";
	locationId: string;
	lotId: string | null;
	occurredOn: string;
	quantityMicros: string;
	reason: null;
	valueCents: string;
} {
	return {
		kind: "opening",
		locationId: values.locationId,
		lotId: values.lotId,
		occurredOn: values.occurredOn,
		quantityMicros: (quantityMicros(values.quantity) ?? 0n).toString(),
		reason: null,
		valueCents: (parseMoney(values.value) ?? 0n).toString(),
	};
}

export type TransferField =
	| "fromLocationId"
	| "occurredOn"
	| "quantity"
	| "toLocationId";

export function transferFormErrors(
	values: TransferFormValues
): Partial<Record<TransferField, string>> {
	const quantity = quantityError(values.quantity);
	const occurredOn = dateError(values.occurredOn);
	const sameLocation =
		values.toLocationId !== "" && values.toLocationId === values.fromLocationId;
	return {
		...(values.fromLocationId === ""
			? { fromLocationId: "Escolha o local de origem" }
			: {}),
		...(values.toLocationId === ""
			? { toLocationId: "Escolha o local de destino" }
			: {}),
		...(sameLocation
			? { toLocationId: "Escolha um local diferente da origem" }
			: {}),
		...(quantity ? { quantity } : {}),
		...(occurredOn ? { occurredOn } : {}),
	};
}

export function transferFields(values: TransferFormValues): {
	fromLocationId: string;
	lotId: string | null;
	occurredOn: string;
	quantityMicros: string;
	reason: string | null;
	toLocationId: string;
} {
	return {
		fromLocationId: values.fromLocationId,
		lotId: values.lotId,
		occurredOn: values.occurredOn,
		quantityMicros: (quantityMicros(values.quantity) ?? 0n).toString(),
		reason: emptyToNull(values.reason),
		toLocationId: values.toLocationId,
	};
}

export function balanceQuantity(
	item: Pick<
		BalanceItemView,
		"baseUnit" | "displayPrecision" | "quantityMicros"
	>
): string {
	return `${formatQuantity(BigInt(item.quantityMicros), item.displayPrecision)} ${unitAbbreviation(item.baseUnit)}`;
}

export function balanceValue(valueCents: string): string {
	return `R$ ${formatMoney(BigInt(valueCents))}`;
}

export function pointQuantity(
	micros: string,
	unit: BaseUnitCode,
	precision: number
): string {
	return `${formatQuantity(BigInt(micros), precision)} ${unitAbbreviation(unit)}`;
}

export function availabilityOf(item: {
	quantityMicros: string;
	reservedMicros: string;
}): { availableMicros: bigint; reservedMicros: bigint } {
	const reservedMicros = BigInt(item.reservedMicros);
	return {
		availableMicros: BigInt(item.quantityMicros) - reservedMicros,
		reservedMicros,
	};
}

export type ReservationNote = {
	available: string | null;
	reserved: string;
	short: boolean;
};

export function reservationNote(
	item: Pick<
		BalanceItemView,
		"baseUnit" | "displayPrecision" | "quantityMicros" | "reservedMicros"
	>,
	allLocations: boolean
): ReservationNote | null {
	const { availableMicros, reservedMicros } = availabilityOf(item);
	if (reservedMicros === 0n) {
		return null;
	}
	const reserved = `reservado ${pointQuantity(reservedMicros.toString(), item.baseUnit, item.displayPrecision)}`;
	if (!allLocations) {
		return {
			available: null,
			reserved: `${reserved} em todos os locais`,
			short: false,
		};
	}
	return {
		available: `disponível ${pointQuantity(availableMicros.toString(), item.baseUnit, item.displayPrecision)}`,
		reserved,
		short: availableMicros < 0n,
	};
}

export function movementQuantity(
	micros: string,
	unit: BaseUnitCode,
	precision: number
): string {
	const value = BigInt(micros);
	const sign = value < 0n ? "" : "+";
	return `${sign}${pointQuantity(micros, unit, precision)}`;
}

export type MovementAction =
	| { id: string; kind: "purchase" }
	| { id: string; kind: "serviceOrder" }
	| { kind: "none" }
	| { kind: "reverse" };

export function movementAction(movement: {
	kind: StockMovementKind;
	purchaseId: string | null;
	reversedByMovementId: string | null;
	serviceOrderId: string | null;
}): MovementAction {
	if (movement.purchaseId !== null) {
		return { id: movement.purchaseId, kind: "purchase" };
	}
	if (movement.serviceOrderId !== null) {
		return { id: movement.serviceOrderId, kind: "serviceOrder" };
	}
	return movement.reversedByMovementId !== null || movement.kind === "reversal"
		? { kind: "none" }
		: { kind: "reverse" };
}

import { multiplyHalfUp } from "./quantity";
import { normalizeText } from "./search";

export const productLimits = {
	caption: 40,
	category: 40,
	code: 40,
	itemNote: 60,
	lossBasisPoints: { max: 9999, min: 1 },
	name: { max: 120, min: 1 },
	notes: 2000,
	photos: 12,
	serviceCount: { max: 99, min: 1 },
	sheetChanges: 60,
	sheetItems: 60,
	variantName: { max: 80, min: 1 },
} as const;

export const productCategorySuggestions = [
	"Roupa",
	"Kit",
	"Acessório",
	"Bolsa",
	"Cama, mesa e banho",
	"Decoração",
] as const;

function keyOf(parts: readonly (string | null)[]): string {
	return normalizeText(
		parts.filter((part): part is string => Boolean(part)).join(" ")
	);
}

export function productSearchKey(parts: {
	category: string | null;
	name: string;
}): string {
	return keyOf([parts.name, parts.category]);
}

export function productVariantSearchKey(parts: {
	code: string | null;
	name: string;
}): string {
	return keyOf([parts.name, parts.code]);
}

export type SheetLoss =
	| { kind: "fixed"; quantityMicros: bigint }
	| { basisPoints: number; kind: "percent" };

export type SheetMaterialItem = {
	id: string;
	kind: "material";
	loss: SheetLoss | null;
	materialVariantId: string;
	note: string | null;
	quantityMicros: bigint;
};

export type SheetServiceItem = {
	count: number;
	id: string;
	kind: "service";
	note: string | null;
	serviceId: string;
};

export type SheetItem = SheetMaterialItem | SheetServiceItem;

export type SheetChange<Item extends { id: string }> =
	| { item: Item; kind: "add" }
	| { item: Item; kind: "replace" }
	| { itemId: string; kind: "remove" };

export type EffectiveItem<Item> = {
	item: Item;
	origin: "added" | "base" | "replaced";
};

export function effectiveSheet<Item extends { id: string }>(
	base: readonly Item[],
	changes: readonly SheetChange<Item>[]
): EffectiveItem<Item>[] {
	const replacements = new Map(
		changes.flatMap((change) =>
			change.kind === "replace" ? [[change.item.id, change.item] as const] : []
		)
	);
	const removals = new Set(
		changes.flatMap((change) =>
			change.kind === "remove" ? [change.itemId] : []
		)
	);
	const kept = base.flatMap((item): EffectiveItem<Item>[] => {
		if (removals.has(item.id)) {
			return [];
		}
		const replacement = replacements.get(item.id);
		return [
			replacement
				? { item: replacement, origin: "replaced" }
				: { item, origin: "base" },
		];
	});
	const added = changes.flatMap((change): EffectiveItem<Item>[] =>
		change.kind === "add" ? [{ item: change.item, origin: "added" }] : []
	);
	return [...kept, ...added];
}

export function plannedQuantity(
	quantityMicros: bigint,
	loss: SheetLoss | null
): bigint {
	if (loss === null) {
		return quantityMicros;
	}
	if (loss.kind === "fixed") {
		return quantityMicros + loss.quantityMicros;
	}
	return (
		quantityMicros +
		(quantityMicros * BigInt(loss.basisPoints) + 9999n) / 10_000n
	);
}

export type SheetPrices = {
	materials: ReadonlyMap<string, bigint | null>;
	services: ReadonlyMap<string, bigint>;
};

export type SheetCost = {
	complete: boolean;
	lines: (bigint | null)[];
	totalCents: bigint;
};

function lineCost(item: SheetItem, prices: SheetPrices): bigint | null {
	if (item.kind === "service") {
		const cost = prices.services.get(item.serviceId);
		return cost === undefined ? null : BigInt(item.count) * cost;
	}
	const unitCost = prices.materials.get(item.materialVariantId);
	return unitCost === undefined || unitCost === null
		? null
		: multiplyHalfUp(plannedQuantity(item.quantityMicros, item.loss), unitCost);
}

export function sheetCost(
	items: readonly SheetItem[],
	prices: SheetPrices
): SheetCost {
	const lines = items.map((item) => lineCost(item, prices));
	return {
		complete: lines.every((line) => line !== null),
		lines,
		totalCents: lines.reduce<bigint>((sum, line) => sum + (line ?? 0n), 0n),
	};
}

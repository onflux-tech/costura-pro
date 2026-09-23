import { useState } from "react";

import {
	changesFull,
	draftOf,
	type ProductDetailView,
	type SheetChangeView,
	type SheetItemDraft,
	type SheetItemView,
	variantEstimate,
	withAdded,
	withMaterial,
	withoutChange,
	withRemoval,
	withReplacement,
	withService,
} from "@/lib/products";

import type { SheetItemDialogMode } from "./sheet-item-dialog";
import type { SheetAction } from "./variant-sheet-section";

type SheetDialog = { mode: SheetItemDialogMode; purpose: "add" | "replace" };

function currentItem(
	sheet: readonly SheetItemView[],
	changes: readonly SheetChangeView[],
	itemId: string
): SheetItemView | undefined {
	for (const change of changes) {
		if (change.kind !== "remove" && change.item.id === itemId) {
			return change.item;
		}
	}
	return sheet.find((item) => item.id === itemId);
}

export function useVariantSheet(
	detail: ProductDetailView,
	initialChanges: readonly SheetChangeView[]
) {
	const { sheet } = detail.product;
	const [changes, setChanges] = useState<SheetChangeView[]>(() => [
		...initialChanges,
	]);
	const [references, setReferences] = useState(detail.references);
	const [dialog, setDialog] = useState<SheetDialog | null>(null);

	const openItem = (
		itemId: string,
		purpose: SheetDialog["purpose"],
		heading: string
	) => {
		const item = currentItem(sheet, changes, itemId);
		const draft = item ? draftOf(item, references) : null;
		if (draft) {
			setDialog({ mode: { draft, heading, itemId, kind: "edit" }, purpose });
		}
	};

	const onAction = (action: SheetAction) => {
		if (action.kind === "addMaterial" || action.kind === "addService") {
			const heading =
				action.kind === "addMaterial"
					? "Acrescentar material"
					: "Acrescentar serviço";
			const kind = action.kind === "addMaterial" ? "newMaterial" : "newService";
			setDialog({ mode: { heading, kind }, purpose: "add" });
			return;
		}
		if (action.kind === "replace") {
			openItem(action.itemId, "replace", "Trocar nesta variante");
			return;
		}
		if (action.kind === "editAdded") {
			openItem(action.itemId, "add", "Editar item acrescentado");
			return;
		}
		const { itemId } = action;
		setChanges((current) =>
			action.kind === "remove"
				? withRemoval(current, itemId)
				: withoutChange(current, itemId)
		);
	};

	const saveItem = (item: SheetItemView, draft: SheetItemDraft) => {
		const purpose = dialog?.purpose ?? "add";
		setReferences((current) =>
			draft.kind === "material"
				? withMaterial(current, draft.variant)
				: withService(current, draft.service)
		);
		setChanges((current) =>
			purpose === "replace"
				? withReplacement(current, item)
				: withAdded(current, item)
		);
	};

	return {
		changes,
		closeDialog: () => setDialog(null),
		dialogMode: dialog?.mode ?? null,
		estimate: variantEstimate(sheet, changes, references),
		full: changesFull(sheet, changes),
		onAction,
		references,
		saveItem,
	};
}

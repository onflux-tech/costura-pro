import { productLimits } from "@costura-pro/domain/product";
import { Button } from "@costura-pro/ui/components/button";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Text } from "@costura-pro/ui/components/typography";

import { moneyLabel } from "@/lib/finance";
import {
	draftOf,
	type ProductReferences,
	type SheetChangeView,
	type SheetEstimate,
	type SheetItemView,
	type VariantSheetRow,
	variantSheetRows,
} from "@/lib/products";

import { type SheetLineRow, SheetLines } from "./sheet-lines";

export type SheetAction =
	| { itemId: string; kind: "editAdded" }
	| { itemId: string; kind: "remove" }
	| { itemId: string; kind: "replace" }
	| { itemId: string; kind: "restore" }
	| { kind: "addMaterial" }
	| { kind: "addService" };

const tags: Record<VariantSheetRow["state"], string | undefined> = {
	added: "acrescentado",
	base: undefined,
	removed: "tirado",
	replaced: "trocado",
};

const pendingMeta = {
	empty: "Ficha vazia",
	incomplete: "Custo incompleto",
} as const;

function RowActions({
	editable,
	full,
	onAction,
	row,
}: {
	editable: boolean;
	full: boolean;
	onAction: (action: SheetAction) => void;
	row: VariantSheetRow;
}) {
	const itemId = row.item.id;
	if (row.state === "removed") {
		return (
			<Button
				onClick={() => onAction({ itemId, kind: "restore" })}
				size="sm"
				variant="outline"
			>
				Devolver
			</Button>
		);
	}
	if (row.state === "replaced") {
		return (
			<>
				<Button
					disabled={!editable}
					onClick={() => onAction({ itemId, kind: "replace" })}
					size="sm"
					variant="outline"
				>
					Editar troca
				</Button>
				<Button
					onClick={() => onAction({ itemId, kind: "restore" })}
					size="sm"
					variant="outline"
				>
					Desfazer troca
				</Button>
			</>
		);
	}
	const added = row.state === "added";
	const blocked = full && !added;
	return (
		<>
			<Button
				disabled={!editable || blocked}
				onClick={() =>
					onAction({ itemId, kind: added ? "editAdded" : "replace" })
				}
				size="sm"
				variant="outline"
			>
				{added ? "Editar" : "Trocar"}
			</Button>
			<Button
				disabled={blocked}
				onClick={() => onAction({ itemId, kind: added ? "restore" : "remove" })}
				size="sm"
				variant="outline"
			>
				Tirar
			</Button>
		</>
	);
}

export function VariantSheetSection({
	base,
	changes,
	estimate,
	full,
	onAction,
	references,
}: {
	base: readonly SheetItemView[];
	changes: readonly SheetChangeView[];
	estimate: SheetEstimate;
	full: boolean;
	onAction: (action: SheetAction) => void;
	references: ProductReferences;
}) {
	const costs = new Map(
		estimate.lines.map((line) => [line.item.id, line.cost])
	);
	const rows: SheetLineRow[] = variantSheetRows(base, changes).map((row) => ({
		actions: (
			<RowActions
				editable={draftOf(row.item, references) !== null}
				full={full}
				onAction={onAction}
				row={row}
			/>
		),
		cost: costs.get(row.item.id) ?? null,
		item: row.item,
		outside: row.state === "removed",
		tag: tags[row.state],
	}));
	const meta =
		estimate.status === "complete"
			? `Custo ${moneyLabel(estimate.totalCents)}`
			: pendingMeta[estimate.status];
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Ficha desta variante</PanelTitle>
				<PanelMeta>{meta}</PanelMeta>
			</PanelHeader>
			{rows.length === 0 ? (
				<PanelContent>
					<Text tone="subtle">
						A ficha do produto está vazia. Monte a ficha base ou acrescente
						itens só para esta variante.
					</Text>
				</PanelContent>
			) : (
				<SheetLines
					label="Ficha desta variante"
					references={references}
					rows={rows}
				/>
			)}
			<PanelContent className="flex flex-col gap-2 border-divider border-t">
				<Text size="xs" tone="muted">
					Troque, tire ou acrescente só o que muda nesta variante; o resto segue
					a ficha do produto.
				</Text>
				<div className="flex flex-wrap gap-2">
					<Button
						disabled={full}
						onClick={() => onAction({ kind: "addMaterial" })}
						type="button"
						variant="outline"
					>
						Acrescentar material
					</Button>
					<Button
						disabled={full}
						onClick={() => onAction({ kind: "addService" })}
						type="button"
						variant="outline"
					>
						Acrescentar serviço
					</Button>
				</div>
				{full ? (
					<Text size="xs" tone="muted">
						{`Esta variante já tem ${productLimits.sheetChanges} ajustes, o máximo. Desfaça um ajuste para trocar, tirar ou acrescentar outro item.`}
					</Text>
				) : null}
			</PanelContent>
		</Panel>
	);
}

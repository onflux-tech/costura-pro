import { Button } from "@costura-pro/ui/components/button";
import {
	DataList,
	DataListCell,
	DataListHeader,
	DataListHeaderCell,
	DataListRow,
} from "@costura-pro/ui/components/data-list";
import { Text } from "@costura-pro/ui/components/typography";

import { moneyLabel } from "@/lib/finance";
import {
	draftSummary,
	itemDraftErrors,
	type PurchaseItemDraft,
	type purchasePreview,
	unitCostLabel,
} from "@/lib/purchases";

export function PurchaseItemRows({
	items,
	onEdit,
	onRemove,
	preview,
}: {
	items: PurchaseItemDraft[];
	onEdit: (item: PurchaseItemDraft) => void;
	onRemove: (key: string) => void;
	preview: ReturnType<typeof purchasePreview>;
}) {
	const lines = preview?.ok ? preview.totals.lines : [];
	return (
		<DataList
			aria-label="Itens da compra"
			columns="minmax(0,1fr) 9rem 9rem 10rem"
		>
			<DataListHeader>
				<DataListHeaderCell>Item</DataListHeaderCell>
				<DataListHeaderCell align="end">Linha</DataListHeaderCell>
				<DataListHeaderCell align="end">Custo final</DataListHeaderCell>
				<DataListHeaderCell align="end">Ações</DataListHeaderCell>
			</DataListHeader>
			{items.map((item, index) => {
				const line = lines[index];
				const invalid = Object.keys(itemDraftErrors(item)).length > 0;
				return (
					<DataListRow key={item.key}>
						<DataListCell label="Item">
							<div className="flex flex-col gap-1">
								<Text weight="semibold">
									{`${item.variant.materialName} · ${item.variant.name}`}
								</Text>
								<Text size="sm" tone={invalid ? "danger" : "subtle"}>
									{invalid
										? "Complete este item"
										: `${draftSummary(item)} a R$ ${item.unitPrice}`}
								</Text>
							</div>
						</DataListCell>
						<DataListCell align="end" label="Linha">
							<Text inline numeric>
								{line ? moneyLabel(line.grossCents) : "-"}
							</Text>
						</DataListCell>
						<DataListCell align="end" label="Custo final">
							<div className="flex flex-col gap-1 md:items-end">
								<Text inline numeric>
									{line ? moneyLabel(line.valueCents) : "-"}
								</Text>
								{line ? (
									<Text inline size="sm" tone="subtle">
										{unitCostLabel(
											line.valueCents,
											line.quantityMicros,
											item.variant.baseUnit
										)}
									</Text>
								) : null}
							</div>
						</DataListCell>
						<DataListCell align="end" label="Ações">
							<div className="flex flex-wrap gap-2 md:justify-end">
								<Button
									onClick={() => onEdit(item)}
									size="sm"
									type="button"
									variant="outline"
								>
									Editar
								</Button>
								<Button
									onClick={() => onRemove(item.key)}
									size="sm"
									type="button"
									variant="ghost"
								>
									Remover
								</Button>
							</div>
						</DataListCell>
					</DataListRow>
				);
			})}
		</DataList>
	);
}

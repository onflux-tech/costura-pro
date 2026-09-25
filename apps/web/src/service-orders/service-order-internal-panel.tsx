import { formatMarginPercent } from "@costura-pro/domain/pricing";
import { Badge } from "@costura-pro/ui/components/badge";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Stat } from "@costura-pro/ui/components/stat";
import { Text } from "@costura-pro/ui/components/typography";

import { moneyLabel } from "@/lib/finance";
import {
	costDifferenceText,
	estimatedMargin,
	type MaterialCosts,
	materialCostRows,
	materialCostText,
	materialCostTotalText,
	type ServiceOrderItemView,
	type ServiceOrderRevisionView,
} from "@/lib/service-orders";

function marginText(margin: number | null): string {
	return margin === null ? "sem preço" : formatMarginPercent(margin);
}

function MaterialCostSection({ costs }: { costs: MaterialCosts }) {
	const difference = costDifferenceText(costs);
	return (
		<div className="flex flex-col gap-1 border-divider border-t pt-3">
			<Text size="sm" weight="semibold">
				Material
			</Text>
			{costs.rows.map((row) => (
				<div
					className="flex flex-wrap items-center gap-x-2 gap-y-1"
					key={row.label}
				>
					<Text inline size="xs">
						{materialCostText(row)}
					</Text>
					{row.provisional ? <Badge tone="warning">provisório</Badge> : null}
				</div>
			))}
			<Text size="xs" weight="semibold">
				{materialCostTotalText(costs)}
			</Text>
			{difference === null ? null : (
				<Text size="xs" tone="subtle">
					{`Diferença ${difference}`}
				</Text>
			)}
		</div>
	);
}

export function ServiceOrderInternalPanel({
	items,
	revision,
}: {
	items: readonly Pick<ServiceOrderItemView, "reconciliation">[];
	revision: ServiceOrderRevisionView;
}) {
	const pricing = estimatedMargin(revision);
	const costs = materialCostRows(items);
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Só para você</PanelTitle>
				<PanelMeta>Não sai no documento.</PanelMeta>
			</PanelHeader>
			<PanelContent className="flex flex-col gap-3">
				<div className="grid grid-cols-2 gap-4">
					<Stat
						label="Custo estimado"
						value={
							revision.costCents === null
								? "incompleto"
								: moneyLabel(revision.costCents)
						}
					/>
					<Stat
						label="Margem estimada"
						tone={pricing?.belowTarget ? "warning" : undefined}
						value={
							pricing ? marginText(pricing.marginBasisPoints) : "sem custo"
						}
					/>
					<Stat
						label="Meta da revisão"
						value={formatMarginPercent(revision.targetMarginBasisPoints)}
					/>
				</div>
				<Text size="xs" tone="subtle">
					{revision.costCents === null
						? `Custo incompleto na revisão ${revision.number}: algum item ficou sem custo na emissão.`
						: `Valores da aprovação, pela revisão ${revision.number}. A margem real chega com o consumo.`}
				</Text>
				{costs.rows.length > 0 ? <MaterialCostSection costs={costs} /> : null}
			</PanelContent>
		</Panel>
	);
}

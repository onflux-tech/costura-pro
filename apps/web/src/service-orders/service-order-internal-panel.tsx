import { formatMarginPercent } from "@costura-pro/domain/pricing";
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
	estimatedMargin,
	type ServiceOrderRevisionView,
} from "@/lib/service-orders";

function marginText(margin: number | null): string {
	return margin === null ? "sem preço" : formatMarginPercent(margin);
}

export function ServiceOrderInternalPanel({
	revision,
}: {
	revision: ServiceOrderRevisionView;
}) {
	const pricing = estimatedMargin(revision);
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
			</PanelContent>
		</Panel>
	);
}

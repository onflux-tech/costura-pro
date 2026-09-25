import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Stat } from "@costura-pro/ui/components/stat";

import {
	deliverySummary,
	financialSummary,
	productionSummary,
	type ServiceOrderDetailView,
} from "@/lib/service-orders";

const productionTone = {
	danger: "danger",
	default: undefined,
	success: "success",
} as const;

export function ServiceOrderStates({
	detail,
	today,
}: {
	detail: ServiceOrderDetailView;
	today: string;
}) {
	const production = productionSummary(detail.items, today);
	return (
		<Panel aria-label="Situação da OS">
			<PanelContent className="flex flex-wrap gap-x-10 gap-y-3">
				<Stat
					label="Produção"
					tone={productionTone[production.tone]}
					value={production.text}
				/>
				<Stat label="Entrega" value={deliverySummary(detail.items)} />
				<Stat label="Financeiro" value={financialSummary(detail.receivable)} />
			</PanelContent>
		</Panel>
	);
}

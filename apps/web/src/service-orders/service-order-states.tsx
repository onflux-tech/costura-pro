import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Stat } from "@costura-pro/ui/components/stat";

import {
	deliverySummary,
	financialSummary,
	productionSummary,
	type ServiceOrderDetailView,
} from "@/lib/service-orders";

export function ServiceOrderStates({
	detail,
}: {
	detail: ServiceOrderDetailView;
}) {
	return (
		<Panel aria-label="Situação da OS">
			<PanelContent className="flex flex-wrap gap-x-10 gap-y-3">
				<Stat label="Produção" value={productionSummary(detail.items)} />
				<Stat label="Entrega" value={deliverySummary(detail.items)} />
				<Stat label="Financeiro" value={financialSummary(detail.receivable)} />
			</PanelContent>
		</Panel>
	);
}

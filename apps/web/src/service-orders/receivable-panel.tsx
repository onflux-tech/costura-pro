import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Stat } from "@costura-pro/ui/components/stat";
import { Text } from "@costura-pro/ui/components/typography";

import { moneyLabel } from "@/lib/finance";
import { formatDay } from "@/lib/measurements";
import type { ServiceOrderDetailView } from "@/lib/service-orders";

export function ReceivablePanel({
	detail,
}: {
	detail: ServiceOrderDetailView;
}) {
	const { receivable, revision } = detail;
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Recebível</PanelTitle>
			</PanelHeader>
			<PanelContent className="flex flex-col gap-3">
				<Stat label="Total da OS" value={moneyLabel(revision.totalCents)} />
				{receivable ? (
					<>
						<Stat
							hint={`Desde ${formatDay(receivable.occurredOn)}`}
							label="A receber"
							value={moneyLabel(receivable.amountCents)}
						/>
						<Text size="xs" tone="subtle">
							Entrada, parcelas e pagamentos chegam com os recebíveis.
						</Text>
					</>
				) : (
					<Text tone="subtle">Sem cobrança: o total aprovado é zero.</Text>
				)}
			</PanelContent>
		</Panel>
	);
}

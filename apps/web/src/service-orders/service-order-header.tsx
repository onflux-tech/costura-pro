import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { Link } from "@tanstack/react-router";

import { formatDay } from "@/lib/measurements";
import { revisionLabel } from "@/lib/quotes";
import {
	approvalChannelLabels,
	type ServiceOrderDetailView,
	subitemsLabel,
} from "@/lib/service-orders";

export function ServiceOrderHeader({
	detail,
}: {
	detail: ServiceOrderDetailView;
}) {
	const { approval, client, items, quote, revision, serviceOrder } = detail;
	return (
		<Panel>
			<PanelContent className="flex flex-col gap-1.5">
				<Heading className="font-mono max-md:text-xl">
					{serviceOrder.code}
				</Heading>
				<Text size="xs" tone="subtle">
					{`Aprovado em ${formatDay(approval.approvedOn)} · canal ${approvalChannelLabels[approval.channel]} · ${subitemsLabel(items.length)}`}
				</Text>
				<div className="flex flex-wrap items-center gap-x-2">
					<Text inline tone="subtle">
						Cliente
					</Text>
					<ButtonLink
						className="h-auto min-h-11 px-0 md:min-h-0"
						render={
							<Link
								params={{ clienteId: client.id }}
								to="/atendimento/clientes/$clienteId"
							/>
						}
						variant="link"
					>
						{client.name}
					</ButtonLink>
				</div>
				<div className="flex flex-wrap items-center gap-x-2">
					<Text inline tone="subtle">
						Orçamento
					</Text>
					<ButtonLink
						className="h-auto min-h-11 px-0 md:min-h-0"
						render={
							<Link
								params={{
									numero: String(revision.number),
									orcamentoId: quote.id,
								}}
								to="/orcamentos/$orcamentoId/revisoes/$numero"
							/>
						}
						variant="link"
					>
						{revisionLabel(quote.code, revision.number)}
					</ButtonLink>
				</div>
				{approval.note ? (
					<Text size="xs" tone="subtle">
						{`Nota da aprovação: ${approval.note}`}
					</Text>
				) : null}
			</PanelContent>
		</Panel>
	);
}

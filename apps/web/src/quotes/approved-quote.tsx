import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Badge } from "@costura-pro/ui/components/badge";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { formatDay } from "@/lib/measurements";
import type {
	PeopleNames,
	QuoteApprovalView,
	QuoteDetailView,
	QuoteRevisionView,
} from "@/lib/quotes";
import { approvalChannelLabels } from "@/lib/service-orders";

import { FrozenLines } from "./frozen-lines";
import { RevisionInternal, RevisionTotals } from "./revision-page";
import { RevisionsPanel } from "./revisions-panel";

function ApprovalPanel({
	actions,
	approval,
	detail,
}: {
	actions: ReactNode;
	approval: QuoteApprovalView;
	detail: QuoteDetailView;
}) {
	const { client, quote } = detail;
	return (
		<Panel>
			<PanelContent className="flex flex-col gap-3">
				<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div className="flex min-w-0 flex-col gap-1.5">
						<Heading className="font-mono max-md:text-xl">{quote.code}</Heading>
						<div className="flex flex-wrap gap-1.5">
							<Badge tone="success">aprovado</Badge>
							{quote.archivedAt ? (
								<Badge tone="warning">arquivado</Badge>
							) : null}
						</div>
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
						<Text size="xs" tone="subtle">
							{`Aprovado em ${formatDay(approval.approvedOn)} · ${approvalChannelLabels[approval.channel]} · rev. ${approval.revisionNumber}`}
						</Text>
						{approval.note ? (
							<Text size="xs" tone="subtle">
								{approval.note}
							</Text>
						) : null}
					</div>
					<div className="flex flex-col gap-2 md:items-end">
						<ButtonLink
							className="max-md:w-full"
							render={
								<Link
									params={{ osId: approval.serviceOrderId }}
									to="/os/$osId"
								/>
							}
						>
							{`Abrir ${approval.serviceOrderCode}`}
						</ButtonLink>
						{actions}
					</div>
				</div>
				<Text size="xs" tone="subtle">
					O orçamento aprovado fica só leitura. Mudança de preço, prazo ou
					material chega com a revisão comercial da OS.
				</Text>
			</PanelContent>
		</Panel>
	);
}

export function ApprovedQuote({
	actions,
	approval,
	detail,
	people,
}: {
	actions: ReactNode;
	approval: QuoteApprovalView;
	detail: QuoteDetailView;
	people: PeopleNames;
}) {
	const revision: QuoteRevisionView | undefined = detail.revisions.find(
		(item) => item.id === approval.revisionId
	);
	return (
		<div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<div className="flex min-w-0 flex-col gap-4">
				<ApprovalPanel actions={actions} approval={approval} detail={detail} />
				{revision ? (
					<Panel>
						<PanelHeader>
							<PanelTitle>Itens aprovados</PanelTitle>
							<PanelMeta>{`Valores da revisão ${revision.number}.`}</PanelMeta>
						</PanelHeader>
						<FrozenLines lines={revision.content.lines} people={people} />
					</Panel>
				) : (
					<Alert tone="warning">
						<AlertTitle>Revisão aprovada não encontrada</AlertTitle>
						<AlertDescription>Recarregue a tela.</AlertDescription>
					</Alert>
				)}
				<RevisionsPanel
					quoteId={detail.quote.id}
					revisions={detail.revisions}
				/>
			</div>
			{revision ? (
				<div className="flex min-w-0 flex-col gap-4">
					<RevisionTotals revision={revision} />
					<RevisionInternal revision={revision} />
				</div>
			) : null}
		</div>
	);
}

import { formatMarginPercent, pricingOf } from "@costura-pro/domain/pricing";
import {
	Alert,
	AlertActions,
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
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Stat } from "@costura-pro/ui/components/stat";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { clientCommandFailure } from "@/lib/client-command-error";
import { moneyLabel, signedMoney } from "@/lib/finance";
import { formatDay } from "@/lib/measurements";
import {
	type QuoteDetailView,
	type QuoteRevisionView,
	revisionLabel,
} from "@/lib/quotes";
import { usePageHeader } from "@/shell/page-header";

import { FrozenLines } from "./frozen-lines";
import { quoteQuery } from "./quote-queries";
import { usePeople } from "./use-people";

function days(count: number): string {
	return count === 1 ? "1 dia" : `${count} dias`;
}

function marginText(margin: number | null): string {
	return margin === null ? "sem preço" : formatMarginPercent(margin);
}

export function RevisionInternal({
	revision,
}: {
	revision: QuoteRevisionView;
}) {
	const pricing =
		revision.costCents === null
			? null
			: pricingOf({
					costCents: BigInt(revision.costCents),
					priceCents: BigInt(revision.totalCents),
					targetMarginBasisPoints: revision.targetMarginBasisPoints,
				});
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Só para você</PanelTitle>
				<PanelMeta>Não sai no documento.</PanelMeta>
			</PanelHeader>
			<PanelContent className="grid grid-cols-2 gap-4">
				<Stat
					label="Custo na emissão"
					value={
						revision.costCents === null
							? "incompleto"
							: moneyLabel(revision.costCents)
					}
				/>
				<Stat
					label="Meta na emissão"
					value={formatMarginPercent(revision.targetMarginBasisPoints)}
				/>
				<Stat
					label="Preço sugerido"
					value={
						pricing ? moneyLabel(pricing.suggestedCents) : "sem custo completo"
					}
				/>
				<Stat
					label="Margem da revisão"
					value={
						pricing
							? marginText(pricing.marginBasisPoints)
							: "sem custo completo"
					}
				/>
			</PanelContent>
		</Panel>
	);
}

export function RevisionTotals({ revision }: { revision: QuoteRevisionView }) {
	const { content } = revision;
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Totais e condições</PanelTitle>
			</PanelHeader>
			<PanelContent className="flex flex-col gap-3">
				<Stat
					hint={`Valor dos itens ${moneyLabel(revision.grossCents)}`}
					label="Total ao cliente"
					value={moneyLabel(revision.totalCents)}
				/>
				<Text size="xs" tone="subtle">
					{BigInt(revision.discountCents) > 0n
						? `Descontos ${signedMoney(String(-BigInt(revision.discountCents)))}`
						: "Sem desconto"}
				</Text>
				<Text size="xs" tone="subtle">
					{`Validade de ${days(content.validityDays)} · ${
						content.leadTimeDays === null
							? "prazo a combinar"
							: `prazo de ${days(content.leadTimeDays)} após a aprovação`
					}`}
				</Text>
				{content.notes ? (
					<Text size="xs" tone="subtle">
						{content.notes}
					</Text>
				) : null}
			</PanelContent>
		</Panel>
	);
}

function RevisionView({
	detail,
	revision,
}: {
	detail: QuoteDetailView;
	revision: QuoteRevisionView;
}) {
	const { people } = usePeople(detail.client.id);
	const { content } = revision;
	return (
		<div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<div className="flex min-w-0 flex-col gap-4">
				<Panel>
					<PanelContent className="flex flex-col gap-1.5">
						<Heading className="font-mono max-md:sr-only">
							{revisionLabel(detail.quote.code, revision.number)}
						</Heading>
						<div className="flex flex-wrap gap-1.5">
							<Badge>congelada</Badge>
						</div>
						<Text>{`Cliente ${detail.client.name}`}</Text>
						<Text size="xs" tone="subtle">
							{`Emitida em ${formatDay(revision.emittedOn)} · válida até ${formatDay(revision.validUntil)}`}
						</Text>
						{revision.reason ? (
							<Text size="xs" tone="subtle">
								{`Motivo da revisão: ${revision.reason}`}
							</Text>
						) : null}
						<ButtonLink
							className="self-start"
							render={
								<Link
									params={{ orcamentoId: detail.quote.id }}
									to="/orcamentos/$orcamentoId"
								/>
							}
							variant="outline"
						>
							Voltar para o orçamento
						</ButtonLink>
					</PanelContent>
				</Panel>
				<Panel>
					<PanelHeader>
						<PanelTitle>Itens</PanelTitle>
						<PanelMeta>Valores congelados na emissão.</PanelMeta>
					</PanelHeader>
					<FrozenLines lines={content.lines} people={people} />
				</Panel>
			</div>
			<div className="flex min-w-0 flex-col gap-4">
				<RevisionTotals revision={revision} />
				<RevisionInternal revision={revision} />
			</div>
		</div>
	);
}

export function RevisionPage({
	number,
	quoteId,
}: {
	number: number;
	quoteId: string;
}) {
	const detail = useQuery(quoteQuery(quoteId));
	usePageHeader({
		backHref: `/orcamentos/${quoteId}`,
		eyebrow: detail.data?.quote.code ?? "Orçamento",
		heading: `Revisão ${number}`,
	});

	if (detail.isPending) {
		return <Skeleton className="h-96" />;
	}
	if (!detail.data) {
		return (
			<Alert tone="danger">
				<AlertTitle>Não dá para abrir este orçamento</AlertTitle>
				<AlertDescription>
					{clientCommandFailure(detail.error, "orçamento").message}
				</AlertDescription>
				<AlertActions>
					<ButtonLink
						render={<Link to="/orcamentos/rascunhos" />}
						variant="outline"
					>
						Voltar para orçamentos
					</ButtonLink>
				</AlertActions>
			</Alert>
		);
	}
	const revision = detail.data.revisions.find((item) => item.number === number);
	if (!revision) {
		return (
			<Alert tone="warning">
				<AlertTitle>Revisão não encontrada.</AlertTitle>
				<AlertDescription>
					{`O orçamento ${detail.data.quote.code} não tem a revisão ${number}.`}
				</AlertDescription>
				<AlertActions>
					<ButtonLink
						render={
							<Link
								params={{ orcamentoId: quoteId }}
								to="/orcamentos/$orcamentoId"
							/>
						}
						variant="outline"
					>
						Voltar para o orçamento
					</ButtonLink>
				</AlertActions>
			</Alert>
		);
	}
	return <RevisionView detail={detail.data} revision={revision} />;
}

import type { QuoteStatus } from "@costura-pro/domain/quote";
import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import {
	ChoiceChip,
	ChoiceChips,
} from "@costura-pro/ui/components/choice-chips";
import {
	DataList,
	DataListCell,
	DataListHeader,
	DataListHeaderCell,
	DataListRow,
} from "@costura-pro/ui/components/data-list";
import { Field, FieldLabel } from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Mono, Text } from "@costura-pro/ui/components/typography";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { clientCommandFailure } from "@/lib/client-command-error";
import { moneyLabel } from "@/lib/finance";
import { formatDay, localDay } from "@/lib/measurements";
import { type QuoteListItemView, statusLabels, statusTone } from "@/lib/quotes";
import { usePageHeader } from "@/shell/page-header";

import type { QuoteListSearch } from "./quote-list-search";
import { quotesQuery } from "./quote-queries";

const tabs: Record<
	QuoteStatus,
	{ description: string; empty: string; label: string }
> = {
	approved: {
		description: "Orçamentos que o cliente aceitou, cada um com a sua OS.",
		empty: "Nenhum orçamento aprovado ainda.",
		label: "Aprovados",
	},
	draft: {
		description: "Orçamentos em montagem, ainda sem revisão emitida.",
		empty:
			"Nenhum rascunho. Comece um orçamento pela ficha do cliente ou pelo botão Novo orçamento.",
		label: "Rascunhos",
	},
	emitted: {
		description: "Revisões emitidas dentro da validade, esperando a resposta.",
		empty: "Nenhum orçamento emitido esperando resposta.",
		label: "Emitidos",
	},
	expired: {
		description: "Revisões emitidas com a validade vencida.",
		empty: "Nenhum orçamento vencido.",
		label: "Vencidos",
	},
	refused: {
		description: "Orçamentos que o cliente recusou.",
		empty: "Nenhum orçamento recusado.",
		label: "Recusados",
	},
};

function dateText(quote: QuoteListItemView): string {
	if (quote.approvedOn) {
		return `aprovado em ${formatDay(quote.approvedOn)}`;
	}
	if (quote.status === "refused" && quote.refusedOn) {
		return `recusado em ${formatDay(quote.refusedOn)}`;
	}
	if (quote.emittedOn && quote.validUntil) {
		return `emitido em ${formatDay(quote.emittedOn)} · válido até ${formatDay(quote.validUntil)}`;
	}
	return `criado em ${formatDay(quote.createdOn)}`;
}

function emptyText(status: QuoteStatus, search: string, archived: boolean) {
	if (search) {
		return `Nada encontrado para “${search}”.`;
	}
	return archived
		? "Nenhum orçamento arquivado nesta aba."
		: tabs[status].empty;
}

function QuoteRow({ quote }: { quote: QuoteListItemView }) {
	return (
		<DataListRow>
			<DataListCell label="Orçamento">
				<div className="flex min-w-0 flex-col items-start gap-0.5">
					<ButtonLink
						className="h-auto min-h-11 justify-start px-0 md:min-h-0"
						render={
							<Link
								params={{ orcamentoId: quote.id }}
								to="/orcamentos/$orcamentoId"
							/>
						}
						variant="link"
					>
						<Mono>{quote.code}</Mono>
					</ButtonLink>
					<Text size="xs" tone="subtle">
						{quote.clientName}
					</Text>
					{quote.serviceOrderCode ? (
						<Mono className="text-xs">{quote.serviceOrderCode}</Mono>
					) : null}
				</div>
			</DataListCell>
			<DataListCell label="Data">
				<Text inline size="xs">
					{dateText(quote)}
				</Text>
			</DataListCell>
			<DataListCell align="end" label="Total">
				<Text inline numeric>
					{moneyLabel(quote.totalCents)}
				</Text>
			</DataListCell>
			<DataListCell label="Estado">
				<div className="flex flex-wrap gap-1">
					<Badge tone={statusTone(quote.status)}>
						{statusLabels[quote.status]}
					</Badge>
					{quote.archivedAt ? <Badge tone="warning">arquivado</Badge> : null}
				</div>
			</DataListCell>
		</DataListRow>
	);
}

export function QuoteListPage({
	onSearchChange,
	search,
	status,
}: {
	onSearchChange: (next: QuoteListSearch, replace: boolean) => void;
	search: QuoteListSearch;
	status: QuoteStatus;
}) {
	const { arquivados, busca = "" } = search;
	const archived = arquivados === 1;
	const tab = tabs[status];
	const [query, setQuery] = useState(busca);
	usePageHeader({ eyebrow: "Orçamentos", heading: tab.label });

	useEffect(() => {
		const next = query.trim();
		if (next === busca) {
			return;
		}
		const timer = setTimeout(() => {
			onSearchChange({ arquivados, busca: next || undefined }, true);
		}, 300);
		return () => clearTimeout(timer);
	}, [arquivados, busca, onSearchChange, query]);

	const list = useInfiniteQuery(
		quotesQuery({
			archived,
			query: busca || undefined,
			status,
			today: localDay(new Date()),
		})
	);
	const items = list.data?.pages.flatMap((page) => page.items) ?? [];

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-col gap-1">
					<Heading className="max-md:sr-only">Orçamentos</Heading>
					<Text tone="subtle">{tab.description}</Text>
				</div>
				<ButtonLink
					className="max-md:w-full"
					render={<Link to="/orcamentos/rascunhos/novo" />}
				>
					Novo orçamento
				</ButtonLink>
			</div>
			<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<Field className="md:w-96">
					<FieldLabel>Buscar</FieldLabel>
					<Input
						maxLength={100}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Código, cliente ou item"
						type="search"
						value={query}
					/>
				</Field>
				<ChoiceChips
					aria-label="Situação"
					onValueChange={(value) =>
						onSearchChange(
							{
								arquivados: value === "arquivados" ? 1 : undefined,
								busca: busca || undefined,
							},
							false
						)
					}
					value={archived ? "arquivados" : "ativos"}
				>
					<ChoiceChip value="ativos">Ativos</ChoiceChip>
					<ChoiceChip value="arquivados">Arquivados</ChoiceChip>
				</ChoiceChips>
			</div>
			<Panel>
				{list.isPending ? (
					<PanelContent className="flex flex-col gap-2">
						<Skeleton className="h-10" />
						<Skeleton className="h-10" />
					</PanelContent>
				) : null}
				{list.isError ? (
					<PanelContent>
						<Text tone="danger">
							{clientCommandFailure(list.error, "orçamento").message}
						</Text>
					</PanelContent>
				) : null}
				{list.isSuccess && items.length === 0 ? (
					<PanelContent className="p-6">
						<Text tone="subtle">{emptyText(status, busca, archived)}</Text>
					</PanelContent>
				) : null}
				{items.length > 0 ? (
					<DataList
						aria-label={`Orçamentos ${tab.label.toLowerCase()}`}
						columns="minmax(0,1fr) 10rem 9rem 8rem"
					>
						<DataListHeader>
							<DataListHeaderCell>Orçamento</DataListHeaderCell>
							<DataListHeaderCell>Data</DataListHeaderCell>
							<DataListHeaderCell align="end">Total</DataListHeaderCell>
							<DataListHeaderCell>Estado</DataListHeaderCell>
						</DataListHeader>
						{items.map((item) => (
							<QuoteRow key={item.id} quote={item} />
						))}
					</DataList>
				) : null}
			</Panel>
			{list.hasNextPage ? (
				<Button
					disabled={list.isFetchingNextPage}
					onClick={() => list.fetchNextPage()}
					variant="outline"
				>
					Carregar mais
				</Button>
			) : null}
		</div>
	);
}

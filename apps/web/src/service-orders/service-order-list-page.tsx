import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
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
import { localDay } from "@/lib/measurements";
import {
	dueLabel,
	receivableLabel,
	type ServiceOrderListItemView,
	subitemsLabel,
} from "@/lib/service-orders";
import { usePageHeader } from "@/shell/page-header";

import type { ServiceOrderListSearch } from "./service-order-list-search";
import { serviceOrdersQuery } from "./service-order-queries";

function ServiceOrderRow({
	order,
	today,
}: {
	order: ServiceOrderListItemView;
	today: string;
}) {
	const due = dueLabel(order.dueOn, today);
	const charged = BigInt(order.totalCents) > 0n;
	return (
		<DataListRow>
			<DataListCell label="OS">
				<div className="flex min-w-0 flex-col items-start gap-0.5">
					<ButtonLink
						className="h-auto min-h-11 justify-start px-0 md:min-h-0"
						render={<Link params={{ osId: order.id }} to="/os/$osId" />}
						variant="link"
					>
						<Mono>{order.code}</Mono>
					</ButtonLink>
					<Text size="xs" tone="subtle">
						{`${order.clientName} · ${subitemsLabel(order.itemCount)}`}
					</Text>
				</div>
			</DataListCell>
			<DataListCell label="Prazo">
				<div className="flex flex-wrap items-center gap-1.5">
					<Text inline size="xs">
						{due.text}
					</Text>
					{due.late ? <Badge tone="warning">vencido</Badge> : null}
				</div>
			</DataListCell>
			<DataListCell align="end" label="A receber">
				<Text inline numeric tone={charged ? "default" : "muted"}>
					{receivableLabel(order.totalCents)}
				</Text>
			</DataListCell>
			<DataListCell label="Situação">
				<div className="flex flex-wrap gap-1">
					<Badge>aberta</Badge>
					{order.shortage ? <Badge tone="warning">falta material</Badge> : null}
				</div>
			</DataListCell>
		</DataListRow>
	);
}

function EmptyState({ search }: { search: string }) {
	if (search) {
		return (
			<PanelContent className="p-6">
				<Text tone="subtle">{`Nada encontrado para “${search}”.`}</Text>
			</PanelContent>
		);
	}
	return (
		<PanelContent className="flex flex-col items-start gap-3 p-6">
			<Text tone="subtle">
				Nenhuma OS ainda. A OS nasce quando você registra a aprovação de um
				orçamento emitido.
			</Text>
			<ButtonLink render={<Link to="/orcamentos/emitidos" />} variant="outline">
				Ver orçamentos emitidos
			</ButtonLink>
		</PanelContent>
	);
}

export function ServiceOrderListPage({
	onSearchChange,
	search,
}: {
	onSearchChange: (next: ServiceOrderListSearch) => void;
	search: ServiceOrderListSearch;
}) {
	const { busca = "" } = search;
	const [query, setQuery] = useState(busca);
	const [today] = useState(() => localDay(new Date()));
	usePageHeader({ heading: "OS" });

	useEffect(() => {
		const next = query.trim();
		if (next === busca) {
			return;
		}
		const timer = setTimeout(() => {
			onSearchChange({ busca: next || undefined });
		}, 300);
		return () => clearTimeout(timer);
	}, [busca, onSearchChange, query]);

	const list = useInfiniteQuery(
		serviceOrdersQuery({ query: busca || undefined })
	);
	const items = list.data?.pages.flatMap((page) => page.items) ?? [];

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1">
				<Heading className="max-md:sr-only">OS</Heading>
				<Text tone="subtle">
					Ordens de serviço abertas pela aprovação dos orçamentos, pelo prazo
					mais próximo.
				</Text>
			</div>
			<Field className="md:w-96">
				<FieldLabel>Buscar</FieldLabel>
				<Input
					maxLength={100}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Código, cliente ou subitem"
					type="search"
					value={query}
				/>
			</Field>
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
							{clientCommandFailure(list.error, "OS").message}
						</Text>
					</PanelContent>
				) : null}
				{list.isSuccess && items.length === 0 ? (
					<EmptyState search={busca} />
				) : null}
				{items.length > 0 ? (
					<DataList
						aria-label="Ordens de serviço"
						columns="minmax(0,1fr) 9rem 8rem 9rem"
					>
						<DataListHeader>
							<DataListHeaderCell>OS</DataListHeaderCell>
							<DataListHeaderCell>Prazo</DataListHeaderCell>
							<DataListHeaderCell align="end">A receber</DataListHeaderCell>
							<DataListHeaderCell>Situação</DataListHeaderCell>
						</DataListHeader>
						{items.map((item) => (
							<ServiceOrderRow key={item.id} order={item} today={today} />
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

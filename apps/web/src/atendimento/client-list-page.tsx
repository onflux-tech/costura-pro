import { formatPhone } from "@costura-pro/domain/client";
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
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { formatDateTime } from "@/lib/format-date-time";
import { usePageHeader } from "@/shell/page-header";
import { orpc } from "@/utils/orpc";

const route = getRouteApi("/_app/atendimento/clientes/");

function emptyState(search: string, archived: boolean) {
	if (search) {
		return {
			hint: "Confira a grafia ou busque por um trecho do telefone.",
			title: "Nenhum cliente encontrado",
		};
	}
	if (archived) {
		return {
			hint: "Clientes arquivados aparecem aqui e continuam com o histórico.",
			title: "Nenhum cliente arquivado",
		};
	}
	return {
		hint: "Cadastre o cliente pagador e os perfis de quem veste a peça.",
		title: "Nenhum cliente ainda",
	};
}

export function ClientListPage() {
	const { arquivados, busca = "" } = route.useSearch();
	const navigate = route.useNavigate();
	const archived = arquivados === 1;
	const [query, setQuery] = useState(busca);
	usePageHeader({ eyebrow: "Atendimento", heading: "Clientes" });

	useEffect(() => {
		const next = query.trim();
		if (next === busca) {
			return;
		}
		const timer = setTimeout(() => {
			navigate({
				replace: true,
				search: (previous) => ({ ...previous, busca: next || undefined }),
			});
		}, 300);
		return () => clearTimeout(timer);
	}, [busca, navigate, query]);

	const list = useInfiniteQuery(
		orpc.clients.list.infiniteOptions({
			getNextPageParam: (page) => page.nextOffset ?? undefined,
			initialPageParam: 0,
			input: (offset: number) => ({
				archived,
				offset,
				query: busca || undefined,
			}),
		})
	);
	const items = list.data?.pages.flatMap((page) => page.items) ?? [];
	const empty = emptyState(busca, archived);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Heading className="max-md:sr-only">Clientes</Heading>
				<ButtonLink
					className="max-md:w-full"
					render={<Link to="/atendimento/clientes/novo" />}
				>
					Novo cliente
				</ButtonLink>
			</div>
			<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<Field className="md:w-96">
					<FieldLabel>Buscar</FieldLabel>
					<Input
						maxLength={100}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Nome, telefone ou e-mail"
						type="search"
						value={query}
					/>
				</Field>
				<ChoiceChips
					aria-label="Situação"
					onValueChange={(value) =>
						navigate({
							search: (previous) => ({
								...previous,
								arquivados: value === "arquivados" ? 1 : undefined,
							}),
						})
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
				{list.isSuccess && items.length === 0 ? (
					<PanelContent className="flex flex-col items-start gap-2 p-6">
						<Heading level={2} size="section">
							{empty.title}
						</Heading>
						<Text tone="subtle">{empty.hint}</Text>
					</PanelContent>
				) : null}
				{items.length > 0 ? (
					<DataList
						aria-label="Clientes"
						columns="minmax(0,2fr) minmax(0,1fr) 5rem 9rem"
					>
						<DataListHeader>
							<DataListHeaderCell>Nome</DataListHeaderCell>
							<DataListHeaderCell>Telefone</DataListHeaderCell>
							<DataListHeaderCell align="end">Perfis</DataListHeaderCell>
							<DataListHeaderCell align="end">Atualizado</DataListHeaderCell>
						</DataListHeader>
						{items.map((item) => (
							<DataListRow key={item.id}>
								<DataListCell label="Nome">
									<ButtonLink
										className="h-auto min-h-11 justify-start whitespace-normal px-0 text-left font-semibold md:min-h-0"
										render={
											<Link
												params={{ clienteId: item.id }}
												to="/atendimento/clientes/$clienteId"
											/>
										}
										variant="link"
									>
										{item.name}
									</ButtonLink>
									{item.kind === "organization" ? (
										<Badge>organização</Badge>
									) : null}
									{item.anonymizedAt ? (
										<Badge tone="danger">anonimizado</Badge>
									) : null}
								</DataListCell>
								<DataListCell label="Telefone">
									{item.phone ? formatPhone(item.phone) : "Sem telefone"}
								</DataListCell>
								<DataListCell align="end" label="Perfis">
									<Text inline numeric>
										{item.profileCount}
									</Text>
								</DataListCell>
								<DataListCell align="end" label="Atualizado">
									{formatDateTime(new Date(item.updatedAt))}
								</DataListCell>
							</DataListRow>
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
					{list.isFetchingNextPage ? "Carregando..." : "Mostrar mais"}
				</Button>
			) : null}
		</div>
	);
}

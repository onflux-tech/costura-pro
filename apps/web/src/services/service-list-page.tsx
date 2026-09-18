import { formatMarginPercent } from "@costura-pro/domain/pricing";
import { formatMinutes } from "@costura-pro/domain/service";
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
import { Select } from "@costura-pro/ui/components/select";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { clientCommandFailure } from "@/lib/client-command-error";
import { moneyLabel } from "@/lib/finance";
import {
	type ServiceView,
	servicePriceFacts,
	servicePricingView,
} from "@/lib/services";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";

import {
	pricingSettingsQuery,
	serviceCategoriesQuery,
	servicesQuery,
} from "./service-queries";
import { TargetMarginDialog } from "./target-margin-dialog";

const route = getRouteApi("/_app/catalogo-produtos/servicos/");

const allCategories = "*";
const withoutCategory = "-";
const namedCategory = (name: string) => `c:${name}`;

function categoryChoice(
	categoria: string | undefined,
	semCategoria: 1 | undefined
): string {
	if (semCategoria === 1) {
		return withoutCategory;
	}
	return categoria === undefined ? allCategories : namedCategory(categoria);
}

function categorySearch(choice: string) {
	if (choice === allCategories) {
		return { categoria: undefined, semCategoria: undefined };
	}
	if (choice === withoutCategory) {
		return { categoria: undefined, semCategoria: 1 as const };
	}
	return { categoria: choice.slice(2), semCategoria: undefined };
}

function emptyState(search: string, archived: boolean, filtered: boolean) {
	if (filtered) {
		return {
			hint: "Troque a categoria no filtro para ver os outros serviços.",
			title: "Nenhum serviço nesta categoria",
		};
	}
	if (search) {
		return {
			hint: "Busque pelo nome do serviço ou pela categoria.",
			title: "Nenhum serviço encontrado",
		};
	}
	if (archived) {
		return {
			hint: "Serviço arquivado sai das listas do dia a dia e mantém o histórico.",
			title: "Nenhum serviço arquivado",
		};
	}
	return {
		hint: "Cadastre barra, ajuste, conserto ou confecção com o custo e o preço que você cobra.",
		title: "Nenhum serviço ainda",
	};
}

function ServiceRow({
	atelierTarget,
	service,
}: {
	atelierTarget: number | undefined;
	service: ServiceView;
}) {
	const view =
		atelierTarget === undefined
			? null
			: servicePricingView(service, atelierTarget);
	const facts = servicePriceFacts(service);
	const belowTarget = view?.pricing?.belowTarget === true;
	const margin =
		facts.marginBasisPoints === null
			? "Sem preço"
			: formatMarginPercent(facts.marginBasisPoints);
	const details = [
		service.category ?? "Sem categoria",
		service.estimatedMinutes === null
			? null
			: formatMinutes(service.estimatedMinutes),
	]
		.filter(Boolean)
		.join(" · ");
	return (
		<DataListRow>
			<DataListCell label="Serviço">
				<ButtonLink
					className="h-auto min-h-11 justify-start whitespace-normal px-0 text-left font-semibold md:min-h-0"
					render={
						<Link
							params={{ servicoId: service.id }}
							to="/catalogo-produtos/servicos/$servicoId"
						/>
					}
					variant="link"
				>
					{service.name}
				</ButtonLink>
				<Text size="xs" tone="muted">
					{details}
				</Text>
				<div className="flex flex-wrap gap-1">
					{service.outsourced ? <Badge>terceirizado</Badge> : null}
					{service.archivedAt ? <Badge tone="warning">arquivado</Badge> : null}
					{facts.belowCost ? (
						<Badge tone="danger">abaixo do custo</Badge>
					) : null}
					{belowTarget && !facts.belowCost ? (
						<Badge tone="warning">abaixo da meta</Badge>
					) : null}
				</div>
			</DataListCell>
			<DataListCell align="end" label="Custo">
				<Text inline numeric>
					{moneyLabel(service.costCents)}
				</Text>
			</DataListCell>
			<DataListCell align="end" label="Preço">
				<Text inline numeric weight="semibold">
					{moneyLabel(service.priceCents)}
				</Text>
			</DataListCell>
			<DataListCell align="end" label="Margem">
				<Text inline numeric>
					{margin}
				</Text>
			</DataListCell>
			<DataListCell align="end" label="Sugerido">
				<Text inline numeric>
					{view ? moneyLabel(view.suggestedCents) : "..."}
				</Text>
				{view?.ownTarget ? (
					<Text size="xs" tone="muted">
						{`meta própria ${formatMarginPercent(view.targetMarginBasisPoints)}`}
					</Text>
				) : null}
			</DataListCell>
		</DataListRow>
	);
}

export function ServiceListPage() {
	const { arquivados, busca = "", categoria, semCategoria } = route.useSearch();
	const navigate = route.useNavigate();
	const archived = arquivados === 1;
	const [query, setQuery] = useState(busca);
	const [marginOpen, setMarginOpen] = useState(false);
	const { opIdFor, reset } = useOpId();
	const categories = useQuery(serviceCategoriesQuery());
	const settings = useQuery(pricingSettingsQuery());
	usePageHeader({ eyebrow: "Catálogo", heading: "Serviços" });

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
		servicesQuery({
			archived,
			category: semCategoria === 1 ? "" : categoria,
			query: busca || undefined,
		})
	);
	const items = list.data?.pages.flatMap((page) => page.items) ?? [];
	const empty = emptyState(
		busca,
		archived,
		categoria !== undefined || semCategoria === 1
	);
	const atelierTarget = settings.data?.targetMarginBasisPoints;
	const categoryItems = [
		{ label: "Todas as categorias", value: allCategories },
		{ label: "Sem categoria", value: withoutCategory },
		...(categories.data?.categories ?? []).map((name) => ({
			label: name,
			value: namedCategory(name),
		})),
	];
	const targetLabel =
		atelierTarget === undefined ? "..." : formatMarginPercent(atelierTarget);
	const settingsFailed = settings.isError && !settings.data;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Heading className="max-md:sr-only">Serviços</Heading>
				<ButtonLink
					className="max-md:w-full"
					render={<Link to="/catalogo-produtos/servicos/novo" />}
				>
					Novo serviço
				</ButtonLink>
			</div>
			<Panel>
				<PanelContent className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-col gap-0.5">
						<Text weight="semibold">
							{`Meta de margem do ateliê: ${targetLabel}`}
						</Text>
						{settingsFailed ? (
							<Text size="sm" tone="danger">
								Não foi possível carregar a meta. A margem e o aviso de custo
								continuam valendo; a sugestão volta com a meta.
							</Text>
						) : (
							<Text size="sm" tone="muted">
								Sugere o preço de todo serviço sem meta própria. Só você vê.
							</Text>
						)}
					</div>
					{settingsFailed ? (
						<Button onClick={() => settings.refetch()} variant="outline">
							Tentar de novo
						</Button>
					) : (
						<Button
							disabled={!settings.data}
							onClick={() => setMarginOpen(true)}
							variant="outline"
						>
							Alterar meta
						</Button>
					)}
				</PanelContent>
			</Panel>
			<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<Field className="md:w-96">
					<FieldLabel>Buscar</FieldLabel>
					<Input
						maxLength={100}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Nome ou categoria"
						type="search"
						value={query}
					/>
				</Field>
				<Field className="md:w-64">
					<FieldLabel>Categoria</FieldLabel>
					<Select
						items={categoryItems}
						onValueChange={(value) =>
							navigate({
								search: (previous) => ({
									...previous,
									...categorySearch(value),
								}),
							})
						}
						value={categoryChoice(categoria, semCategoria)}
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
				{list.isError ? (
					<PanelContent>
						<Text tone="danger">
							{clientCommandFailure(list.error, "serviço").message}
						</Text>
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
						aria-label="Serviços"
						columns="minmax(0,1fr) 7rem 7rem 6rem 8rem"
					>
						<DataListHeader>
							<DataListHeaderCell>Serviço</DataListHeaderCell>
							<DataListHeaderCell align="end">Custo</DataListHeaderCell>
							<DataListHeaderCell align="end">Preço</DataListHeaderCell>
							<DataListHeaderCell align="end">Margem</DataListHeaderCell>
							<DataListHeaderCell align="end">Sugerido</DataListHeaderCell>
						</DataListHeader>
						{items.map((item) => (
							<ServiceRow
								atelierTarget={atelierTarget}
								key={item.id}
								service={item}
							/>
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
			{settings.data ? (
				<TargetMarginDialog
					onOpenChange={setMarginOpen}
					onSaved={reset}
					open={marginOpen}
					opIdFor={opIdFor}
					settings={settings.data}
				/>
			) : null}
		</div>
	);
}

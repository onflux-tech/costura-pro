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
import { usePageHeader } from "@/shell/page-header";
import { orpc } from "@/utils/orpc";

import { materialCategoriesQuery } from "./material-queries";

const route = getRouteApi("/_app/catalogo-produtos/materiais/");

const allCategories = "todas";
const withoutCategory = "sem-categoria";

function categoryInput(choice: string): string | undefined {
	if (choice === allCategories) {
		return;
	}
	return choice === withoutCategory ? "" : choice;
}

function emptyState(search: string, archived: boolean) {
	if (search) {
		return {
			hint: "Busque pelo nome do material, pelo nome da variante ou pelo código.",
			title: "Nenhum material encontrado",
		};
	}
	if (archived) {
		return {
			hint: "Material arquivado sai das listas do dia a dia e mantém o histórico.",
			title: "Nenhum material arquivado",
		};
	}
	return {
		hint: "Cadastre o material base e depois as variantes de cor, tamanho ou especificação.",
		title: "Nenhum material ainda",
	};
}

export function MaterialListPage() {
	const { arquivados, busca = "", categoria } = route.useSearch();
	const navigate = route.useNavigate();
	const archived = arquivados === 1;
	const [query, setQuery] = useState(busca);
	const categories = useQuery(materialCategoriesQuery());
	usePageHeader({ eyebrow: "Catálogo", heading: "Materiais" });

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
		orpc.materials.list.infiniteOptions({
			getNextPageParam: (page) => page.nextOffset ?? undefined,
			initialPageParam: 0,
			input: (offset: number) => ({
				archived,
				category: categoryInput(categoria ?? allCategories),
				offset,
				query: busca || undefined,
			}),
			meta: { silent: true },
		})
	);
	const items = list.data?.pages.flatMap((page) => page.items) ?? [];
	const empty = emptyState(busca, archived);
	const categoryItems = [
		{ label: "Todas as categorias", value: allCategories },
		{ label: "Sem categoria", value: withoutCategory },
		...(categories.data?.categories ?? []).map((name) => ({
			label: name,
			value: name,
		})),
	];

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Heading className="max-md:sr-only">Materiais</Heading>
				<ButtonLink
					className="max-md:w-full"
					render={<Link to="/catalogo-produtos/materiais/novo" />}
				>
					Novo material
				</ButtonLink>
			</div>
			<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<Field className="md:w-96">
					<FieldLabel>Buscar</FieldLabel>
					<Input
						maxLength={100}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Material, variante ou código"
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
									categoria: value === allCategories ? undefined : value,
								}),
							})
						}
						value={categoria ?? allCategories}
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
							{clientCommandFailure(list.error, "material").message}
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
					<DataList aria-label="Materiais" columns="minmax(0,1fr) 10rem 7rem">
						<DataListHeader>
							<DataListHeaderCell>Material</DataListHeaderCell>
							<DataListHeaderCell>Categoria</DataListHeaderCell>
							<DataListHeaderCell align="end">Variantes</DataListHeaderCell>
						</DataListHeader>
						{items.map((item) => (
							<DataListRow key={item.id}>
								<DataListCell label="Material">
									<ButtonLink
										className="h-auto min-h-11 justify-start whitespace-normal px-0 text-left font-semibold md:min-h-0"
										render={
											<Link
												params={{ materialId: item.id }}
												to="/catalogo-produtos/materiais/$materialId"
											/>
										}
										variant="link"
									>
										{item.name}
									</ButtonLink>
									{item.archivedAt ? (
										<Badge tone="warning">arquivado</Badge>
									) : null}
								</DataListCell>
								<DataListCell label="Categoria">
									{item.category ?? "Sem categoria"}
								</DataListCell>
								<DataListCell align="end" label="Variantes">
									<Text inline numeric>
										{String(item.variantCount)}
									</Text>
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
					Carregar mais
				</Button>
			) : null}
		</div>
	);
}

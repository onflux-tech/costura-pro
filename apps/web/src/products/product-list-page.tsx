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
import { Photo } from "@costura-pro/ui/components/photo";
import { Select } from "@costura-pro/ui/components/select";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ShirtIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { clientCommandFailure } from "@/lib/client-command-error";
import { photoUrl } from "@/lib/media";
import { priceRangeLabel } from "@/lib/products";
import { usePageHeader } from "@/shell/page-header";

import { productCategoriesQuery, productsQuery } from "./product-queries";

const route = getRouteApi("/_app/catalogo-produtos/produtos/");

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
			hint: "Troque a categoria no filtro para ver os outros produtos.",
			title: "Nenhum produto nesta categoria",
		};
	}
	if (search) {
		return {
			hint: "Busque pelo nome do produto, pela categoria, pelo nome da variante ou pelo código.",
			title: "Nenhum produto encontrado",
		};
	}
	if (archived) {
		return {
			hint: "Produto arquivado sai das listas do dia a dia e mantém o histórico.",
			title: "Nenhum produto arquivado",
		};
	}
	return {
		hint: "Cadastre a peça ou o kit que você vende, monte a ficha técnica e crie as variantes de tamanho ou cor.",
		title: "Nenhum produto ainda",
	};
}

type ProductListItem = {
	archivedAt: string | null;
	category: string | null;
	id: string;
	mainPhoto: { photoHash: string; thumbnailHash: string } | null;
	maxPriceCents: string | null;
	minPriceCents: string | null;
	name: string;
	variantCount: number;
};

function ProductRow({ product }: { product: ProductListItem }) {
	return (
		<DataListRow>
			<DataListCell label="Produto">
				<div className="flex min-w-0 items-center gap-3">
					{product.mainPhoto ? (
						<Photo
							alt=""
							className="size-12 shrink-0 rounded-md"
							height={96}
							src={photoUrl(product.mainPhoto.thumbnailHash)}
							width={96}
						/>
					) : (
						<div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
							<ShirtIcon aria-hidden="true" className="size-5" />
						</div>
					)}
					<div className="flex min-w-0 flex-col gap-0.5">
						<ButtonLink
							className="h-auto min-h-11 justify-start whitespace-normal px-0 text-left font-semibold md:min-h-0"
							render={
								<Link
									params={{ produtoId: product.id }}
									to="/catalogo-produtos/produtos/$produtoId"
								/>
							}
							variant="link"
						>
							{product.name}
						</ButtonLink>
						{product.archivedAt ? (
							<Badge tone="warning">arquivado</Badge>
						) : null}
					</div>
				</div>
			</DataListCell>
			<DataListCell label="Categoria">
				{product.category ?? "Sem categoria"}
			</DataListCell>
			<DataListCell align="end" label="Variantes">
				<Text inline numeric>
					{String(product.variantCount)}
				</Text>
			</DataListCell>
			<DataListCell align="end" label="Preço">
				<Text inline numeric>
					{priceRangeLabel(product.minPriceCents, product.maxPriceCents)}
				</Text>
			</DataListCell>
		</DataListRow>
	);
}

export function ProductListPage() {
	const { arquivados, busca = "", categoria, semCategoria } = route.useSearch();
	const navigate = route.useNavigate();
	const archived = arquivados === 1;
	const [query, setQuery] = useState(busca);
	const categories = useQuery(productCategoriesQuery());
	usePageHeader({ eyebrow: "Catálogo", heading: "Produtos" });

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
		productsQuery({
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
	const categoryItems = [
		{ label: "Todas as categorias", value: allCategories },
		{ label: "Sem categoria", value: withoutCategory },
		...(categories.data?.categories ?? []).map((name) => ({
			label: name,
			value: namedCategory(name),
		})),
	];

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Heading className="max-md:sr-only">Produtos</Heading>
				<ButtonLink
					className="max-md:w-full"
					render={<Link to="/catalogo-produtos/produtos/novo" />}
				>
					Novo produto
				</ButtonLink>
			</div>
			<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<Field className="md:w-96">
					<FieldLabel>Buscar</FieldLabel>
					<Input
						maxLength={100}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Produto, variante ou código"
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
							{clientCommandFailure(list.error, "produto").message}
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
						aria-label="Produtos"
						columns="minmax(0,1fr) 10rem 6rem 12rem"
					>
						<DataListHeader>
							<DataListHeaderCell>Produto</DataListHeaderCell>
							<DataListHeaderCell>Categoria</DataListHeaderCell>
							<DataListHeaderCell align="end">Variantes</DataListHeaderCell>
							<DataListHeaderCell align="end">Preço</DataListHeaderCell>
						</DataListHeader>
						{items.map((item) => (
							<ProductRow key={item.id} product={item} />
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

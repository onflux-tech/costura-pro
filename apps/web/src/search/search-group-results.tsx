import { Button } from "@costura-pro/ui/components/button";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import type { GroupPageView, SearchGroupKey } from "@/lib/search";
import { orpc } from "@/utils/orpc";

import {
	ClientRow,
	groupHeadings,
	MaterialRow,
	ProductRow,
	ProfileRow,
	QuoteRow,
	ResultPanel,
	SearchFailure,
	ServiceRow,
} from "./search-results";

function PageRows({ page, query }: { page: GroupPageView; query: string }) {
	switch (page.group) {
		case "clients":
			return page.items.map((hit) => (
				<ClientRow hit={hit} key={hit.id} query={query} />
			));
		case "profiles":
			return page.items.map((hit) => (
				<ProfileRow hit={hit} key={hit.id} query={query} />
			));
		case "quotes":
			return page.items.map((hit) => (
				<QuoteRow hit={hit} key={hit.id} query={query} />
			));
		case "products":
			return page.items.map((hit) => (
				<ProductRow hit={hit} key={hit.id} query={query} />
			));
		case "materials":
			return page.items.map((hit) => (
				<MaterialRow hit={hit} key={hit.id} query={query} />
			));
		default:
			return page.items.map((hit) => (
				<ServiceRow hit={hit} key={hit.id} query={query} />
			));
	}
}

export function GroupResults({
	archived,
	focusField,
	group,
	query,
}: {
	archived: boolean;
	focusField: () => void;
	group: SearchGroupKey;
	query: string;
}) {
	const list = useInfiniteQuery({
		...orpc.search.group.infiniteOptions({
			getNextPageParam: (page) => page.nextOffset ?? undefined,
			initialPageParam: 0,
			input: (offset: number) => ({ archived, group, offset, query }),
			meta: { silent: true },
		}),
		networkMode: "always",
		placeholderData: keepPreviousData,
	});

	if (!list.data) {
		return list.isError ? (
			<SearchFailure
				heading="Não foi possível buscar"
				onRetry={() => {
					list.refetch();
					focusField();
				}}
			/>
		) : (
			<div className="flex flex-col gap-2">
				<Skeleton className="h-24" />
				<Skeleton className="h-24" />
			</div>
		);
	}

	const { pageParams, pages } = list.data;
	const stale = list.isPlaceholderData;
	const moreLabel = list.isFetchingNextPage ? "Carregando..." : "Mostrar mais";
	return (
		<div className="flex flex-col gap-4">
			<div aria-busy={stale} className={stale ? "opacity-60" : undefined}>
				<ResultPanel heading={groupHeadings[group]}>
					{pages.map((page, index) => (
						<PageRows key={pageParams[index]} page={page} query={query} />
					))}
				</ResultPanel>
			</div>
			{list.isFetchNextPageError ? (
				<SearchFailure
					description="Confira a conexão com o servidor e toque em Mostrar mais para tentar de novo."
					heading="Não foi possível carregar mais"
				/>
			) : null}
			{list.hasNextPage ? (
				<Button
					disabled={list.isFetchingNextPage || stale}
					onClick={() => list.fetchNextPage()}
					variant="outline"
				>
					{moreLabel}
				</Button>
			) : null}
		</div>
	);
}

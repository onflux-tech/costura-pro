import type { QueryClient } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";

export function serviceOrdersQuery(input: { query?: string }) {
	return orpc.serviceOrders.list.infiniteOptions({
		getNextPageParam: (page) => page.nextOffset ?? undefined,
		initialPageParam: 0,
		input: (offset: number) => ({ ...input, offset }),
		meta: { silent: true },
	});
}

export function serviceOrderQuery(serviceOrderId: string) {
	return orpc.serviceOrders.get.queryOptions({
		input: { serviceOrderId },
		meta: { silent: true },
	});
}

export async function refreshServiceOrders(queryClient: QueryClient) {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: orpc.serviceOrders.key() }),
		queryClient.invalidateQueries({ queryKey: orpc.quotes.key() }),
		queryClient.invalidateQueries({ queryKey: orpc.stockBalances.key() }),
		queryClient.invalidateQueries({ queryKey: orpc.materials.key() }),
		queryClient.invalidateQueries({ queryKey: orpc.search.key() }),
	]);
}

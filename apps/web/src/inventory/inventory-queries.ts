import type { QueryClient } from "@tanstack/react-query";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import { sessionEnded } from "@/lib/command-error";
import { sessionQuery } from "@/lib/session";
import { refreshStock } from "@/stock/stock-queries";
import { orpc } from "@/utils/orpc";

export function inventorySessionsQuery() {
	return orpc.inventorySessions.list.infiniteOptions({
		getNextPageParam: (page) => page.nextOffset ?? undefined,
		initialPageParam: 0,
		input: (offset: number) => ({ offset }),
		meta: { silent: true },
	});
}

export function inventorySessionQuery(sessionId: string) {
	return orpc.inventorySessions.get.queryOptions({
		input: { sessionId },
		meta: { silent: true },
	});
}

export function stockPointsQuery(locationIds: readonly string[]) {
	return orpc.stockBalances.points.queryOptions({
		input: { locationIds: [...locationIds] },
		meta: { silent: true },
		refetchInterval: 15_000,
	});
}

export async function refreshInventory(queryClient: QueryClient) {
	await queryClient.invalidateQueries({
		queryKey: orpc.inventorySessions.key(),
	});
	await refreshStock(queryClient);
}

export async function failedInventoryCommand(
	queryClient: QueryClient,
	error: unknown
): Promise<ClientCommandFailure> {
	if (sessionEnded(error)) {
		await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
	}
	const failure = clientCommandFailure(error, "contagem");
	if (failure.kind !== "other") {
		await refreshInventory(queryClient);
	}
	return failure;
}

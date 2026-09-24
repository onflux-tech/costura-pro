import type { QuoteStatus } from "@costura-pro/domain/quote";
import type { QueryClient } from "@tanstack/react-query";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import { sessionEnded } from "@/lib/command-error";
import { sessionQuery } from "@/lib/session";
import { orpc } from "@/utils/orpc";

export function quotesQuery(input: {
	archived: boolean;
	query?: string;
	status: QuoteStatus;
	today: string;
}) {
	return orpc.quotes.list.infiniteOptions({
		getNextPageParam: (page) => page.nextOffset ?? undefined,
		initialPageParam: 0,
		input: (offset: number) => ({ ...input, offset }),
		meta: { silent: true },
	});
}

export function quoteQuery(quoteId: string) {
	return orpc.quotes.get.queryOptions({
		input: { quoteId },
		meta: { silent: true },
	});
}

export function clientOptionsQuery(query: string) {
	return orpc.clients.list.queryOptions({
		input: { archived: false, query: query || undefined },
		meta: { silent: true },
	});
}

export function productOptionsQuery(query: string) {
	return orpc.products.list.queryOptions({
		input: { archived: false, query: query || undefined },
		meta: { silent: true },
	});
}

export async function refreshQuotes(queryClient: QueryClient) {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: orpc.quotes.key() }),
		queryClient.invalidateQueries({ queryKey: orpc.search.key() }),
	]);
}

export async function failedQuoteCommand(
	queryClient: QueryClient,
	error: unknown
): Promise<ClientCommandFailure> {
	if (sessionEnded(error)) {
		await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
	}
	const failure = clientCommandFailure(error, "orçamento");
	if (failure.kind !== "other") {
		await refreshQuotes(queryClient);
	}
	return failure;
}

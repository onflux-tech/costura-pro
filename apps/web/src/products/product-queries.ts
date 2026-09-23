import type { QueryClient } from "@tanstack/react-query";

import {
	type ClientCommandFailure,
	type CommandSubject,
	clientCommandFailure,
} from "@/lib/client-command-error";
import { sessionEnded } from "@/lib/command-error";
import { sessionQuery } from "@/lib/session";
import { orpc } from "@/utils/orpc";

export function productsQuery(input: {
	archived: boolean;
	category?: string;
	query?: string;
}) {
	return orpc.products.list.infiniteOptions({
		getNextPageParam: (page) => page.nextOffset ?? undefined,
		initialPageParam: 0,
		input: (offset: number) => ({ ...input, offset }),
		meta: { silent: true },
	});
}

export function productCategoriesQuery() {
	return orpc.products.categories.queryOptions({
		input: {},
		meta: { silent: true },
	});
}

export function productQuery(productId: string) {
	return orpc.products.get.queryOptions({
		input: { productId },
		meta: { silent: true },
	});
}

export function productVariantsByCodeQuery(code: string) {
	return orpc.productVariants.byCode.queryOptions({
		enabled: code !== "",
		input: { code },
		meta: { silent: true },
	});
}

export function serviceOptionsQuery(query: string) {
	return orpc.services.list.queryOptions({
		input: { archived: false, query: query || undefined },
		meta: { silent: true },
	});
}

export async function refreshProducts(queryClient: QueryClient) {
	await queryClient.invalidateQueries({ queryKey: orpc.products.key() });
	await queryClient.invalidateQueries({
		queryKey: orpc.productVariants.key(),
	});
}

export async function failedProductCommand(
	queryClient: QueryClient,
	error: unknown,
	subject: CommandSubject = "produto"
): Promise<ClientCommandFailure> {
	if (sessionEnded(error)) {
		await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
	}
	const failure = clientCommandFailure(error, subject);
	if (failure.kind !== "other") {
		await refreshProducts(queryClient);
	}
	return failure;
}

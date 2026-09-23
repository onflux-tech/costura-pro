import type { QueryClient } from "@tanstack/react-query";

import { refreshFinance } from "@/finance/finance-queries";
import {
	type ClientCommandFailure,
	type CommandSubject,
	clientCommandFailure,
} from "@/lib/client-command-error";
import { sessionEnded } from "@/lib/command-error";
import { sessionQuery } from "@/lib/session";
import { refreshStock } from "@/stock/stock-queries";
import { orpc } from "@/utils/orpc";

export function suppliersQuery(archived = false, query?: string) {
	return orpc.suppliers.list.infiniteOptions({
		getNextPageParam: (page) => page.nextOffset ?? undefined,
		initialPageParam: 0,
		input: (offset: number) => ({ archived, offset, query }),
		meta: { silent: true },
	});
}

export function supplierOptionsQuery() {
	return orpc.suppliers.options.queryOptions({ meta: { silent: true } });
}

export function purchasesQuery(supplierId?: string) {
	return orpc.purchases.list.infiniteOptions({
		getNextPageParam: (page) => page.nextOffset ?? undefined,
		initialPageParam: 0,
		input: (offset: number) => ({ offset, supplierId }),
		meta: { silent: true },
	});
}

export function purchaseQuery(purchaseId: string) {
	return orpc.purchases.get.queryOptions({
		input: { purchaseId },
		meta: { silent: true },
	});
}

export async function refreshPurchases(queryClient: QueryClient) {
	await queryClient.invalidateQueries({ queryKey: orpc.suppliers.key() });
	await queryClient.invalidateQueries({ queryKey: orpc.purchases.key() });
	await refreshFinance(queryClient);
	await refreshStock(queryClient);
}

export async function failedPurchaseCommand(
	queryClient: QueryClient,
	error: unknown,
	subject: CommandSubject = "compra"
): Promise<ClientCommandFailure> {
	if (sessionEnded(error)) {
		await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
	}
	const failure = clientCommandFailure(error, subject);
	if (failure.kind !== "other") {
		await refreshPurchases(queryClient);
	}
	return failure;
}

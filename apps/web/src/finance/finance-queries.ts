import type { ObligationStatus } from "@costura-pro/domain/finance";
import type { QueryClient } from "@tanstack/react-query";

import {
	type ClientCommandFailure,
	type CommandSubject,
	clientCommandFailure,
} from "@/lib/client-command-error";
import { sessionEnded } from "@/lib/command-error";
import { sessionQuery } from "@/lib/session";
import { orpc } from "@/utils/orpc";

export function accountsQuery(archived = false) {
	return orpc.financialAccounts.list.queryOptions({
		input: { archived },
		meta: { silent: true },
	});
}

export function accountMovementsQuery(accountId: string) {
	return orpc.financialMovements.list.queryOptions({
		input: { accountId },
		meta: { silent: true },
	});
}

export function obligationsQuery(status: ObligationStatus) {
	return orpc.obligations.list.infiniteOptions({
		getNextPageParam: (page) => page.nextOffset ?? undefined,
		initialPageParam: 0,
		input: (offset: number) => ({ offset, status }),
		meta: { silent: true },
	});
}

export async function refreshFinance(queryClient: QueryClient) {
	await queryClient.invalidateQueries({
		queryKey: orpc.financialAccounts.key(),
	});
	await queryClient.invalidateQueries({
		queryKey: orpc.financialMovements.key(),
	});
	await queryClient.invalidateQueries({ queryKey: orpc.obligations.key() });
	await queryClient.invalidateQueries({ queryKey: orpc.purchases.key() });
}

export async function failedFinanceCommand(
	queryClient: QueryClient,
	error: unknown,
	subject: CommandSubject = "conta"
): Promise<ClientCommandFailure> {
	if (sessionEnded(error)) {
		await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
	}
	const failure = clientCommandFailure(error, subject);
	if (failure.kind !== "other") {
		await refreshFinance(queryClient);
	}
	return failure;
}

import type { QueryClient } from "@tanstack/react-query";

import {
	type ClientCommandFailure,
	type CommandSubject,
	clientCommandFailure,
} from "@/lib/client-command-error";
import { sessionEnded } from "@/lib/command-error";
import { sessionQuery } from "@/lib/session";
import { orpc } from "@/utils/orpc";

export function servicesQuery(input: {
	archived: boolean;
	category?: string;
	query?: string;
}) {
	return orpc.services.list.infiniteOptions({
		getNextPageParam: (page) => page.nextOffset ?? undefined,
		initialPageParam: 0,
		input: (offset: number) => ({ ...input, offset }),
		meta: { silent: true },
	});
}

export function serviceCategoriesQuery() {
	return orpc.services.categories.queryOptions({
		input: {},
		meta: { silent: true },
	});
}

export function serviceQuery(serviceId: string) {
	return orpc.services.get.queryOptions({
		input: { serviceId },
		meta: { silent: true },
	});
}

export function pricingSettingsQuery() {
	return orpc.pricing.settings.queryOptions({
		input: {},
		meta: { silent: true },
	});
}

export async function refreshServices(queryClient: QueryClient) {
	await queryClient.invalidateQueries({ queryKey: orpc.services.key() });
	await queryClient.invalidateQueries({ queryKey: orpc.pricing.key() });
}

export async function failedServiceCommand(
	queryClient: QueryClient,
	error: unknown,
	subject: CommandSubject = "serviço"
): Promise<ClientCommandFailure> {
	if (sessionEnded(error)) {
		await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
	}
	const failure = clientCommandFailure(error, subject);
	if (failure.kind !== "other") {
		await refreshServices(queryClient);
	}
	return failure;
}

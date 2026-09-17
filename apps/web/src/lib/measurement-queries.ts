import type { QueryClient } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "./client-command-error";
import { sessionEnded } from "./command-error";
import { sessionQuery } from "./session";

export function clientMeasurementsQuery(clientId: string) {
	return orpc.measurements.list.queryOptions({
		input: { clientId },
		meta: { silent: true },
	});
}

export function measurementTemplatesQuery() {
	return orpc.measurementTemplates.list.queryOptions({
		input: {},
		meta: { silent: true },
	});
}

export async function refreshTemplates(queryClient: QueryClient) {
	await queryClient.invalidateQueries({
		queryKey: orpc.measurementTemplates.key(),
	});
}

export async function failedTemplateCommand(
	queryClient: QueryClient,
	error: unknown
): Promise<ClientCommandFailure> {
	if (sessionEnded(error)) {
		await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
	}
	const failure = clientCommandFailure(error, "modelo");
	if (failure.kind !== "other") {
		await refreshTemplates(queryClient);
	}
	return failure;
}

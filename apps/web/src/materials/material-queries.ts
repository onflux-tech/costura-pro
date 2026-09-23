import type { QueryClient } from "@tanstack/react-query";

import {
	type ClientCommandFailure,
	type CommandSubject,
	clientCommandFailure,
} from "@/lib/client-command-error";
import { sessionEnded } from "@/lib/command-error";
import { sessionQuery } from "@/lib/session";
import { orpc } from "@/utils/orpc";

export function materialListQuery(input: {
	archived: boolean;
	category?: string;
	query?: string;
}) {
	return orpc.materials.list.queryOptions({ input, meta: { silent: true } });
}

export function materialCategoriesQuery() {
	return orpc.materials.categories.queryOptions({
		input: {},
		meta: { silent: true },
	});
}

export function materialQuery(materialId: string) {
	return orpc.materials.get.queryOptions({
		input: { materialId },
		meta: { silent: true },
	});
}

export async function refreshMaterials(queryClient: QueryClient) {
	await queryClient.invalidateQueries({ queryKey: orpc.materials.key() });
	await queryClient.invalidateQueries({
		queryKey: orpc.materialVariants.key(),
	});
}

export async function failedMaterialCommand(
	queryClient: QueryClient,
	error: unknown,
	subject: CommandSubject = "material"
): Promise<ClientCommandFailure> {
	if (sessionEnded(error)) {
		await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
	}
	const failure = clientCommandFailure(error, subject);
	if (failure.kind !== "other") {
		await refreshMaterials(queryClient);
	}
	return failure;
}

export function variantSearchQuery(query: string) {
	return orpc.materialVariants.search.queryOptions({
		input: { query: query || undefined },
		meta: { silent: true },
	});
}

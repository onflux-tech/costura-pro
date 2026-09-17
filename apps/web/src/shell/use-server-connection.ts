import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";

export function useServerConnection() {
	const health = useQuery(
		orpc.healthCheck.queryOptions({
			meta: { silent: true },
			refetchInterval: 30_000,
		})
	);
	if (health.isPending) {
		return { label: "Verificando conexão", tone: "warning" } as const;
	}
	if (health.isError) {
		return { label: "Sem conexão com o servidor", tone: "offline" } as const;
	}
	return { label: "Conectado ao servidor", tone: "ok" } as const;
}

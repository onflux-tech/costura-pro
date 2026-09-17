import type { AppRouterClient } from "@costura-pro/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

declare module "@tanstack/react-query" {
	interface Register {
		queryMeta: { silent?: boolean };
	}
}

export function createQueryClient() {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (_error, query) => {
				if (query.meta?.silent) {
					return;
				}
				toast.error("Não foi possível carregar os dados", {
					action: {
						label: "Tentar de novo",
						onClick: () => {
							query.invalidate();
						},
					},
				});
			},
		}),
	});
}

export const queryClient = createQueryClient();

export const link = new RPCLink({
	url: () => new URL("/rpc", window.location.origin),
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);

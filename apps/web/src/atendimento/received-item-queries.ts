import { orpc } from "@/utils/orpc";

export function receivedItemsQuery(clientId: string) {
	return orpc.receivedItems.list.queryOptions({
		input: { clientId },
		meta: { silent: true },
	});
}

import type { Database } from "@costura-pro/db";
import { ORPCError } from "@orpc/server";

import { readClient } from "../clients/store";
import { commandMessages } from "../command-messages";
import { listReceivedItemsOfClient, receivedItemSnapshot } from "./store";

type Reader = Pick<Database, "select">;

export function listClientReceivedItems(db: Reader, clientId: string) {
	if (!readClient(db, clientId)) {
		throw new ORPCError("NOT_FOUND", {
			message: commandMessages.clientNotFound,
		});
	}
	return {
		items: listReceivedItemsOfClient(db, clientId).map((row) => ({
			...receivedItemSnapshot(row),
			updatedAt: row.updatedAt.toISOString(),
		})),
	};
}

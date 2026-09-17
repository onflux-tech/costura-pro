import { readClient } from "../clients/store";
import { commandMessages } from "../command-messages";
import { emptyPayload } from "../schemas";
import type { CreateDefinition } from "../sync/commands";
import {
	archivePatch,
	definedFields,
	unarchivePatch,
	updateCommands,
} from "../update-command";
import { receivedItemCreatePayload, receivedItemPatchPayload } from "./schemas";
import {
	insertReceivedItem,
	isReceivedItemAnonymized,
	type ReceivedItemPatch,
	type ReceivedItemRow,
	readReceivedItem,
	receivedItemSnapshot,
	updateReceivedItem,
} from "./store";

const receivedItemCommand = updateCommands<ReceivedItemRow, ReceivedItemPatch>({
	aggregateType: "receivedItem",
	anonymized: isReceivedItemAnonymized,
	read: readReceivedItem,
	snapshot: receivedItemSnapshot,
	update: updateReceivedItem,
});

const createReceivedItem: CreateDefinition = {
	aggregateType: "receivedItem",
	create: (db, id, values, stamp) => {
		const fields = receivedItemCreatePayload.parse(values);
		const owner = readClient(db, fields.clientId);
		if (!owner) {
			return {
				message: commandMessages.clientNotFound,
				reason: "aggregateNotFound",
			};
		}
		if (owner.anonymizedAt) {
			return { reason: "aggregateAnonymized" };
		}
		return insertReceivedItem(db, id, fields, stamp).version;
	},
	exists: (db, id) => readReceivedItem(db, id) !== undefined,
	kind: "create",
	payload: receivedItemCreatePayload,
};

export const receivedItemCommands = {
	"receivedItem.archive": receivedItemCommand(emptyPayload, archivePatch),
	"receivedItem.create": createReceivedItem,
	"receivedItem.unarchive": receivedItemCommand(emptyPayload, unarchivePatch),
	"receivedItem.update": receivedItemCommand(
		receivedItemPatchPayload,
		(_row, values) => definedFields(values)
	),
};

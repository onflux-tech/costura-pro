import z from "zod";

import { runCreateCommand, runUpdateCommand } from "../aggregate-command";
import { commandMessages } from "../command-messages";
import { readyProcedure } from "../index";
import { opIdSchema } from "../schemas";
import { listClientReceivedItems } from "./queries";
import { receivedItemCreatePayload, receivedItemPatchPayload } from "./schemas";

const itemMessages = {
	anonymized: commandMessages.clientAnonymized,
	notFound: commandMessages.receivedItemNotFound,
};

const versionInput = z.object({
	baseVersion: z.number().int().positive(),
	opId: opIdSchema,
	receivedItemId: z.uuid(),
});

function archiveToggle(
	command: "receivedItem.archive" | "receivedItem.unarchive"
) {
	return readyProcedure.input(versionInput).handler(({ context, input }) =>
		runUpdateCommand(context, {
			aggregateId: input.receivedItemId,
			baseVersion: input.baseVersion,
			command,
			messages: itemMessages,
			opId: input.opId,
			values: {},
		})
	);
}

export const receivedItemsRouter = {
	archive: archiveToggle("receivedItem.archive"),

	create: readyProcedure
		.input(
			receivedItemCreatePayload.extend({
				opId: opIdSchema,
				receivedItemId: z.uuid(),
			})
		)
		.handler(({ context, input: { opId, receivedItemId, ...values } }) =>
			runCreateCommand(context, {
				aggregateId: receivedItemId,
				command: "receivedItem.create",
				messages: {
					anonymized: commandMessages.clientAnonymized,
					notFound: commandMessages.clientNotFound,
				},
				opId,
				values,
			})
		),

	list: readyProcedure
		.input(z.object({ clientId: z.uuid() }))
		.handler(({ context, input }) =>
			listClientReceivedItems(context.db, input.clientId)
		),

	unarchive: archiveToggle("receivedItem.unarchive"),

	update: readyProcedure
		.input(versionInput.extend({ patch: receivedItemPatchPayload }))
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.receivedItemId,
				baseVersion: input.baseVersion,
				command: "receivedItem.update",
				messages: itemMessages,
				opId: input.opId,
				values: input.patch,
			})
		),
};

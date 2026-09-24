import z from "zod";

import { runCreateCommand } from "../aggregate-command";
import { commandMessages } from "../command-messages";
import { readyProcedure } from "../index";
import { opIdSchema } from "../schemas";
import {
	getInventorySession,
	inventorySessionListInput,
	listInventorySessions,
} from "./queries";
import { inventorySessionCreatePayload } from "./schemas";

const sessionMessages = {
	anonymized: commandMessages.inventorySessionNotFound,
	notFound: commandMessages.inventorySessionNotFound,
};

export const inventorySessionsRouter = {
	create: readyProcedure
		.input(
			z.intersection(
				inventorySessionCreatePayload,
				z.object({ opId: opIdSchema, sessionId: z.uuid() })
			)
		)
		.handler(({ context, input }) => {
			const { opId, sessionId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: sessionId,
				command: "inventorySession.create",
				messages: sessionMessages,
				opId,
				values,
			});
		}),
	get: readyProcedure
		.input(z.object({ sessionId: z.uuid() }))
		.handler(({ context, input }) =>
			getInventorySession(context.db, input.sessionId)
		),
	list: readyProcedure
		.input(inventorySessionListInput)
		.handler(({ context, input }) => listInventorySessions(context.db, input)),
};

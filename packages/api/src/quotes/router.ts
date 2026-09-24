import z from "zod";

import { runCreateCommand, runUpdateCommand } from "../aggregate-command";
import { commandMessages } from "../command-messages";
import { readyProcedure } from "../index";
import { opIdSchema } from "../schemas";
import { getQuote, listQuotes, quoteListInput } from "./queries";
import {
	quoteContentPayload,
	quoteCreatePayload,
	quoteEmitPayload,
	quoteRefusePayload,
} from "./schemas";

const quoteMessages = {
	anonymized: commandMessages.clientAnonymized,
	notFound: commandMessages.quoteNotFound,
};

const createMessages = {
	anonymized: commandMessages.clientAnonymized,
	notFound: commandMessages.clientNotFound,
};

const versionInput = z.object({
	baseVersion: z.number().int().positive(),
	opId: opIdSchema,
	quoteId: z.uuid(),
});

function quoteToggle(
	command: "quote.archive" | "quote.unarchive" | "quote.unrefuse"
) {
	return readyProcedure.input(versionInput).handler(({ context, input }) =>
		runUpdateCommand(context, {
			aggregateId: input.quoteId,
			baseVersion: input.baseVersion,
			command,
			messages: quoteMessages,
			opId: input.opId,
			values: {},
		})
	);
}

export const quotesRouter = {
	archive: quoteToggle("quote.archive"),

	create: readyProcedure
		.input(
			z.intersection(
				quoteCreatePayload,
				z.object({ opId: opIdSchema, quoteId: z.uuid() })
			)
		)
		.handler(({ context, input }) => {
			const { opId, quoteId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: quoteId,
				command: "quote.create",
				messages: createMessages,
				opId,
				values,
			});
		}),

	emit: readyProcedure
		.input(
			z.intersection(
				quoteEmitPayload,
				z.object({ opId: opIdSchema, revisionId: z.uuid() })
			)
		)
		.handler(({ context, input }) => {
			const { opId, revisionId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: revisionId,
				command: "quote.emit",
				messages: quoteMessages,
				opId,
				values,
			});
		}),

	get: readyProcedure
		.input(z.object({ quoteId: z.uuid() }))
		.handler(({ context, input }) => getQuote(context.db, input.quoteId)),

	list: readyProcedure
		.input(quoteListInput)
		.handler(({ context, input }) => listQuotes(context.db, input)),

	refuse: readyProcedure
		.input(versionInput.extend(quoteRefusePayload.shape))
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.quoteId,
				baseVersion: input.baseVersion,
				command: "quote.refuse",
				messages: quoteMessages,
				opId: input.opId,
				values: { reason: input.reason, refusedOn: input.refusedOn },
			})
		),

	unarchive: quoteToggle("quote.unarchive"),

	unrefuse: quoteToggle("quote.unrefuse"),

	update: readyProcedure
		.input(versionInput.extend({ content: quoteContentPayload }))
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.quoteId,
				baseVersion: input.baseVersion,
				command: "quote.update",
				messages: quoteMessages,
				opId: input.opId,
				values: input.content,
			})
		),
};

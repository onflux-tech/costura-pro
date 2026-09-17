import z from "zod";

import { runCreateCommand, runUpdateCommand } from "../aggregate-command";
import { commandMessages } from "../command-messages";
import { readyLocalProcedure, readyProcedure } from "../index";
import { opIdSchema } from "../schemas";
import { anonymizeClient } from "./anonymize";
import { clientListInput, getClient, listClients } from "./queries";
import {
	clientCreatePayload,
	clientPatchPayload,
	profileCreatePayload,
	profilePatchPayload,
} from "./schemas";

const clientMessages = {
	anonymized: commandMessages.clientAnonymized,
	notFound: commandMessages.clientNotFound,
};

const profileMessages = {
	anonymized: commandMessages.clientAnonymized,
	notFound: commandMessages.profileNotFound,
};

const baseVersionSchema = z.number().int().positive();

const clientVersionInput = z.object({
	baseVersion: baseVersionSchema,
	clientId: z.uuid(),
	opId: opIdSchema,
});

const profileVersionInput = z.object({
	baseVersion: baseVersionSchema,
	opId: opIdSchema,
	profileId: z.uuid(),
});

export const clientsRouter = {
	anonymize: readyLocalProcedure
		.input(clientVersionInput)
		.handler(({ context, input }) => anonymizeClient(context, input)),

	archive: readyProcedure
		.input(clientVersionInput)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.clientId,
				baseVersion: input.baseVersion,
				command: "client.archive",
				messages: clientMessages,
				opId: input.opId,
				values: {},
			})
		),

	create: readyProcedure
		.input(clientCreatePayload.extend({ clientId: z.uuid(), opId: opIdSchema }))
		.handler(({ context, input: { clientId, opId, ...values } }) =>
			runCreateCommand(context, {
				aggregateId: clientId,
				command: "client.create",
				messages: clientMessages,
				opId,
				values,
			})
		),

	get: readyProcedure
		.input(z.object({ clientId: z.uuid() }))
		.handler(({ context, input }) => getClient(context.db, input.clientId)),

	list: readyProcedure
		.input(clientListInput)
		.handler(({ context, input }) => listClients(context.db, input)),

	unarchive: readyProcedure
		.input(clientVersionInput)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.clientId,
				baseVersion: input.baseVersion,
				command: "client.unarchive",
				messages: clientMessages,
				opId: input.opId,
				values: {},
			})
		),

	update: readyProcedure
		.input(clientVersionInput.extend({ patch: clientPatchPayload }))
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.clientId,
				baseVersion: input.baseVersion,
				command: "client.update",
				messages: clientMessages,
				opId: input.opId,
				values: input.patch,
			})
		),
};

export const profilesRouter = {
	archive: readyProcedure
		.input(profileVersionInput)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.profileId,
				baseVersion: input.baseVersion,
				command: "profile.archive",
				messages: profileMessages,
				opId: input.opId,
				values: {},
			})
		),

	create: readyProcedure
		.input(
			profileCreatePayload.extend({ opId: opIdSchema, profileId: z.uuid() })
		)
		.handler(({ context, input: { opId, profileId, ...values } }) =>
			runCreateCommand(context, {
				aggregateId: profileId,
				command: "profile.create",
				messages: clientMessages,
				opId,
				values,
			})
		),

	unarchive: readyProcedure
		.input(profileVersionInput)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.profileId,
				baseVersion: input.baseVersion,
				command: "profile.unarchive",
				messages: profileMessages,
				opId: input.opId,
				values: {},
			})
		),

	update: readyProcedure
		.input(profileVersionInput.extend({ patch: profilePatchPayload }))
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.profileId,
				baseVersion: input.baseVersion,
				command: "profile.update",
				messages: profileMessages,
				opId: input.opId,
				values: input.patch,
			})
		),
};

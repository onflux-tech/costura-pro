import z from "zod";

import { runCreateCommand, runUpdateCommand } from "../aggregate-command";
import { commandMessages } from "../command-messages";
import { readyProcedure } from "../index";
import { opIdSchema } from "../schemas";
import { listClientMeasurements, listTemplateItems } from "./queries";
import {
	measurementCreatePayload,
	measurementPatchPayload,
	templateCreatePayload,
	templatePatchPayload,
} from "./schemas";

const templateMessages = {
	anonymized: commandMessages.clientAnonymized,
	notFound: commandMessages.measurementTemplateNotFound,
};

const baseVersionSchema = z.number().int().positive();

const templateVersionInput = z.object({
	baseVersion: baseVersionSchema,
	opId: opIdSchema,
	templateId: z.uuid(),
});

export const measurementTemplatesRouter = {
	archive: readyProcedure
		.input(templateVersionInput)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.templateId,
				baseVersion: input.baseVersion,
				command: "measurementTemplate.archive",
				messages: templateMessages,
				opId: input.opId,
				values: {},
			})
		),

	create: readyProcedure
		.input(
			templateCreatePayload.extend({ opId: opIdSchema, templateId: z.uuid() })
		)
		.handler(({ context, input: { opId, templateId, ...values } }) =>
			runCreateCommand(context, {
				aggregateId: templateId,
				command: "measurementTemplate.create",
				messages: templateMessages,
				opId,
				values,
			})
		),

	list: readyProcedure
		.input(z.object({}))
		.handler(({ context }) => listTemplateItems(context.db)),

	unarchive: readyProcedure
		.input(templateVersionInput)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.templateId,
				baseVersion: input.baseVersion,
				command: "measurementTemplate.unarchive",
				messages: templateMessages,
				opId: input.opId,
				values: {},
			})
		),

	update: readyProcedure
		.input(templateVersionInput.extend({ patch: templatePatchPayload }))
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.templateId,
				baseVersion: input.baseVersion,
				command: "measurementTemplate.update",
				messages: templateMessages,
				opId: input.opId,
				values: input.patch,
			})
		),
};

const measurementMessages = {
	anonymized: commandMessages.clientAnonymized,
	notFound: commandMessages.measurementNotFound,
};

const measurementVersionInput = z.object({
	baseVersion: baseVersionSchema,
	measurementId: z.uuid(),
	opId: opIdSchema,
});

function measurementUpdate(
	command: "measurement.archive" | "measurement.unarchive"
) {
	return readyProcedure
		.input(measurementVersionInput)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.measurementId,
				baseVersion: input.baseVersion,
				command,
				messages: measurementMessages,
				opId: input.opId,
				values: {},
			})
		);
}

export const measurementsRouter = {
	archive: measurementUpdate("measurement.archive"),

	create: readyProcedure
		.input(
			measurementCreatePayload.extend({
				measurementId: z.uuid(),
				opId: opIdSchema,
			})
		)
		.handler(({ context, input: { measurementId, opId, ...values } }) =>
			runCreateCommand(context, {
				aggregateId: measurementId,
				command: "measurement.create",
				messages: {
					anonymized: commandMessages.clientAnonymized,
					notFound: commandMessages.profileNotFound,
				},
				opId,
				values,
			})
		),

	list: readyProcedure
		.input(z.object({ clientId: z.uuid() }))
		.handler(({ context, input }) =>
			listClientMeasurements(context.db, input.clientId)
		),

	unarchive: measurementUpdate("measurement.unarchive"),

	update: readyProcedure
		.input(measurementVersionInput.extend({ patch: measurementPatchPayload }))
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.measurementId,
				baseVersion: input.baseVersion,
				command: "measurement.update",
				messages: measurementMessages,
				opId: input.opId,
				values: input.patch,
			})
		),
};

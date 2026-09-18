import z from "zod";

import { runCreateCommand, runUpdateCommand } from "../aggregate-command";
import { commandMessages } from "../command-messages";
import { readyProcedure } from "../index";
import { readInstallation } from "../installation/store";
import { opIdSchema } from "../schemas";
import {
	getService,
	listServiceCategories,
	listServices,
	pricingSettings,
	serviceListInput,
} from "./queries";
import {
	serviceCreatePayload,
	servicePatchPayload,
	targetMarginPayload,
} from "./schemas";

const serviceMessages = {
	anonymized: commandMessages.serviceNotFound,
	notFound: commandMessages.serviceNotFound,
};

const installationMessages = {
	anonymized: commandMessages.installationNotFound,
	notFound: commandMessages.installationNotFound,
};

const baseVersionField = z.number().int().positive();

const serviceVersionInput = z.object({
	baseVersion: baseVersionField,
	opId: opIdSchema,
	serviceId: z.uuid(),
});

function serviceArchiveToggle(
	command: "service.archive" | "service.unarchive"
) {
	return readyProcedure
		.input(serviceVersionInput)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.serviceId,
				baseVersion: input.baseVersion,
				command,
				messages: serviceMessages,
				opId: input.opId,
				values: {},
			})
		);
}

export const servicesRouter = {
	archive: serviceArchiveToggle("service.archive"),

	categories: readyProcedure
		.input(z.object({}))
		.handler(({ context }) => listServiceCategories(context.db)),

	create: readyProcedure
		.input(
			serviceCreatePayload.extend({ opId: opIdSchema, serviceId: z.uuid() })
		)
		.handler(({ context, input: { opId, serviceId, ...values } }) =>
			runCreateCommand(context, {
				aggregateId: serviceId,
				command: "service.create",
				messages: serviceMessages,
				opId,
				values,
			})
		),

	get: readyProcedure
		.input(z.object({ serviceId: z.uuid() }))
		.handler(({ context, input }) => getService(context.db, input.serviceId)),

	list: readyProcedure
		.input(serviceListInput)
		.handler(({ context, input }) => listServices(context.db, input)),

	unarchive: serviceArchiveToggle("service.unarchive"),

	update: readyProcedure
		.input(serviceVersionInput.extend({ patch: servicePatchPayload }))
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.serviceId,
				baseVersion: input.baseVersion,
				command: "service.update",
				messages: serviceMessages,
				opId: input.opId,
				values: input.patch,
			})
		),
};

export const pricingRouter = {
	setTargetMargin: readyProcedure
		.input(
			targetMarginPayload.extend({
				baseVersion: baseVersionField,
				opId: opIdSchema,
			})
		)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: readInstallation(context.db).id,
				baseVersion: input.baseVersion,
				command: "installation.setTargetMargin",
				messages: installationMessages,
				opId: input.opId,
				values: { targetMarginBasisPoints: input.targetMarginBasisPoints },
			})
		),

	settings: readyProcedure
		.input(z.object({}))
		.handler(({ context }) => pricingSettings(context.db)),
};

import z from "zod";

import { runCreateCommand, runUpdateCommand } from "../aggregate-command";
import { commandMessages } from "../command-messages";
import { readyProcedure } from "../index";
import {
	reconciliationCreatePayload,
	reconciliationReversePayload,
} from "../reconciliation/schemas";
import { opIdSchema } from "../schemas";
import {
	boardOf,
	getServiceOrder,
	listServiceOrders,
	serviceOrderListInput,
} from "./queries";
import { productionStartPayload } from "./schemas";

const baseVersionField = z.number().int().positive();

const serviceOrderMessages = {
	anonymized: commandMessages.clientAnonymized,
	notFound: commandMessages.serviceOrderNotFound,
};

const itemMessages = {
	anonymized: commandMessages.clientAnonymized,
	notFound: commandMessages.productionItemNotFound,
};

const itemVersionInput = z.object({
	baseVersion: baseVersionField,
	itemId: z.uuid(),
	opId: opIdSchema,
});

function itemStep(
	command: "serviceOrderItem.advance" | "serviceOrderItem.back"
) {
	return readyProcedure.input(itemVersionInput).handler(({ context, input }) =>
		runUpdateCommand(context, {
			aggregateId: input.itemId,
			baseVersion: input.baseVersion,
			command,
			messages: itemMessages,
			opId: input.opId,
			values: {},
		})
	);
}

export const serviceOrdersRouter = {
	adoptCurrentFlow: readyProcedure
		.input(
			z.object({
				baseVersion: baseVersionField,
				opId: opIdSchema,
				serviceOrderId: z.uuid(),
			})
		)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.serviceOrderId,
				baseVersion: input.baseVersion,
				command: "serviceOrder.adoptCurrentFlow",
				messages: serviceOrderMessages,
				opId: input.opId,
				values: {},
			})
		),

	get: readyProcedure
		.input(z.object({ serviceOrderId: z.uuid() }))
		.handler(({ context, input }) =>
			getServiceOrder(context.db, input.serviceOrderId)
		),

	list: readyProcedure
		.input(serviceOrderListInput)
		.handler(({ context, input }) => listServiceOrders(context.db, input)),
};

export const serviceOrderItemsRouter = {
	advance: itemStep("serviceOrderItem.advance"),

	back: itemStep("serviceOrderItem.back"),

	board: readyProcedure
		.input(z.object({}))
		.handler(({ context }) => boardOf(context.db)),

	reconcile: readyProcedure
		.input(
			z.intersection(
				reconciliationCreatePayload,
				z.object({ opId: opIdSchema, reconciliationId: z.uuid() })
			)
		)
		.handler(({ context, input }) => {
			const { opId, reconciliationId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: reconciliationId,
				command: "materialReconciliation.create",
				messages: itemMessages,
				opId,
				values,
			});
		}),

	reverseReconciliation: readyProcedure
		.input(
			z.intersection(
				reconciliationReversePayload,
				z.object({ opId: opIdSchema, reversalId: z.uuid() })
			)
		)
		.handler(({ context, input }) => {
			const { opId, reversalId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: reversalId,
				command: "materialReconciliation.reverse",
				messages: {
					anonymized: commandMessages.clientAnonymized,
					notFound: commandMessages.reconciliationNotFound,
				},
				opId,
				values,
			});
		}),

	start: readyProcedure
		.input(
			productionStartPayload.extend({
				baseVersion: baseVersionField,
				itemId: z.uuid(),
				opId: opIdSchema,
			})
		)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.itemId,
				baseVersion: input.baseVersion,
				command: "serviceOrderItem.start",
				messages: itemMessages,
				opId: input.opId,
				values: { stageIds: input.stageIds },
			})
		),
};

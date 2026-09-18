import z from "zod";

import { runCreateCommand, runUpdateCommand } from "../aggregate-command";
import { commandMessages } from "../command-messages";
import { readyProcedure } from "../index";
import { opIdSchema } from "../schemas";
import { listFinancialAccounts, listFinancialMovements } from "./queries";
import {
	financialAccountCreatePayload,
	financialAccountPatchPayload,
	financialMovementCreatePayload,
	financialMovementReversePayload,
	financialMovementTransferPayload,
} from "./schemas";

const accountMessages = {
	anonymized: commandMessages.financialAccountNotFound,
	notFound: commandMessages.financialAccountNotFound,
};

const movementMessages = {
	anonymized: commandMessages.financialMovementNotFound,
	notFound: commandMessages.financialMovementNotFound,
};

const accountVersionInput = z.object({
	accountId: z.uuid(),
	baseVersion: z.number().int().positive(),
	opId: opIdSchema,
});

function accountArchiveToggle(
	command: "financialAccount.archive" | "financialAccount.unarchive"
) {
	return readyProcedure
		.input(accountVersionInput)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.accountId,
				baseVersion: input.baseVersion,
				command,
				messages: accountMessages,
				opId: input.opId,
				values: {},
			})
		);
}

export const financialAccountsRouter = {
	archive: accountArchiveToggle("financialAccount.archive"),
	create: readyProcedure
		.input(
			financialAccountCreatePayload.extend({
				accountId: z.uuid(),
				opId: opIdSchema,
			})
		)
		.handler(({ context, input }) => {
			const { accountId, opId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: accountId,
				command: "financialAccount.create",
				messages: accountMessages,
				opId,
				values,
			});
		}),
	list: readyProcedure
		.input(z.object({ archived: z.boolean().default(false) }))
		.handler(({ context, input }) =>
			listFinancialAccounts(context.db, input.archived)
		),
	unarchive: accountArchiveToggle("financialAccount.unarchive"),
	update: readyProcedure
		.input(
			z.object({
				accountId: z.uuid(),
				baseVersion: z.number().int().positive(),
				opId: opIdSchema,
				patch: financialAccountPatchPayload,
			})
		)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.accountId,
				baseVersion: input.baseVersion,
				command: "financialAccount.update",
				messages: accountMessages,
				opId: input.opId,
				values: input.patch,
			})
		),
};

export const financialMovementsRouter = {
	create: readyProcedure
		.input(
			financialMovementCreatePayload.extend({
				movementId: z.uuid(),
				opId: opIdSchema,
			})
		)
		.handler(({ context, input }) => {
			const { movementId, opId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: movementId,
				command: "financialMovement.create",
				messages: movementMessages,
				opId,
				values,
			});
		}),
	list: readyProcedure
		.input(z.object({ accountId: z.uuid() }))
		.handler(({ context, input }) =>
			listFinancialMovements(context.db, input.accountId)
		),
	reverse: readyProcedure
		.input(
			financialMovementReversePayload.extend({
				movementId: z.uuid(),
				opId: opIdSchema,
			})
		)
		.handler(({ context, input }) => {
			const { movementId, opId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: movementId,
				command: "financialMovement.reverse",
				messages: movementMessages,
				opId,
				values,
			});
		}),
	transfer: readyProcedure
		.input(
			z.intersection(
				financialMovementTransferPayload,
				z.object({ movementId: z.uuid(), opId: opIdSchema })
			)
		)
		.handler(({ context, input }) => {
			const { movementId, opId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: movementId,
				command: "financialMovement.transfer",
				messages: movementMessages,
				opId,
				values,
			});
		}),
};

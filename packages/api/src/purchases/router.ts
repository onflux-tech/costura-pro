import z from "zod";

import { runCreateCommand, runUpdateCommand } from "../aggregate-command";
import { commandMessages } from "../command-messages";
import { readyProcedure } from "../index";
import { opIdSchema } from "../schemas";
import {
	getPurchase,
	listObligations,
	listPurchases,
	listSupplierOptions,
	listSuppliers,
	obligationListInput,
	purchaseListInput,
	supplierListInput,
} from "./queries";
import {
	obligationPayPayload,
	purchaseCreatePayload,
	purchaseReversePayload,
	supplierCreatePayload,
	supplierPatchPayload,
} from "./schemas";

const supplierMessages = {
	anonymized: commandMessages.supplierNotFound,
	notFound: commandMessages.supplierNotFound,
};

const purchaseMessages = {
	anonymized: commandMessages.purchaseNotFound,
	notFound: commandMessages.purchaseNotFound,
};

const obligationMessages = {
	anonymized: commandMessages.obligationNotFound,
	notFound: commandMessages.obligationNotFound,
};

const supplierVersionInput = z.object({
	baseVersion: z.number().int().positive(),
	opId: opIdSchema,
	supplierId: z.uuid(),
});

function supplierArchiveToggle(
	command: "supplier.archive" | "supplier.unarchive"
) {
	return readyProcedure
		.input(supplierVersionInput)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.supplierId,
				baseVersion: input.baseVersion,
				command,
				messages: supplierMessages,
				opId: input.opId,
				values: {},
			})
		);
}

export const suppliersRouter = {
	archive: supplierArchiveToggle("supplier.archive"),
	create: readyProcedure
		.input(
			supplierCreatePayload.extend({
				opId: opIdSchema,
				supplierId: z.uuid(),
			})
		)
		.handler(({ context, input }) => {
			const { opId, supplierId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: supplierId,
				command: "supplier.create",
				messages: supplierMessages,
				opId,
				values,
			});
		}),
	list: readyProcedure
		.input(supplierListInput)
		.handler(({ context, input }) => listSuppliers(context.db, input)),
	options: readyProcedure.handler(({ context }) =>
		listSupplierOptions(context.db)
	),
	unarchive: supplierArchiveToggle("supplier.unarchive"),
	update: readyProcedure
		.input(
			z.object({
				baseVersion: z.number().int().positive(),
				opId: opIdSchema,
				patch: supplierPatchPayload,
				supplierId: z.uuid(),
			})
		)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.supplierId,
				baseVersion: input.baseVersion,
				command: "supplier.update",
				messages: supplierMessages,
				opId: input.opId,
				values: input.patch,
			})
		),
};

export const purchasesRouter = {
	create: readyProcedure
		.input(
			z.intersection(
				purchaseCreatePayload,
				z.object({ opId: opIdSchema, purchaseId: z.uuid() })
			)
		)
		.handler(({ context, input }) => {
			const { opId, purchaseId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: purchaseId,
				command: "purchase.create",
				messages: purchaseMessages,
				opId,
				values,
			});
		}),
	get: readyProcedure
		.input(z.object({ purchaseId: z.uuid() }))
		.handler(({ context, input }) => getPurchase(context.db, input.purchaseId)),
	list: readyProcedure
		.input(purchaseListInput)
		.handler(({ context, input }) => listPurchases(context.db, input)),
	reverse: readyProcedure
		.input(
			z.intersection(
				purchaseReversePayload,
				z.object({ opId: opIdSchema, reversalId: z.uuid() })
			)
		)
		.handler(({ context, input }) => {
			const { opId, reversalId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: reversalId,
				command: "purchase.reverse",
				messages: purchaseMessages,
				opId,
				values,
			});
		}),
};

export const obligationsRouter = {
	list: readyProcedure
		.input(obligationListInput)
		.handler(({ context, input }) => listObligations(context.db, input)),
	pay: readyProcedure
		.input(
			obligationPayPayload.extend({
				movementId: z.uuid(),
				opId: opIdSchema,
			})
		)
		.handler(({ context, input }) => {
			const { movementId, opId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: movementId,
				command: "obligation.pay",
				messages: obligationMessages,
				opId,
				values,
			});
		}),
};

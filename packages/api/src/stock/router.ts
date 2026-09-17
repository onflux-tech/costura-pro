import z from "zod";

import { runCreateCommand, runUpdateCommand } from "../aggregate-command";
import { commandMessages } from "../command-messages";
import { readyProcedure } from "../index";
import { opIdSchema } from "../schemas";
import {
	getVariantBalance,
	listStockBalances,
	listStockLocations,
	listStockLots,
	listStockMovements,
	stockBalanceListInput,
} from "./queries";
import {
	stockLocationCreatePayload,
	stockLocationPatchPayload,
	stockLotCreatePayload,
	stockLotPatchPayload,
	stockMovementCreatePayload,
	stockMovementReversePayload,
	stockMovementTransferPayload,
} from "./schemas";

const locationMessages = {
	anonymized: commandMessages.stockLocationNotFound,
	notFound: commandMessages.stockLocationNotFound,
};

const lotMessages = {
	anonymized: commandMessages.stockLotNotFound,
	notFound: commandMessages.stockLotNotFound,
};

const lotCreateMessages = {
	anonymized: commandMessages.materialVariantNotFound,
	notFound: commandMessages.materialVariantNotFound,
};

const movementMessages = {
	anonymized: commandMessages.stockMovementNotFound,
	notFound: commandMessages.stockMovementNotFound,
};

const locationVersionInput = z.object({
	baseVersion: z.number().int().positive(),
	locationId: z.uuid(),
	opId: opIdSchema,
});

const lotVersionInput = z.object({
	baseVersion: z.number().int().positive(),
	lotId: z.uuid(),
	opId: opIdSchema,
});

function locationArchiveToggle(
	command: "stockLocation.archive" | "stockLocation.unarchive"
) {
	return readyProcedure
		.input(locationVersionInput)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.locationId,
				baseVersion: input.baseVersion,
				command,
				messages: locationMessages,
				opId: input.opId,
				values: {},
			})
		);
}

function lotArchiveToggle(command: "stockLot.archive" | "stockLot.unarchive") {
	return readyProcedure.input(lotVersionInput).handler(({ context, input }) =>
		runUpdateCommand(context, {
			aggregateId: input.lotId,
			baseVersion: input.baseVersion,
			command,
			messages: lotMessages,
			opId: input.opId,
			values: {},
		})
	);
}

export const stockLocationsRouter = {
	archive: locationArchiveToggle("stockLocation.archive"),
	create: readyProcedure
		.input(
			stockLocationCreatePayload.extend({
				locationId: z.uuid(),
				opId: opIdSchema,
			})
		)
		.handler(({ context, input }) => {
			const { locationId, opId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: locationId,
				command: "stockLocation.create",
				messages: locationMessages,
				opId,
				values,
			});
		}),
	list: readyProcedure
		.input(z.object({ archived: z.boolean().default(false) }))
		.handler(({ context, input }) =>
			listStockLocations(context.db, input.archived)
		),
	unarchive: locationArchiveToggle("stockLocation.unarchive"),
	update: readyProcedure
		.input(
			z.object({
				baseVersion: z.number().int().positive(),
				locationId: z.uuid(),
				opId: opIdSchema,
				patch: stockLocationPatchPayload,
			})
		)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.locationId,
				baseVersion: input.baseVersion,
				command: "stockLocation.update",
				messages: locationMessages,
				opId: input.opId,
				values: input.patch,
			})
		),
};

export const stockLotsRouter = {
	archive: lotArchiveToggle("stockLot.archive"),
	create: readyProcedure
		.input(stockLotCreatePayload.extend({ lotId: z.uuid(), opId: opIdSchema }))
		.handler(({ context, input }) => {
			const { lotId, opId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: lotId,
				command: "stockLot.create",
				messages: lotCreateMessages,
				opId,
				values,
			});
		}),
	list: readyProcedure
		.input(
			z.object({
				archived: z.boolean().default(false),
				variantId: z.uuid(),
			})
		)
		.handler(({ context, input }) =>
			listStockLots(context.db, input.variantId, input.archived)
		),
	unarchive: lotArchiveToggle("stockLot.unarchive"),
	update: readyProcedure
		.input(
			z.object({
				baseVersion: z.number().int().positive(),
				lotId: z.uuid(),
				opId: opIdSchema,
				patch: stockLotPatchPayload,
			})
		)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.lotId,
				baseVersion: input.baseVersion,
				command: "stockLot.update",
				messages: lotMessages,
				opId: input.opId,
				values: input.patch,
			})
		),
};

export const stockMovementsRouter = {
	create: readyProcedure
		.input(
			z.intersection(
				stockMovementCreatePayload,
				z.object({ movementId: z.uuid(), opId: opIdSchema })
			)
		)
		.handler(({ context, input }) => {
			const { movementId, opId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: movementId,
				command: "stockMovement.create",
				messages: movementMessages,
				opId,
				values,
			});
		}),
	list: readyProcedure
		.input(z.object({ variantId: z.uuid() }))
		.handler(({ context, input }) =>
			listStockMovements(context.db, input.variantId)
		),
	reverse: readyProcedure
		.input(
			stockMovementReversePayload.extend({
				movementId: z.uuid(),
				opId: opIdSchema,
			})
		)
		.handler(({ context, input }) => {
			const { movementId, opId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: movementId,
				command: "stockMovement.reverse",
				messages: movementMessages,
				opId,
				values,
			});
		}),
	transfer: readyProcedure
		.input(
			z.intersection(
				stockMovementTransferPayload,
				z.object({ movementId: z.uuid(), opId: opIdSchema })
			)
		)
		.handler(({ context, input }) => {
			const { movementId, opId, ...values } = input;
			return runCreateCommand(context, {
				aggregateId: movementId,
				command: "stockMovement.transfer",
				messages: movementMessages,
				opId,
				values,
			});
		}),
};

export const stockBalancesRouter = {
	get: readyProcedure
		.input(z.object({ variantId: z.uuid() }))
		.handler(({ context, input }) =>
			getVariantBalance(context.db, input.variantId)
		),
	list: readyProcedure
		.input(stockBalanceListInput)
		.handler(({ context, input }) => listStockBalances(context.db, input)),
};

import z from "zod";

import { deviceOrLocalProcedure, deviceProcedure } from "../index";
import { maxPullLimit, pullChanges } from "./pull";
import { pushOperations } from "./push";
import { pendingSync, resolveConflict, resolveInputSchema } from "./resolve";

export const maxPushOperations = 100;

export const syncRouter = {
	pending: deviceOrLocalProcedure.handler(({ context }) =>
		pendingSync(context)
	),

	pull: deviceProcedure
		.input(
			z.object({
				cursor: z.string().regex(/^\d+$/),
				epoch: z.string().max(100).nullable(),
				limit: z.number().int().min(1).max(maxPullLimit).optional(),
			})
		)
		.handler(({ context, input }) =>
			pullChanges(context.db, input, context.serverVersion)
		),

	push: deviceProcedure
		.input(
			z.object({
				operations: z.array(z.unknown()).min(1).max(maxPushOperations),
			})
		)
		.handler(({ context, input }) =>
			pushOperations(context, context.deviceRow, input.operations)
		),

	resolve: deviceOrLocalProcedure
		.input(resolveInputSchema)
		.handler(({ context, input }) =>
			resolveConflict(context, context.deviceRow?.id ?? null, input)
		),
};

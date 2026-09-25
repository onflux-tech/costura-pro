import { ORPCError } from "@orpc/server";
import z from "zod";

import { runUpdateCommand } from "../aggregate-command";
import { commandMessages } from "../command-messages";
import type { Context } from "../context";
import { readyProcedure } from "../index";
import { opIdSchema } from "../schemas";
import { productionFlowUpdatePayload } from "./schemas";
import { readCurrentProductionFlow } from "./store";

const baseVersionField = z.number().int().positive();

function currentFlow(db: Context["db"]) {
	const row = readCurrentProductionFlow(db);
	if (!row) {
		throw new ORPCError("NOT_FOUND", {
			message: commandMessages.productionFlowNotFound,
		});
	}
	return row;
}

export const productionFlowRouter = {
	get: readyProcedure.input(z.object({})).handler(({ context }) => {
		const row = currentFlow(context.db);
		return {
			id: row.id,
			stages: row.stages,
			updatedAt: row.updatedAt.toISOString(),
			version: row.version,
		};
	}),

	update: readyProcedure
		.input(
			productionFlowUpdatePayload.extend({
				baseVersion: baseVersionField,
				opId: opIdSchema,
			})
		)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: currentFlow(context.db).id,
				baseVersion: input.baseVersion,
				command: "productionFlow.update",
				messages: {
					anonymized: commandMessages.clientAnonymized,
					notFound: commandMessages.productionFlowNotFound,
				},
				opId: input.opId,
				values: { stages: input.stages },
			})
		),
};

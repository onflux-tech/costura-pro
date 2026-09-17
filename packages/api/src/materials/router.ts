import { materialLimits } from "@costura-pro/domain/material";
import z from "zod";

import { runCreateCommand, runUpdateCommand } from "../aggregate-command";
import { commandMessages } from "../command-messages";
import { readyProcedure } from "../index";
import { opIdSchema } from "../schemas";
import {
	findVariantsByCode,
	getMaterial,
	listMaterialCategories,
	listMaterials,
	materialListInput,
} from "./queries";
import {
	materialCreatePayload,
	materialPatchPayload,
	materialVariantCreatePayload,
	materialVariantPatchPayload,
} from "./schemas";

const materialMessages = {
	anonymized: commandMessages.materialNotFound,
	notFound: commandMessages.materialNotFound,
};

const variantMessages = {
	anonymized: commandMessages.materialVariantNotFound,
	notFound: commandMessages.materialVariantNotFound,
};

const materialVersionInput = z.object({
	baseVersion: z.number().int().positive(),
	materialId: z.uuid(),
	opId: opIdSchema,
});

const variantVersionInput = z.object({
	baseVersion: z.number().int().positive(),
	opId: opIdSchema,
	variantId: z.uuid(),
});

function materialArchiveToggle(
	command: "material.archive" | "material.unarchive"
) {
	return readyProcedure
		.input(materialVersionInput)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.materialId,
				baseVersion: input.baseVersion,
				command,
				messages: materialMessages,
				opId: input.opId,
				values: {},
			})
		);
}

function variantArchiveToggle(
	command: "materialVariant.archive" | "materialVariant.unarchive"
) {
	return readyProcedure
		.input(variantVersionInput)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.variantId,
				baseVersion: input.baseVersion,
				command,
				messages: variantMessages,
				opId: input.opId,
				values: {},
			})
		);
}

export const materialsRouter = {
	archive: materialArchiveToggle("material.archive"),

	categories: readyProcedure
		.input(z.object({}))
		.handler(({ context }) => listMaterialCategories(context.db)),

	create: readyProcedure
		.input(
			materialCreatePayload.extend({
				materialId: z.uuid(),
				opId: opIdSchema,
			})
		)
		.handler(({ context, input: { materialId, opId, ...values } }) =>
			runCreateCommand(context, {
				aggregateId: materialId,
				command: "material.create",
				messages: materialMessages,
				opId,
				values,
			})
		),

	get: readyProcedure
		.input(z.object({ materialId: z.uuid() }))
		.handler(({ context, input }) => getMaterial(context.db, input.materialId)),

	list: readyProcedure
		.input(materialListInput)
		.handler(({ context, input }) => listMaterials(context.db, input)),

	unarchive: materialArchiveToggle("material.unarchive"),

	update: readyProcedure
		.input(materialVersionInput.extend({ patch: materialPatchPayload }))
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.materialId,
				baseVersion: input.baseVersion,
				command: "material.update",
				messages: materialMessages,
				opId: input.opId,
				values: input.patch,
			})
		),
};

export const materialVariantsRouter = {
	archive: variantArchiveToggle("materialVariant.archive"),

	byCode: readyProcedure
		.input(
			z.object({ code: z.string().trim().min(1).max(materialLimits.code) })
		)
		.handler(({ context, input }) =>
			findVariantsByCode(context.db, input.code)
		),

	create: readyProcedure
		.input(
			materialVariantCreatePayload.extend({
				opId: opIdSchema,
				variantId: z.uuid(),
			})
		)
		.handler(({ context, input: { opId, variantId, ...values } }) =>
			runCreateCommand(context, {
				aggregateId: variantId,
				command: "materialVariant.create",
				messages: materialMessages,
				opId,
				values,
			})
		),

	unarchive: variantArchiveToggle("materialVariant.unarchive"),

	update: readyProcedure
		.input(variantVersionInput.extend({ patch: materialVariantPatchPayload }))
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.variantId,
				baseVersion: input.baseVersion,
				command: "materialVariant.update",
				messages: variantMessages,
				opId: input.opId,
				values: input.patch,
			})
		),
};

import { productLimits } from "@costura-pro/domain/product";
import z from "zod";

import { runCreateCommand, runUpdateCommand } from "../aggregate-command";
import { commandMessages } from "../command-messages";
import { readyProcedure } from "../index";
import { opIdSchema } from "../schemas";
import {
	findProductVariantsByCode,
	getProduct,
	listProductCategories,
	listProducts,
	productListInput,
} from "./queries";
import {
	productCreatePayload,
	productPatchPayload,
	productVariantCreatePayload,
	productVariantPatchPayload,
} from "./schemas";

const productMessages = {
	anonymized: commandMessages.productNotFound,
	notFound: commandMessages.productNotFound,
};

const variantMessages = {
	anonymized: commandMessages.productVariantNotFound,
	notFound: commandMessages.productVariantNotFound,
};

const variantCreateMessages = {
	anonymized: commandMessages.productVariantNotFound,
	notFound: commandMessages.productNotFound,
};

const baseVersionField = z.number().int().positive();

const productVersionInput = z.object({
	baseVersion: baseVersionField,
	opId: opIdSchema,
	productId: z.uuid(),
});

const variantVersionInput = z.object({
	baseVersion: baseVersionField,
	opId: opIdSchema,
	variantId: z.uuid(),
});

function productArchiveToggle(
	command: "product.archive" | "product.unarchive"
) {
	return readyProcedure
		.input(productVersionInput)
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.productId,
				baseVersion: input.baseVersion,
				command,
				messages: productMessages,
				opId: input.opId,
				values: {},
			})
		);
}

function variantArchiveToggle(
	command: "productVariant.archive" | "productVariant.unarchive"
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

export const productsRouter = {
	archive: productArchiveToggle("product.archive"),

	categories: readyProcedure
		.input(z.object({}))
		.handler(({ context }) => listProductCategories(context.db)),

	create: readyProcedure
		.input(
			productCreatePayload.extend({ opId: opIdSchema, productId: z.uuid() })
		)
		.handler(({ context, input: { opId, productId, ...values } }) =>
			runCreateCommand(context, {
				aggregateId: productId,
				command: "product.create",
				messages: productMessages,
				opId,
				values,
			})
		),

	get: readyProcedure
		.input(z.object({ productId: z.uuid() }))
		.handler(({ context, input }) => getProduct(context.db, input.productId)),

	list: readyProcedure
		.input(productListInput)
		.handler(({ context, input }) => listProducts(context.db, input)),

	unarchive: productArchiveToggle("product.unarchive"),

	update: readyProcedure
		.input(productVersionInput.extend({ patch: productPatchPayload }))
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.productId,
				baseVersion: input.baseVersion,
				command: "product.update",
				messages: productMessages,
				opId: input.opId,
				values: input.patch,
			})
		),
};

export const productVariantsRouter = {
	archive: variantArchiveToggle("productVariant.archive"),

	byCode: readyProcedure
		.input(z.object({ code: z.string().trim().min(1).max(productLimits.code) }))
		.handler(({ context, input }) =>
			findProductVariantsByCode(context.db, input.code)
		),

	create: readyProcedure
		.input(
			productVariantCreatePayload.extend({
				opId: opIdSchema,
				variantId: z.uuid(),
			})
		)
		.handler(({ context, input: { opId, variantId, ...values } }) =>
			runCreateCommand(context, {
				aggregateId: variantId,
				command: "productVariant.create",
				messages: variantCreateMessages,
				opId,
				values,
			})
		),

	unarchive: variantArchiveToggle("productVariant.unarchive"),

	update: readyProcedure
		.input(variantVersionInput.extend({ patch: productVariantPatchPayload }))
		.handler(({ context, input }) =>
			runUpdateCommand(context, {
				aggregateId: input.variantId,
				baseVersion: input.baseVersion,
				command: "productVariant.update",
				messages: variantMessages,
				opId: input.opId,
				values: input.patch,
			})
		),
};

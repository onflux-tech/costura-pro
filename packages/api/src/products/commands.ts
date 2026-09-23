import { commandMessages } from "../command-messages";
import { emptyPayload } from "../schemas";
import type { CreateDefinition } from "../sync/commands";
import {
	archivePatch,
	definedFields,
	unarchivePatch,
	updateCommands,
} from "../update-command";
import {
	productCreatePayload,
	productPatchPayload,
	productVariantCreatePayload,
	productVariantPatchPayload,
} from "./schemas";
import {
	insertProduct,
	insertProductVariant,
	type ProductPatch,
	type ProductRow,
	type ProductVariantPatch,
	type ProductVariantRow,
	productSnapshot,
	productVariantSnapshot,
	readProduct,
	readProductVariant,
	updateProduct,
	updateProductVariant,
} from "./store";

const productCommand = updateCommands<ProductRow, ProductPatch>({
	aggregateType: "product",
	anonymized: () => false,
	read: readProduct,
	snapshot: productSnapshot,
	update: updateProduct,
});

const variantCommand = updateCommands<ProductVariantRow, ProductVariantPatch>({
	aggregateType: "productVariant",
	anonymized: () => false,
	read: readProductVariant,
	snapshot: productVariantSnapshot,
	update: updateProductVariant,
});

const createProduct: CreateDefinition = {
	aggregateType: "product",
	create: (db, id, values, stamp) =>
		insertProduct(db, id, productCreatePayload.parse(values), stamp).version,
	exists: (db, id) => readProduct(db, id) !== undefined,
	kind: "create",
	payload: productCreatePayload,
};

const createVariant: CreateDefinition = {
	aggregateType: "productVariant",
	create: (db, id, values, stamp) => {
		const fields = productVariantCreatePayload.parse(values);
		if (!readProduct(db, fields.productId)) {
			return {
				message: commandMessages.productNotFound,
				reason: "aggregateNotFound",
			};
		}
		return insertProductVariant(db, id, fields, stamp).version;
	},
	exists: (db, id) => readProductVariant(db, id) !== undefined,
	kind: "create",
	payload: productVariantCreatePayload,
};

export const productCommands = {
	"product.archive": productCommand(emptyPayload, archivePatch),
	"product.create": createProduct,
	"product.unarchive": productCommand(emptyPayload, unarchivePatch),
	"product.update": productCommand(productPatchPayload, (_row, values) =>
		definedFields(values)
	),
	"productVariant.archive": variantCommand(emptyPayload, archivePatch),
	"productVariant.create": createVariant,
	"productVariant.unarchive": variantCommand(emptyPayload, unarchivePatch),
	"productVariant.update": variantCommand(
		productVariantPatchPayload,
		(_row, values) => definedFields(values)
	),
};

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
	materialCreatePayload,
	materialPatchPayload,
	materialVariantCreatePayload,
	materialVariantPatchPayload,
} from "./schemas";
import {
	insertMaterial,
	insertMaterialVariant,
	type MaterialPatch,
	type MaterialRow,
	type MaterialVariantPatch,
	type MaterialVariantRow,
	materialSnapshot,
	materialVariantSnapshot,
	readMaterial,
	readMaterialVariant,
	updateMaterial,
	updateMaterialVariant,
} from "./store";

const materialCommand = updateCommands<MaterialRow, MaterialPatch>({
	aggregateType: "material",
	anonymized: () => false,
	read: readMaterial,
	snapshot: materialSnapshot,
	update: updateMaterial,
});

const variantCommand = updateCommands<MaterialVariantRow, MaterialVariantPatch>(
	{
		aggregateType: "materialVariant",
		anonymized: () => false,
		read: readMaterialVariant,
		snapshot: materialVariantSnapshot,
		update: updateMaterialVariant,
	}
);

const createMaterial: CreateDefinition = {
	aggregateType: "material",
	create: (db, id, values, stamp) =>
		insertMaterial(db, id, materialCreatePayload.parse(values), stamp).version,
	exists: (db, id) => readMaterial(db, id) !== undefined,
	kind: "create",
	payload: materialCreatePayload,
};

const createVariant: CreateDefinition = {
	aggregateType: "materialVariant",
	create: (db, id, values, stamp) => {
		const fields = materialVariantCreatePayload.parse(values);
		if (!readMaterial(db, fields.materialId)) {
			return {
				message: commandMessages.materialNotFound,
				reason: "aggregateNotFound",
			};
		}
		return insertMaterialVariant(db, id, fields, stamp).version;
	},
	exists: (db, id) => readMaterialVariant(db, id) !== undefined,
	kind: "create",
	payload: materialVariantCreatePayload,
};

export const materialCommands = {
	"material.archive": materialCommand(emptyPayload, archivePatch),
	"material.create": createMaterial,
	"material.unarchive": materialCommand(emptyPayload, unarchivePatch),
	"material.update": materialCommand(materialPatchPayload, (_row, values) =>
		definedFields(values)
	),
	"materialVariant.archive": variantCommand(emptyPayload, archivePatch),
	"materialVariant.create": createVariant,
	"materialVariant.unarchive": variantCommand(emptyPayload, unarchivePatch),
	"materialVariant.update": variantCommand(
		materialVariantPatchPayload,
		(_row, values) => definedFields(values)
	),
};

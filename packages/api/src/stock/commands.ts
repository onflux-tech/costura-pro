import { exitValueCents } from "@costura-pro/domain/stock";

import { commandMessages } from "../command-messages";
import { readMaterialVariant } from "../materials/store";
import { emptyPayload } from "../schemas";
import type {
	CommandExecutor,
	CreateDefinition,
	CreateRejection,
} from "../sync/commands";
import {
	archivePatch,
	definedFields,
	unarchivePatch,
	updateCommands,
} from "../update-command";
import {
	stockLocationCreatePayload,
	stockLocationPatchPayload,
	stockLotCreatePayload,
	stockLotPatchPayload,
	stockMovementCreatePayload,
	stockMovementReversePayload,
	stockMovementTransferPayload,
} from "./schemas";
import {
	insertStockLocation,
	insertStockLot,
	insertStockMovement,
	readReversalOf,
	readStockBalancePoint,
	readStockLocation,
	readStockLot,
	readStockMovement,
	type StockLocationPatch,
	type StockLocationRow,
	type StockLotPatch,
	type StockLotRow,
	stockLocationSnapshot,
	stockLotSnapshot,
	updateStockLocation,
	updateStockLot,
} from "./store";

const notFound = (message: string): CreateRejection => ({
	message,
	reason: "aggregateNotFound",
});

type Place = {
	locationId: string;
	lotId: string | null;
	variantId: string;
};

function checkPlace(db: CommandExecutor, place: Place): CreateRejection | null {
	const variant = readMaterialVariant(db, place.variantId);
	if (!variant) {
		return notFound(commandMessages.materialVariantNotFound);
	}
	if (!readStockLocation(db, place.locationId)) {
		return notFound(commandMessages.stockLocationNotFound);
	}
	if (!variant.tracksLots) {
		return place.lotId === null
			? null
			: notFound(commandMessages.stockLotNotFound);
	}
	if (place.lotId === null) {
		return notFound(commandMessages.stockLotNotFound);
	}
	const lot = readStockLot(db, place.lotId);
	return lot && lot.variantId === place.variantId
		? null
		: notFound(commandMessages.stockLotNotFound);
}

function exitCents(
	db: CommandExecutor,
	place: Place,
	exitMicros: bigint
): bigint {
	const point = readStockBalancePoint(
		db,
		place.variantId,
		place.locationId,
		place.lotId
	);
	return point
		? exitValueCents(point.quantityMicros, point.valueCents, exitMicros)
		: 0n;
}

const locationCommand = updateCommands<StockLocationRow, StockLocationPatch>({
	aggregateType: "stockLocation",
	anonymized: () => false,
	read: readStockLocation,
	snapshot: stockLocationSnapshot,
	update: updateStockLocation,
});

const lotCommand = updateCommands<StockLotRow, StockLotPatch>({
	aggregateType: "stockLot",
	anonymized: () => false,
	read: readStockLot,
	snapshot: stockLotSnapshot,
	update: updateStockLot,
});

const createLocation: CreateDefinition = {
	aggregateType: "stockLocation",
	create: (db, id, values, stamp) =>
		insertStockLocation(db, id, stockLocationCreatePayload.parse(values), stamp)
			.version,
	exists: (db, id) => readStockLocation(db, id) !== undefined,
	kind: "create",
	payload: stockLocationCreatePayload,
};

const createLot: CreateDefinition = {
	aggregateType: "stockLot",
	create: (db, id, values, stamp) => {
		const fields = stockLotCreatePayload.parse(values);
		const variant = readMaterialVariant(db, fields.variantId);
		if (!variant?.tracksLots) {
			return notFound(commandMessages.materialVariantNotFound);
		}
		return insertStockLot(db, id, fields, stamp).version;
	},
	exists: (db, id) => readStockLot(db, id) !== undefined,
	kind: "create",
	payload: stockLotCreatePayload,
};

const createMovement: CreateDefinition = {
	aggregateType: "stockMovement",
	create: (db, id, values, stamp) => {
		const fields = stockMovementCreatePayload.parse(values);
		const rejection = checkPlace(db, fields);
		if (rejection) {
			return rejection;
		}
		const quantity = BigInt(fields.quantityMicros);
		const valueCents =
			fields.valueCents === undefined
				? (-exitCents(db, fields, -quantity)).toString()
				: fields.valueCents;
		return insertStockMovement(
			db,
			id,
			{
				kind: fields.kind,
				locationId: fields.locationId,
				lotId: fields.lotId,
				occurredOn: fields.occurredOn,
				quantityMicros: fields.quantityMicros,
				reason: fields.reason,
				reversesMovementId: null,
				transferId: null,
				valueCents,
				variantId: fields.variantId,
			},
			stamp
		).version;
	},
	exists: (db, id) => readStockMovement(db, id) !== undefined,
	kind: "create",
	payload: stockMovementCreatePayload,
};

const transferMovement: CreateDefinition = {
	aggregateType: "stockMovement",
	create: (db, id, values, stamp) => {
		const fields = stockMovementTransferPayload.parse(values);
		const source = {
			locationId: fields.fromLocationId,
			lotId: fields.lotId,
			variantId: fields.variantId,
		};
		const rejection =
			checkPlace(db, source) ??
			checkPlace(db, { ...source, locationId: fields.toLocationId });
		if (rejection) {
			return rejection;
		}
		if (readStockMovement(db, fields.inboundId)) {
			return { reason: "aggregateExists" };
		}
		const quantity = BigInt(fields.quantityMicros);
		const moved = exitCents(db, source, quantity);
		const shared = {
			lotId: fields.lotId,
			occurredOn: fields.occurredOn,
			reason: fields.reason,
			reversesMovementId: null,
			transferId: id,
			variantId: fields.variantId,
		};
		const out = insertStockMovement(
			db,
			id,
			{
				...shared,
				kind: "transferOut",
				locationId: fields.fromLocationId,
				quantityMicros: (-quantity).toString(),
				valueCents: (-moved).toString(),
			},
			stamp
		);
		insertStockMovement(
			db,
			fields.inboundId,
			{
				...shared,
				kind: "transferIn",
				locationId: fields.toLocationId,
				quantityMicros: fields.quantityMicros,
				valueCents: moved.toString(),
			},
			stamp
		);
		return out.version;
	},
	exists: (db, id) => readStockMovement(db, id) !== undefined,
	kind: "create",
	payload: stockMovementTransferPayload,
};

const reverseMovement: CreateDefinition = {
	aggregateType: "stockMovement",
	create: (db, id, values, stamp) => {
		const fields = stockMovementReversePayload.parse(values);
		const original = readStockMovement(db, fields.reversesMovementId);
		if (!original) {
			return notFound(commandMessages.stockMovementNotFound);
		}
		if (readReversalOf(db, original.id)) {
			return { message: "Movimento já estornado", reason: "aggregateExists" };
		}
		return insertStockMovement(
			db,
			id,
			{
				kind: "reversal",
				locationId: original.locationId,
				lotId: original.lotId,
				occurredOn: fields.occurredOn,
				quantityMicros: (-original.quantityMicros).toString(),
				reason: fields.reason,
				reversesMovementId: original.id,
				transferId: null,
				valueCents: (-original.valueCents).toString(),
				variantId: original.variantId,
			},
			stamp
		).version;
	},
	exists: (db, id) => readStockMovement(db, id) !== undefined,
	kind: "create",
	payload: stockMovementReversePayload,
};

export const stockCommands = {
	"stockLocation.archive": locationCommand(emptyPayload, archivePatch),
	"stockLocation.create": createLocation,
	"stockLocation.unarchive": locationCommand(emptyPayload, unarchivePatch),
	"stockLocation.update": locationCommand(
		stockLocationPatchPayload,
		(_row, values) => definedFields(values)
	),
	"stockLot.archive": lotCommand(emptyPayload, archivePatch),
	"stockLot.create": createLot,
	"stockLot.unarchive": lotCommand(emptyPayload, unarchivePatch),
	"stockLot.update": lotCommand(stockLotPatchPayload, (_row, values) =>
		definedFields(values)
	),
	"stockMovement.create": createMovement,
	"stockMovement.reverse": reverseMovement,
	"stockMovement.transfer": transferMovement,
};

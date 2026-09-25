import { countOutcome } from "@costura-pro/domain/stock";

import { checkPlace, exitCents } from "../stock/commands";
import { insertStockMovement, readStockMovement } from "../stock/store";
import type {
	CommandExecutor,
	CreateDefinition,
	CreateRejection,
} from "../sync/commands";
import {
	type InventorySessionCreateValues,
	inventorySessionCreatePayload,
} from "./schemas";
import {
	type InventoryLine,
	insertInventorySession,
	readInventorySession,
} from "./store";

type PayloadLine = InventorySessionCreateValues["lines"][number];

type DivergentLine = InventoryLine & { movementId: string; valueCents: string };

const taken: CreateRejection = { reason: "aggregateExists" };

function placeRejection(
	db: CommandExecutor,
	lines: readonly PayloadLine[]
): CreateRejection | null {
	for (const line of lines) {
		const rejection = checkPlace(db, line);
		if (rejection) {
			return rejection;
		}
	}
	return null;
}

function idsTaken(
	db: CommandExecutor,
	id: string,
	lines: readonly PayloadLine[]
): boolean {
	return lines.some(
		(line) =>
			line.movementId !== null &&
			(line.movementId === id ||
				readStockMovement(db, line.movementId) !== undefined)
	);
}

function movementValueOf(
	db: CommandExecutor,
	line: PayloadLine
): string | null {
	const outcome = countOutcome(
		BigInt(line.expectedMicros),
		BigInt(line.countedMicros)
	);
	if (outcome.kind === "match") {
		return null;
	}
	if (outcome.kind === "surplus") {
		return line.valueCents;
	}
	return (-exitCents(db, line, -outcome.quantityMicros)).toString();
}

function isDivergent(line: InventoryLine): line is DivergentLine {
	return line.movementId !== null && line.valueCents !== null;
}

const createInventorySession: CreateDefinition = {
	aggregateType: "inventorySession",
	create: (db, id, values, stamp) => {
		const fields = inventorySessionCreatePayload.parse(values);
		const rejection = placeRejection(db, fields.lines);
		if (rejection) {
			return rejection;
		}
		if (idsTaken(db, id, fields.lines)) {
			return taken;
		}
		const lines: InventoryLine[] = fields.lines.map((line) => ({
			countedMicros: line.countedMicros,
			expectedMicros: line.expectedMicros,
			locationId: line.locationId,
			lotId: line.lotId,
			movementId: line.movementId,
			valueCents: movementValueOf(db, line),
			variantId: line.variantId,
		}));
		const created = insertInventorySession(
			db,
			id,
			{
				lines,
				notes: fields.notes,
				occurredOn: fields.occurredOn,
				reason: fields.reason,
			},
			stamp
		);
		for (const line of lines.filter(isDivergent)) {
			insertStockMovement(
				db,
				line.movementId,
				{
					inventorySessionId: id,
					kind: "inventory",
					locationId: line.locationId,
					lotId: line.lotId,
					materialReconciliationId: null,
					occurredOn: fields.occurredOn,
					purchaseId: null,
					quantityMicros: (
						BigInt(line.countedMicros) - BigInt(line.expectedMicros)
					).toString(),
					reason: fields.reason,
					reversesMovementId: null,
					transferId: null,
					valueCents: line.valueCents,
					variantId: line.variantId,
				},
				stamp
			);
		}
		return created.version;
	},
	exists: (db, id) => readInventorySession(db, id) !== undefined,
	kind: "create",
	payload: inventorySessionCreatePayload,
};

export const inventoryCommands = {
	"inventorySession.create": createInventorySession,
};

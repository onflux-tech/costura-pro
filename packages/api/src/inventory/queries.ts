import type { Database } from "@costura-pro/db";
import { material, materialVariant } from "@costura-pro/db/schema/materials";
import {
	inventorySession,
	stockLocation,
	stockLot,
	stockMovement,
} from "@costura-pro/db/schema/stock";
import type { BaseUnitCode } from "@costura-pro/domain/unit";
import { ORPCError } from "@orpc/server";
import { desc, eq, inArray } from "drizzle-orm";
import z from "zod";

import { commandMessages } from "../command-messages";
import {
	type InventoryLine,
	type InventorySessionSnapshot,
	inventorySessionSnapshot,
	readInventorySession,
} from "./store";

export const inventoryPageSize = 50;

export const inventorySessionListInput = z.object({
	offset: z.number().int().nonnegative().default(0),
});

export type InventorySessionListItem = {
	createdAt: string;
	divergentCount: number;
	id: string;
	lineCount: number;
	locationNames: string[];
	occurredOn: string;
	reason: string;
};

export type InventorySessionLineDetail = InventoryLine & {
	baseUnit: BaseUnitCode;
	code: string | null;
	displayPrecision: number;
	locationName: string;
	lotLabel: string | null;
	materialId: string;
	materialName: string;
	reversedByMovementId: string | null;
	variantName: string;
};

export type InventorySessionDetail = {
	lines: InventorySessionLineDetail[];
	session: InventorySessionSnapshot;
};

type Reader = Pick<Database, "select">;

const unique = (values: readonly string[]) => [...new Set(values)];

function locationNames(
	db: Reader,
	ids: readonly string[]
): Map<string, string> {
	const wanted = unique(ids);
	return new Map(
		wanted.length === 0
			? []
			: db
					.select({ id: stockLocation.id, name: stockLocation.name })
					.from(stockLocation)
					.where(inArray(stockLocation.id, wanted))
					.all()
					.map((row) => [row.id, row.name])
	);
}

export function listInventorySessions(
	db: Reader,
	{ offset }: z.output<typeof inventorySessionListInput>
): { items: InventorySessionListItem[]; nextOffset: number | null } {
	const rows = db
		.select()
		.from(inventorySession)
		.orderBy(
			desc(inventorySession.occurredOn),
			desc(inventorySession.createdAt),
			desc(inventorySession.id)
		)
		.limit(inventoryPageSize + 1)
		.offset(offset)
		.all();
	const page = rows.slice(0, inventoryPageSize);
	const names = locationNames(
		db,
		page.flatMap((row) => row.lines.map((line) => line.locationId))
	);
	return {
		items: page.map((row) => ({
			createdAt: row.createdAt.toISOString(),
			divergentCount: row.lines.filter((line) => line.movementId !== null)
				.length,
			id: row.id,
			lineCount: row.lines.length,
			locationNames: unique(
				row.lines.map((line) => names.get(line.locationId) ?? "")
			).sort((left, right) => left.localeCompare(right, "pt-BR")),
			occurredOn: row.occurredOn,
			reason: row.reason,
		})),
		nextOffset:
			rows.length > inventoryPageSize ? offset + inventoryPageSize : null,
	};
}

function variantsOf(db: Reader, ids: readonly string[]) {
	return new Map(
		db
			.select({
				baseUnit: materialVariant.baseUnit,
				code: materialVariant.code,
				displayPrecision: materialVariant.displayPrecision,
				id: materialVariant.id,
				materialId: material.id,
				materialName: material.name,
				variantName: materialVariant.name,
			})
			.from(materialVariant)
			.innerJoin(material, eq(material.id, materialVariant.materialId))
			.where(inArray(materialVariant.id, unique(ids)))
			.all()
			.map((row) => [row.id, row])
	);
}

function lotLabels(db: Reader, ids: readonly string[]): Map<string, string> {
	const wanted = unique(ids);
	return new Map(
		wanted.length === 0
			? []
			: db
					.select({ id: stockLot.id, label: stockLot.label })
					.from(stockLot)
					.where(inArray(stockLot.id, wanted))
					.all()
					.map((row) => [row.id, row.label])
	);
}

function reversalsOf(db: Reader, ids: readonly string[]): Map<string, string> {
	const wanted = unique(ids);
	return new Map(
		wanted.length === 0
			? []
			: db
					.select({
						id: stockMovement.id,
						reverses: stockMovement.reversesMovementId,
					})
					.from(stockMovement)
					.where(inArray(stockMovement.reversesMovementId, wanted))
					.all()
					.flatMap((row) => (row.reverses ? [[row.reverses, row.id]] : []))
	);
}

export function getInventorySession(
	db: Reader,
	sessionId: string
): InventorySessionDetail {
	const row = readInventorySession(db, sessionId);
	if (!row) {
		throw new ORPCError("NOT_FOUND", {
			message: commandMessages.inventorySessionNotFound,
		});
	}
	const variants = variantsOf(
		db,
		row.lines.map((line) => line.variantId)
	);
	const locations = locationNames(
		db,
		row.lines.map((line) => line.locationId)
	);
	const lots = lotLabels(
		db,
		row.lines.flatMap((line) => (line.lotId === null ? [] : [line.lotId]))
	);
	const reversals = reversalsOf(
		db,
		row.lines.flatMap((line) =>
			line.movementId === null ? [] : [line.movementId]
		)
	);
	return {
		lines: row.lines.map((line) => {
			const variant = variants.get(line.variantId);
			return {
				...line,
				baseUnit: variant?.baseUnit ?? "un",
				code: variant?.code ?? null,
				displayPrecision: variant?.displayPrecision ?? 0,
				locationName: locations.get(line.locationId) ?? "",
				lotLabel: line.lotId === null ? null : (lots.get(line.lotId) ?? null),
				materialId: variant?.materialId ?? "",
				materialName: variant?.materialName ?? "",
				reversedByMovementId:
					line.movementId === null
						? null
						: (reversals.get(line.movementId) ?? null),
				variantName: variant?.variantName ?? "",
			};
		}),
		session: inventorySessionSnapshot(row),
	};
}

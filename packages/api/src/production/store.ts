import type { Database } from "@costura-pro/db";
import {
	type FlowStageRow,
	productionFlow,
} from "@costura-pro/db/schema/production";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

import { appendChange } from "../change-log";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";

export type ProductionFlowRow = typeof productionFlow.$inferSelect;

export type ProductionFlowSnapshot = {
	createdAt: string;
	id: string;
	stages: FlowStageRow[];
	version: number;
};

type Reader = Pick<Database, "select">;

export function productionFlowSnapshot(
	row: ProductionFlowRow
): ProductionFlowSnapshot {
	return {
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		stages: row.stages,
		version: row.version,
	};
}

export function readProductionFlow(
	db: Reader,
	id: string
): ProductionFlowRow | undefined {
	return db
		.select()
		.from(productionFlow)
		.where(eq(productionFlow.id, id))
		.get();
}

export function readCurrentProductionFlow(
	db: Reader
): ProductionFlowRow | undefined {
	return db.select().from(productionFlow).limit(1).get();
}

function recordProductionFlow(
	db: Executor,
	row: ProductionFlowRow,
	stamp: ChangeStamp
) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "productionFlow",
		data: productionFlowSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

export function insertProductionFlow(
	db: Executor,
	id: string,
	stages: FlowStageRow[],
	stamp: ChangeStamp
): ProductionFlowRow {
	const row = db
		.insert(productionFlow)
		.values({
			createdAt: stamp.now,
			id,
			stages,
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordProductionFlow(db, row, stamp);
	return row;
}

export function updateProductionFlow(
	db: Executor,
	current: ProductionFlowRow,
	patch: { stages: FlowStageRow[] },
	stamp: ChangeStamp
): ProductionFlowRow {
	const next = db
		.update(productionFlow)
		.set({
			stages: patch.stages,
			updatedAt: stamp.now,
			version: current.version + 1,
		})
		.where(
			and(
				eq(productionFlow.id, current.id),
				eq(productionFlow.version, current.version)
			)
		)
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Fluxo de produção mudou durante a operação",
		});
	}
	recordProductionFlow(db, next, stamp);
	return next;
}

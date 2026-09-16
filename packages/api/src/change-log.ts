import { changeLog } from "@costura-pro/db/schema/sync";

import type { Executor } from "./executor";

export type AggregateType = "device" | "installation";

export type ChangeInput = {
	aggregateId: string;
	aggregateType: AggregateType;
	data: unknown;
	epoch: string;
	now: Date;
	opId: string | null;
	version: number;
};

export function appendChange(
	db: Executor,
	{ aggregateId, aggregateType, data, epoch, now, opId, version }: ChangeInput
): void {
	db.insert(changeLog)
		.values({
			aggregateId,
			aggregateType,
			changedAt: now,
			data,
			epoch,
			opId,
			version,
		})
		.run();
}

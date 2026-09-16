import type { Database } from "@costura-pro/db";
import { changeLog } from "@costura-pro/db/schema/sync";
import { asc, gt } from "drizzle-orm";

import type { AggregateType } from "../change-log";
import { readInstallation } from "../installation/store";

export const maxPullLimit = 500;

export type Change = {
	aggregateId: string;
	aggregateType: AggregateType;
	cursor: string;
	data: unknown;
	version: number;
};

export type PullResult = {
	changes: Change[];
	cursor: string;
	epoch: string;
	hasMore: boolean;
	rebase: boolean;
	serverVersion: string;
};

export type PullInput = {
	cursor: string;
	epoch: string | null;
	limit?: number;
};

export function pullChanges(
	db: Pick<Database, "select">,
	{ cursor, epoch, limit = maxPullLimit }: PullInput,
	serverVersion: string
): PullResult {
	const current = readInstallation(db).epoch;
	const rebase = epoch !== current;
	const from = rebase ? 0 : Number(cursor);
	const rows = db
		.select()
		.from(changeLog)
		.where(gt(changeLog.cursor, from))
		.orderBy(asc(changeLog.cursor))
		.limit(limit + 1)
		.all();
	const page = rows.slice(0, limit);
	return {
		changes: page.map((row) => ({
			aggregateId: row.aggregateId,
			aggregateType: row.aggregateType as AggregateType,
			cursor: String(row.cursor),
			data: row.data,
			version: row.version,
		})),
		cursor: String(page.at(-1)?.cursor ?? from),
		epoch: current,
		hasMore: rows.length > limit,
		rebase,
		serverVersion,
	};
}

import type z from "zod";

import type { AggregateType } from "./change-log";
import type { ChangeStamp } from "./devices/store";
import type { CommandExecutor, UpdateDefinition } from "./sync/commands";

export type AggregateAccess<Row, Patch> = {
	aggregateType: AggregateType;
	anonymized: (db: CommandExecutor, row: Row) => boolean;
	read: (db: CommandExecutor, id: string) => Row | undefined;
	snapshot: (row: Row) => object;
	update: (
		db: CommandExecutor,
		row: Row,
		patch: Patch,
		stamp: ChangeStamp
	) => Row;
};

type Archivable = { archivedAt: Date | null };

export function archivePatch(row: Archivable, _values: unknown, now: Date) {
	return row.archivedAt ? null : { archivedAt: now };
}

export function unarchivePatch(row: Archivable) {
	return row.archivedAt ? { archivedAt: null } : null;
}

export function definedFields<T extends Record<string, unknown>>(values: T) {
	return Object.fromEntries(
		Object.entries(values).filter(([, value]) => value !== undefined)
	) as { [K in keyof T]: Exclude<T[K], undefined> };
}

export function updateCommands<Row extends { version: number }, Patch>(
	access: AggregateAccess<Row, Patch>
) {
	return <Values extends Record<string, unknown>>(
		payload: z.ZodType<Values>,
		patchFor: (row: Row, values: Values, now: Date) => Patch | null
	): UpdateDefinition => ({
		aggregateType: access.aggregateType,
		kind: "update",
		load: (db, id) => {
			const row = access.read(db, id);
			if (!row) {
				return;
			}
			const snapshot = access.snapshot(row);
			return {
				anonymized: access.anonymized(db, row),
				apply: (values: unknown, stamp: ChangeStamp) => {
					const patch = patchFor(row, payload.parse(values), stamp.now);
					return patch
						? access.update(db, row, patch, stamp).version
						: row.version;
				},
				snapshot,
				values: { ...snapshot },
				version: row.version,
			};
		},
		payload,
	});
}

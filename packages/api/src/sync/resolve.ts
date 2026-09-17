import { auditEvent } from "@costura-pro/db/schema/installation";
import { operation, syncConflict } from "@costura-pro/db/schema/sync";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import z from "zod";

import { appendAudit } from "../audit";
import type { AggregateType } from "../change-log";
import type { Context } from "../context";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";
import { readInstallation } from "../installation/store";
import { runDirectCommand } from "../operations";
import { redactedOpHash } from "../redaction";
import { opIdSchema } from "../schemas";
import { findCommand, type LoadedAggregate } from "./commands";
import type { OperationOutcome, QuarantineNote } from "./push";

export const resolveInputSchema = z.object({
	choice: z.enum(["keepLocal", "keepServer", "merge"]),
	conflictId: z.uuid(),
	opId: opIdSchema,
	reason: z.string().trim().min(1).max(200),
	values: z.record(z.string(), z.unknown()).optional(),
});

export type ResolveInput = z.infer<typeof resolveInputSchema>;

type ResolveContext = Pick<Context, "access" | "db" | "ip" | "log" | "now">;

type ConflictRow = typeof syncConflict.$inferSelect;

function openConflict(db: Executor, conflictId: string): ConflictRow {
	const conflict = db
		.select()
		.from(syncConflict)
		.where(eq(syncConflict.id, conflictId))
		.get();
	if (!conflict) {
		throw new ORPCError("NOT_FOUND", { message: "Conflito não encontrado" });
	}
	if (conflict.status === "resolved") {
		throw new ORPCError("CONFLICT", { message: "Conflito já resolvido" });
	}
	return conflict;
}

function conflictTarget(
	db: Executor,
	conflict: ConflictRow
): { payload: z.ZodType<Record<string, unknown>>; target: LoadedAggregate } {
	const definition = findCommand(conflict.command, conflict.aggregateType);
	const target =
		definition?.kind === "update"
			? definition.load(db, conflict.aggregateId)
			: undefined;
	if (!(definition && target)) {
		throw new ORPCError("PRECONDITION_FAILED", {
			message: "Registro do conflito não existe mais",
		});
	}
	return { payload: definition.payload, target };
}

function applyChoice(
	db: Executor,
	conflict: ConflictRow,
	input: ResolveInput,
	stamp: ChangeStamp
): number {
	const { payload, target } = conflictTarget(db, conflict);
	if (input.choice === "keepServer") {
		return target.version;
	}
	const parsed = payload.safeParse(
		input.choice === "keepLocal" ? conflict.localValues : input.values
	);
	if (!parsed.success) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Valores inválidos para resolver o conflito",
		});
	}
	return target.apply(parsed.data, stamp);
}

export function resolveConflict(
	context: ResolveContext,
	deviceId: string | null,
	input: ResolveInput
) {
	const target = context.db
		.select({
			id: syncConflict.aggregateId,
			type: syncConflict.aggregateType,
		})
		.from(syncConflict)
		.where(eq(syncConflict.id, input.conflictId))
		.get();
	if (!target) {
		throw new ORPCError("NOT_FOUND", { message: "Conflito não encontrado" });
	}
	return runDirectCommand(
		context,
		{
			aggregate: { id: target.id, type: target.type as AggregateType },
			command: "sync.resolve",
			input: {
				choice: input.choice,
				conflictId: input.conflictId,
				reason: input.reason,
				values: input.values,
			},
			opId: input.opId,
		},
		(record) => {
			const now = context.now();
			return context.db.transaction((tx) => {
				const conflict = openConflict(tx, input.conflictId);
				const version = applyChoice(tx, conflict, input, {
					epoch: readInstallation(tx).epoch,
					now,
					opId: input.opId,
				});
				tx.update(syncConflict)
					.set({
						choice: input.choice,
						reason: input.reason,
						resolvedAt: now,
						resolvedByOpId: input.opId,
						status: "resolved",
					})
					.where(eq(syncConflict.id, conflict.id))
					.run();
				appendAudit(
					tx,
					now,
					{
						access: context.access,
						details: { choice: input.choice, command: conflict.command },
						deviceId,
						ip: context.ip,
						outcome: "succeeded",
						type: "sync.conflict_resolved",
					},
					context.log
				);
				return record(tx, {
					choice: input.choice,
					conflictId: conflict.id,
					version,
				});
			});
		}
	);
}

export function pendingSync(context: Pick<Context, "db">) {
	const conflicts = context.db
		.select({
			aggregateId: syncConflict.aggregateId,
			aggregateType: syncConflict.aggregateType,
			baseVersion: syncConflict.baseVersion,
			command: syncConflict.command,
			createdAt: syncConflict.createdAt,
			currentValues: syncConflict.currentValues,
			currentVersion: syncConflict.currentVersion,
			id: syncConflict.id,
			localValues: syncConflict.localValues,
			opId: syncConflict.opId,
		})
		.from(syncConflict)
		.where(eq(syncConflict.status, "open"))
		.orderBy(asc(syncConflict.createdAt))
		.all()
		.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
	const stored = context.db
		.select({
			command: operation.command,
			occurredAt: operation.occurredAt,
			opHash: operation.opHash,
			opId: operation.opId,
			receivedAt: operation.receivedAt,
			result: operation.result,
		})
		.from(operation)
		.where(eq(operation.status, "quarantined"))
		.all();
	const redactedQuarantines = new Set(
		stored.filter((row) => row.opHash === redactedOpHash).map((row) => row.opId)
	);
	const storedItems = stored.map((row) => ({
		command: row.command,
		occurredAt: row.occurredAt?.toISOString() ?? null,
		opId: row.opId,
		reason: (row.result as Extract<OperationOutcome, { kind: "quarantined" }>)
			.reason,
		receivedAt: row.receivedAt,
	}));
	const reused = context.db
		.select({ details: auditEvent.details, receivedAt: auditEvent.occurredAt })
		.from(auditEvent)
		.where(
			and(
				eq(auditEvent.type, "sync.quarantined"),
				sql`json_extract(${auditEvent.details}, '$.reason') = 'opIdReused'`
			)
		)
		.all()
		.map(({ details, receivedAt }) => {
			const note = details as QuarantineNote & { opId: string };
			return {
				command: note.command,
				occurredAt: note.occurredAt,
				opId: note.opId,
				reason: "opIdReused" as const,
				receivedAt,
			};
		})
		.filter((item) => !redactedQuarantines.has(item.opId));
	const quarantined = [...storedItems, ...reused]
		.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
		.map(({ receivedAt: _receivedAt, ...item }) => item);
	return { conflicts, quarantined };
}

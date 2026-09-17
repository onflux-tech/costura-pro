import type { Database } from "@costura-pro/db";
import {
	changeLog,
	operation,
	syncConflict,
} from "@costura-pro/db/schema/sync";
import { desc, eq } from "drizzle-orm";
import z from "zod";

import { appendAudit } from "../audit";
import type { Context } from "../context";
import type { DeviceRow } from "../devices/store";
import type { Executor } from "../executor";
import { type InstallationRow, readInstallation } from "../installation/store";
import { operationHash } from "../operations";
import {
	isRedacted,
	personalDataAggregates,
	redactedOpHash,
} from "../redaction";
import { opIdSchema } from "../schemas";
import {
	type CreateDefinition,
	commandNamed,
	findCommand,
	type LoadedAggregate,
} from "./commands";

export const quarantineReasons = [
	"epoch",
	"opIdReused",
	"deviceMismatch",
	"unknownCommand",
	"invalidPayload",
	"aggregateNotFound",
	"aggregateExists",
	"aggregateAnonymized",
	"invalidEnvelope",
] as const;

export type QuarantineReason = (typeof quarantineReasons)[number];

const createdIdSchema = z.uuid();

export const operationSchema = z.object({
	aggregateId: z.string().min(1).max(100),
	aggregateType: z.string().min(1).max(50),
	baseVersion: z.number().int().nonnegative().nullable(),
	command: z.string().min(1).max(100),
	deviceId: z.string().min(1).max(100),
	epoch: z.string().min(1).max(100),
	occurredAt: z.iso.datetime({ offset: true }),
	opId: opIdSchema,
	payload: z.unknown(),
});

const envelopeHintSchema = z
	.object({
		command: z.string().max(100).catch(""),
		epoch: z.string().max(100).catch(""),
		opId: opIdSchema.nullable().catch(null),
	})
	.catch({ command: "", epoch: "", opId: null });

export type SyncOperation = z.infer<typeof operationSchema>;

export type OperationOutcome =
	| { kind: "accepted"; newVersion: number }
	| {
			conflictId: string;
			current: unknown;
			currentVersion: number;
			kind: "conflict";
	  }
	| { kind: "quarantined"; reason: QuarantineReason };

type Quarantined = Extract<OperationOutcome, { kind: "quarantined" }>;

export type QuarantineNote = {
	command: string;
	occurredAt: string | null;
	opId: string | null;
};

export type PushResult = {
	accepted: { newVersion: number; opId: string }[];
	conflicts: {
		conflictId: string;
		current: unknown;
		currentVersion: number;
		opId: string;
	}[];
	cursor: string;
	epoch: string;
	exceptions: { kind: string; opId: string; referenceId: string }[];
	quarantined: { opId: string | null; reason: QuarantineReason }[];
};

type PushContext = Pick<Context, "access" | "db" | "ip" | "log" | "now">;

type Arrival = { context: PushContext; device: DeviceRow; now: Date };

type Decision = Arrival & { op: SyncOperation };

type Creation = {
	definition: CreateDefinition;
	kind: "create";
	values: Record<string, unknown>;
};

type Edition = {
	kind: "update";
	loaded: LoadedAggregate;
	values: Record<string, unknown>;
};

type Classification = Creation | Edition | { reason: QuarantineReason };

type StoredOperation = Omit<
	typeof operation.$inferInsert,
	"receivedAt" | "result" | "status"
> & { opId: string };

function hashOf(op: SyncOperation): string {
	return operationHash({
		aggregateId: op.aggregateId,
		aggregateType: op.aggregateType,
		baseVersion: op.baseVersion,
		command: op.command,
		deviceId: op.deviceId,
		epoch: op.epoch,
		occurredAt: op.occurredAt,
		payload: op.payload,
	});
}

function noteOf(op: SyncOperation): QuarantineNote {
	return { command: op.command, occurredAt: op.occurredAt, opId: op.opId };
}

export function latestCursor(db: Pick<Database, "select">): string {
	const last = db
		.select({ cursor: changeLog.cursor })
		.from(changeLog)
		.orderBy(desc(changeLog.cursor))
		.limit(1)
		.get();
	return String(last?.cursor ?? 0);
}

function classify(
	db: Executor,
	{ device, op }: Decision,
	installation: InstallationRow
): Classification {
	if (op.deviceId !== device.id) {
		return { reason: "deviceMismatch" };
	}
	if (op.epoch !== installation.epoch) {
		return { reason: "epoch" };
	}
	const definition = findCommand(op.command, op.aggregateType);
	if (!definition) {
		return { reason: "unknownCommand" };
	}
	const parsed = definition.payload.safeParse(op.payload);
	if (!parsed.success) {
		return { reason: "invalidPayload" };
	}
	if (definition.kind === "create") {
		if (
			op.baseVersion !== null ||
			!createdIdSchema.safeParse(op.aggregateId).success
		) {
			return { reason: "invalidEnvelope" };
		}
		if (definition.exists(db, op.aggregateId)) {
			return { reason: "aggregateExists" };
		}
		return { definition, kind: "create", values: parsed.data };
	}
	const loaded = definition.load(db, op.aggregateId);
	if (!loaded) {
		return { reason: "aggregateNotFound" };
	}
	if (loaded.anonymized) {
		return { reason: "aggregateAnonymized" };
	}
	return { kind: "update", loaded, values: parsed.data };
}

function quarantine(
	db: Executor,
	{ context, device, now }: Arrival,
	note: QuarantineNote,
	reason: QuarantineReason
): Quarantined {
	appendAudit(
		db,
		now,
		{
			access: context.access,
			details: { ...note, reason },
			deviceId: device.id,
			ip: context.ip,
			outcome: "failed",
			type: "sync.quarantined",
		},
		context.log
	);
	return { kind: "quarantined", reason };
}

function openConflict(
	db: Executor,
	{ context, device, now, op }: Decision,
	{ loaded, values }: Edition
): OperationOutcome {
	const conflictId = crypto.randomUUID();
	db.insert(syncConflict)
		.values({
			aggregateId: op.aggregateId,
			aggregateType: op.aggregateType,
			baseVersion: op.baseVersion,
			command: op.command,
			createdAt: now,
			currentValues: loaded.values,
			currentVersion: loaded.version,
			id: conflictId,
			localValues: values,
			opId: op.opId,
			status: "open",
		})
		.run();
	appendAudit(
		db,
		now,
		{
			access: context.access,
			details: { command: op.command },
			deviceId: device.id,
			ip: context.ip,
			outcome: "failed",
			type: "sync.conflict_opened",
		},
		context.log
	);
	return {
		conflictId,
		current: loaded.snapshot,
		currentVersion: loaded.version,
		kind: "conflict",
	};
}

function decideNew(
	db: Executor,
	decision: Decision,
	installation: InstallationRow
): OperationOutcome {
	const classification = classify(db, decision, installation);
	if ("reason" in classification) {
		return quarantine(db, decision, noteOf(decision.op), classification.reason);
	}
	const stamp = {
		epoch: installation.epoch,
		now: decision.now,
		opId: decision.op.opId,
	};
	if (classification.kind === "create") {
		const created = classification.definition.create(
			db,
			decision.op.aggregateId,
			classification.values,
			stamp
		);
		if (typeof created !== "number") {
			return quarantine(db, decision, noteOf(decision.op), created.reason);
		}
		return { kind: "accepted", newVersion: created };
	}
	if (decision.op.baseVersion !== classification.loaded.version) {
		return openConflict(db, decision, classification);
	}
	return {
		kind: "accepted",
		newVersion: classification.loaded.apply(classification.values, stamp),
	};
}

function withholdsHash(
	tx: Executor,
	op: SyncOperation,
	outcome: OperationOutcome
): boolean {
	if (isRedacted(tx, op.aggregateType, op.aggregateId)) {
		return true;
	}
	if (outcome.kind !== "quarantined") {
		return false;
	}
	return (
		outcome.reason === "aggregateAnonymized" || isPersonalCommand(op.command)
	);
}

function isPersonalCommand(command: string): boolean {
	const definition = commandNamed(command);
	return (
		definition !== undefined &&
		personalDataAggregates.has(definition.aggregateType)
	);
}

function settleOnce<O extends OperationOutcome>(
	arrival: Arrival,
	stored: StoredOperation,
	note: QuarantineNote,
	decideFirst: (tx: Executor) => O,
	withholds: (tx: Executor, outcome: O) => boolean = () => false
): O | Quarantined {
	return arrival.context.db.transaction((tx) => {
		const previous = tx
			.select({ opHash: operation.opHash, result: operation.result })
			.from(operation)
			.where(eq(operation.opId, stored.opId))
			.get();
		if (previous?.opHash === stored.opHash) {
			return previous.result as O;
		}
		if (previous) {
			return quarantine(tx, arrival, note, "opIdReused");
		}
		const outcome = decideFirst(tx);
		tx.insert(operation)
			.values({
				...stored,
				opHash: withholds(tx, outcome) ? redactedOpHash : stored.opHash,
				receivedAt: arrival.now,
				result: outcome,
				status: outcome.kind,
			})
			.run();
		return outcome;
	});
}

function pushValid(arrival: Arrival, op: SyncOperation): OperationOutcome {
	return settleOnce(
		arrival,
		{
			aggregateId: op.aggregateId,
			aggregateType: op.aggregateType,
			baseVersion: op.baseVersion,
			command: op.command,
			deviceId: arrival.device.id,
			epoch: op.epoch,
			occurredAt: new Date(op.occurredAt),
			opHash: hashOf(op),
			opId: op.opId,
		},
		noteOf(op),
		(tx) => decideNew(tx, { ...arrival, op }, readInstallation(tx)),
		(tx, outcome) => withholdsHash(tx, op, outcome)
	);
}

function pushInvalid(
	arrival: Arrival,
	item: unknown
): { opId: string | null; outcome: Quarantined } {
	const { command, epoch, opId } = envelopeHintSchema.parse(item);
	const note = { command, occurredAt: null, opId };
	if (opId === null) {
		return {
			opId,
			outcome: quarantine(arrival.context.db, arrival, note, "invalidEnvelope"),
		};
	}
	return {
		opId,
		outcome: settleOnce(
			arrival,
			{
				command,
				deviceId: arrival.device.id,
				epoch,
				opHash: operationHash(item),
				opId,
			},
			note,
			(tx) => quarantine(tx, arrival, note, "invalidEnvelope"),
			() => isPersonalCommand(command)
		),
	};
}

function collect(
	result: PushResult,
	opId: string,
	outcome: OperationOutcome
): void {
	if (outcome.kind === "quarantined") {
		result.quarantined.push({ opId, reason: outcome.reason });
	} else if (outcome.kind === "accepted") {
		result.accepted.push({ newVersion: outcome.newVersion, opId });
	} else {
		result.conflicts.push({
			conflictId: outcome.conflictId,
			current: outcome.current,
			currentVersion: outcome.currentVersion,
			opId,
		});
	}
}

export function pushOperations(
	context: PushContext,
	device: DeviceRow,
	items: unknown[]
): PushResult {
	const result: PushResult = {
		accepted: [],
		conflicts: [],
		cursor: "0",
		epoch: "",
		exceptions: [],
		quarantined: [],
	};
	for (const item of items) {
		const arrival = { context, device, now: context.now() };
		const parsed = operationSchema.safeParse(item);
		if (parsed.success) {
			collect(result, parsed.data.opId, pushValid(arrival, parsed.data));
		} else {
			const { opId, outcome } = pushInvalid(arrival, item);
			result.quarantined.push({ opId, reason: outcome.reason });
		}
	}
	result.cursor = latestCursor(context.db);
	result.epoch = readInstallation(context.db).epoch;
	return result;
}

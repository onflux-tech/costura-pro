import { operation } from "@costura-pro/db/schema/sync";
import { canonicalJson } from "@costura-pro/domain/canonical-json";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";

import type { AggregateType } from "./change-log";
import type { Context } from "./context";
import type { Executor } from "./executor";
import { sha256Hex } from "./hashing";
import { readInstallation } from "./installation/store";

export type DirectCommand<T> = {
	aggregate?: { id: string; type: AggregateType };
	command: string;
	input: unknown;
	opId: string;
	redact?: Partial<T>;
};

export type Recorded<T> = { readonly recorded: T };

export type RecordResult = <T>(db: Executor, result: T) => Recorded<T>;

type Stored<T> = { found: false } | { found: true; result: T };

const inFlight = new Map<string, Promise<unknown>>();

export function operationHash(value: unknown): string {
	return sha256Hex(canonicalJson(value));
}

function storedResult<T>(
	db: Executor,
	opId: string,
	opHash: string
): Stored<T> {
	const stored = db
		.select({ opHash: operation.opHash, result: operation.result })
		.from(operation)
		.where(eq(operation.opId, opId))
		.get();
	if (!stored) {
		return { found: false };
	}
	if (stored.opHash !== opHash) {
		throw new ORPCError("CONFLICT", {
			message: "opId reutilizado com conteúdo diferente",
		});
	}
	return { found: true, result: stored.result as T };
}

function queued<T>(opId: string, run: () => Promise<T>): Promise<T> {
	const previous = inFlight.get(opId) ?? Promise.resolve();
	const current = previous.catch(() => undefined).then(run);
	inFlight.set(opId, current);
	return current.finally(() => {
		if (inFlight.get(opId) === current) {
			inFlight.delete(opId);
		}
	});
}

export async function runDirectCommand<T extends object>(
	{ db, now }: Pick<Context, "db" | "now">,
	{ aggregate, command, input, opId, redact }: DirectCommand<NoInfer<T>>,
	handler: (record: RecordResult) => Promise<Recorded<T>> | Recorded<T>
): Promise<T> {
	const opHash = operationHash({ command, input });
	const record: RecordResult = (executor, result) => {
		executor
			.insert(operation)
			.values({
				aggregateId: aggregate?.id ?? null,
				aggregateType: aggregate?.type ?? null,
				command,
				epoch: readInstallation(executor).epoch,
				opHash,
				opId,
				receivedAt: now(),
				result: { ...(result as unknown as T), ...redact },
				status: "accepted",
			})
			.run();
		return { recorded: result };
	};
	return await queued(opId, async () => {
		const stored = storedResult<T>(db, opId, opHash);
		if (stored.found) {
			return stored.result;
		}
		return (await handler(record)).recorded;
	});
}

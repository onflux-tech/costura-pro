import { ORPCError } from "@orpc/server";

import { commandMessages } from "./command-messages";
import type { Context } from "./context";
import { readInstallation } from "./installation/store";
import { runDirectCommand } from "./operations";
import {
	type CreateCommandName,
	type CreateDefinition,
	type CreateRejection,
	syncCommands,
	type UpdateCommandName,
	type UpdateDefinition,
} from "./sync/commands";

export type CommandMessages = { anonymized: string; notFound: string };

function rejectionError(
	rejection: CreateRejection,
	messages: CommandMessages
): ORPCError<string, unknown> {
	if (rejection.reason === "aggregateNotFound") {
		return new ORPCError("NOT_FOUND", {
			message: rejection.message ?? messages.notFound,
		});
	}
	if (rejection.reason === "aggregateExists") {
		return new ORPCError("CONFLICT", {
			message: rejection.message ?? commandMessages.aggregateExists,
		});
	}
	return new ORPCError("PRECONDITION_FAILED", {
		message: messages.anonymized,
	});
}

type CommandContext = Pick<Context, "db" | "now">;

type CommandInput = {
	aggregateId: string;
	messages: CommandMessages;
	opId: string;
	values: Record<string, unknown>;
};

export function runCreateCommand(
	context: CommandContext,
	{
		aggregateId,
		command,
		messages,
		opId,
		values,
	}: CommandInput & { command: CreateCommandName }
): Promise<{ id: string; version: number }> {
	const definition: CreateDefinition = syncCommands[command];
	return runDirectCommand(
		context,
		{
			aggregate: { id: aggregateId, type: definition.aggregateType },
			command,
			input: { aggregateId, values },
			opId,
		},
		(record) => {
			const now = context.now();
			return context.db.transaction((tx) => {
				if (definition.exists(tx, aggregateId)) {
					throw new ORPCError("CONFLICT", {
						message: commandMessages.aggregateExists,
					});
				}
				const created = definition.create(tx, aggregateId, values, {
					epoch: readInstallation(tx).epoch,
					now,
					opId,
				});
				if (typeof created !== "number") {
					throw rejectionError(created, messages);
				}
				return record(tx, { id: aggregateId, version: created });
			});
		}
	);
}

export function runUpdateCommand(
	context: CommandContext,
	{
		aggregateId,
		baseVersion,
		command,
		messages,
		opId,
		values,
	}: CommandInput & { baseVersion: number; command: UpdateCommandName }
): Promise<{ version: number }> {
	const definition: UpdateDefinition = syncCommands[command];
	return runDirectCommand(
		context,
		{
			aggregate: { id: aggregateId, type: definition.aggregateType },
			command,
			input: { aggregateId, baseVersion, values },
			opId,
		},
		(record) => {
			const now = context.now();
			return context.db.transaction((tx) => {
				const loaded = definition.load(tx, aggregateId);
				if (!loaded) {
					throw new ORPCError("NOT_FOUND", { message: messages.notFound });
				}
				if (loaded.anonymized) {
					throw new ORPCError("PRECONDITION_FAILED", {
						message: messages.anonymized,
					});
				}
				if (loaded.version !== baseVersion) {
					throw new ORPCError("CONFLICT", {
						data: { current: loaded.snapshot, currentVersion: loaded.version },
						message: commandMessages.staleVersion,
					});
				}
				return record(tx, {
					version: loaded.apply(values, {
						epoch: readInstallation(tx).epoch,
						now,
						opId,
					}),
				});
			});
		}
	);
}

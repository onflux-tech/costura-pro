import type { Database } from "@costura-pro/db";
import z from "zod";

import type { AggregateType } from "../change-log";
import { clientCommands } from "../clients/commands";
import {
	type ChangeStamp,
	deviceSnapshot,
	readDevice,
	updateDevice,
} from "../devices/store";
import type { Executor } from "../executor";
import { financeCommands } from "../finance/commands";
import {
	installationSnapshot,
	readInstallation,
	updateInstallation,
} from "../installation/store";
import { inventoryCommands } from "../inventory/commands";
import { materialCommands } from "../materials/commands";
import { measurementCommands } from "../measurements/commands";
import { productCommands } from "../products/commands";
import { purchaseCommands } from "../purchases/commands";
import { quoteCommands } from "../quotes/commands";
import { receivedItemCommands } from "../received-items/commands";
import { atelierNameSchema, deviceNameSchema } from "../schemas";
import { serviceCommands } from "../services/commands";
import { stockCommands } from "../stock/commands";

export type CommandExecutor = Executor & Pick<Database, "select">;

export type LoadedAggregate = {
	anonymized: boolean;
	apply: (values: unknown, stamp: ChangeStamp) => number;
	snapshot: unknown;
	values: Record<string, unknown>;
	version: number;
};

export type CreateRejection = {
	message?: string;
	reason: "aggregateAnonymized" | "aggregateExists" | "aggregateNotFound";
};

export type CreateDefinition = {
	aggregateType: AggregateType;
	create: (
		db: CommandExecutor,
		id: string,
		values: Record<string, unknown>,
		stamp: ChangeStamp
	) => CreateRejection | number;
	exists: (db: CommandExecutor, id: string) => boolean;
	kind: "create";
	payload: z.ZodType<Record<string, unknown>>;
};

export type UpdateDefinition = {
	aggregateType: AggregateType;
	kind: "update";
	load: (db: CommandExecutor, id: string) => LoadedAggregate | undefined;
	payload: z.ZodType<Record<string, unknown>>;
};

export type CommandDefinition = CreateDefinition | UpdateDefinition;

const setAtelierNamePayload = z.object({ atelierName: atelierNameSchema });
const renameDevicePayload = z.object({ name: deviceNameSchema });

const renameDevice: UpdateDefinition = {
	aggregateType: "device",
	kind: "update",
	load: (db, id) => {
		const row = readDevice(db, id);
		if (!row) {
			return;
		}
		return {
			anonymized: false,
			apply: (values, stamp) =>
				updateDevice(
					db,
					row,
					{ name: renameDevicePayload.parse(values).name },
					stamp
				).version,
			snapshot: deviceSnapshot(row),
			values: { name: row.name },
			version: row.version,
		};
	},
	payload: renameDevicePayload,
};

const setAtelierName: UpdateDefinition = {
	aggregateType: "installation",
	kind: "update",
	load: (db, id) => {
		const row = readInstallation(db);
		if (row.id !== id) {
			return;
		}
		return {
			anonymized: false,
			apply: (values, stamp) =>
				updateInstallation(
					db,
					row,
					{ atelierName: setAtelierNamePayload.parse(values).atelierName },
					stamp
				).version,
			snapshot: installationSnapshot(row),
			values: { atelierName: row.atelierName },
			version: row.version,
		};
	},
	payload: setAtelierNamePayload,
};

export const syncCommands = {
	...clientCommands,
	...financeCommands,
	...inventoryCommands,
	...materialCommands,
	...measurementCommands,
	...productCommands,
	...purchaseCommands,
	...quoteCommands,
	...receivedItemCommands,
	...serviceCommands,
	...stockCommands,
	"device.rename": renameDevice,
	"installation.setAtelierName": setAtelierName,
} satisfies Record<string, CommandDefinition>;

type Commands = typeof syncCommands;

type NamesOf<K extends CommandDefinition["kind"]> = {
	[N in keyof Commands]: Commands[N] extends { kind: K } ? N : never;
}[keyof Commands];

export type CreateCommandName = NamesOf<"create">;
export type UpdateCommandName = NamesOf<"update">;

export function commandNamed(command: string): CommandDefinition | undefined {
	return Object.hasOwn(syncCommands, command)
		? syncCommands[command as keyof Commands]
		: undefined;
}

export function findCommand(
	command: string,
	aggregateType: string
): CommandDefinition | undefined {
	const definition = commandNamed(command);
	return definition?.aggregateType === aggregateType ? definition : undefined;
}

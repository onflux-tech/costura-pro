import type { Database } from "@costura-pro/db";
import z from "zod";

import type { AggregateType } from "../change-log";
import {
	type ChangeStamp,
	deviceSnapshot,
	readDevice,
	updateDevice,
} from "../devices/store";
import type { Executor } from "../executor";
import {
	installationSnapshot,
	readInstallation,
	updateInstallation,
} from "../installation/store";
import { atelierNameSchema, deviceNameSchema } from "../schemas";

export type LoadedAggregate = {
	apply: (values: unknown, stamp: ChangeStamp) => number;
	snapshot: unknown;
	values: Record<string, unknown>;
	version: number;
};

export type CommandDefinition = {
	aggregateType: AggregateType;
	load: (
		db: Executor & Pick<Database, "select">,
		id: string
	) => LoadedAggregate | undefined;
	payload: z.ZodType<Record<string, unknown>>;
};

const setAtelierNamePayload = z.object({ atelierName: atelierNameSchema });
const renameDevicePayload = z.object({ name: deviceNameSchema });

export const syncCommands: Record<string, CommandDefinition> = {
	"device.rename": {
		aggregateType: "device",
		load: (db, id) => {
			const row = readDevice(db, id);
			if (!row) {
				return;
			}
			return {
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
	},
	"installation.setAtelierName": {
		aggregateType: "installation",
		load: (db, id) => {
			const row = readInstallation(db);
			if (row.id !== id) {
				return;
			}
			return {
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
	},
};

export function findCommand(
	command: string,
	aggregateType: string
): CommandDefinition | undefined {
	const definition = Object.hasOwn(syncCommands, command)
		? syncCommands[command]
		: undefined;
	return definition?.aggregateType === aggregateType ? definition : undefined;
}

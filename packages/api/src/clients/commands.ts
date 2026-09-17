import type z from "zod";

import type { ChangeStamp } from "../devices/store";
import type {
	CommandExecutor,
	CreateDefinition,
	UpdateDefinition,
} from "../sync/commands";
import {
	clientCreatePayload,
	clientPatchPayload,
	emptyPayload,
	profileCreatePayload,
	profilePatchPayload,
} from "./schemas";
import {
	type ClientPatch,
	type ClientRow,
	clientSnapshot,
	insertClient,
	insertProfile,
	isProfileAnonymized,
	type ProfilePatch,
	type ProfileRow,
	profileSnapshot,
	readClient,
	readProfile,
	updateClient,
	updateProfile,
} from "./store";

type PatchFor<Row, Values, Patch> = (
	row: Row,
	values: Values,
	now: Date
) => Patch | null;

type Archivable = { archivedAt: Date | null };

function definedFields<T extends Record<string, unknown>>(values: T) {
	return Object.fromEntries(
		Object.entries(values).filter(([, value]) => value !== undefined)
	) as { [K in keyof T]: Exclude<T[K], undefined> };
}

function clientCommand<T extends Record<string, unknown>>(
	payload: z.ZodType<T>,
	patchFor: PatchFor<ClientRow, T, ClientPatch>
): UpdateDefinition {
	return {
		aggregateType: "client",
		kind: "update",
		load: (db: CommandExecutor, id: string) => {
			const row = readClient(db, id);
			if (!row) {
				return;
			}
			return {
				anonymized: row.anonymizedAt !== null,
				apply: (values: unknown, stamp: ChangeStamp) => {
					const patch = patchFor(row, payload.parse(values), stamp.now);
					return patch
						? updateClient(db, row, patch, stamp).version
						: row.version;
				},
				snapshot: clientSnapshot(row),
				values: { ...clientSnapshot(row) },
				version: row.version,
			};
		},
		payload,
	};
}

function profileCommand<T extends Record<string, unknown>>(
	payload: z.ZodType<T>,
	patchFor: PatchFor<ProfileRow, T, ProfilePatch>
): UpdateDefinition {
	return {
		aggregateType: "profile",
		kind: "update",
		load: (db: CommandExecutor, id: string) => {
			const row = readProfile(db, id);
			if (!row) {
				return;
			}
			return {
				anonymized: isProfileAnonymized(db, row),
				apply: (values: unknown, stamp: ChangeStamp) => {
					const patch = patchFor(row, payload.parse(values), stamp.now);
					return patch
						? updateProfile(db, row, patch, stamp).version
						: row.version;
				},
				snapshot: profileSnapshot(row),
				values: { ...profileSnapshot(row) },
				version: row.version,
			};
		},
		payload,
	};
}

function archivePatch(row: Archivable, _values: unknown, now: Date) {
	return row.archivedAt ? null : { archivedAt: now };
}

function unarchivePatch(row: Archivable) {
	return row.archivedAt ? { archivedAt: null } : null;
}

const createClient: CreateDefinition = {
	aggregateType: "client",
	create: (db, id, values, stamp) =>
		insertClient(db, id, clientCreatePayload.parse(values), stamp).version,
	exists: (db, id) => readClient(db, id) !== undefined,
	kind: "create",
	payload: clientCreatePayload,
};

const createProfile: CreateDefinition = {
	aggregateType: "profile",
	create: (db, id, values, stamp) => {
		const fields = profileCreatePayload.parse(values);
		const owner = readClient(db, fields.clientId);
		if (!owner) {
			return { reason: "aggregateNotFound" };
		}
		if (owner.anonymizedAt) {
			return { reason: "aggregateAnonymized" };
		}
		return insertProfile(db, id, fields, stamp).version;
	},
	exists: (db, id) => readProfile(db, id) !== undefined,
	kind: "create",
	payload: profileCreatePayload,
};

export const clientCommands = {
	"client.archive": clientCommand(emptyPayload, archivePatch),
	"client.create": createClient,
	"client.unarchive": clientCommand(emptyPayload, unarchivePatch),
	"client.update": clientCommand(clientPatchPayload, (_row, values) =>
		definedFields(values)
	),
	"profile.archive": profileCommand(emptyPayload, archivePatch),
	"profile.create": createProfile,
	"profile.unarchive": profileCommand(emptyPayload, unarchivePatch),
	"profile.update": profileCommand(profilePatchPayload, (_row, values) =>
		definedFields(values)
	),
};

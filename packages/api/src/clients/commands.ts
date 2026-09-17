import { emptyPayload } from "../schemas";
import type { CreateDefinition } from "../sync/commands";
import {
	archivePatch,
	definedFields,
	unarchivePatch,
	updateCommands,
} from "../update-command";
import {
	clientCreatePayload,
	clientPatchPayload,
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

const clientCommand = updateCommands<ClientRow, ClientPatch>({
	aggregateType: "client",
	anonymized: (_db, row) => row.anonymizedAt !== null,
	read: readClient,
	snapshot: clientSnapshot,
	update: updateClient,
});

const profileCommand = updateCommands<ProfileRow, ProfilePatch>({
	aggregateType: "profile",
	anonymized: isProfileAnonymized,
	read: readProfile,
	snapshot: profileSnapshot,
	update: updateProfile,
});

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

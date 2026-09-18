import {
	type InstallationPatch,
	type InstallationRow,
	installationSnapshot,
	readInstallation,
	updateInstallation,
} from "../installation/store";
import { emptyPayload } from "../schemas";
import type { CreateDefinition } from "../sync/commands";
import {
	archivePatch,
	definedFields,
	unarchivePatch,
	updateCommands,
} from "../update-command";
import {
	serviceCreatePayload,
	servicePatchPayload,
	targetMarginPayload,
} from "./schemas";
import {
	insertService,
	readService,
	type ServicePatch,
	type ServiceRow,
	serviceSnapshot,
	updateService,
} from "./store";

const serviceCommand = updateCommands<ServiceRow, ServicePatch>({
	aggregateType: "service",
	anonymized: () => false,
	read: readService,
	snapshot: serviceSnapshot,
	update: updateService,
});

const installationCommand = updateCommands<InstallationRow, InstallationPatch>({
	aggregateType: "installation",
	anonymized: () => false,
	read: (db, id) => {
		const row = readInstallation(db);
		return row.id === id ? row : undefined;
	},
	snapshot: installationSnapshot,
	update: updateInstallation,
});

const createService: CreateDefinition = {
	aggregateType: "service",
	create: (db, id, values, stamp) =>
		insertService(db, id, serviceCreatePayload.parse(values), stamp).version,
	exists: (db, id) => readService(db, id) !== undefined,
	kind: "create",
	payload: serviceCreatePayload,
};

export const serviceCommands = {
	"installation.setTargetMargin": installationCommand(
		targetMarginPayload,
		(row, values) =>
			row.targetMarginBasisPoints === values.targetMarginBasisPoints
				? null
				: { targetMarginBasisPoints: values.targetMarginBasisPoints }
	),
	"service.archive": serviceCommand(emptyPayload, archivePatch),
	"service.create": createService,
	"service.unarchive": serviceCommand(emptyPayload, unarchivePatch),
	"service.update": serviceCommand(servicePatchPayload, (_row, values) =>
		definedFields(values)
	),
};

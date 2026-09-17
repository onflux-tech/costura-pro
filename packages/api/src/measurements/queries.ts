import type { Database } from "@costura-pro/db";
import { ORPCError } from "@orpc/server";

import { listProfiles, readClient } from "../clients/store";
import { commandMessages } from "../command-messages";
import {
	listMeasurementsOfProfiles,
	listTemplates,
	measurementSnapshot,
	templateSnapshot,
} from "./store";

type Reader = Pick<Database, "select">;

export function listTemplateItems(db: Reader) {
	return {
		items: listTemplates(db).map((row) => ({
			...templateSnapshot(row),
			updatedAt: row.updatedAt.toISOString(),
		})),
	};
}

export function listClientMeasurements(db: Reader, clientId: string) {
	if (!readClient(db, clientId)) {
		throw new ORPCError("NOT_FOUND", {
			message: commandMessages.clientNotFound,
		});
	}
	const profileIds = listProfiles(db, clientId).map((profile) => profile.id);
	return {
		items: listMeasurementsOfProfiles(db, profileIds).map((row) => ({
			...measurementSnapshot(row),
			updatedAt: row.updatedAt.toISOString(),
		})),
	};
}

import { truncateWal } from "@costura-pro/db";
import {
	anonymizedClientName,
	anonymizedProfileName,
} from "@costura-pro/domain/client";
import { ORPCError } from "@orpc/server";

import { appendAudit } from "../audit";
import { commandMessages } from "../command-messages";
import type { Context } from "../context";
import { readInstallation } from "../installation/store";
import {
	listMeasurementsOfProfiles,
	measurementSnapshot,
	updateMeasurement,
} from "../measurements/store";
import { runDirectCommand } from "../operations";
import { redactHistory } from "../redaction";
import {
	clientSnapshot,
	listProfiles,
	profileSnapshot,
	readClient,
	updateClient,
	updateProfile,
} from "./store";

export async function anonymizeClient(
	context: Pick<Context, "access" | "db" | "log" | "now">,
	input: { baseVersion: number; clientId: string; opId: string }
): Promise<{ version: number }> {
	const result = await runDirectCommand(
		context,
		{
			aggregate: { id: input.clientId, type: "client" },
			command: "client.anonymize",
			input: { baseVersion: input.baseVersion, clientId: input.clientId },
			opId: input.opId,
		},
		(record) => {
			const now = context.now();
			return context.db.transaction((tx) => {
				const current = readClient(tx, input.clientId);
				if (!current) {
					throw new ORPCError("NOT_FOUND", {
						message: commandMessages.clientNotFound,
					});
				}
				if (current.anonymizedAt) {
					throw new ORPCError("PRECONDITION_FAILED", {
						message: commandMessages.clientAnonymized,
					});
				}
				if (current.version !== input.baseVersion) {
					throw new ORPCError("CONFLICT", {
						data: {
							current: clientSnapshot(current),
							currentVersion: current.version,
						},
						message: commandMessages.staleVersion,
					});
				}
				const stamp = {
					epoch: readInstallation(tx).epoch,
					now,
					opId: input.opId,
				};
				const profiles = listProfiles(tx, current.id);
				const next = updateClient(
					tx,
					current,
					{
						address: null,
						anonymizedAt: now,
						archivedAt: current.archivedAt ?? now,
						email: null,
						name: anonymizedClientName,
						notes: null,
						phone: null,
						secondaryPhone: null,
					},
					stamp
				);
				redactHistory(
					tx,
					{ current: clientSnapshot(next), id: next.id, type: "client" },
					stamp
				);
				for (const profile of profiles) {
					const anonymized = updateProfile(
						tx,
						profile,
						{
							archivedAt: profile.archivedAt ?? now,
							name: anonymizedProfileName,
							notes: null,
						},
						stamp
					);
					redactHistory(
						tx,
						{
							current: profileSnapshot(anonymized),
							id: anonymized.id,
							type: "profile",
						},
						stamp
					);
				}
				const measurements = listMeasurementsOfProfiles(
					tx,
					profiles.map((profile) => profile.id)
				);
				for (const row of measurements) {
					const anonymized = updateMeasurement(
						tx,
						row,
						{
							archivedAt: row.archivedAt ?? now,
							fields: row.fields.map((field) => ({ ...field, valueMm: null })),
							notes: null,
						},
						stamp
					);
					redactHistory(
						tx,
						{
							current: measurementSnapshot(anonymized),
							id: anonymized.id,
							type: "measurement",
						},
						stamp
					);
				}
				appendAudit(
					tx,
					now,
					{
						access: context.access,
						details: {
							clientId: next.id,
							measurements: measurements.length,
							profiles: profiles.length,
						},
						outcome: "succeeded",
						type: "client.anonymized",
					},
					context.log
				);
				return record(tx, { version: next.version });
			});
		}
	);
	truncateWal(context.db);
	return result;
}

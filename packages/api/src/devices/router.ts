import { device, deviceActivationCode } from "@costura-pro/db/schema/sync";
import {
	encodeAccessCode,
	normalizeAccessCode,
} from "@costura-pro/domain/access-code";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import z from "zod";

import { appendAudit } from "../audit";
import type { Context } from "../context";
import { hmacSha256Hex, randomBuffer } from "../hashing";
import { readyLocalProcedure, readyProcedure } from "../index";
import { readInstallation } from "../installation/store";
import { runDirectCommand } from "../operations";
import { deviceNameSchema, opIdSchema } from "../schemas";
import {
	deviceSnapshot,
	insertDevice,
	readDevice,
	updateDevice,
} from "./store";

export const activationCodeLength = 8;
export const activationCodeTtlMs = 600_000;

const deviceIdInput = z.object({ deviceId: z.uuid(), opId: opIdSchema });

async function activationCodeHash(
	auth: Context["auth"],
	normalized: string
): Promise<string> {
	const { secret } = await auth.$context;
	return hmacSha256Hex(secret, normalized);
}

function requireDevice(db: Parameters<typeof readDevice>[0], id: string) {
	const row = readDevice(db, id);
	if (!row) {
		throw new ORPCError("NOT_FOUND", { message: "Dispositivo não encontrado" });
	}
	return row;
}

export const devicesRouter = {
	approve: readyLocalProcedure
		.input(deviceIdInput)
		.handler(({ context, input }) =>
			runDirectCommand(
				context,
				{
					command: "devices.approve",
					input: { deviceId: input.deviceId },
					opId: input.opId,
				},
				(record) => {
					const now = context.now();
					return context.db.transaction((tx) => {
						const current = requireDevice(tx, input.deviceId);
						if (current.status === "revoked") {
							throw new ORPCError("PRECONDITION_FAILED", {
								message: "Dispositivo revogado",
							});
						}
						if (current.status === "approved") {
							return record(tx, {
								status: current.status,
								version: current.version,
							});
						}
						const next = updateDevice(
							tx,
							current,
							{ approvedAt: now, status: "approved" },
							{ epoch: readInstallation(tx).epoch, now, opId: input.opId }
						);
						appendAudit(
							tx,
							now,
							{
								access: context.access,
								deviceId: next.id,
								outcome: "succeeded",
								type: "device.approved",
							},
							context.log
						);
						return record(tx, { status: next.status, version: next.version });
					});
				}
			)
		),

	createActivationCode: readyLocalProcedure
		.input(z.object({ opId: opIdSchema }))
		.handler(({ context, input }) =>
			runDirectCommand(
				context,
				{
					command: "devices.createActivationCode",
					input: {},
					opId: input.opId,
					redact: { code: null },
				},
				async (record) => {
					const now = context.now();
					const code = encodeAccessCode(
						randomBuffer(activationCodeLength),
						activationCodeLength
					);
					const codeHash = await activationCodeHash(
						context.auth,
						code.replace("-", "")
					);
					const expiresAt = new Date(now.getTime() + activationCodeTtlMs);
					return context.db.transaction((tx) => {
						tx.update(deviceActivationCode)
							.set({ usedAt: now })
							.where(isNull(deviceActivationCode.usedAt))
							.run();
						tx.insert(deviceActivationCode)
							.values({
								codeHash,
								createdAt: now,
								expiresAt,
								id: crypto.randomUUID(),
							})
							.run();
						appendAudit(
							tx,
							now,
							{
								access: context.access,
								outcome: "succeeded",
								type: "device.activation_code_created",
							},
							context.log
						);
						return record(tx, {
							code: code as string | null,
							expiresAt: expiresAt.toISOString(),
						});
					});
				}
			)
		),

	list: readyLocalProcedure.handler(({ context }) =>
		context.db
			.select()
			.from(device)
			.orderBy(asc(device.createdAt))
			.all()
			.map(deviceSnapshot)
	),

	register: readyProcedure
		.input(
			z.object({
				activationCode: z.string().max(32).optional(),
				name: deviceNameSchema,
				opId: opIdSchema,
			})
		)
		.handler(({ context, input }) =>
			runDirectCommand(
				context,
				{
					command: "devices.register",
					input: {
						name: input.name,
						withCode: input.activationCode !== undefined,
					},
					opId: input.opId,
					redact: { deviceSecret: null },
				},
				async (record) => {
					const now = context.now();
					const normalized =
						input.activationCode === undefined
							? undefined
							: normalizeAccessCode(input.activationCode, activationCodeLength);
					const codeHash = normalized
						? await activationCodeHash(context.auth, normalized)
						: undefined;
					const validCode = codeHash
						? context.db
								.select({ id: deviceActivationCode.id })
								.from(deviceActivationCode)
								.where(
									and(
										eq(deviceActivationCode.codeHash, codeHash),
										isNull(deviceActivationCode.usedAt),
										gt(deviceActivationCode.expiresAt, now)
									)
								)
								.get()
						: undefined;
					if (input.activationCode !== undefined && !validCode) {
						appendAudit(
							context.db,
							now,
							{
								access: context.access,
								ip: context.ip,
								outcome: "failed",
								type: "device.registered",
							},
							context.log
						);
						throw new ORPCError("UNAUTHORIZED", {
							message: "Código de ativação inválido",
						});
					}
					return context.db.transaction((tx) => {
						const stamp = {
							epoch: readInstallation(tx).epoch,
							now,
							opId: input.opId,
						};
						const { row, secret } = insertDevice(
							tx,
							{ name: input.name, status: validCode ? "approved" : "pending" },
							stamp
						);
						if (validCode) {
							const consumed = tx
								.update(deviceActivationCode)
								.set({ deviceId: row.id, usedAt: now })
								.where(
									and(
										eq(deviceActivationCode.id, validCode.id),
										isNull(deviceActivationCode.usedAt)
									)
								)
								.returning({ id: deviceActivationCode.id })
								.all();
							if (consumed.length !== 1) {
								throw new ORPCError("UNAUTHORIZED", {
									message: "Código de ativação inválido",
								});
							}
						}
						appendAudit(
							tx,
							now,
							{
								access: context.access,
								deviceId: row.id,
								ip: context.ip,
								outcome: "succeeded",
								type: "device.registered",
							},
							context.log
						);
						return record(tx, {
							deviceId: row.id,
							deviceSecret: secret as string | null,
							status: row.status,
						});
					});
				}
			)
		),

	revoke: readyLocalProcedure
		.input(deviceIdInput)
		.handler(({ context, input }) =>
			runDirectCommand(
				context,
				{
					command: "devices.revoke",
					input: { deviceId: input.deviceId },
					opId: input.opId,
				},
				(record) => {
					const now = context.now();
					return context.db.transaction((tx) => {
						const current = requireDevice(tx, input.deviceId);
						if (current.status === "revoked") {
							return record(tx, {
								status: current.status,
								version: current.version,
							});
						}
						const next = updateDevice(
							tx,
							current,
							{ revokedAt: now, status: "revoked" },
							{ epoch: readInstallation(tx).epoch, now, opId: input.opId }
						);
						appendAudit(
							tx,
							now,
							{
								access: context.access,
								deviceId: next.id,
								outcome: "succeeded",
								type: "device.revoked",
							},
							context.log
						);
						return record(tx, { status: next.status, version: next.version });
					});
				}
			)
		),
};

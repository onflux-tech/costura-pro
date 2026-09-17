import { ownerEmail } from "@costura-pro/auth";
import {
	installation,
	recoveryCode,
} from "@costura-pro/db/schema/installation";
import {
	isAtLeast,
	isBeforeOwner,
} from "@costura-pro/domain/installation-state";
import { ORPCError } from "@orpc/server";
import { count, eq, isNull } from "drizzle-orm";
import z from "zod";

import { appendAudit } from "../audit";
import type { Context } from "../context";
import { localProcedure, ownerLocalProcedure, publicProcedure } from "../index";
import { runDirectCommand } from "../operations";
import { generateRecoveryCodes } from "../recovery/codes";
import {
	atelierNameSchema,
	opIdSchema,
	passwordSchema,
	usernameSchema,
} from "../schemas";
import {
	BackupFolderError,
	listFolders,
	testBackupFolder,
} from "./backup-folder";
import {
	installationSnapshot,
	readInstallation,
	removeOrphanUsers,
	requireInstallationState,
	updateInstallation,
} from "./store";

function asBadRequest(error: unknown): never {
	if (error instanceof BackupFolderError) {
		throw new ORPCError("BAD_REQUEST", {
			cause: error,
			message: error.message,
		});
	}
	throw error;
}

function requireOwnerUnlessBeforeAccount(
	context: Pick<Context, "db" | "session">
) {
	const current = readInstallation(context.db);
	if (!(isBeforeOwner(current.state) || context.session?.user)) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return current;
}

export const installationRouter = {
	confirmRecoveryCodes: ownerLocalProcedure
		.input(z.object({ opId: opIdSchema }))
		.handler(({ context, input }) =>
			runDirectCommand(
				context,
				{
					command: "installation.confirmRecoveryCodes",
					input: {},
					opId: input.opId,
				},
				(record) => {
					const now = context.now();
					return context.db.transaction((tx) => {
						const current = requireInstallationState(
							tx,
							(state) => state === "account"
						);
						const [codes] = tx
							.select({ unused: count() })
							.from(recoveryCode)
							.where(isNull(recoveryCode.usedAt))
							.all();
						if ((codes?.unused ?? 0) === 0) {
							throw new ORPCError("PRECONDITION_FAILED", {
								data: { state: current.state },
								message: "Gere os códigos antes de confirmar",
							});
						}
						updateInstallation(
							tx,
							current,
							{ state: "recovery" },
							{ now, opId: input.opId }
						);
						appendAudit(
							tx,
							now,
							{
								access: context.access,
								outcome: "succeeded",
								type: "recovery_codes.confirmed",
							},
							context.log
						);
						return record(tx, { ok: true as const });
					});
				}
			)
		),

	createOwner: localProcedure
		.input(
			z.object({
				opId: opIdSchema,
				password: passwordSchema,
				username: usernameSchema,
			})
		)
		.handler(({ context, input }) =>
			runDirectCommand(
				context,
				{
					command: "installation.createOwner",
					input: { username: input.username },
					opId: input.opId,
				},
				async (record) => {
					const now = context.now();
					context.db.transaction((tx) => {
						const current = requireInstallationState(
							tx,
							(state) => state === "atelier"
						);
						updateInstallation(
							tx,
							current,
							{ state: "account" },
							{ now, opId: input.opId }
						);
					});
					const created = await context.auth.api
						.signUpEmail({
							body: {
								email: ownerEmail,
								name: input.username,
								password: input.password,
								username: input.username,
							},
						})
						.catch(() => null);
					const userId = created?.user.id;
					if (!userId) {
						context.db.transaction((tx) => {
							removeOrphanUsers(tx);
							updateInstallation(
								tx,
								readInstallation(tx),
								{ state: "atelier" },
								{ now, opId: input.opId }
							);
							appendAudit(
								tx,
								now,
								{
									access: context.access,
									outcome: "failed",
									type: "owner.bootstrap_failed",
								},
								context.log
							);
						});
						throw new ORPCError("BAD_REQUEST", {
							message: "Não foi possível criar a conta do dono",
						});
					}
					return context.db.transaction((tx) => {
						tx.update(installation)
							.set({ ownerUserId: userId, updatedAt: now })
							.where(eq(installation.singleton, 1))
							.run();
						appendAudit(
							tx,
							now,
							{
								access: context.access,
								outcome: "succeeded",
								type: "owner.created",
							},
							context.log
						);
						return record(tx, { userId });
					});
				}
			)
		),

	details: localProcedure.handler(({ context }) => {
		const current = requireOwnerUnlessBeforeAccount(context);
		return {
			atelierName: current.atelierName,
			backupFolder: current.backupFolder,
			backupTestedAt: current.backupTestedAt?.toISOString() ?? null,
			version: current.version,
		};
	}),

	finish: ownerLocalProcedure
		.input(z.object({ opId: opIdSchema }))
		.handler(({ context, input }) =>
			runDirectCommand(
				context,
				{ command: "installation.finish", input: {}, opId: input.opId },
				(record) => {
					const now = context.now();
					return context.db.transaction((tx) => {
						const current = requireInstallationState(
							tx,
							(state) => state === "backup"
						);
						updateInstallation(
							tx,
							current,
							{ state: "ready" },
							{ now, opId: input.opId }
						);
						appendAudit(
							tx,
							now,
							{
								access: context.access,
								outcome: "succeeded",
								type: "installation.ready",
							},
							context.log
						);
						return record(tx, { state: "ready" as const });
					});
				}
			)
		),

	generateRecoveryCodes: ownerLocalProcedure
		.input(z.object({ opId: opIdSchema }))
		.handler(({ context, input }) =>
			runDirectCommand(
				context,
				{
					command: "installation.generateRecoveryCodes",
					input: {},
					opId: input.opId,
					redact: { codes: [] },
				},
				(record) => {
					const now = context.now();
					const { codes, hashes } = generateRecoveryCodes();
					return context.db.transaction((tx) => {
						requireInstallationState(tx, (state) =>
							isAtLeast(state, "account")
						);
						tx.delete(recoveryCode).run();
						tx.insert(recoveryCode)
							.values(
								hashes.map((codeHash) => ({
									codeHash,
									createdAt: now,
									id: crypto.randomUUID(),
								}))
							)
							.run();
						appendAudit(
							tx,
							now,
							{
								access: context.access,
								outcome: "succeeded",
								type: "recovery_codes.generated",
							},
							context.log
						);
						return record(tx, { codes });
					});
				}
			)
		),

	listFolders: ownerLocalProcedure
		.input(z.object({ path: z.string().optional() }))
		.handler(async ({ context, input }) => {
			requireInstallationState(context.db, (state) =>
				isAtLeast(state, "recovery")
			);
			return await listFolders(input.path).catch(asBadRequest);
		}),

	setAtelierName: localProcedure
		.input(
			z.object({
				atelierName: atelierNameSchema,
				baseVersion: z.number().int().positive(),
				opId: opIdSchema,
			})
		)
		.handler(({ context, input }) => {
			requireOwnerUnlessBeforeAccount(context);
			return runDirectCommand(
				context,
				{
					command: "installation.setAtelierName",
					input: {
						atelierName: input.atelierName,
						baseVersion: input.baseVersion,
					},
					opId: input.opId,
				},
				(record) => {
					const now = context.now();
					return context.db.transaction((tx) => {
						const current = readInstallation(tx);
						if (current.version !== input.baseVersion) {
							throw new ORPCError("CONFLICT", {
								data: {
									current: installationSnapshot(current),
									currentVersion: current.version,
								},
								message: "Versão desatualizada",
							});
						}
						const next = updateInstallation(
							tx,
							current,
							{
								atelierName: input.atelierName,
								state: current.state === "empty" ? "atelier" : current.state,
							},
							{ now, opId: input.opId }
						);
						appendAudit(
							tx,
							now,
							{
								access: context.access,
								outcome: "succeeded",
								type: "installation.atelier_named",
							},
							context.log
						);
						return record(tx, { version: next.version });
					});
				}
			);
		}),

	status: publicProcedure.handler(({ context }) => ({
		access: context.access,
		state: readInstallation(context.db).state,
	})),

	testBackupFolder: ownerLocalProcedure
		.input(z.object({ opId: opIdSchema, path: z.string().min(1) }))
		.handler(({ context, input }) =>
			runDirectCommand(
				context,
				{
					command: "installation.testBackupFolder",
					input: { path: input.path },
					opId: input.opId,
				},
				async (record) => {
					requireInstallationState(context.db, (state) =>
						isAtLeast(state, "recovery")
					);
					await testBackupFolder(input.path).catch((error: unknown) => {
						appendAudit(
							context.db,
							context.now(),
							{
								access: context.access,
								outcome: "failed",
								type: "backup_folder.tested",
							},
							context.log
						);
						return asBadRequest(error);
					});
					const now = context.now();
					return context.db.transaction((tx) => {
						const current = readInstallation(tx);
						tx.update(installation)
							.set({
								backupFolder: input.path,
								backupTestedAt: now,
								updatedAt: now,
							})
							.where(eq(installation.singleton, 1))
							.run();
						if (current.state === "recovery") {
							updateInstallation(
								tx,
								current,
								{ state: "backup" },
								{ now, opId: input.opId }
							);
						}
						appendAudit(
							tx,
							now,
							{
								access: context.access,
								outcome: "succeeded",
								type: "backup_folder.tested",
							},
							context.log
						);
						return record(tx, {
							ok: true as const,
							testedAt: now.toISOString(),
						});
					});
				}
			)
		),
};

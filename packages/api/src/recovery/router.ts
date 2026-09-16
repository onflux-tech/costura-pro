import { account, session } from "@costura-pro/db/schema/auth";
import { recoveryCode } from "@costura-pro/db/schema/installation";
import { normalizeAccessCode } from "@costura-pro/domain/access-code";
import { isAtLeast } from "@costura-pro/domain/installation-state";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import z from "zod";

import { appendAudit } from "../audit";
import { localProcedure } from "../index";
import {
	readInstallation,
	requireInstallationState,
} from "../installation/store";
import { runDirectCommand } from "../operations";
import { opIdSchema, passwordSchema } from "../schemas";
import { hashAccessCode, recoveryCodeLength } from "./codes";

export const recoveryRouter = {
	resetPassword: localProcedure
		.input(
			z.object({
				code: z.string().min(1).max(64),
				newPassword: passwordSchema,
				opId: opIdSchema,
			})
		)
		.handler(({ context, input }) =>
			runDirectCommand(
				context,
				{ command: "recovery.resetPassword", input: {}, opId: input.opId },
				async (record) => {
					requireInstallationState(context.db, (state) =>
						isAtLeast(state, "recovery")
					);
					const normalized = normalizeAccessCode(
						input.code,
						recoveryCodeLength
					);
					const authContext = await context.auth.$context;
					const passwordHash = await authContext.password.hash(
						input.newPassword
					);
					const now = context.now();
					const reset = context.db.transaction((tx) => {
						const { ownerUserId } = readInstallation(tx);
						if (normalized === null || ownerUserId === null) {
							return null;
						}
						const consumed = tx
							.update(recoveryCode)
							.set({ usedAt: now })
							.where(
								and(
									eq(recoveryCode.codeHash, hashAccessCode(normalized)),
									isNull(recoveryCode.usedAt)
								)
							)
							.returning({ id: recoveryCode.id })
							.all();
						if (consumed.length !== 1) {
							return null;
						}
						tx.update(account)
							.set({ password: passwordHash, updatedAt: now })
							.where(
								and(
									eq(account.userId, ownerUserId),
									eq(account.providerId, "credential")
								)
							)
							.run();
						tx.delete(session).where(eq(session.userId, ownerUserId)).run();
						appendAudit(
							tx,
							now,
							{
								access: context.access,
								outcome: "succeeded",
								type: "recovery.password_reset",
							},
							context.log
						);
						return record(tx, { ok: true as const });
					});
					if (!reset) {
						appendAudit(
							context.db,
							now,
							{
								access: context.access,
								outcome: "failed",
								type: "recovery.code_rejected",
							},
							context.log
						);
						throw new ORPCError("UNAUTHORIZED", {
							message: "Código de recuperação inválido",
						});
					}
					return reset;
				}
			)
		),
};

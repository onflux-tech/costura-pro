import type { Database } from "@costura-pro/db";
import { auditEvent, signInGuard } from "@costura-pro/db/schema/installation";
import { remoteLockDurationMs } from "@costura-pro/domain/sign-in-lockout";
import { eq, sql } from "drizzle-orm";

import { type AuditLog, type AuditOutcome, appendAudit } from "./audit";
import type { Access } from "./context";
import type { Executor } from "./executor";

export type SignInAttempt = {
	access: Access;
	ip: string | null;
	log?: AuditLog;
	now: Date;
};

export type RemoteReservation =
	| { reserved: true }
	| { reserved: false; retryAfter: number };

const outcomeByStatus: Partial<Record<number, AuditOutcome>> = {
	200: "succeeded",
	401: "failed",
	429: "rate_limited",
};

const invalidCredentials = 401;
const signedIn = 200;

function readGuard(db: Pick<Database, "select">) {
	return db
		.select()
		.from(signInGuard)
		.where(eq(signInGuard.singleton, 1))
		.get();
}

function lastSignInOutcome(db: Pick<Database, "select">): string | undefined {
	return db
		.select({ outcome: auditEvent.outcome })
		.from(auditEvent)
		.where(eq(auditEvent.type, "auth.sign_in"))
		.orderBy(sql`rowid desc`)
		.limit(1)
		.get()?.outcome;
}

export function reserveRemoteAttempt(
	db: Database,
	{ ip, log, now }: Omit<SignInAttempt, "access">
): RemoteReservation {
	return db.transaction((tx) => {
		const guard = readGuard(tx);
		const lockedUntil = guard?.remoteLockedUntil;
		if (lockedUntil && now < lockedUntil) {
			if (lastSignInOutcome(tx) !== "locked") {
				appendAudit(
					tx,
					now,
					{ access: "remote", ip, outcome: "locked", type: "auth.sign_in" },
					log
				);
			}
			return {
				reserved: false,
				retryAfter: Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000),
			};
		}
		const failures = (guard?.remoteFailures ?? 0) + 1;
		const lockMs = remoteLockDurationMs(failures);
		tx.update(signInGuard)
			.set({
				remoteFailures: failures,
				...(lockMs === null
					? {}
					: { remoteLockedUntil: new Date(now.getTime() + lockMs) }),
			})
			.where(eq(signInGuard.singleton, 1))
			.run();
		return { reserved: true };
	});
}

function settleRemote(db: Executor, status: number): void {
	if (status === invalidCredentials) {
		return;
	}
	if (status === signedIn) {
		db.update(signInGuard)
			.set({ remoteFailures: 0, remoteLockedUntil: null })
			.where(eq(signInGuard.singleton, 1))
			.run();
		return;
	}
	const failures = readGuard(db)?.remoteFailures ?? 0;
	db.update(signInGuard)
		.set({ remoteFailures: Math.max(failures - 1, 0) })
		.where(eq(signInGuard.singleton, 1))
		.run();
}

export function recordSignInAttempt(
	db: Database,
	{ access, ip, log, now, status }: SignInAttempt & { status: number }
): void {
	db.transaction((tx) => {
		if (access === "remote") {
			settleRemote(tx, status);
		}
		const outcome = outcomeByStatus[status];
		if (outcome) {
			appendAudit(tx, now, { access, ip, outcome, type: "auth.sign_in" }, log);
		}
	});
}

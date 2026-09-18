import type { Database } from "@costura-pro/db";
import { account, user } from "@costura-pro/db/schema/auth";
import { installation, signInGuard } from "@costura-pro/db/schema/installation";
import type { InstallationState } from "@costura-pro/domain/installation-state";
import { ORPCError } from "@orpc/server";
import { and, eq, notInArray } from "drizzle-orm";

import { appendAudit } from "../audit";
import { appendChange } from "../change-log";
import type { Executor } from "../executor";

export type InstallationRow = typeof installation.$inferSelect;

export type InstallationSnapshot = {
	atelierName: string | null;
	id: string;
	state: InstallationState;
	targetMarginBasisPoints: number;
	version: number;
};

export type InstallationPatch = Partial<
	Pick<InstallationRow, "atelierName" | "state" | "targetMarginBasisPoints">
>;

export function ensureInstallation(db: Database, now: Date): void {
	db.transaction((tx) => {
		const created = tx
			.insert(installation)
			.values({
				createdAt: now,
				epoch: crypto.randomUUID(),
				id: crypto.randomUUID(),
				singleton: 1,
				state: "empty",
				updatedAt: now,
				version: 1,
			})
			.onConflictDoNothing({ target: installation.singleton })
			.returning({ id: installation.id })
			.all();
		tx.insert(signInGuard)
			.values({ remoteFailures: 0, singleton: 1 })
			.onConflictDoNothing({ target: signInGuard.singleton })
			.run();
		if (created.length === 1) {
			appendAudit(tx, now, {
				access: "local",
				outcome: "succeeded",
				type: "installation.created",
			});
		}
		reconcileOwner(tx, now);
	});
}

export function removeOrphanUsers(db: Executor): void {
	db.delete(user)
		.where(
			notInArray(
				user.id,
				db
					.select({ userId: account.userId })
					.from(account)
					.where(eq(account.providerId, "credential"))
			)
		)
		.run();
}

function reconcileOwner(db: Executor, now: Date): void {
	const current = readInstallation(db);
	if (current.state !== "account" || current.ownerUserId !== null) {
		return;
	}
	const owners = db
		.select({ id: user.id })
		.from(user)
		.innerJoin(
			account,
			and(eq(account.userId, user.id), eq(account.providerId, "credential"))
		)
		.all();
	const [owner] = owners;
	if (owners.length === 1 && owner) {
		db.update(installation)
			.set({ ownerUserId: owner.id, updatedAt: now })
			.where(eq(installation.singleton, 1))
			.run();
		appendAudit(db, now, {
			access: "local",
			details: { recovered: true },
			outcome: "succeeded",
			type: "owner.created",
		});
		return;
	}
	if (owners.length === 0) {
		removeOrphanUsers(db);
		updateInstallation(db, current, { state: "atelier" }, { now, opId: null });
		appendAudit(db, now, {
			access: "local",
			details: { recovered: true },
			outcome: "failed",
			type: "owner.bootstrap_failed",
		});
	}
}

export function readInstallation(
	db: Pick<Database, "select">
): InstallationRow {
	const row = db
		.select()
		.from(installation)
		.where(eq(installation.singleton, 1))
		.get();
	if (!row) {
		throw new Error("Instalação não inicializada");
	}
	return row;
}

export function installationSnapshot(
	row: InstallationRow
): InstallationSnapshot {
	return {
		atelierName: row.atelierName,
		id: row.id,
		state: row.state,
		targetMarginBasisPoints: row.targetMarginBasisPoints,
		version: row.version,
	};
}

export function requireInstallationState(
	db: Pick<Database, "select">,
	allowed: (state: InstallationState) => boolean
): InstallationRow {
	const row = readInstallation(db);
	if (!allowed(row.state)) {
		throw new ORPCError("PRECONDITION_FAILED", {
			data: { state: row.state },
			message: "Etapa do wizard fora de ordem",
		});
	}
	return row;
}

export function updateInstallation(
	db: Executor,
	current: InstallationRow,
	patch: InstallationPatch,
	{ now, opId }: { now: Date; opId: string | null }
): InstallationRow {
	const next = db
		.update(installation)
		.set({ ...patch, updatedAt: now, version: current.version + 1 })
		.where(
			and(
				eq(installation.singleton, 1),
				eq(installation.version, current.version)
			)
		)
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Instalação mudou durante a operação",
		});
	}
	appendChange(db, {
		aggregateId: next.id,
		aggregateType: "installation",
		data: installationSnapshot(next),
		epoch: next.epoch,
		now,
		opId,
		version: next.version,
	});
	return next;
}

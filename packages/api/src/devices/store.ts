import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Database } from "@costura-pro/db";
import { device } from "@costura-pro/db/schema/sync";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

import { appendChange } from "../change-log";
import type { DeviceCredential } from "../context";
import type { Executor } from "../executor";
import { sha256Hex } from "../hashing";

export type DeviceRow = typeof device.$inferSelect;
export type DeviceStatus = DeviceRow["status"];

export type DeviceSnapshot = {
	approvedAt: string | null;
	createdAt: string;
	id: string;
	name: string;
	revokedAt: string | null;
	status: DeviceStatus;
	version: number;
};

export type DevicePatch = Partial<
	Pick<DeviceRow, "approvedAt" | "name" | "revokedAt" | "status">
>;

export type ChangeStamp = { epoch: string; now: Date; opId: string | null };

export function deviceSnapshot(row: DeviceRow): DeviceSnapshot {
	return {
		approvedAt: row.approvedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		name: row.name,
		revokedAt: row.revokedAt?.toISOString() ?? null,
		status: row.status,
		version: row.version,
	};
}

export function readDevice(
	db: Pick<Database, "select">,
	id: string
): DeviceRow | undefined {
	return db.select().from(device).where(eq(device.id, id)).get();
}

function recordDeviceChange(db: Executor, row: DeviceRow, stamp: ChangeStamp) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "device",
		data: deviceSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

export function insertDevice(
	db: Executor,
	{ name, status }: { name: string; status: DeviceStatus },
	stamp: ChangeStamp
): { row: DeviceRow; secret: string } {
	const secret = randomBytes(32).toString("base64url");
	const row = db
		.insert(device)
		.values({
			approvedAt: status === "approved" ? stamp.now : null,
			createdAt: stamp.now,
			id: crypto.randomUUID(),
			name,
			secretHash: sha256Hex(secret),
			status,
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordDeviceChange(db, row, stamp);
	return { row, secret };
}

export function updateDevice(
	db: Executor,
	current: DeviceRow,
	patch: DevicePatch,
	stamp: ChangeStamp
): DeviceRow {
	const next = db
		.update(device)
		.set({ ...patch, updatedAt: stamp.now, version: current.version + 1 })
		.where(and(eq(device.id, current.id), eq(device.version, current.version)))
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Dispositivo mudou durante a operação",
		});
	}
	recordDeviceChange(db, next, stamp);
	return next;
}

function sameHash(left: string, right: string): boolean {
	const a = Buffer.from(left, "hex");
	const b = Buffer.from(right, "hex");
	return a.length === b.length && timingSafeEqual(a, b);
}

export function authenticateDevice(
	db: Database,
	credential: DeviceCredential | null,
	now: Date
): DeviceRow {
	const row = credential ? readDevice(db, credential.id) : undefined;
	if (
		!(
			credential &&
			row &&
			sameHash(row.secretHash, sha256Hex(credential.secret))
		)
	) {
		throw new ORPCError("UNAUTHORIZED", {
			message: "Dispositivo não identificado",
		});
	}
	if (row.status === "pending") {
		throw new ORPCError("FORBIDDEN", {
			message: "Dispositivo aguardando aprovação",
		});
	}
	if (row.status === "revoked") {
		throw new ORPCError("FORBIDDEN", { message: "Dispositivo revogado" });
	}
	db.update(device).set({ lastSeenAt: now }).where(eq(device.id, row.id)).run();
	return row;
}

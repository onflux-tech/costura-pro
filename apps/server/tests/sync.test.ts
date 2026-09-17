import { afterEach, describe, expect, test } from "bun:test";

import {
	newOpId,
	rpc,
	type SyncSetup,
	syncSetup,
	type TestServer,
} from "./support";

const semver = /^\d+\.\d+\.\d+$/;

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

function deviceRow(server: TestServer, id: string) {
	return server
		.native()
		.query<{ name: string; version: number }, [string]>(
			"SELECT name, version FROM device WHERE id = ?"
		)
		.get(id);
}

function rename(
	setup: SyncSetup,
	{
		baseVersion,
		name,
		opId = newOpId(),
	}: { baseVersion: number | null; name: string; opId?: string }
) {
	return {
		aggregateId: setup.device.id,
		aggregateType: "device",
		baseVersion,
		command: "device.rename",
		deviceId: setup.device.id,
		epoch: setup.epoch,
		occurredAt: "2026-09-16T12:00:00.000Z",
		opId,
		payload: { name },
	};
}

describe("push", () => {
	test("accepts an edit on the current version and replays it by opId", async () => {
		const setup = await syncSetup(servers);
		const operation = rename(setup, { baseVersion: 2, name: "Celular novo" });
		const first = await setup.sync.sync.push({ operations: [operation] });
		expect(first.accepted).toEqual([{ newVersion: 3, opId: operation.opId }]);
		expect(first.epoch).toBe(setup.epoch);
		const replay = await setup.sync.sync.push({ operations: [operation] });
		expect(replay.accepted).toEqual(first.accepted);
		expect(deviceRow(setup.server, setup.device.id)).toEqual({
			name: "Celular novo",
			version: 3,
		});
	});

	test("an opId reused with other content goes to quarantine without touching the original", async () => {
		const setup = await syncSetup(servers);
		const operation = rename(setup, { baseVersion: 2, name: "Primeiro" });
		await setup.sync.sync.push({ operations: [operation] });
		const reused = await setup.sync.sync.push({
			operations: [{ ...operation, payload: { name: "Segundo" } }],
		});
		expect(reused.quarantined).toEqual([
			{ opId: operation.opId, reason: "opIdReused" },
		]);
		expect(deviceRow(setup.server, setup.device.id)?.name).toBe("Primeiro");
		expect(
			(await setup.sync.sync.push({ operations: [operation] })).accepted
		).toEqual([{ newVersion: 3, opId: operation.opId }]);
	});

	test("a stale base version becomes a conflict listed as pending", async () => {
		const setup = await syncSetup(servers);
		await setup.sync.sync.push({
			operations: [rename(setup, { baseVersion: 2, name: "Servidor" })],
		});
		const stale = rename(setup, { baseVersion: 2, name: "Local" });
		const result = await setup.sync.sync.push({ operations: [stale] });
		expect(result.accepted).toEqual([]);
		expect(result.conflicts).toEqual([
			{
				conflictId: expect.any(String),
				current: expect.objectContaining({ name: "Servidor", version: 3 }),
				currentVersion: 3,
				opId: stale.opId,
			},
		]);
		const pending = await setup.sync.sync.pending();
		expect(pending.conflicts).toEqual([
			expect.objectContaining({
				currentValues: { name: "Servidor" },
				id: result.conflicts[0]?.conflictId,
				localValues: { name: "Local" },
				opId: stale.opId,
			}),
		]);
		expect(
			(await setup.sync.sync.push({ operations: [stale] })).conflicts
		).toEqual(result.conflicts);
	});

	test("an old epoch goes to quarantine before the version check", async () => {
		const setup = await syncSetup(servers);
		const old = {
			...rename(setup, { baseVersion: 1, name: "Antigo" }),
			epoch: crypto.randomUUID(),
		};
		const result = await setup.sync.sync.push({ operations: [old] });
		expect(result.quarantined).toEqual([{ opId: old.opId, reason: "epoch" }]);
		expect(result.conflicts).toEqual([]);
		const pending = await setup.sync.sync.pending();
		expect(pending.quarantined).toEqual([
			expect.objectContaining({
				command: "device.rename",
				opId: old.opId,
				reason: "epoch",
			}),
		]);
	});

	test("classifies incompatible operations and still applies the valid ones in the batch", async () => {
		const setup = await syncSetup(servers);
		const valid = rename(setup, { baseVersion: 2, name: "Válido" });
		const mismatch = {
			...rename(setup, { baseVersion: 2, name: "x" }),
			deviceId: crypto.randomUUID(),
		};
		const unknown = {
			...rename(setup, { baseVersion: 2, name: "x" }),
			command: "x.y",
		};
		const invalid = {
			...rename(setup, { baseVersion: 2, name: "x" }),
			payload: { nome: "sem name" },
		};
		const missing = {
			...rename(setup, { baseVersion: 2, name: "x" }),
			aggregateId: crypto.randomUUID(),
		};
		const conflict = rename(setup, { baseVersion: 1, name: "velho" });
		const result = await setup.sync.sync.push({
			operations: [mismatch, unknown, invalid, missing, conflict, valid],
		});
		expect(result.quarantined).toEqual([
			{ opId: mismatch.opId, reason: "deviceMismatch" },
			{ opId: unknown.opId, reason: "unknownCommand" },
			{ opId: invalid.opId, reason: "invalidPayload" },
			{ opId: missing.opId, reason: "aggregateNotFound" },
		]);
		expect(result.conflicts.map((item) => item.opId)).toEqual([conflict.opId]);
		expect(result.accepted).toEqual([{ newVersion: 3, opId: valid.opId }]);
		expect(result.exceptions).toEqual([]);
	});

	test("renames the atelier through sync and exposes it on pull", async () => {
		const setup = await syncSetup(servers);
		const installation = setup.server
			.native()
			.query<{ id: string; version: number }, []>(
				"SELECT id, version FROM installation"
			)
			.get();
		const operation = {
			aggregateId: installation?.id ?? "",
			aggregateType: "installation",
			baseVersion: installation?.version ?? 0,
			command: "installation.setAtelierName",
			deviceId: setup.device.id,
			epoch: setup.epoch,
			occurredAt: "2026-09-16T12:00:00.000Z",
			opId: newOpId(),
			payload: { atelierName: "Ateliê Novo" },
		};
		const result = await setup.sync.sync.push({ operations: [operation] });
		expect(result.accepted).toHaveLength(1);
		const pulled = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		expect(pulled.changes.at(-1)).toMatchObject({
			aggregateType: "installation",
			data: { atelierName: "Ateliê Novo", state: "ready" },
		});
		expect(JSON.stringify(pulled.changes)).not.toContain("secret");
	});
});

describe("pull", () => {
	test("pages changes by cursor", async () => {
		const setup = await syncSetup(servers);
		const everything = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
			limit: 500,
		});
		expect(everything.hasMore).toBe(false);
		expect(everything.rebase).toBe(false);
		expect(everything.serverVersion).toMatch(semver);
		const total = everything.changes.length;
		expect(total).toBeGreaterThan(2);
		const firstPage = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
			limit: 2,
		});
		expect(firstPage.changes).toHaveLength(2);
		expect(firstPage.hasMore).toBe(true);
		const rest = await setup.sync.sync.pull({
			cursor: firstPage.cursor,
			epoch: setup.epoch,
			limit: 500,
		});
		expect(rest.hasMore).toBe(false);
		expect([...firstPage.changes, ...rest.changes]).toEqual(everything.changes);
		const cursors = everything.changes.map((change) => Number(change.cursor));
		expect(cursors).toEqual([...cursors].sort((a, b) => a - b));
	});

	test("another epoch asks for a rebase from the start", async () => {
		const setup = await syncSetup(servers);
		const everything = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		const rebased = await setup.sync.sync.pull({
			cursor: everything.cursor,
			epoch: crypto.randomUUID(),
		});
		expect(rebased.rebase).toBe(true);
		expect(rebased.epoch).toBe(setup.epoch);
		expect(rebased.changes).toEqual(everything.changes);
	});
});

describe("resolve", () => {
	async function openConflict(setup: SyncSetup) {
		await setup.sync.sync.push({
			operations: [rename(setup, { baseVersion: 2, name: "Servidor" })],
		});
		const stale = rename(setup, { baseVersion: 2, name: "Local" });
		const { conflicts } = await setup.sync.sync.push({ operations: [stale] });
		return conflicts[0]?.conflictId ?? "";
	}

	test("keepLocal applies the local values on the current version", async () => {
		const setup = await syncSetup(servers);
		const conflictId = await openConflict(setup);
		const input = {
			choice: "keepLocal" as const,
			conflictId,
			opId: newOpId(),
			reason: "O nome do celular vale",
		};
		const result = await setup.sync.sync.resolve(input);
		expect(result).toEqual({ choice: "keepLocal", conflictId, version: 4 });
		expect(deviceRow(setup.server, setup.device.id)).toEqual({
			name: "Local",
			version: 4,
		});
		expect(await setup.sync.sync.resolve(input)).toEqual(result);
		await expect(
			setup.sync.sync.resolve({ ...input, opId: newOpId() })
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect((await setup.sync.sync.pending()).conflicts).toEqual([]);
	});

	test("keepServer closes without changing and merge validates the values", async () => {
		const setup = await syncSetup(servers);
		const conflictId = await openConflict(setup);
		await expect(
			setup.sync.sync.resolve({
				choice: "merge",
				conflictId,
				opId: newOpId(),
				reason: "Mesclar",
				values: { name: "" },
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(
			await setup.local.sync.resolve({
				choice: "keepServer",
				conflictId,
				opId: newOpId(),
				reason: "Fica o do servidor",
			})
		).toEqual({ choice: "keepServer", conflictId, version: 3 });
		expect(deviceRow(setup.server, setup.device.id)).toEqual({
			name: "Servidor",
			version: 3,
		});
	});

	test("merge applies the given values", async () => {
		const setup = await syncSetup(servers);
		const conflictId = await openConflict(setup);
		expect(
			await setup.sync.sync.resolve({
				choice: "merge",
				conflictId,
				opId: newOpId(),
				reason: "Juntar os dois",
				values: { name: "Servidor e Local" },
			})
		).toEqual({ choice: "merge", conflictId, version: 4 });
		expect(deviceRow(setup.server, setup.device.id)?.name).toBe(
			"Servidor e Local"
		);
	});
});

describe("device credential", () => {
	test("rejects a wrong secret, a pending device and a revoked device", async () => {
		const setup = await syncSetup(servers);
		const pull = { cursor: "0", epoch: setup.epoch };
		await expect(
			rpc(setup.server, {
				access: "remote",
				cookie: setup.remoteCookie,
				device: { ...setup.device, secret: "errado" },
			}).sync.pull(pull)
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		await expect(
			rpc(setup.server, {
				access: "remote",
				cookie: setup.remoteCookie,
			}).sync.pull(pull)
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		const pending = await rpc(setup.server, {
			access: "remote",
			cookie: setup.remoteCookie,
		}).devices.register({ name: "Tablet", opId: newOpId() });
		await expect(
			rpc(setup.server, {
				access: "remote",
				cookie: setup.remoteCookie,
				device: { id: pending.deviceId, secret: pending.deviceSecret ?? "" },
			}).sync.pull(pull)
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "Dispositivo aguardando aprovação",
		});
		await setup.local.devices.revoke({
			deviceId: setup.device.id,
			opId: newOpId(),
		});
		await expect(setup.sync.sync.pull(pull)).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "Dispositivo revogado",
		});
		await expect(
			setup.sync.sync.push({
				operations: [rename(setup, { baseVersion: 3, name: "Depois" })],
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	test("a device secret without the owner session is rejected", async () => {
		const setup = await syncSetup(servers);
		await expect(
			rpc(setup.server, {
				access: "remote",
				device: setup.device,
			}).sync.pull({ cursor: "0", epoch: setup.epoch })
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("review regressions", () => {
	test("a remote session without a device cannot resolve or list pending items", async () => {
		const setup = await syncSetup(servers);
		const remote = rpc(setup.server, {
			access: "remote",
			cookie: setup.remoteCookie,
		});
		await expect(remote.sync.pending()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
		await expect(
			remote.sync.resolve({
				choice: "keepServer",
				conflictId: crypto.randomUUID(),
				opId: newOpId(),
				reason: "sem aparelho",
			})
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	test("an opId reused with other content shows up as pending quarantine", async () => {
		const setup = await syncSetup(servers);
		const operation = rename(setup, { baseVersion: 2, name: "Primeiro" });
		await setup.sync.sync.push({ operations: [operation] });
		await setup.sync.sync.push({
			operations: [{ ...operation, baseVersion: 3 }],
		});
		const pending = await setup.sync.sync.pending();
		expect(pending.quarantined).toEqual([
			expect.objectContaining({
				command: "device.rename",
				opId: operation.opId,
				reason: "opIdReused",
			}),
		]);
	});

	test("the device check comes before the epoch check", async () => {
		const setup = await syncSetup(servers);
		const both = {
			...rename(setup, { baseVersion: 2, name: "x" }),
			deviceId: crypto.randomUUID(),
			epoch: crypto.randomUUID(),
		};
		const result = await setup.sync.sync.push({ operations: [both] });
		expect(result.quarantined).toEqual([
			{ opId: both.opId, reason: "deviceMismatch" },
		]);
	});

	test("a malformed item goes to quarantine without blocking the batch", async () => {
		const setup = await syncSetup(servers);
		const malformed = {
			...rename(setup, { baseVersion: 2, name: "x" }),
			occurredAt: "ontem",
		};
		const valid = rename(setup, { baseVersion: 2, name: "Válido" });
		const result = await setup.sync.sync.push({
			operations: [malformed, valid],
		});
		expect(result.quarantined).toEqual([
			{ opId: malformed.opId, reason: "invalidEnvelope" },
		]);
		expect(result.accepted).toEqual([{ newVersion: 3, opId: valid.opId }]);
		const pending = await setup.sync.sync.pending();
		expect(pending.quarantined.map((item) => item.reason)).toEqual([
			"invalidEnvelope",
		]);
	});

	test("a null base version opens a conflict that keeps the null", async () => {
		const setup = await syncSetup(servers);
		const operation = rename(setup, { baseVersion: null, name: "Sem base" });
		const result = await setup.sync.sync.push({ operations: [operation] });
		expect(result.conflicts).toHaveLength(1);
		const pending = await setup.sync.sync.pending();
		expect(pending.conflicts[0]?.baseVersion).toBeNull();
	});
});

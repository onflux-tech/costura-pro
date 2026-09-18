import { afterEach, describe, expect, test } from "bun:test";

import { newOpId, type SyncSetup, syncSetup, type TestServer } from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

function envelope(
	setup: SyncSetup,
	input: {
		aggregateId: string;
		aggregateType?: string;
		baseVersion: number | null;
		command: string;
		payload: unknown;
	}
) {
	return {
		aggregateType: "service",
		...input,
		deviceId: setup.device.id,
		epoch: setup.epoch,
		occurredAt: "2026-09-18T12:00:00.000Z",
		opId: newOpId(),
	};
}

function installationOf(setup: SyncSetup) {
	return (
		setup.server
			.native()
			.query<{ id: string; version: number }, []>(
				"SELECT id, version FROM installation"
			)
			.get() ?? { id: "", version: 0 }
	);
}

describe("service sync", () => {
	test("creates and edits a service over push and reads it back on pull", async () => {
		const setup = await syncSetup(servers);
		const serviceId = crypto.randomUUID();
		const create = envelope(setup, {
			aggregateId: serviceId,
			baseVersion: null,
			command: "service.create",
			payload: {
				costCents: "6000",
				name: "Barra de calça",
				priceCents: "10000",
			},
		});
		const created = await setup.sync.sync.push({ operations: [create] });
		expect(created.accepted).toEqual([{ newVersion: 1, opId: create.opId }]);
		const edit = envelope(setup, {
			aggregateId: serviceId,
			baseVersion: 1,
			command: "service.update",
			payload: {
				category: "Barra",
				costCents: "6500",
				outsourced: true,
				targetMarginBasisPoints: 2500,
			},
		});
		const invalid = [
			{ costCents: "12,50", name: "Outro" },
			{ name: "Outro", targetMarginBasisPoints: 10_000 },
			{ estimatedMinutes: 0, name: "Outro" },
			{ baseUnit: "m" },
		].map((payload) =>
			envelope(setup, {
				aggregateId: serviceId,
				baseVersion: 2,
				command: "service.update",
				payload,
			})
		);
		const pushed = await setup.sync.sync.push({
			operations: [edit, ...invalid],
		});
		expect(pushed.accepted).toEqual([{ newVersion: 2, opId: edit.opId }]);
		expect(pushed.quarantined).toEqual(
			invalid.map((operation) => ({
				opId: operation.opId,
				reason: "invalidPayload",
			}))
		);
		const { changes } = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		const serviceChanges = changes.filter(
			(change) => change.aggregateType === "service"
		);
		expect(serviceChanges.map((change) => change.version)).toEqual([1, 2]);
		expect(serviceChanges[0]?.data).toMatchObject({
			costCents: "6000",
			outsourced: false,
			version: 1,
		});
		expect(serviceChanges.at(-1)?.data).toEqual({
			archivedAt: null,
			category: "Barra",
			costCents: "6500",
			createdAt: expect.any(String),
			estimatedMinutes: null,
			id: serviceId,
			name: "Barra de calça",
			notes: null,
			outsourced: true,
			priceCents: "10000",
			targetMarginBasisPoints: 2500,
			version: 2,
		});
	});

	test("changes the atelier margin over push and refuses another installation id", async () => {
		const setup = await syncSetup(servers);
		const installation = installationOf(setup);
		const change = envelope(setup, {
			aggregateId: installation.id,
			aggregateType: "installation",
			baseVersion: installation.version,
			command: "installation.setTargetMargin",
			payload: { targetMarginBasisPoints: 3500 },
		});
		const foreign = envelope(setup, {
			aggregateId: crypto.randomUUID(),
			aggregateType: "installation",
			baseVersion: installation.version + 1,
			command: "installation.setTargetMargin",
			payload: { targetMarginBasisPoints: 2000 },
		});
		const pushed = await setup.sync.sync.push({
			operations: [change, foreign],
		});
		expect(pushed.accepted).toEqual([
			{ newVersion: installation.version + 1, opId: change.opId },
		]);
		expect(pushed.quarantined).toEqual([
			{ opId: foreign.opId, reason: "aggregateNotFound" },
		]);
		const { changes } = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		expect(changes.at(-1)).toMatchObject({
			aggregateType: "installation",
			data: { state: "ready", targetMarginBasisPoints: 3500 },
		});
		expect(await setup.local.pricing.settings({})).toEqual({
			targetMarginBasisPoints: 3500,
			version: installation.version + 1,
		});
	});

	test("resolves a stale edit that clears the own margin with keepLocal", async () => {
		const setup = await syncSetup(servers);
		const { id } = await setup.local.services.create({
			costCents: "6000",
			name: "Barra de calça",
			opId: newOpId(),
			priceCents: "10000",
			serviceId: crypto.randomUUID(),
			targetMarginBasisPoints: 2500,
		});
		await setup.local.services.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: { priceCents: "11000" },
			serviceId: id,
		});
		const stale = envelope(setup, {
			aggregateId: id,
			baseVersion: 1,
			command: "service.update",
			payload: { notes: "", targetMarginBasisPoints: null },
		});
		const pushed = await setup.sync.sync.push({ operations: [stale] });
		expect(pushed.conflicts).toHaveLength(1);
		const resolved = await setup.local.sync.resolve({
			choice: "keepLocal",
			conflictId: pushed.conflicts[0]?.conflictId ?? "",
			opId: newOpId(),
			reason: "O celular estava certo",
		});
		expect(resolved.version).toBe(3);
		expect(await setup.local.services.get({ serviceId: id })).toMatchObject({
			notes: null,
			priceCents: "11000",
			targetMarginBasisPoints: null,
		});
	});
});

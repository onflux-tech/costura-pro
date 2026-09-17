import { afterEach, describe, expect, test } from "bun:test";

import { newOpId, type SyncSetup, syncSetup, type TestServer } from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

type OperationInput = {
	aggregateId: string;
	aggregateType: string;
	baseVersion: number | null;
	command: string;
	payload: unknown;
};

function envelope(setup: SyncSetup, input: OperationInput) {
	return {
		...input,
		deviceId: setup.device.id,
		epoch: setup.epoch,
		occurredAt: "2026-09-17T12:00:00.000Z",
		opId: newOpId(),
	};
}

async function templateNamed(setup: SyncSetup, name: string) {
	const { items } = await setup.local.measurementTemplates.list({});
	const found = items.find((item) => item.name === name);
	if (!found) {
		throw new Error(`Modelo ${name} ausente`);
	}
	return found;
}

type Template = Awaited<ReturnType<typeof templateNamed>>;

async function pushedProfile(setup: SyncSetup) {
	const clientId = crypto.randomUUID();
	const profileId = crypto.randomUUID();
	await setup.sync.sync.push({
		operations: [
			envelope(setup, {
				aggregateId: clientId,
				aggregateType: "client",
				baseVersion: null,
				command: "client.create",
				payload: { kind: "person", name: "Maria Beatriz Alencar" },
			}),
			envelope(setup, {
				aggregateId: profileId,
				aggregateType: "profile",
				baseVersion: null,
				command: "profile.create",
				payload: { clientId, name: "Maria Beatriz" },
			}),
		],
	});
	return { clientId, profileId };
}

function measurementPayload(
	template: Template,
	profileId: string,
	values: readonly number[],
	notes: string | null = null
) {
	return {
		fields: template.fields
			.filter((field) => field.active)
			.map((field, index) => ({
				fieldId: field.id,
				label: field.label,
				valueMm: values[index] ?? null,
			})),
		notes,
		profileId,
		takenOn: "2026-09-02",
		templateId: template.id,
		templateName: template.name,
		templateVersion: template.version,
	};
}

function createMeasurement(
	setup: SyncSetup,
	payload: unknown,
	id = crypto.randomUUID()
) {
	return envelope(setup, {
		aggregateId: id,
		aggregateType: "measurement",
		baseVersion: null,
		command: "measurement.create",
		payload,
	});
}

function measurementCommand(
	setup: SyncSetup,
	id: string,
	command: string,
	baseVersion: number,
	payload: unknown
) {
	return envelope(setup, {
		aggregateId: id,
		aggregateType: "measurement",
		baseVersion,
		command,
		payload,
	});
}

function opHash(server: TestServer, opId: string) {
	return server
		.native()
		.query<{ op_hash: string }, [string]>(
			"SELECT op_hash FROM operation WHERE op_id = ?"
		)
		.get(opId)?.op_hash;
}

describe("measurement templates and measurements over sync", () => {
	test("creates a template and a measurement by push and pulls both snapshots", async () => {
		const setup = await syncSetup(servers);
		const { profileId } = await pushedProfile(setup);
		const templateId = crypto.randomUUID();
		const fieldId = crypto.randomUUID();
		const template = envelope(setup, {
			aggregateId: templateId,
			aggregateType: "measurementTemplate",
			baseVersion: null,
			command: "measurementTemplate.create",
			payload: { fields: [{ id: fieldId, label: "Punho" }], name: "Punho" },
		});
		const measurement = createMeasurement(setup, {
			fields: [{ fieldId, label: "Punho", valueMm: 165 }],
			notes: null,
			profileId,
			takenOn: "2026-09-02",
			templateId,
			templateName: "Punho",
			templateVersion: 1,
		});
		const result = await setup.sync.sync.push({
			operations: [template, measurement],
		});
		expect(result.accepted.map((item) => item.newVersion)).toEqual([1, 1]);
		const pulled = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		const lastOf = (type: string) =>
			pulled.changes.filter((change) => change.aggregateType === type).at(-1)
				?.data;
		expect(lastOf("measurementTemplate")).toEqual({
			archivedAt: null,
			createdAt: expect.any(String),
			fields: [{ active: true, id: fieldId, label: "Punho" }],
			id: templateId,
			name: "Punho",
			version: 1,
		});
		expect(lastOf("measurement")).toEqual({
			archivedAt: null,
			createdAt: expect.any(String),
			fields: [{ fieldId, label: "Punho", valueMm: 165 }],
			id: measurement.aggregateId,
			notes: null,
			profileId,
			takenOn: "2026-09-02",
			templateId,
			templateName: "Punho",
			templateVersion: 1,
			version: 1,
		});
	});

	test("quarantined measurement operations never keep their hash, template ones do", async () => {
		const setup = await syncSetup(servers);
		const { profileId } = await pushedProfile(setup);
		const saia = await templateNamed(setup, "Saia");
		const valid = measurementPayload(saia, profileId, [700]);
		const operations = [
			createMeasurement(setup, { ...valid, profileId: crypto.randomUUID() }),
			createMeasurement(setup, { ...valid, templateId: crypto.randomUUID() }),
			createMeasurement(setup, measurementPayload(saia, profileId, [])),
			{ ...createMeasurement(setup, valid), aggregateType: "profile" },
			measurementCommand(setup, crypto.randomUUID(), "measurement.update", 1, {
				notes: "Mede com salto",
			}),
		];
		const result = await setup.sync.sync.push({ operations });
		expect(result.quarantined.map((item) => item.reason)).toEqual([
			"aggregateNotFound",
			"aggregateNotFound",
			"invalidPayload",
			"unknownCommand",
			"aggregateNotFound",
		]);
		expect(
			operations.map((operation) => opHash(setup.server, operation.opId))
		).toEqual(operations.map(() => "redacted"));
		const templateCreate = envelope(setup, {
			aggregateId: saia.id,
			aggregateType: "measurementTemplate",
			baseVersion: null,
			command: "measurementTemplate.create",
			payload: {
				fields: [{ id: crypto.randomUUID(), label: "Cintura" }],
				name: "Saia",
			},
		});
		const first = await setup.sync.sync.push({ operations: [templateCreate] });
		const again = await setup.sync.sync.push({ operations: [templateCreate] });
		expect(first.quarantined).toEqual([
			{ opId: templateCreate.opId, reason: "aggregateExists" },
		]);
		expect(again.quarantined).toEqual(first.quarantined);
		expect(opHash(setup.server, templateCreate.opId)).not.toBe("redacted");
	});

	test("an invalid creation sent twice shows once in pending with its original reason", async () => {
		const setup = await syncSetup(servers);
		const { profileId } = await pushedProfile(setup);
		const saia = await templateNamed(setup, "Saia");
		const invalid = createMeasurement(
			setup,
			measurementPayload(saia, profileId, [])
		);
		await setup.sync.sync.push({ operations: [invalid] });
		const repeated = await setup.sync.sync.push({ operations: [invalid] });
		expect(repeated.quarantined).toEqual([
			{ opId: invalid.opId, reason: "opIdReused" },
		]);
		const pending = await setup.sync.sync.pending();
		expect(
			pending.quarantined.filter((item) => item.opId === invalid.opId)
		).toEqual([
			expect.objectContaining({
				command: "measurement.create",
				reason: "invalidPayload",
			}),
		]);
	});

	test("a stale correction opens a conflict and keepLocal clears the notes", async () => {
		const setup = await syncSetup(servers);
		const { clientId, profileId } = await pushedProfile(setup);
		const saia = await templateNamed(setup, "Saia");
		const id = crypto.randomUUID();
		await setup.sync.sync.push({
			operations: [
				createMeasurement(
					setup,
					measurementPayload(saia, profileId, [700], "Mede com salto"),
					id
				),
				measurementCommand(setup, id, "measurement.update", 1, {
					takenOn: "2026-09-03",
				}),
			],
		});
		const pushed = await setup.sync.sync.push({
			operations: [
				measurementCommand(setup, id, "measurement.update", 1, { notes: "" }),
			],
		});
		const [conflict] = pushed.conflicts;
		expect(conflict?.currentVersion).toBe(2);
		const resolved = await setup.local.sync.resolve({
			choice: "keepLocal",
			conflictId: conflict?.conflictId ?? "",
			opId: newOpId(),
			reason: "Sem nota",
		});
		expect(resolved.version).toBe(3);
		const { items } = await setup.local.measurements.list({ clientId });
		expect(items[0]).toMatchObject({
			notes: null,
			takenOn: "2026-09-03",
			version: 3,
		});
	});

	test("a stale template update resolved with keepLocal keeps the other side's new field deactivated", async () => {
		const setup = await syncSetup(servers);
		const saia = await templateNamed(setup, "Saia");
		const current = saia.fields.map(({ id, label }) => ({ id, label }));
		await setup.local.measurementTemplates.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: {
				fields: [...current, { id: crypto.randomUUID(), label: "Barra" }],
			},
			templateId: saia.id,
		});
		const pushed = await setup.sync.sync.push({
			operations: [
				envelope(setup, {
					aggregateId: saia.id,
					aggregateType: "measurementTemplate",
					baseVersion: 1,
					command: "measurementTemplate.update",
					payload: {
						fields: [...current, { id: crypto.randomUUID(), label: "Bolso" }],
					},
				}),
			],
		});
		await setup.local.sync.resolve({
			choice: "keepLocal",
			conflictId: pushed.conflicts[0]?.conflictId ?? "",
			opId: newOpId(),
			reason: "Bolso vence",
		});
		expect(
			(await templateNamed(setup, "Saia")).fields.map((field) => [
				field.label,
				field.active,
			])
		).toEqual([
			["Cintura", true],
			["Quadril", true],
			["Altura do quadril", true],
			["Comprimento da saia", true],
			["Bolso", true],
			["Barra", false],
		]);
	});
});

describe("measurement sync review regressions", () => {
	test("a malformed envelope of a personal command keeps no hash, a template one does", async () => {
		const setup = await syncSetup(servers);
		const personal = {
			...measurementCommand(
				setup,
				crypto.randomUUID(),
				"measurement.update",
				1,
				{ notes: "Mede com salto" }
			),
			occurredAt: "2026-09-17T12:00:00",
		};
		const template = {
			...envelope(setup, {
				aggregateId: crypto.randomUUID(),
				aggregateType: "measurementTemplate",
				baseVersion: 1,
				command: "measurementTemplate.update",
				payload: { name: "Saia" },
			}),
			occurredAt: "2026-09-17T12:00:00",
		};
		const result = await setup.sync.sync.push({
			operations: [personal, template],
		});
		expect(result.quarantined.map((item) => item.reason)).toEqual([
			"invalidEnvelope",
			"invalidEnvelope",
		]);
		expect(opHash(setup.server, personal.opId)).toBe("redacted");
		expect(opHash(setup.server, template.opId)).not.toBe("redacted");
	});

	test("an invalid template update resent with other content shows both in pending", async () => {
		const setup = await syncSetup(servers);
		const saia = await templateNamed(setup, "Saia");
		const invalid = envelope(setup, {
			aggregateId: saia.id,
			aggregateType: "measurementTemplate",
			baseVersion: 1,
			command: "measurementTemplate.update",
			payload: { name: "" },
		});
		await setup.sync.sync.push({ operations: [invalid] });
		await setup.sync.sync.push({
			operations: [{ ...invalid, payload: { name: "Saia reta" } }],
		});
		const pending = await setup.sync.sync.pending();
		expect(
			pending.quarantined
				.filter((item) => item.opId === invalid.opId)
				.map((item) => item.reason)
		).toEqual(["invalidPayload", "opIdReused"]);
	});

	test("quarantined client commands keep no hash", async () => {
		const setup = await syncSetup(servers);
		const { clientId } = await pushedProfile(setup);
		const invalidUpdate = envelope(setup, {
			aggregateId: clientId,
			aggregateType: "client",
			baseVersion: 1,
			command: "client.update",
			payload: { phone: "4402" },
		});
		const existing = envelope(setup, {
			aggregateId: clientId,
			aggregateType: "client",
			baseVersion: null,
			command: "client.create",
			payload: { kind: "person", name: "Maria Beatriz Alencar" },
		});
		const result = await setup.sync.sync.push({
			operations: [invalidUpdate, existing],
		});
		expect(result.quarantined.map((item) => item.reason)).toEqual([
			"invalidPayload",
			"aggregateExists",
		]);
		expect(opHash(setup.server, invalidUpdate.opId)).toBe("redacted");
		expect(opHash(setup.server, existing.opId)).toBe("redacted");
	});

	test("an archived template still accepts a measurement by push", async () => {
		const setup = await syncSetup(servers);
		const { profileId } = await pushedProfile(setup);
		const saia = await templateNamed(setup, "Saia");
		await setup.local.measurementTemplates.archive({
			baseVersion: saia.version,
			opId: newOpId(),
			templateId: saia.id,
		});
		const result = await setup.sync.sync.push({
			operations: [
				createMeasurement(setup, measurementPayload(saia, profileId, [700])),
			],
		});
		expect(result.accepted.map((item) => item.newVersion)).toEqual([1]);
	});
});

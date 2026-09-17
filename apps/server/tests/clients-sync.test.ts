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
	opId?: string;
	payload: unknown;
};

function envelope(setup: SyncSetup, input: OperationInput) {
	return {
		aggregateId: input.aggregateId,
		aggregateType: input.aggregateType,
		baseVersion: input.baseVersion,
		command: input.command,
		deviceId: setup.device.id,
		epoch: setup.epoch,
		occurredAt: "2026-09-17T12:00:00.000Z",
		opId: input.opId ?? newOpId(),
		payload: input.payload,
	};
}

function createClient(
	setup: SyncSetup,
	id: string,
	payload: unknown,
	opId?: string
) {
	return envelope(setup, {
		aggregateId: id,
		aggregateType: "client",
		baseVersion: null,
		command: "client.create",
		opId,
		payload,
	});
}

function createProfile(setup: SyncSetup, clientId: string, name: string) {
	return envelope(setup, {
		aggregateId: crypto.randomUUID(),
		aggregateType: "profile",
		baseVersion: null,
		command: "profile.create",
		payload: { clientId, name },
	});
}

function clientCommand(
	setup: SyncSetup,
	clientId: string,
	command: string,
	baseVersion: number,
	payload: unknown
) {
	return envelope(setup, {
		aggregateId: clientId,
		aggregateType: "client",
		baseVersion,
		command,
		payload,
	});
}

const maria = {
	email: "maria.alencar@email.com",
	kind: "person",
	name: "Maria Beatriz Alencar",
	notes: "Prefere barra alta",
	phone: "(81) 99815-4402",
};

describe("client and profile commands over sync", () => {
	test("creates a client and a profile in one batch and pulls both", async () => {
		const setup = await syncSetup(servers);
		const clientId = crypto.randomUUID();
		const profile = createProfile(setup, clientId, "Maria Beatriz");
		const result = await setup.sync.sync.push({
			operations: [createClient(setup, clientId, maria), profile],
		});
		expect(result.accepted.map((item) => item.newVersion)).toEqual([1, 1]);
		const pulled = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		const lastOf = (type: string) =>
			pulled.changes.filter((change) => change.aggregateType === type).at(-1)
				?.data;
		expect(lastOf("client")).toMatchObject({
			id: clientId,
			name: "Maria Beatriz Alencar",
			phone: "81998154402",
			version: 1,
		});
		expect(lastOf("profile")).toMatchObject({
			clientId,
			id: profile.aggregateId,
			name: "Maria Beatriz",
			notes: null,
		});
	});

	test("classifies invalid creations without blocking the batch", async () => {
		const setup = await syncSetup(servers);
		const clientId = crypto.randomUUID();
		const opId = newOpId();
		await setup.sync.sync.push({
			operations: [createClient(setup, clientId, maria, opId)],
		});
		const result = await setup.sync.sync.push({
			operations: [
				createClient(setup, clientId, maria, opId),
				createClient(setup, clientId, maria),
				{ ...createClient(setup, crypto.randomUUID(), maria), baseVersion: 0 },
				createClient(setup, crypto.randomUUID(), { ...maria, phone: "4402" }),
				createProfile(setup, crypto.randomUUID(), "Sem cliente"),
			],
		});
		expect(result.accepted).toEqual([{ newVersion: 1, opId }]);
		expect(result.quarantined.map((item) => item.reason)).toEqual([
			"aggregateExists",
			"invalidEnvelope",
			"invalidPayload",
			"aggregateNotFound",
		]);
	});

	test("a stale edit opens a conflict and keepLocal applies only the patch", async () => {
		const setup = await syncSetup(servers);
		const clientId = crypto.randomUUID();
		await setup.sync.sync.push({
			operations: [
				createClient(setup, clientId, maria),
				clientCommand(setup, clientId, "client.update", 1, {
					name: "Maria B. Alencar",
				}),
			],
		});
		const pushed = await setup.sync.sync.push({
			operations: [
				clientCommand(setup, clientId, "client.update", 1, {
					phone: "(81) 98888-7777",
				}),
			],
		});
		const [conflict] = pushed.conflicts;
		expect(conflict?.currentVersion).toBe(2);
		const resolved = await setup.local.sync.resolve({
			choice: "keepLocal",
			conflictId: conflict?.conflictId ?? "",
			opId: newOpId(),
			reason: "Telefone novo",
		});
		expect(resolved.version).toBe(3);
		const pulled = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		expect(pulled.changes.at(-1)?.data).toMatchObject({
			name: "Maria B. Alencar",
			phone: "81988887777",
			version: 3,
		});
	});

	test("archiving an archived client keeps the version and the change log", async () => {
		const setup = await syncSetup(servers);
		const clientId = crypto.randomUUID();
		await setup.sync.sync.push({
			operations: [
				createClient(setup, clientId, maria),
				clientCommand(setup, clientId, "client.archive", 1, {}),
			],
		});
		const again = await setup.sync.sync.push({
			operations: [clientCommand(setup, clientId, "client.archive", 2, {})],
		});
		expect(again.accepted.map((item) => item.newVersion)).toEqual([2]);
		const rows = setup.server
			.native()
			.query<{ total: number }, [string]>(
				"SELECT count(*) AS total FROM change_log WHERE aggregate_id = ?"
			)
			.get(clientId);
		expect(rows?.total).toBe(2);
	});
});

describe("creation edge cases over sync", () => {
	test("a create whose id is not a UUID goes to quarantine", async () => {
		const setup = await syncSetup(servers);
		const result = await setup.sync.sync.push({
			operations: [
				createClient(setup, "cliente-1", maria),
				envelope(setup, {
					aggregateId: "perfil-1",
					aggregateType: "profile",
					baseVersion: null,
					command: "profile.create",
					payload: { clientId: crypto.randomUUID(), name: "Helena" },
				}),
			],
		});
		expect(result.accepted).toEqual([]);
		expect(result.quarantined.map((item) => item.reason)).toEqual([
			"invalidEnvelope",
			"invalidEnvelope",
		]);
	});

	test("a profile id that already exists goes to aggregateExists without breaking the batch", async () => {
		const setup = await syncSetup(servers);
		const clientId = crypto.randomUUID();
		const profile = createProfile(setup, clientId, "Helena");
		await setup.sync.sync.push({
			operations: [createClient(setup, clientId, maria), profile],
		});
		const again = await setup.sync.sync.push({
			operations: [
				{ ...profile, opId: newOpId() },
				createClient(setup, crypto.randomUUID(), {
					kind: "person",
					name: "Outra",
				}),
			],
		});
		expect(again.quarantined.map((item) => item.reason)).toEqual([
			"aggregateExists",
		]);
		expect(again.accepted).toHaveLength(1);
	});

	test("a profile create for a missing client stores a redacted hash", async () => {
		const setup = await syncSetup(servers);
		const orphan = createProfile(setup, crypto.randomUUID(), "Helena Alencar");
		const first = await setup.sync.sync.push({ operations: [orphan] });
		expect(first.quarantined.map((item) => item.reason)).toEqual([
			"aggregateNotFound",
		]);
		expect(opHash(setup.server, orphan.opId)).toBe("redacted");
	});
});

const personalData = [
	"Alencar",
	"81998154402",
	"81988887777",
	"maria.alencar",
	"Prefere barra",
	"Barra alta",
	"Infantil",
	"Helena",
	"Mede ",
	"Tereza",
];

const measuredValue = /"valueMm":\d/;

function opHash(server: TestServer, opId: string) {
	return server
		.native()
		.query<{ op_hash: string }, [string]>(
			"SELECT op_hash FROM operation WHERE op_id = ?"
		)
		.get(opId)?.op_hash;
}

function leakedData(server: TestServer): string[] {
	const native = server.native();
	const text = native
		.query<{ name: string }, []>(
			"SELECT name FROM sqlite_master WHERE type = 'table'"
		)
		.all()
		.map(({ name }) =>
			native
				.query<Record<string, unknown>, []>(`SELECT * FROM "${name}"`)
				.values()
				.flat()
				.map(String)
				.join(" ")
		)
		.join(" ");
	return [
		...personalData.filter((piece) => text.includes(piece)),
		...(measuredValue.test(text) ? ["valueMm"] : []),
	];
}

describe("anonymization over sync", () => {
	test("redacts history, conflicts, merges and every operation of the client and its profiles", async () => {
		const setup = await syncSetup(servers);
		const clientId = crypto.randomUUID();
		const creation = createClient(setup, clientId, maria);
		const profile = envelope(setup, {
			aggregateId: crypto.randomUUID(),
			aggregateType: "profile",
			baseVersion: null,
			command: "profile.create",
			payload: { clientId, name: "Helena Alencar", notes: "Infantil" },
		});
		const profileCommand = (baseVersion: number, payload: unknown) =>
			envelope(setup, {
				aggregateId: profile.aggregateId,
				aggregateType: "profile",
				baseVersion,
				command: "profile.update",
				payload,
			});
		await setup.sync.sync.push({
			operations: [
				creation,
				clientCommand(setup, clientId, "client.update", 1, {
					name: "Maria Alencar",
				}),
				profile,
				profileCommand(1, { notes: "Infantil 8 anos" }),
			],
		});
		const merged = await setup.sync.sync.push({
			operations: [
				clientCommand(setup, clientId, "client.update", 1, {
					phone: "(81) 98888-7777",
				}),
			],
		});
		await setup.local.sync.resolve({
			choice: "merge",
			conflictId: merged.conflicts[0]?.conflictId ?? "",
			opId: newOpId(),
			reason: "Telefone novo da Maria Alencar",
			values: { phone: "(81) 98888-7777" },
		});
		const open = await setup.sync.sync.push({
			operations: [
				clientCommand(setup, clientId, "client.update", 1, {
					notes: "Barra alta",
				}),
				profileCommand(1, { name: "Helena A." }),
			],
		});
		expect(open.conflicts).toHaveLength(2);
		expect(leakedData(setup.server)).not.toEqual([]);

		await setup.local.clients.anonymize({
			baseVersion: 3,
			clientId,
			opId: newOpId(),
		});

		expect((await setup.local.sync.pending()).conflicts).toEqual([]);
		expect(leakedData(setup.server)).toEqual([]);
		const pulled = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		const pulledText = JSON.stringify(pulled.changes);
		expect(personalData.filter((piece) => pulledText.includes(piece))).toEqual(
			[]
		);
		expect(
			setup.server
				.native()
				.query<
					{
						choice: string | null;
						reason: string;
						resolved: number;
						status: string;
						values: string;
					},
					[]
				>(
					'SELECT choice, reason, status, resolved_by_op_id IS NOT NULL AS resolved, local_values || current_values AS "values" FROM sync_conflict ORDER BY created_at'
				)
				.all()
		).toEqual([
			{
				choice: "merge",
				reason: "Cliente anonimizado",
				resolved: 1,
				status: "resolved",
				values: "{}{}",
			},
			{
				choice: "keepServer",
				reason: "Cliente anonimizado",
				resolved: 1,
				status: "resolved",
				values: "{}{}",
			},
			{
				choice: "keepServer",
				reason: "Cliente anonimizado",
				resolved: 1,
				status: "resolved",
				values: "{}{}",
			},
		]);
		const hashes = setup.server
			.native()
			.query<{ command: string; op_hash: string }, [string, string]>(
				"SELECT command, op_hash FROM operation WHERE aggregate_id IN (?, ?) AND command <> 'client.anonymize'"
			)
			.all(clientId, profile.aggregateId);
		expect(hashes.map((row) => row.command)).toEqual(
			expect.arrayContaining([
				"sync.resolve",
				"profile.create",
				"profile.update",
				"client.create",
				"client.update",
			])
		);
		expect(hashes.filter((row) => row.op_hash !== "redacted")).toEqual([]);

		const later = await setup.sync.sync.push({
			operations: [
				creation,
				{ ...creation, opId: newOpId() },
				clientCommand(setup, clientId, "client.update", 1, {
					phone: "(81) 97777-6666",
				}),
				profileCommand(1, { notes: "Infantil 9 anos" }),
				envelope(setup, {
					aggregateId: crypto.randomUUID(),
					aggregateType: "profile",
					baseVersion: null,
					command: "profile.create",
					payload: { clientId, name: "Novo Alencar" },
				}),
			],
		});
		expect(later.quarantined.map((item) => item.reason)).toEqual([
			"opIdReused",
			"aggregateExists",
			"aggregateAnonymized",
			"aggregateAnonymized",
			"aggregateAnonymized",
		]);
		expect(leakedData(setup.server)).toEqual([]);
		const lateHashes = setup.server
			.native()
			.query<{ op_hash: string }, []>(
				"SELECT op_hash FROM operation WHERE status = 'quarantined'"
			)
			.all();
		expect(lateHashes.filter((row) => row.op_hash !== "redacted")).toEqual([]);
	});
});

describe("anonymization over sync with measurements", () => {
	test("redacts measurements, their conflicts and every late measurement operation", async () => {
		const setup = await syncSetup(servers);
		const clientId = crypto.randomUUID();
		const helena = crypto.randomUUID();
		const tereza = crypto.randomUUID();
		const { items } = await setup.local.measurementTemplates.list({});
		const saia = items.find((item) => item.name === "Saia");
		if (!saia) {
			throw new Error("Modelo Saia ausente");
		}
		const measurement = (id: string, profileId: string, notes: string) =>
			envelope(setup, {
				aggregateId: id,
				aggregateType: "measurement",
				baseVersion: null,
				command: "measurement.create",
				payload: {
					fields: saia.fields.map((field, index) => ({
						fieldId: field.id,
						label: field.label,
						valueMm: 701 + index,
					})),
					notes,
					profileId,
					takenOn: "2026-09-02",
					templateId: saia.id,
					templateName: saia.name,
					templateVersion: saia.version,
				},
			});
		const onMeasurement = (
			id: string,
			command: string,
			baseVersion: number,
			payload: unknown
		) =>
			envelope(setup, {
				aggregateId: id,
				aggregateType: "measurement",
				baseVersion,
				command,
				payload,
			});
		const onProfile = (id: string, command: string, payload: unknown) =>
			envelope(setup, {
				aggregateId: id,
				aggregateType: "profile",
				baseVersion: command === "profile.create" ? null : 1,
				command,
				payload,
			});
		const active = crypto.randomUUID();
		const archived = crypto.randomUUID();
		const ofArchivedProfile = crypto.randomUUID();
		await setup.sync.sync.push({
			operations: [
				createClient(setup, clientId, maria),
				onProfile(helena, "profile.create", {
					clientId,
					name: "Helena Alencar",
				}),
				onProfile(tereza, "profile.create", {
					clientId,
					name: "Tereza Alencar",
				}),
				onProfile(tereza, "profile.archive", {}),
				measurement(active, helena, "Mede com salto"),
				measurement(archived, helena, "Mede sem cinta"),
				onMeasurement(archived, "measurement.archive", 1, {}),
				measurement(ofArchivedProfile, tereza, "Mede de sapatilha"),
				onMeasurement(active, "measurement.update", 1, {
					notes: "Mede com salto alto",
				}),
				onMeasurement(ofArchivedProfile, "measurement.update", 1, {
					notes: "Mede de sapatilha nova",
				}),
			],
		});
		const stale = await setup.sync.sync.push({
			operations: [
				onMeasurement(active, "measurement.update", 1, {
					notes: "Mede com salto fino",
				}),
				onMeasurement(ofArchivedProfile, "measurement.update", 1, {
					notes: "Mede de sapatilha velha",
				}),
			],
		});
		expect(stale.conflicts).toHaveLength(2);
		await setup.local.sync.resolve({
			choice: "merge",
			conflictId: stale.conflicts[1]?.conflictId ?? "",
			opId: newOpId(),
			reason: "Sapatilha da Tereza Alencar",
			values: { notes: "Mede de sapatilha rosa" },
		});
		expect(leakedData(setup.server)).not.toEqual([]);

		await setup.local.clients.anonymize({
			baseVersion: 1,
			clientId,
			opId: newOpId(),
		});

		expect(leakedData(setup.server)).toEqual([]);
		const pulled = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		const pulledText = JSON.stringify(pulled.changes);
		expect(measuredValue.test(pulledText)).toBe(false);
		expect(pulledText.includes("Mede")).toBe(false);
		const conflictCount = () =>
			setup.server
				.native()
				.query<{ total: number }, []>(
					"SELECT count(*) AS total FROM sync_conflict"
				)
				.get()?.total;
		const conflictsBefore = conflictCount();
		const orphan = crypto.randomUUID();
		const later = await setup.sync.sync.push({
			operations: [
				onMeasurement(active, "measurement.update", 1, {
					notes: "Mede com salto",
				}),
				onMeasurement(active, "measurement.update", 3, {
					notes: "Mede com salto",
				}),
				onMeasurement(archived, "measurement.unarchive", 3, {}),
				measurement(crypto.randomUUID(), helena, "Mede com salto"),
				measurement(orphan, helena, "Mede com salto"),
				onMeasurement(orphan, "measurement.update", 1, {
					notes: "Mede com salto",
				}),
			],
		});
		expect(later.quarantined.map((item) => item.reason)).toEqual([
			"aggregateAnonymized",
			"aggregateAnonymized",
			"aggregateAnonymized",
			"aggregateAnonymized",
			"aggregateAnonymized",
			"aggregateNotFound",
		]);
		expect(conflictCount()).toBe(conflictsBefore);
		expect(leakedData(setup.server)).toEqual([]);
		expect(
			setup.server
				.native()
				.query<{ op_hash: string }, []>(
					"SELECT op_hash FROM operation WHERE aggregate_type = 'measurement' OR command LIKE 'measurement.%'"
				)
				.all()
				.filter((row) => row.op_hash !== "redacted")
		).toEqual([]);
	});
});

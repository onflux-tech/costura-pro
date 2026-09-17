import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
	completeWizard,
	inSequence,
	newOpId,
	rpc,
	sessionCookie,
	signIn,
	startTestServer,
	type TestServer,
	times,
} from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function ownerSetup() {
	const server = await startTestServer();
	servers.push(server);
	const { cookie } = await completeWizard(server);
	return { owner: rpc(server, { cookie }), server };
}

type Owner = ReturnType<typeof rpc>;

function createMaria(owner: Owner, overrides: Record<string, unknown> = {}) {
	return owner.clients.create({
		clientId: crypto.randomUUID(),
		email: " maria.alencar@email.com ",
		kind: "person",
		name: "Maria Beatriz Alencar",
		notes: "Prefere barra alta",
		opId: newOpId(),
		phone: "(81) 99815-4402",
		...overrides,
	});
}

async function remoteOwner(server: TestServer, ip: string) {
	const cookie = sessionCookie(await signIn(server, { access: "remote", ip }));
	return rpc(server, { access: "remote", cookie });
}

describe("client commands", () => {
	test("creates, reads and edits a client with normalized contacts", async () => {
		const { owner } = await ownerSetup();
		const created = await createMaria(owner, { address: "" });
		expect(created.version).toBe(1);
		const read = await owner.clients.get({ clientId: created.id });
		expect(read.client).toMatchObject({
			address: null,
			email: "maria.alencar@email.com",
			phone: "81998154402",
			secondaryPhone: null,
		});
		const edited = await owner.clients.update({
			baseVersion: 1,
			clientId: created.id,
			opId: newOpId(),
			patch: { address: "Rua da Aurora, 140", notes: "" },
		});
		expect(edited.version).toBe(2);
		const after = await owner.clients.get({ clientId: created.id });
		expect(after.client).toMatchObject({
			address: "Rua da Aurora, 140",
			notes: null,
			version: 2,
		});
	});

	test("replays by opId and refuses the opId with other content", async () => {
		const { owner } = await ownerSetup();
		const input = {
			clientId: crypto.randomUUID(),
			kind: "person" as const,
			name: "Joana",
			opId: newOpId(),
		};
		const first = await owner.clients.create(input);
		expect(await owner.clients.create(input)).toEqual(first);
		await expect(
			owner.clients.create({ ...input, name: "Outra" })
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "opId reutilizado com conteúdo diferente",
		});
	});

	test("answers stale version, repeated id, missing client and invalid phone", async () => {
		const { owner } = await ownerSetup();
		const { id } = await createMaria(owner);
		await owner.clients.update({
			baseVersion: 1,
			clientId: id,
			opId: newOpId(),
			patch: { name: "Maria" },
		});
		await expect(
			owner.clients.update({
				baseVersion: 1,
				clientId: id,
				opId: newOpId(),
				patch: { name: "Mari" },
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: { currentVersion: 2 },
			message: "Versão desatualizada",
		});
		await expect(createMaria(owner, { clientId: id })).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		await expect(
			owner.clients.archive({
				baseVersion: 1,
				clientId: crypto.randomUUID(),
				opId: newOpId(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Cliente não encontrado",
		});
		await expect(createMaria(owner, { phone: "4402" })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
	});

	test("archives and unarchives, and archiving twice keeps the version", async () => {
		const { owner } = await ownerSetup();
		const { id } = await createMaria(owner);
		const archive = (baseVersion: number) =>
			owner.clients.archive({ baseVersion, clientId: id, opId: newOpId() });
		expect((await archive(1)).version).toBe(2);
		expect((await archive(2)).version).toBe(2);
		expect((await owner.clients.list({})).items).toEqual([]);
		expect(
			(await owner.clients.list({ archived: true })).items.map(
				(item) => item.id
			)
		).toEqual([id]);
		expect(
			(
				await owner.clients.unarchive({
					baseVersion: 2,
					clientId: id,
					opId: newOpId(),
				})
			).version
		).toBe(3);
		expect(
			(
				await owner.clients.unarchive({
					baseVersion: 3,
					clientId: id,
					opId: newOpId(),
				})
			).version
		).toBe(3);
	});

	test("searches without accents, by phone piece, escapes wildcards and pages by 50", async () => {
		const { owner } = await ownerSetup();
		await createMaria(owner);
		await createMaria(owner, {
			name: "João da Silva",
			phone: "(81) 3222-1234",
		});
		const names = async (query: string) =>
			(await owner.clients.list({ query })).items.map((item) => item.name);
		expect(await names("joao")).toEqual(["João da Silva"]);
		expect(await names("99815-4402")).toEqual(["Maria Beatriz Alencar"]);
		expect(await names("%")).toEqual([]);
		expect(await names("_")).toEqual([]);
		await createMaria(owner, { name: "Loja \\ Centro", phone: null });
		expect(await names("\\")).toEqual(["Loja \\ Centro"]);
		await inSequence(times(48), (index) =>
			createMaria(owner, {
				name: `Cliente ${String(index).padStart(2, "0")}`,
				phone: null,
			})
		);
		const first = await owner.clients.list({});
		expect(first.items).toHaveLength(50);
		expect(first.nextOffset).toBe(50);
		const second = await owner.clients.list({ offset: 50 });
		expect(second.items).toHaveLength(1);
		expect(second.nextOffset).toBeNull();
		expect([...first.items, ...second.items].map((item) => item.name)).toEqual([
			...times(48).map((index) => `Cliente ${String(index).padStart(2, "0")}`),
			"João da Silva",
			"Loja \\ Centro",
			"Maria Beatriz Alencar",
		]);
	});

	test("creates and archives profiles and counts only active ones", async () => {
		const { owner } = await ownerSetup();
		const { id } = await createMaria(owner);
		const helena = await owner.profiles.create({
			clientId: id,
			name: "Helena Alencar",
			opId: newOpId(),
			profileId: crypto.randomUUID(),
		});
		await owner.profiles.create({
			clientId: id,
			name: "Maria Beatriz",
			opId: newOpId(),
			profileId: crypto.randomUUID(),
		});
		await owner.profiles.archive({
			baseVersion: 1,
			opId: newOpId(),
			profileId: helena.id,
		});
		const [listed] = (await owner.clients.list({})).items;
		expect(listed?.profileCount).toBe(1);
		const read = await owner.clients.get({ clientId: id });
		expect(read.profiles.map((profile) => profile.name)).toEqual([
			"Helena Alencar",
			"Maria Beatriz",
		]);
		await expect(
			owner.profiles.create({
				clientId: crypto.randomUUID(),
				name: "Sem cliente",
				opId: newOpId(),
				profileId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Cliente não encontrado",
		});
		await expect(
			owner.profiles.archive({
				baseVersion: 1,
				opId: newOpId(),
				profileId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Perfil não encontrado",
		});
		await expect(
			owner.profiles.create({
				clientId: id,
				name: "Outra Helena",
				opId: newOpId(),
				profileId: helena.id,
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
	});

	test("records the aggregate of a direct command and accepts the remote session", async () => {
		const { owner, server } = await ownerSetup();
		const opId = newOpId();
		const { id } = await createMaria(owner, { opId });
		const row = server
			.native()
			.query<
				{ aggregate_id: string; aggregate_type: string; command: string },
				[string]
			>(
				"SELECT aggregate_type, aggregate_id, command FROM operation WHERE op_id = ?"
			)
			.get(opId);
		expect(row).toEqual({
			aggregate_id: id,
			aggregate_type: "client",
			command: "client.create",
		});
		const remote = await remoteOwner(server, "203.0.113.40");
		expect((await createMaria(remote, { name: "Pelo celular" })).version).toBe(
			1
		);
	});
});

const personalData = [
	"Alencar",
	"81998154402",
	"81988887777",
	"maria.alencar",
	"Prefere barra",
	"Aurora",
	"Infantil",
	"Mede com",
	"Mede sem",
	"Mede de",
	"Tereza",
];

const measuredValue = /"valueMm":\d/;

function dump(server: TestServer): string {
	const native = server.native();
	return native
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
		.join("\n");
}

async function recordSaia(owner: Owner, profileId: string, notes: string) {
	const { items } = await owner.measurementTemplates.list({});
	const saia = items.find((item) => item.name === "Saia");
	if (!saia) {
		throw new Error("Modelo Saia ausente");
	}
	const measurementId = crypto.randomUUID();
	await owner.measurements.create({
		fields: saia.fields.map((field, index) => ({
			fieldId: field.id,
			label: field.label,
			valueMm: 701 + index,
		})),
		measurementId,
		notes,
		opId: newOpId(),
		profileId,
		takenOn: "2026-09-02",
		templateId: saia.id,
		templateName: saia.name,
		templateVersion: saia.version,
	});
	return measurementId;
}

describe("client anonymization", () => {
	async function anonymizable() {
		const setup = await ownerSetup();
		const { id } = await createMaria(setup.owner, {
			address: "Rua da Aurora, 140",
		});
		const updateInput = {
			baseVersion: 1,
			clientId: id,
			opId: newOpId(),
			patch: { phone: "(81) 98888-7777" },
		};
		await setup.owner.clients.update(updateInput);
		const profile = await setup.owner.profiles.create({
			clientId: id,
			name: "Helena Alencar",
			notes: "Infantil",
			opId: newOpId(),
			profileId: crypto.randomUUID(),
		});
		const tereza = await setup.owner.profiles.create({
			clientId: id,
			name: "Tereza Alencar",
			opId: newOpId(),
			profileId: crypto.randomUUID(),
		});
		await recordSaia(setup.owner, profile.id, "Mede com salto");
		const archived = await recordSaia(
			setup.owner,
			profile.id,
			"Mede sem cinta"
		);
		await setup.owner.measurements.archive({
			baseVersion: 1,
			measurementId: archived,
			opId: newOpId(),
		});
		await recordSaia(setup.owner, tereza.id, "Mede de sapatilha");
		await setup.owner.profiles.archive({
			baseVersion: 1,
			opId: newOpId(),
			profileId: tereza.id,
		});
		return { ...setup, id, profileId: profile.id, updateInput };
	}

	test("answers CONFLICT when the anonymization base version is stale", async () => {
		const { id, owner } = await anonymizable();
		await expect(
			owner.clients.anonymize({ baseVersion: 1, clientId: id, opId: newOpId() })
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: { currentVersion: 2 },
			message: "Versão desatualizada",
		});
	});

	test("is refused on remote access", async () => {
		const { id, server } = await anonymizable();
		const remote = await remoteOwner(server, "203.0.113.41");
		await expect(
			remote.clients.anonymize({
				baseVersion: 2,
				clientId: id,
				opId: newOpId(),
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	test("leaves no personal data in any table", async () => {
		const { id, owner, profileId, server } = await anonymizable();
		expect(dump(server)).toContain("Alencar");
		expect(measuredValue.test(dump(server))).toBe(true);
		const opId = newOpId();
		const result = await owner.clients.anonymize({
			baseVersion: 2,
			clientId: id,
			opId,
		});
		expect(result.version).toBe(3);
		const text = dump(server);
		expect(personalData.filter((piece) => text.includes(piece))).toEqual([]);
		expect(measuredValue.test(text)).toBe(false);
		const read = await owner.clients.get({ clientId: id });
		expect(read.client).toMatchObject({
			address: null,
			email: null,
			name: "Cliente anonimizado",
			notes: null,
			phone: null,
		});
		expect(read.client.anonymizedAt).not.toBeNull();
		expect(read.client.archivedAt).not.toBeNull();
		expect(read.profiles.map((profile) => profile.name)).toEqual([
			"Perfil anonimizado",
			"Perfil anonimizado",
		]);
		const hashes = server
			.native()
			.query<{ command: string; op_hash: string }, [string, string]>(
				"SELECT command, op_hash FROM operation WHERE aggregate_id IN (?, ?) ORDER BY received_at"
			)
			.all(id, profileId);
		expect(
			hashes
				.filter((row) => row.command !== "client.anonymize")
				.map((row) => row.op_hash)
		).toEqual(["redacted", "redacted", "redacted"]);
		expect(
			server
				.native()
				.query<{ details: string }, []>(
					"SELECT details FROM audit_event WHERE type = 'client.anonymized'"
				)
				.all()
				.map((row) => JSON.parse(row.details))
		).toEqual([
			{ clientId: id, measurements: 3, profiles: 2, receivedItems: 0 },
		]);
		const bytes = ["atelier.db", "atelier.db-wal"]
			.map((file) => join(server.directory, file))
			.filter((file) => existsSync(file))
			.map((file) => readFileSync(file).toString("latin1"))
			.join(" ");
		expect(
			[
				"Alencar",
				"81998154402",
				"81988887777",
				"maria.alencar",
				"Mede ",
			].filter((piece) => bytes.includes(piece))
		).toEqual([]);
		expect(measuredValue.test(bytes)).toBe(false);
		expect(
			await owner.clients.anonymize({ baseVersion: 2, clientId: id, opId })
		).toEqual(result);
	});

	test("refuses commands on the anonymized client and old opIds count as reused", async () => {
		const { id, owner, profileId, updateInput } = await anonymizable();
		await owner.clients.anonymize({
			baseVersion: 2,
			clientId: id,
			opId: newOpId(),
		});
		const anonymized = {
			code: "PRECONDITION_FAILED",
			message: "Cliente anonimizado",
		};
		await expect(
			owner.clients.update({
				baseVersion: 3,
				clientId: id,
				opId: newOpId(),
				patch: { name: "Volta" },
			})
		).rejects.toMatchObject(anonymized);
		await expect(
			owner.clients.unarchive({ baseVersion: 3, clientId: id, opId: newOpId() })
		).rejects.toMatchObject(anonymized);
		await expect(
			owner.profiles.create({
				clientId: id,
				name: "Novo",
				opId: newOpId(),
				profileId: crypto.randomUUID(),
			})
		).rejects.toMatchObject(anonymized);
		await expect(
			owner.profiles.update({
				baseVersion: 2,
				opId: newOpId(),
				patch: { notes: "x" },
				profileId,
			})
		).rejects.toMatchObject(anonymized);
		await expect(
			owner.clients.anonymize({ baseVersion: 3, clientId: id, opId: newOpId() })
		).rejects.toMatchObject(anonymized);
		await expect(
			owner.clients.update({
				baseVersion: 1,
				clientId: id,
				opId: newOpId(),
				patch: { name: "Velha" },
			})
		).rejects.toMatchObject(anonymized);
		await expect(
			owner.profiles.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: { notes: "y" },
				profileId,
			})
		).rejects.toMatchObject(anonymized);
		await expect(owner.clients.update(updateInput)).rejects.toMatchObject({
			code: "CONFLICT",
			message: "opId reutilizado com conteúdo diferente",
		});
	});
});

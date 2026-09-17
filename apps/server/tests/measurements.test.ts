import { afterEach, describe, expect, test } from "bun:test";

import {
	completeWizard,
	inSequence,
	manualClock,
	newOpId,
	rpc,
	type ServerOptions,
	startTestServer,
	type TestServer,
} from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function ownerSetup(options: ServerOptions = {}) {
	const server = await startTestServer(options);
	servers.push(server);
	const { cookie } = await completeWizard(server);
	return { owner: rpc(server, { cookie }), server };
}

type Owner = ReturnType<typeof rpc>;

type TemplateItem = Awaited<
	ReturnType<Owner["measurementTemplates"]["list"]>
>["items"][number];

async function templateNamed(owner: Owner, name: string) {
	const { items } = await owner.measurementTemplates.list({});
	const found = items.find((item) => item.name === name);
	if (!found) {
		throw new Error(`Modelo ${name} ausente`);
	}
	return found;
}

function sent(fields: TemplateItem["fields"]) {
	return fields
		.filter((field) => field.active)
		.map(({ id, label }) => ({ id, label }));
}

const vestidoLabels = [
	"Busto",
	"Abaixo do busto",
	"Cintura",
	"Quadril",
	"Altura do quadril",
	"Ombro",
	"Costas",
	"Frente",
	"Altura do busto",
	"Separação do busto",
	"Altura da frente",
	"Altura das costas",
	"Cava",
	"Braço",
	"Comprimento da manga",
	"Comprimento do vestido",
];

describe("measurement templates", () => {
	test("a new installation starts with the five garment templates", async () => {
		const { owner, server } = await ownerSetup();
		const { items } = await owner.measurementTemplates.list({});
		expect(items.map((item) => item.name)).toEqual([
			"Blazer e paletó",
			"Blusa e camisa",
			"Calça",
			"Saia",
			"Vestido",
		]);
		const vestido = await templateNamed(owner, "Vestido");
		expect(vestido).toMatchObject({ archivedAt: null, version: 1 });
		expect(vestido.fields.map((field) => field.label)).toEqual(vestidoLabels);
		expect(vestido.fields.every((field) => field.active)).toBe(true);
		expect(
			server
				.native()
				.query<{ op_id: string | null }, []>(
					"SELECT op_id FROM change_log WHERE aggregate_type = 'measurementTemplate'"
				)
				.all()
		).toEqual(Array.from({ length: 5 }, () => ({ op_id: null })));
	});

	test("seeds only once: reopening keeps five and archiving all does not reseed", async () => {
		const { owner, server } = await ownerSetup();
		const { items } = await owner.measurementTemplates.list({});
		await inSequence(items, (item) =>
			owner.measurementTemplates.archive({
				baseVersion: item.version,
				opId: newOpId(),
				templateId: item.id,
			})
		);
		server.reopen();
		const after = await owner.measurementTemplates.list({});
		expect(after.items).toHaveLength(5);
		expect(after.items.every((item) => item.archivedAt !== null)).toBe(true);
	});

	test("creates, renames, reorders and archives a template, keeping the version on repeated archive", async () => {
		const { owner } = await ownerSetup();
		const templateId = crypto.randomUUID();
		const busto = crypto.randomUUID();
		const cintura = crypto.randomUUID();
		expect(
			await owner.measurementTemplates.create({
				fields: [
					{ id: busto, label: " Busto " },
					{ id: cintura, label: "Cintura" },
				],
				name: "Macacão",
				opId: newOpId(),
				templateId,
			})
		).toEqual({ id: templateId, version: 1 });
		const updated = await owner.measurementTemplates.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: {
				fields: [
					{ id: cintura, label: "Cintura alta" },
					{ id: busto, label: "Busto" },
				],
				name: "Macacão longo",
			},
			templateId,
		});
		expect(updated.version).toBe(2);
		expect((await templateNamed(owner, "Macacão longo")).fields).toEqual([
			{ active: true, id: cintura, label: "Cintura alta" },
			{ active: true, id: busto, label: "Busto" },
		]);
		const archiveInput = { baseVersion: 2, opId: newOpId(), templateId };
		expect(
			(await owner.measurementTemplates.archive(archiveInput)).version
		).toBe(3);
		expect(
			(
				await owner.measurementTemplates.archive({
					baseVersion: 3,
					opId: newOpId(),
					templateId,
				})
			).version
		).toBe(3);
		expect(
			(await owner.measurementTemplates.archive(archiveInput)).version
		).toBe(3);
		expect(
			(
				await owner.measurementTemplates.unarchive({
					baseVersion: 3,
					opId: newOpId(),
					templateId,
				})
			).version
		).toBe(4);
	});

	test("a field left out stays deactivated at the end and resending it reactivates it", async () => {
		const { owner } = await ownerSetup();
		const saia = await templateNamed(owner, "Saia");
		await owner.measurementTemplates.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: {
				fields: sent(saia.fields).filter((field) => field.label !== "Quadril"),
			},
			templateId: saia.id,
		});
		expect(
			(await templateNamed(owner, "Saia")).fields.map((field) => [
				field.label,
				field.active,
			])
		).toEqual([
			["Cintura", true],
			["Altura do quadril", true],
			["Comprimento da saia", true],
			["Quadril", false],
		]);
		await owner.measurementTemplates.update({
			baseVersion: 2,
			opId: newOpId(),
			patch: { fields: sent(saia.fields) },
			templateId: saia.id,
		});
		expect(
			(await templateNamed(owner, "Saia")).fields.map((field) => [
				field.label,
				field.active,
			])
		).toEqual([
			["Cintura", true],
			["Quadril", true],
			["Altura do quadril", true],
			["Comprimento da saia", true],
		]);
	});

	test("the sixty field limit counts only the fields sent as active", async () => {
		const { owner } = await ownerSetup();
		const vestido = await templateNamed(owner, "Vestido");
		const sixty = Array.from({ length: 60 }, (_, index) => ({
			id: crypto.randomUUID(),
			label: `Campo ${index + 1}`,
		}));
		await owner.measurementTemplates.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: { fields: sixty },
			templateId: vestido.id,
		});
		const stored = await templateNamed(owner, "Vestido");
		expect(stored.fields).toHaveLength(76);
		expect(stored.fields.filter((field) => field.active)).toHaveLength(60);
		expect(
			(
				await owner.measurementTemplates.update({
					baseVersion: 2,
					opId: newOpId(),
					patch: { fields: sent(stored.fields) },
					templateId: vestido.id,
				})
			).version
		).toBe(3);
		await expect(
			owner.measurementTemplates.update({
				baseVersion: 3,
				opId: newOpId(),
				patch: {
					fields: [...sixty, { id: crypto.randomUUID(), label: "Campo 61" }],
				},
				templateId: vestido.id,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("refuses repeated labels, stale versions, unknown and repeated ids", async () => {
		const { owner } = await ownerSetup();
		await expect(
			owner.measurementTemplates.create({
				fields: [
					{ id: crypto.randomUUID(), label: "Braço" },
					{ id: crypto.randomUUID(), label: "braco" },
				],
				name: "Manga",
				opId: newOpId(),
				templateId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		const saia = await templateNamed(owner, "Saia");
		await owner.measurementTemplates.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: { name: "Saia reta" },
			templateId: saia.id,
		});
		await expect(
			owner.measurementTemplates.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: { name: "Saia longa" },
				templateId: saia.id,
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: { currentVersion: 2 },
			message: "Versão desatualizada",
		});
		await expect(
			owner.measurementTemplates.archive({
				baseVersion: 1,
				opId: newOpId(),
				templateId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Modelo de medidas não encontrado",
		});
		await expect(
			owner.measurementTemplates.create({
				fields: sent(saia.fields),
				name: "Saia",
				opId: newOpId(),
				templateId: saia.id,
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
	});
});

async function clientWithProfile(owner: Owner) {
	const clientId = crypto.randomUUID();
	await owner.clients.create({
		clientId,
		kind: "person",
		name: "Maria Beatriz Alencar",
		opId: newOpId(),
	});
	const profileId = crypto.randomUUID();
	await owner.profiles.create({
		clientId,
		name: "Maria Beatriz",
		opId: newOpId(),
		profileId,
	});
	return { clientId, profileId };
}

type Recording = {
	notes?: string | null;
	profileId: string;
	takenOn?: string;
	template: TemplateItem;
	values: readonly (number | null)[];
};

function measurementInput({
	notes = null,
	profileId,
	takenOn = "2026-09-02",
	template,
	values,
}: Recording) {
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
		takenOn,
		templateId: template.id,
		templateName: template.name,
		templateVersion: template.version,
	};
}

async function recordMeasurement(owner: Owner, recording: Recording) {
	const measurementId = crypto.randomUUID();
	await owner.measurements.create({
		...measurementInput(recording),
		measurementId,
		opId: newOpId(),
	});
	return measurementId;
}

describe("measurements", () => {
	test("records, lists, corrects, archives and replays a measurement", async () => {
		const { owner, server } = await ownerSetup();
		const { clientId, profileId } = await clientWithProfile(owner);
		const vestido = await templateNamed(owner, "Vestido");
		const measurementId = crypto.randomUUID();
		const input = measurementInput({
			notes: " Mede com salto ",
			profileId,
			template: vestido,
			values: [920],
		});
		const createInput = { ...input, measurementId, opId: newOpId() };
		expect(await owner.measurements.create(createInput)).toEqual({
			id: measurementId,
			version: 1,
		});
		expect(await owner.measurements.create(createInput)).toEqual({
			id: measurementId,
			version: 1,
		});
		await expect(
			owner.measurements.create({ ...createInput, notes: "Outra" })
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "opId reutilizado com conteúdo diferente",
		});
		const [listed] = (await owner.measurements.list({ clientId })).items;
		expect(listed).toMatchObject({
			archivedAt: null,
			id: measurementId,
			notes: "Mede com salto",
			profileId,
			takenOn: "2026-09-02",
			templateId: vestido.id,
			templateName: "Vestido",
			templateVersion: 1,
			version: 1,
		});
		expect(listed?.fields[0]).toEqual({
			fieldId: input.fields[0]?.fieldId ?? "",
			label: "Busto",
			valueMm: 920,
		});
		const corrected = await owner.measurements.update({
			baseVersion: 1,
			measurementId,
			opId: newOpId(),
			patch: {
				fields: input.fields.map((field, index) =>
					index === 1 ? { ...field, valueMm: 745 } : field
				),
				notes: "",
			},
		});
		expect(corrected.version).toBe(2);
		const [afterCorrection] = (await owner.measurements.list({ clientId }))
			.items;
		expect(afterCorrection?.notes).toBeNull();
		expect(
			afterCorrection?.fields.slice(0, 2).map((field) => field.valueMm)
		).toEqual([920, 745]);
		expect(
			(
				await owner.measurements.archive({
					baseVersion: 2,
					measurementId,
					opId: newOpId(),
				})
			).version
		).toBe(3);
		expect(
			(
				await owner.measurements.unarchive({
					baseVersion: 3,
					measurementId,
					opId: newOpId(),
				})
			).version
		).toBe(4);
		expect(
			server
				.native()
				.query<{ aggregate_type: string }, [string]>(
					"SELECT DISTINCT aggregate_type FROM operation WHERE aggregate_id = ?"
				)
				.all(measurementId)
		).toEqual([{ aggregate_type: "measurement" }]);
	});

	test("answers stale versions, missing records, repeated ids and invalid values", async () => {
		const { owner } = await ownerSetup();
		const { profileId } = await clientWithProfile(owner);
		const saia = await templateNamed(owner, "Saia");
		const measurementId = await recordMeasurement(owner, {
			profileId,
			template: saia,
			values: [700],
		});
		await owner.measurements.update({
			baseVersion: 1,
			measurementId,
			opId: newOpId(),
			patch: { takenOn: "2026-09-03" },
		});
		await expect(
			owner.measurements.update({
				baseVersion: 1,
				measurementId,
				opId: newOpId(),
				patch: { notes: "x" },
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: { currentVersion: 2 },
			message: "Versão desatualizada",
		});
		await expect(
			owner.measurements.archive({
				baseVersion: 1,
				measurementId: crypto.randomUUID(),
				opId: newOpId(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Medição não encontrada",
		});
		const base = measurementInput({ profileId, template: saia, values: [700] });
		await expect(
			owner.measurements.create({
				...base,
				measurementId: crypto.randomUUID(),
				opId: newOpId(),
				profileId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Perfil não encontrado",
		});
		await expect(
			owner.measurements.create({
				...base,
				measurementId: crypto.randomUUID(),
				opId: newOpId(),
				templateId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Modelo de medidas não encontrado",
		});
		await expect(
			owner.measurements.create({ ...base, measurementId, opId: newOpId() })
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		const [first] = base.fields;
		if (!first) {
			throw new Error("Saia sem campos");
		}
		const invalid = [
			{ fields: [{ ...first, valueMm: 0 }] },
			{ fields: [{ ...first, valueMm: 10_000 }] },
			{ fields: [{ ...first, valueMm: 74.5 }] },
			{ fields: [{ ...first, valueMm: null }] },
			{ fields: [first, first] },
			{ takenOn: "2026-02-30" },
		];
		await inSequence(invalid, async (override) => {
			await expect(
				owner.measurements.create({
					...base,
					measurementId: crypto.randomUUID(),
					opId: newOpId(),
					...override,
				})
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		});
	});

	test("lists in total order: date, arrival and id, all descending", async () => {
		const clock = manualClock();
		const { owner } = await ownerSetup({ now: clock.now });
		const { clientId, profileId } = await clientWithProfile(owner);
		const saia = await templateNamed(owner, "Saia");
		const older = await recordMeasurement(owner, {
			profileId,
			takenOn: "2026-08-01",
			template: saia,
			values: [700],
		});
		const first = await recordMeasurement(owner, {
			profileId,
			template: saia,
			values: [710],
		});
		const second = await recordMeasurement(owner, {
			profileId,
			template: saia,
			values: [720],
		});
		clock.advance(1000);
		const later = await recordMeasurement(owner, {
			profileId,
			template: saia,
			values: [730],
		});
		const { items } = await owner.measurements.list({ clientId });
		const sameInstant = [first, second].sort().reverse();
		expect(items.map((item) => item.id)).toEqual([
			later,
			...sameInstant,
			older,
		]);
	});

	test("refuses measurement commands once the client is anonymized", async () => {
		const { owner } = await ownerSetup();
		const { clientId, profileId } = await clientWithProfile(owner);
		const saia = await templateNamed(owner, "Saia");
		const measurementId = await recordMeasurement(owner, {
			profileId,
			template: saia,
			values: [700],
		});
		await owner.clients.anonymize({
			baseVersion: 1,
			clientId,
			opId: newOpId(),
		});
		const anonymized = {
			code: "PRECONDITION_FAILED",
			message: "Cliente anonimizado",
		};
		await expect(
			owner.measurements.update({
				baseVersion: 2,
				measurementId,
				opId: newOpId(),
				patch: { notes: "x" },
			})
		).rejects.toMatchObject(anonymized);
		await expect(
			owner.measurements.unarchive({
				baseVersion: 2,
				measurementId,
				opId: newOpId(),
			})
		).rejects.toMatchObject(anonymized);
		await expect(
			recordMeasurement(owner, { profileId, template: saia, values: [700] })
		).rejects.toMatchObject(anonymized);
		const [item] = (await owner.measurements.list({ clientId })).items;
		expect(item?.fields.map((field) => field.valueMm)).toEqual([
			null,
			null,
			null,
			null,
		]);
		expect(item?.archivedAt).not.toBeNull();
	});
});

describe("measurement review regressions", () => {
	test("anonymizing a client leaves the measurements of another client untouched", async () => {
		const { owner } = await ownerSetup();
		const maria = await clientWithProfile(owner);
		const other = await clientWithProfile(owner);
		const saia = await templateNamed(owner, "Saia");
		await recordMeasurement(owner, {
			profileId: maria.profileId,
			template: saia,
			values: [700],
		});
		const kept = await recordMeasurement(owner, {
			profileId: other.profileId,
			template: saia,
			values: [710],
		});
		expect(
			(await owner.measurements.list({ clientId: maria.clientId })).items
		).toHaveLength(1);
		await owner.clients.anonymize({
			baseVersion: 1,
			clientId: maria.clientId,
			opId: newOpId(),
		});
		const [otherItem] = (
			await owner.measurements.list({ clientId: other.clientId })
		).items;
		expect(otherItem).toMatchObject({ archivedAt: null, id: kept, version: 1 });
		expect(otherItem?.fields[0]?.valueMm).toBe(710);
	});

	test("anonymization keeps the archive date of an archived measurement", async () => {
		const clock = manualClock();
		const { owner } = await ownerSetup({ now: clock.now });
		const { clientId, profileId } = await clientWithProfile(owner);
		const saia = await templateNamed(owner, "Saia");
		const measurementId = await recordMeasurement(owner, {
			profileId,
			template: saia,
			values: [700],
		});
		await owner.measurements.archive({
			baseVersion: 1,
			measurementId,
			opId: newOpId(),
		});
		const [archived] = (await owner.measurements.list({ clientId })).items;
		clock.advance(60_000);
		await owner.clients.anonymize({
			baseVersion: 1,
			clientId,
			opId: newOpId(),
		});
		const [after] = (await owner.measurements.list({ clientId })).items;
		expect(after?.archivedAt).toBe(archived?.archivedAt ?? "ausente");
	});

	test("an anonymized client is refused before a missing template is looked up", async () => {
		const { owner } = await ownerSetup();
		const { clientId, profileId } = await clientWithProfile(owner);
		const saia = await templateNamed(owner, "Saia");
		await owner.clients.anonymize({
			baseVersion: 1,
			clientId,
			opId: newOpId(),
		});
		await expect(
			owner.measurements.create({
				...measurementInput({ profileId, template: saia, values: [700] }),
				measurementId: crypto.randomUUID(),
				opId: newOpId(),
				templateId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({
			code: "PRECONDITION_FAILED",
			message: "Cliente anonimizado",
		});
	});

	test("answers a missing client, repeated template field ids and empty patches", async () => {
		const { owner } = await ownerSetup();
		await expect(
			owner.measurements.list({ clientId: crypto.randomUUID() })
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Cliente não encontrado",
		});
		const repeated = crypto.randomUUID();
		await expect(
			owner.measurementTemplates.create({
				fields: [
					{ id: repeated, label: "Busto" },
					{ id: repeated, label: "Cintura" },
				],
				name: "Corpete",
				opId: newOpId(),
				templateId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		const saia = await templateNamed(owner, "Saia");
		await expect(
			owner.measurementTemplates.update({
				baseVersion: saia.version,
				opId: newOpId(),
				patch: {},
				templateId: saia.id,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		const { profileId } = await clientWithProfile(owner);
		const measurementId = await recordMeasurement(owner, {
			profileId,
			template: saia,
			values: [700],
		});
		await expect(
			owner.measurements.update({
				baseVersion: 1,
				measurementId,
				opId: newOpId(),
				patch: {},
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("an archived template still accepts a measurement", async () => {
		const { owner } = await ownerSetup();
		const { profileId } = await clientWithProfile(owner);
		const saia = await templateNamed(owner, "Saia");
		await owner.measurementTemplates.archive({
			baseVersion: saia.version,
			opId: newOpId(),
			templateId: saia.id,
		});
		expect(
			await recordMeasurement(owner, {
				profileId,
				template: saia,
				values: [700],
			})
		).toEqual(expect.any(String));
	});
});

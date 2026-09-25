import { afterEach, describe, expect, test } from "bun:test";
import { defaultTargetMarginBasisPoints } from "@costura-pro/domain/pricing";

import {
	completeWizard,
	inSequence,
	manualClock,
	newOpId,
	rpc,
	type ServerOptions,
	startTestServer,
	type TestServer,
	times,
} from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

type Owner = ReturnType<typeof rpc>;

async function ownerSetup(options: ServerOptions = {}) {
	const server = await startTestServer(options);
	servers.push(server);
	const { cookie } = await completeWizard(server);
	return { owner: rpc(server, { cookie }), server };
}

function createService(owner: Owner, overrides: Record<string, unknown> = {}) {
	return owner.services.create({
		category: "Barra",
		costCents: "6000",
		name: "Barra de calça",
		opId: newOpId(),
		priceCents: "10000",
		serviceId: crypto.randomUUID(),
		...overrides,
	});
}

function changesOf(server: TestServer, aggregateType: string): number {
	return (
		server
			.native()
			.query<{ total: number }, [string]>(
				"SELECT count(*) AS total FROM change_log WHERE aggregate_type = ?"
			)
			.get(aggregateType)?.total ?? 0
	);
}

describe("services", () => {
	test("creates, reads and edits a service with money as strings", async () => {
		const { owner } = await ownerSetup({ now: manualClock().now });
		const created = await createService(owner, {
			estimatedMinutes: 30,
			notes: "  Com overloque ",
			serviceId: "00000000-0000-4000-8000-000000000001",
		});
		expect(created).toEqual({
			id: "00000000-0000-4000-8000-000000000001",
			version: 1,
		});
		const expected = {
			archivedAt: null,
			category: "Barra",
			costCents: "6000",
			createdAt: "2026-09-16T12:00:00.000Z",
			estimatedMinutes: 30,
			id: created.id,
			name: "Barra de calça",
			notes: "Com overloque",
			outsourced: false,
			priceCents: "10000",
			suggestedStageIds: [],
			targetMarginBasisPoints: null,
			updatedAt: "2026-09-16T12:00:00.000Z",
			version: 1,
		};
		expect((await owner.services.list({})).items).toEqual([expected]);
		expect(await owner.services.get({ serviceId: created.id })).toEqual(
			expected
		);
		expect(
			await owner.services.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: {
					outsourced: true,
					priceCents: "12000",
					targetMarginBasisPoints: 3000,
				},
				serviceId: created.id,
			})
		).toEqual({ version: 2 });
		expect(await owner.services.get({ serviceId: created.id })).toMatchObject({
			costCents: "6000",
			outsourced: true,
			priceCents: "12000",
			targetMarginBasisPoints: 3000,
			version: 2,
		});
	});

	test("clears the own margin, the category and the duration with null", async () => {
		const { owner } = await ownerSetup();
		const { id } = await createService(owner, {
			estimatedMinutes: 45,
			targetMarginBasisPoints: 2500,
		});
		await owner.services.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: {
				category: "",
				estimatedMinutes: null,
				targetMarginBasisPoints: null,
			},
			serviceId: id,
		});
		expect(await owner.services.get({ serviceId: id })).toMatchObject({
			category: null,
			estimatedMinutes: null,
			targetMarginBasisPoints: null,
		});
	});

	test("finds services without accents and filters by category", async () => {
		const { owner } = await ownerSetup();
		await createService(owner);
		await createService(owner, { name: "Barra italiana" });
		await createService(owner, {
			category: "Ajuste",
			name: "Ajuste de cintura",
		});
		await createService(owner, { category: null, name: "Bordado à mão" });
		const archived = await createService(owner, {
			category: "Conserto",
			name: "Troca de zíper",
		});
		await owner.services.archive({
			baseVersion: 1,
			opId: newOpId(),
			serviceId: archived.id,
		});
		const names = async (input: Parameters<Owner["services"]["list"]>[0]) =>
			(await owner.services.list(input)).items.map((item) => item.name);
		expect(await names({ query: "bordado a mao" })).toEqual(["Bordado à mão"]);
		expect(await names({ query: "CALCA" })).toEqual(["Barra de calça"]);
		expect(await names({ query: "100%" })).toEqual([]);
		expect(await names({ category: "Ajuste" })).toEqual(["Ajuste de cintura"]);
		expect(await names({ category: "Barra" })).toEqual([
			"Barra de calça",
			"Barra italiana",
		]);
		expect(await names({ category: "" })).toEqual(["Bordado à mão"]);
		expect(await names({ archived: true })).toEqual(["Troca de zíper"]);
		expect(await owner.services.categories({})).toEqual({
			categories: ["Ajuste", "Barra"],
		});
	});

	test("edits the cost and finds the service by its new name and category", async () => {
		const { owner } = await ownerSetup();
		const { id } = await createService(owner);
		await createService(owner, { name: "Barra italiana" });
		await owner.services.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: { category: null, costCents: "7000", name: "Bainha" },
			serviceId: id,
		});
		expect(await owner.services.get({ serviceId: id })).toMatchObject({
			category: null,
			costCents: "7000",
			name: "Bainha",
			priceCents: "10000",
			version: 2,
		});
		const names = async (query: string) =>
			(await owner.services.list({ query })).items.map((item) => item.name);
		expect(await names("bainha")).toEqual(["Bainha"]);
		expect(await names("barra")).toEqual(["Barra italiana"]);
		expect(await owner.services.categories({})).toEqual({
			categories: ["Barra"],
		});
	});

	test("pages the list 50 at a time", async () => {
		const { owner } = await ownerSetup();
		await inSequence(times(51), (index) =>
			createService(owner, {
				name: `Serviço ${String(index).padStart(2, "0")}`,
			})
		);
		const first = await owner.services.list({});
		expect(first.items).toHaveLength(50);
		expect(first.nextOffset).toBe(50);
		const second = await owner.services.list({ offset: 50 });
		expect(second.items.map((item) => item.name)).toEqual(["Serviço 51"]);
		expect(second.nextOffset).toBeNull();
	});

	test("archives, archives again without effect and unarchives", async () => {
		const { owner } = await ownerSetup();
		const { id } = await createService(owner);
		const input = { opId: newOpId(), serviceId: id };
		expect(await owner.services.archive({ ...input, baseVersion: 1 })).toEqual({
			version: 2,
		});
		expect(
			await owner.services.archive({
				baseVersion: 2,
				opId: newOpId(),
				serviceId: id,
			})
		).toEqual({ version: 2 });
		expect((await owner.services.list({})).items).toHaveLength(0);
		expect(
			await owner.services.unarchive({
				baseVersion: 2,
				opId: newOpId(),
				serviceId: id,
			})
		).toEqual({ version: 3 });
	});

	test("repeats by opId and refuses a stale version, a repeated id, a missing service and an empty patch", async () => {
		const { owner } = await ownerSetup();
		const serviceId = crypto.randomUUID();
		const opId = newOpId();
		const first = await createService(owner, { opId, serviceId });
		expect(await createService(owner, { opId, serviceId })).toEqual(first);
		await expect(createService(owner, { serviceId })).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		await expect(
			owner.services.update({
				baseVersion: 4,
				opId: newOpId(),
				patch: { name: "Outro" },
				serviceId,
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: { currentVersion: 1 },
			message: "Versão desatualizada",
		});
		await expect(
			owner.services.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: { name: "Outro" },
				serviceId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Serviço não encontrado",
		});
		await expect(
			owner.services.get({ serviceId: crypto.randomUUID() })
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Serviço não encontrado",
		});
		await expect(
			owner.services.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: {},
				serviceId,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("keeps the suggested stages of a service and refuses a repeated stage", async () => {
		const { owner } = await ownerSetup();
		const suggested = [
			"c0000000-0000-4000-8000-000000000003",
			"c0000000-0000-4000-8000-000000000004",
		];
		const { id } = await createService(owner, {
			suggestedStageIds: suggested,
		});
		expect(await owner.services.get({ serviceId: id })).toMatchObject({
			suggestedStageIds: suggested,
			version: 1,
		});
		const plain = await createService(owner, { name: "Bainha" });
		expect(
			(await owner.services.get({ serviceId: plain.id })).suggestedStageIds
		).toEqual([]);
		expect(
			await owner.services.update({
				baseVersion: 1,
				opId: newOpId(),
				patch: {
					suggestedStageIds: ["c0000000-0000-4000-8000-000000000001"],
				},
				serviceId: id,
			})
		).toEqual({ version: 2 });
		expect(await owner.services.get({ serviceId: id })).toMatchObject({
			suggestedStageIds: ["c0000000-0000-4000-8000-000000000001"],
			version: 2,
		});
		const repeated = [
			"c0000000-0000-4000-8000-000000000002",
			"c0000000-0000-4000-8000-000000000002",
		];
		const outcomes = await inSequence(
			[
				() => createService(owner, { suggestedStageIds: repeated }),
				() =>
					owner.services.update({
						baseVersion: 2,
						opId: newOpId(),
						patch: { suggestedStageIds: repeated },
						serviceId: id,
					}),
				() => createService(owner, { suggestedStageIds: ["Prova"] }),
			],
			(call) =>
				call().then(
					() => "accepted",
					(error: { code?: string }) => error.code
				)
		);
		expect(outcomes).toEqual(["BAD_REQUEST", "BAD_REQUEST", "BAD_REQUEST"]);
		expect(await owner.services.get({ serviceId: id })).toMatchObject({
			suggestedStageIds: ["c0000000-0000-4000-8000-000000000001"],
			version: 2,
		});
	});

	test("refuses money out of format, a margin of 100% and a zero duration", async () => {
		const { owner } = await ownerSetup();
		const outcomes = await inSequence(
			[
				{ costCents: "12,50" },
				{ priceCents: "-100" },
				{ costCents: "9007199254740992" },
				{ targetMarginBasisPoints: 10_000 },
				{ estimatedMinutes: 0 },
				{ estimatedMinutes: 10_000 },
				{ name: "  " },
			],
			(overrides) =>
				createService(owner, overrides).then(
					() => "accepted",
					(error: { code?: string }) => error.code
				)
		);
		expect(outcomes).toEqual(Array.from({ length: 7 }, () => "BAD_REQUEST"));
	});
});

describe("atelier target margin", () => {
	test("starts at the default of the domain and changes without touching service prices", async () => {
		const { owner, server } = await ownerSetup();
		const settings = await owner.pricing.settings({});
		expect(settings.targetMarginBasisPoints).toBe(
			defaultTargetMarginBasisPoints
		);
		const { id } = await createService(owner);
		const serviceChanges = changesOf(server, "service");
		const changed = await owner.pricing.setTargetMargin({
			baseVersion: settings.version,
			opId: newOpId(),
			targetMarginBasisPoints: 3500,
		});
		expect(changed).toEqual({ version: settings.version + 1 });
		expect(await owner.pricing.settings({})).toEqual({
			targetMarginBasisPoints: 3500,
			version: settings.version + 1,
		});
		expect(await owner.services.get({ serviceId: id })).toMatchObject({
			priceCents: "10000",
			version: 1,
		});
		expect(changesOf(server, "service")).toBe(serviceChanges);
	});

	test("the same margin keeps the version without writing", async () => {
		const { owner, server } = await ownerSetup();
		const settings = await owner.pricing.settings({});
		const installationChanges = changesOf(server, "installation");
		expect(
			await owner.pricing.setTargetMargin({
				baseVersion: settings.version,
				opId: newOpId(),
				targetMarginBasisPoints: settings.targetMarginBasisPoints,
			})
		).toEqual({ version: settings.version });
		expect(changesOf(server, "installation")).toBe(installationChanges);
	});

	test("refuses a stale version and a margin out of range", async () => {
		const { owner } = await ownerSetup();
		const settings = await owner.pricing.settings({});
		await expect(
			owner.pricing.setTargetMargin({
				baseVersion: settings.version - 1,
				opId: newOpId(),
				targetMarginBasisPoints: 3000,
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Versão desatualizada",
		});
		const outcomes = await inSequence(
			[10_000, -1, 12.5],
			(targetMarginBasisPoints) =>
				owner.pricing
					.setTargetMargin({
						baseVersion: settings.version,
						opId: newOpId(),
						targetMarginBasisPoints,
					})
					.then(
						() => "accepted",
						(error: { code?: string }) => error.code
					)
		);
		expect(outcomes).toEqual(["BAD_REQUEST", "BAD_REQUEST", "BAD_REQUEST"]);
	});
});

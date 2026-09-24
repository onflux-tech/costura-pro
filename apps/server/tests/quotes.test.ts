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

async function createClient(
	owner: Owner,
	name = "Maria Beatriz Alencar"
): Promise<string> {
	const clientId = crypto.randomUUID();
	await owner.clients.create({
		clientId,
		kind: "person",
		name,
		opId: newOpId(),
	});
	return clientId;
}

const serviceId = crypto.randomUUID();
const zipperVariantId = crypto.randomUUID();

function serviceLine(overrides: Record<string, unknown> = {}) {
	return {
		catalogPriceCents: "16000",
		discount: { basisPoints: 1000, kind: "percent" as const, reason: null },
		estimatedMinutes: 90,
		id: crypto.randomUUID(),
		kind: "service" as const,
		note: "  Blazer de linho ",
		outsourced: false,
		profileId: null,
		quantity: 1,
		receivedItemId: null,
		serviceId,
		serviceName: "Ajuste de cava",
		serviceVersion: 1,
		unitCostCents: "6000",
		unitPriceCents: "16000",
		...overrides,
	};
}

function materialComponent(
	materialName: string,
	quantityMicros: string,
	unitCostCents: string | null
) {
	return {
		baseUnit: "m" as const,
		code: null,
		displayPrecision: 2,
		id: crypto.randomUUID(),
		kind: "material" as const,
		materialName,
		materialVariantId: crypto.randomUUID(),
		quantityMicros,
		unitCostCents,
		variantName: "Padrão",
	};
}

function sewingComponent(overrides: Record<string, unknown> = {}) {
	return {
		count: 1,
		estimatedMinutes: 600,
		id: crypto.randomUUID(),
		kind: "service" as const,
		outsourced: false,
		serviceId: crypto.randomUUID(),
		serviceName: "Costura sob medida",
		serviceVersion: 3,
		unitCostCents: "30000",
		...overrides,
	};
}

function customLine(overrides: Record<string, unknown> = {}) {
	return {
		components: [
			materialComponent("Crepe georgette", "3400000", "3800"),
			materialComponent("Forro cetim", "2800000", "2200"),
			{
				...materialComponent("Zíper invisível 60 cm", "1000000", "900"),
				baseUnit: "un" as const,
				displayPrecision: 0,
			},
			sewingComponent(),
		],
		description: "Vestido de festa sob medida",
		discount: null,
		id: crypto.randomUUID(),
		kind: "custom" as const,
		note: null,
		profileId: null,
		quantity: 1,
		source: null,
		unitPriceCents: "98000",
		...overrides,
	};
}

function materialLine(overrides: Record<string, unknown> = {}) {
	return {
		baseUnit: "un" as const,
		code: "ZIP-20",
		discount: null,
		displayPrecision: 0,
		id: crypto.randomUUID(),
		kind: "material" as const,
		materialName: "Zíper invisível",
		materialVariantId: zipperVariantId,
		note: null,
		quantityMicros: "1000000",
		unitCostCents: "370",
		unitPriceCents: "800",
		variantName: "20 cm preto",
		...overrides,
	};
}

function freeLine(overrides: Record<string, unknown> = {}) {
	return {
		description: "Taxa de urgência",
		discount: null,
		id: crypto.randomUUID(),
		kind: "free" as const,
		note: null,
		quantity: 1,
		unitCostCents: "0",
		unitPriceCents: "5000",
		...overrides,
	};
}

function exampleContent() {
	return {
		discount: {
			amountCents: "30000",
			kind: "amount" as const,
			reason: "Cliente antiga",
		},
		leadTimeDays: 20,
		lines: [serviceLine(), customLine(), materialLine(), freeLine()],
		notes: "Prova em 10 dias",
		validityDays: 15,
	};
}

async function createQuote(
	owner: Owner,
	clientId: string,
	overrides: Record<string, unknown> = {}
): Promise<string> {
	const quoteId = crypto.randomUUID();
	await owner.quotes.create({
		clientId,
		createdOn: "2026-09-24",
		opId: newOpId(),
		quoteId,
		...overrides,
	});
	return quoteId;
}

function updateWith(
	owner: Owner,
	quoteId: string,
	baseVersion: number,
	overrides: Record<string, unknown> = {}
) {
	return owner.quotes.update({
		baseVersion,
		content: { ...exampleContent(), ...overrides },
		opId: newOpId(),
		quoteId,
	});
}

const outcome = (promise: Promise<unknown>) =>
	promise.then(
		() => "accepted",
		(error: { code?: string }) => error.code
	);

function changeCount(server: TestServer, quoteId: string): number {
	return (
		server
			.native()
			.query<{ total: number }, [string]>(
				"SELECT count(*) AS total FROM change_log WHERE aggregate_type = 'quote' AND aggregate_id = ?"
			)
			.get(quoteId)?.total ?? 0
	);
}

describe("quotes", () => {
	test("creates drafts with the next code of each year and reads one back", async () => {
		const { owner } = await ownerSetup();
		const clientId = await createClient(owner);
		const first = await createQuote(owner, clientId);
		const second = await createQuote(owner, clientId);
		const nextYear = await createQuote(owner, clientId, {
			createdOn: "2027-01-02",
		});
		const codes = await inSequence([first, second, nextYear], async (id) => {
			const detail = await owner.quotes.get({ quoteId: id });
			return detail.quote.code;
		});
		expect(codes).toEqual([
			"ORC-2026-PC-0001",
			"ORC-2026-PC-0002",
			"ORC-2027-PC-0001",
		]);
		expect(await owner.quotes.get({ quoteId: first })).toEqual({
			approval: null,
			client: {
				anonymized: false,
				archived: false,
				id: clientId,
				name: "Maria Beatriz Alencar",
			},
			quote: {
				archivedAt: null,
				clientId,
				code: "ORC-2026-PC-0001",
				createdAt: expect.any(String),
				createdOn: "2026-09-24",
				discount: null,
				id: first,
				leadTimeDays: null,
				lines: [],
				notes: null,
				refusalReason: null,
				refusedOn: null,
				updatedAt: expect.any(String),
				validityDays: 15,
				version: 1,
			},
			revisions: [],
			stock: [],
		});
	});

	test("refuses a missing or anonymized client and takes an archived one", async () => {
		const { owner } = await ownerSetup();
		await expect(createQuote(owner, crypto.randomUUID())).rejects.toMatchObject(
			{
				code: "NOT_FOUND",
				message: "Cliente não encontrado",
			}
		);
		const anonymized = await createClient(owner, "Rita de Cássia");
		await owner.clients.anonymize({
			baseVersion: 1,
			clientId: anonymized,
			opId: newOpId(),
		});
		await expect(createQuote(owner, anonymized)).rejects.toMatchObject({
			code: "PRECONDITION_FAILED",
			message: "Cliente anonimizado",
		});
		const archived = await createClient(owner, "Beatriz Nogueira");
		await owner.clients.archive({
			baseVersion: 1,
			clientId: archived,
			opId: newOpId(),
		});
		const quoteId = await createQuote(owner, archived);
		expect((await owner.quotes.get({ quoteId })).client).toMatchObject({
			archived: true,
		});
	});

	test("replaces the whole content and ignores an equal one", async () => {
		const { owner, server } = await ownerSetup();
		const quoteId = await createQuote(owner, await createClient(owner));
		const service = serviceLine();
		const rest = [customLine(), materialLine(), freeLine()];
		const content = { ...exampleContent(), lines: [service, ...rest] };
		expect(
			await owner.quotes.update({
				baseVersion: 1,
				content,
				opId: newOpId(),
				quoteId,
			})
		).toEqual({ version: 2 });
		const trimmed = [{ ...service, note: "Blazer de linho" }, ...rest];
		const stored = (await owner.quotes.get({ quoteId })).quote;
		expect(stored).toMatchObject({
			discount: content.discount,
			leadTimeDays: 20,
			lines: trimmed,
			notes: "Prova em 10 dias",
			validityDays: 15,
			version: 2,
		});
		expect(
			await owner.quotes.update({
				baseVersion: 2,
				content: { ...content, lines: trimmed },
				opId: newOpId(),
				quoteId,
			})
		).toEqual({ version: 2 });
		expect(changeCount(server, quoteId)).toBe(2);
		expect(
			await owner.quotes.update({
				baseVersion: 2,
				content: { ...content, notes: null },
				opId: newOpId(),
				quoteId,
			})
		).toEqual({ version: 3 });
		expect(changeCount(server, quoteId)).toBe(3);
		expect((await owner.quotes.get({ quoteId })).quote.notes).toBeNull();
	});

	test("archives, refuses and undoes without spending versions on repeats", async () => {
		const { owner } = await ownerSetup();
		const quoteId = await createQuote(owner, await createClient(owner));
		const toggle = (
			action: "archive" | "unarchive" | "unrefuse",
			baseVersion: number
		) => owner.quotes[action]({ baseVersion, opId: newOpId(), quoteId });
		const refuse = (baseVersion: number) =>
			owner.quotes.refuse({
				baseVersion,
				opId: newOpId(),
				quoteId,
				reason: " Achou caro ",
				refusedOn: "2026-09-25",
			});
		expect(await toggle("archive", 1)).toEqual({ version: 2 });
		expect(await toggle("archive", 2)).toEqual({ version: 2 });
		expect(
			(await owner.quotes.get({ quoteId })).quote.archivedAt
		).not.toBeNull();
		expect(await toggle("unarchive", 2)).toEqual({ version: 3 });
		expect(await refuse(3)).toEqual({ version: 4 });
		expect((await owner.quotes.get({ quoteId })).quote).toMatchObject({
			archivedAt: null,
			refusalReason: "Achou caro",
			refusedOn: "2026-09-25",
		});
		expect(await refuse(4)).toEqual({ version: 4 });
		expect(await toggle("unrefuse", 4)).toEqual({ version: 5 });
		expect(await toggle("unrefuse", 5)).toEqual({ version: 5 });
		expect((await owner.quotes.get({ quoteId })).quote).toMatchObject({
			refusalReason: null,
			refusedOn: null,
		});
	});

	test("repeats by opId, refuses a stale version, a repeated id and a missing quote", async () => {
		const { owner } = await ownerSetup();
		const clientId = await createClient(owner);
		const quoteId = crypto.randomUUID();
		const input = {
			clientId,
			createdOn: "2026-09-24",
			opId: newOpId(),
			quoteId,
		};
		expect(await owner.quotes.create(input)).toEqual({
			id: quoteId,
			version: 1,
		});
		expect(await owner.quotes.create(input)).toEqual({
			id: quoteId,
			version: 1,
		});
		await expect(
			owner.quotes.create({ ...input, opId: newOpId() })
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		await updateWith(owner, quoteId, 1);
		await expect(
			updateWith(owner, quoteId, 1, { notes: "Outra" })
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: { currentVersion: 2 },
			message: "Versão desatualizada",
		});
		const missing = crypto.randomUUID();
		const notFound = { code: "NOT_FOUND", message: "Orçamento não encontrado" };
		await expect(owner.quotes.get({ quoteId: missing })).rejects.toMatchObject(
			notFound
		);
		await expect(updateWith(owner, missing, 1)).rejects.toMatchObject(notFound);
		await expect(
			owner.quotes.archive({
				baseVersion: 1,
				opId: newOpId(),
				quoteId: missing,
			})
		).rejects.toMatchObject(notFound);
		await expect(
			owner.quotes.refuse({
				baseVersion: 1,
				opId: newOpId(),
				quoteId: missing,
				refusedOn: "2026-09-25",
			})
		).rejects.toMatchObject(notFound);
	});

	test("refuses content out of shape", async () => {
		const { owner } = await ownerSetup();
		const quoteId = await createQuote(owner, await createClient(owner));
		const repeated = serviceLine();
		const repeatedComponent = sewingComponent();
		const outcomes = await inSequence(
			[
				{ lines: [repeated, { ...repeated }] },
				{
					lines: [
						customLine({ components: [repeatedComponent, repeatedComponent] }),
					],
				},
				{
					lines: [
						serviceLine({
							discount: { amountCents: "16001", kind: "amount", reason: null },
						}),
						freeLine(),
					],
				},
				{
					discount: { amountCents: "14401", kind: "amount", reason: null },
					lines: [serviceLine()],
				},
				{ lines: [serviceLine({ quantity: 0 })] },
				{ lines: [serviceLine({ quantity: 10_000 })] },
				{
					lines: [customLine({ components: [sewingComponent({ count: 0 })] })],
				},
				{
					lines: [
						customLine({ components: [sewingComponent({ count: 100 })] }),
					],
				},
				{
					lines: [
						serviceLine({
							discount: { basisPoints: 0, kind: "percent", reason: null },
						}),
					],
				},
				{
					lines: [
						serviceLine({
							discount: { basisPoints: 10_001, kind: "percent", reason: null },
						}),
					],
				},
				{ validityDays: 0 },
				{ validityDays: 366 },
				{ leadTimeDays: 0 },
				{ lines: [customLine({ description: "  " })] },
				{ lines: [freeLine({ note: "x".repeat(201) })] },
				{ lines: [serviceLine({ unitPriceCents: "12,50" })] },
				{ lines: times(101).map(() => freeLine()) },
				{
					lines: [
						customLine({
							components: times(61).map(() => sewingComponent()),
						}),
					],
				},
				{
					lines: [
						freeLine({ quantity: 9999, unitPriceCents: "900719925474099" }),
					],
				},
				{ lines: [serviceLine(), null] },
			],
			(overrides) =>
				outcome(updateWith(owner, quoteId, 1, { discount: null, ...overrides }))
		);
		expect(outcomes).toEqual(Array.from({ length: 20 }, () => "BAD_REQUEST"));
		expect(
			await outcome(
				updateWith(owner, quoteId, 1, {
					discount: null,
					lines: [
						serviceLine({
							discount: { amountCents: "16000", kind: "amount", reason: null },
						}),
					],
				})
			)
		).toBe("accepted");
		expect(
			await outcome(
				updateWith(owner, quoteId, 2, {
					discount: { amountCents: "14400", kind: "amount", reason: null },
					lines: [serviceLine()],
				})
			)
		).toBe("accepted");
		expect(
			await outcome(
				createQuote(owner, await createClient(owner, "Tereza"), {
					createdOn: "2026-02-30",
				})
			)
		).toBe("BAD_REQUEST");
	});

	test("needs a session in every procedure", async () => {
		const { owner, server } = await ownerSetup();
		const quoteId = await createQuote(owner, await createClient(owner));
		const anonymous = rpc(server);
		const version = { baseVersion: 1, opId: newOpId(), quoteId };
		const calls = [
			() =>
				anonymous.quotes.create({
					clientId: crypto.randomUUID(),
					createdOn: "2026-09-24",
					opId: newOpId(),
					quoteId: crypto.randomUUID(),
				}),
			() => anonymous.quotes.update({ ...version, content: exampleContent() }),
			() => anonymous.quotes.archive(version),
			() => anonymous.quotes.unarchive(version),
			() => anonymous.quotes.refuse({ ...version, refusedOn: "2026-09-25" }),
			() => anonymous.quotes.unrefuse(version),
			() => anonymous.quotes.get({ quoteId }),
		];
		expect(await inSequence(calls, (call) => outcome(call()))).toEqual(
			Array.from({ length: calls.length }, () => "UNAUTHORIZED")
		);
	});
});

function emitRevision(
	owner: Owner,
	quoteId: string,
	overrides: Record<string, unknown> = {}
) {
	return owner.quotes.emit({
		content: exampleContent(),
		emittedOn: "2026-09-24",
		opId: newOpId(),
		quoteId,
		revisionId: crypto.randomUUID(),
		...overrides,
	});
}

describe("quote emission", () => {
	test("emits numbered revisions with the frozen content and totals", async () => {
		const { owner } = await ownerSetup();
		const quoteId = await createQuote(owner, await createClient(owner));
		const content = exampleContent();
		const [service, custom, material, free] = [
			serviceLine(),
			customLine(),
			materialLine(),
			freeLine(),
		];
		const revisionId = crypto.randomUUID();
		expect(
			await owner.quotes.emit({
				content: { ...content, lines: [service, custom, material, free] },
				emittedOn: "2026-09-24",
				opId: newOpId(),
				quoteId,
				revisionId,
			})
		).toEqual({ id: revisionId, version: 1 });
		const second = await emitRevision(owner, quoteId, {
			content: { ...content, discount: null, lines: [custom] },
			reason: " Cliente aceitou só o vestido ",
		});
		const { revisions } = await owner.quotes.get({ quoteId });
		expect(revisions.map((revision) => revision.number)).toEqual([2, 1]);
		expect(revisions[0]).toMatchObject({
			id: second.id,
			reason: "Cliente aceitou só o vestido",
			totalCents: "98000",
		});
		expect(revisions[1]).toEqual({
			content: {
				discount: content.discount,
				leadTimeDays: 20,
				lines: [
					{
						...service,
						costCents: "6000",
						discountCents: "1600",
						grossCents: "16000",
						note: "Blazer de linho",
						totalCents: "14400",
					},
					{
						...custom,
						costCents: "49980",
						discountCents: "0",
						grossCents: "98000",
						totalCents: "98000",
					},
					{
						...material,
						costCents: "370",
						discountCents: "0",
						grossCents: "800",
						totalCents: "800",
					},
					{
						...free,
						costCents: "0",
						discountCents: "0",
						grossCents: "5000",
						totalCents: "5000",
					},
				],
				notes: "Prova em 10 dias",
				validityDays: 15,
			},
			costCents: "56350",
			createdAt: expect.any(String),
			discountCents: "31600",
			emittedOn: "2026-09-24",
			grossCents: "119800",
			id: revisionId,
			number: 1,
			quoteId,
			reason: null,
			targetMarginBasisPoints: 4000,
			totalCents: "88200",
			validUntil: "2026-10-09",
			version: 1,
		});
	});

	test("freezes an unknown cost when a free line has none", async () => {
		const { owner } = await ownerSetup();
		const quoteId = await createQuote(owner, await createClient(owner));
		await emitRevision(owner, quoteId, {
			content: {
				...exampleContent(),
				discount: null,
				lines: [serviceLine(), freeLine({ unitCostCents: null })],
			},
		});
		const [revision] = (await owner.quotes.get({ quoteId })).revisions;
		expect(revision).toMatchObject({ costCents: null, totalCents: "19400" });
	});

	test("keeps the revision as emitted after the target and the draft change", async () => {
		const { owner } = await ownerSetup();
		const quoteId = await createQuote(owner, await createClient(owner));
		await emitRevision(owner, quoteId);
		const before = (await owner.quotes.get({ quoteId })).revisions;
		const { version } = await owner.pricing.settings({});
		await owner.pricing.setTargetMargin({
			baseVersion: version,
			opId: newOpId(),
			targetMarginBasisPoints: 3000,
		});
		await updateWith(owner, quoteId, 1, {
			discount: null,
			lines: [serviceLine()],
		});
		const after = await owner.quotes.get({ quoteId });
		expect(after.revisions).toEqual(before);
		expect(after.revisions[0]?.targetMarginBasisPoints).toBe(4000);
	});

	test("freezes the content it receives, even when the draft moved on", async () => {
		const { owner } = await ownerSetup();
		const quoteId = await createQuote(owner, await createClient(owner));
		await updateWith(owner, quoteId, 1, {
			discount: null,
			lines: [serviceLine()],
		});
		const piece = customLine();
		await emitRevision(owner, quoteId, {
			content: { ...exampleContent(), discount: null, lines: [piece] },
		});
		const detail = await owner.quotes.get({ quoteId });
		expect(detail.revisions[0]?.content.lines.map((line) => line.id)).toEqual([
			piece.id,
		]);
		expect(detail.quote.lines.map((line) => line.kind)).toEqual(["service"]);
		expect(detail.quote.version).toBe(2);
	});

	test("reopens a refused quote when a new revision is emitted", async () => {
		const { owner } = await ownerSetup();
		const quoteId = await createQuote(owner, await createClient(owner));
		await emitRevision(owner, quoteId);
		expect((await owner.quotes.get({ quoteId })).quote.version).toBe(1);
		await owner.quotes.refuse({
			baseVersion: 1,
			opId: newOpId(),
			quoteId,
			reason: "Achou caro",
			refusedOn: "2026-09-25",
		});
		await emitRevision(owner, quoteId, { emittedOn: "2026-10-01" });
		expect((await owner.quotes.get({ quoteId })).quote).toMatchObject({
			refusalReason: null,
			refusedOn: null,
			version: 3,
		});
	});

	test("refuses a missing quote, an anonymized client, no lines and a bad date", async () => {
		const { owner } = await ownerSetup();
		await expect(
			emitRevision(owner, crypto.randomUUID())
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Orçamento não encontrado",
		});
		const clientId = await createClient(owner);
		const quoteId = await createQuote(owner, clientId);
		expect(
			await outcome(
				emitRevision(owner, quoteId, {
					content: { ...exampleContent(), discount: null, lines: [] },
				})
			)
		).toBe("BAD_REQUEST");
		expect(
			await outcome(emitRevision(owner, quoteId, { emittedOn: "2026-13-01" }))
		).toBe("BAD_REQUEST");
		await owner.clients.anonymize({
			baseVersion: 1,
			clientId,
			opId: newOpId(),
		});
		await expect(emitRevision(owner, quoteId)).rejects.toMatchObject({
			code: "PRECONDITION_FAILED",
			message: "Cliente anonimizado",
		});
	});

	test("repeats an emission by opId without a second revision", async () => {
		const { owner, server } = await ownerSetup();
		const quoteId = await createQuote(owner, await createClient(owner));
		const input = {
			content: exampleContent(),
			emittedOn: "2026-09-24",
			opId: newOpId(),
			quoteId,
			revisionId: crypto.randomUUID(),
		};
		const first = await owner.quotes.emit(input);
		expect(await owner.quotes.emit(input)).toEqual(first);
		await expect(
			owner.quotes.emit({ ...input, opId: newOpId() })
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		expect(
			server
				.native()
				.query<{ total: number }, []>(
					"SELECT count(*) AS total FROM quote_revision"
				)
				.get()?.total
		).toBe(1);
		await expect(
			rpc(server).quotes.emit({ ...input, opId: newOpId() })
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	test("reads the physical balance of every material of the draft, summed across locations", async () => {
		const { owner } = await ownerSetup();
		const materialId = crypto.randomUUID();
		await owner.materials.create({
			materialId,
			name: "Zíper invisível",
			opId: newOpId(),
		});
		const variantId = crypto.randomUUID();
		await owner.materialVariants.create({
			baseUnit: "un",
			displayPrecision: 0,
			materialId,
			name: "20 cm preto",
			opId: newOpId(),
			referenceCostCents: "370",
			variantId,
		});
		const locations = await inSequence(["Gaveta A", "Gaveta B"], (name) =>
			owner.stockLocations.create({
				locationId: crypto.randomUUID(),
				name,
				opId: newOpId(),
			})
		);
		await inSequence(
			locations.map((location, index) => ({
				location,
				quantity: String((index + 1) * 1_000_000),
			})),
			({ location, quantity }) =>
				owner.stockMovements.create({
					kind: "opening",
					locationId: location.id,
					movementId: crypto.randomUUID(),
					occurredOn: "2026-09-20",
					opId: newOpId(),
					quantityMicros: quantity,
					valueCents: "370",
					variantId,
				})
		);
		const quoteId = await createQuote(owner, await createClient(owner));
		const lace = materialComponent("Renda", "500000", "1200");
		await updateWith(owner, quoteId, 1, {
			discount: null,
			lines: [
				materialLine({ materialVariantId: variantId }),
				customLine({
					components: [
						{
							...materialComponent("Zíper invisível", "1000000", "370"),
							materialVariantId: variantId,
						},
						lace,
					],
				}),
			],
		});
		expect((await owner.quotes.get({ quoteId })).stock).toEqual([
			{ quantityMicros: "3000000", reservedMicros: "0", variantId },
			{
				quantityMicros: "0",
				reservedMicros: "0",
				variantId: lace.materialVariantId,
			},
		]);
		await emitRevision(owner, quoteId, {
			content: {
				...exampleContent(),
				discount: null,
				lines: [materialLine({ materialVariantId: variantId })],
			},
		});
		await updateWith(owner, quoteId, 2, {
			discount: null,
			lines: [freeLine()],
		});
		expect((await owner.quotes.get({ quoteId })).stock).toEqual([
			{ quantityMicros: "3000000", reservedMicros: "0", variantId },
		]);
	});
});

const minute = 60_000;

function listOf(
	owner: Owner,
	status: "draft" | "emitted" | "expired" | "refused",
	extra: { archived?: boolean; offset?: number; query?: string } = {}
) {
	return owner.quotes.list({ status, today: "2026-09-24", ...extra });
}

describe("quote list", () => {
	test("lists each quote under the status the domain derives", async () => {
		const clock = manualClock();
		const { owner } = await ownerSetup({ now: clock.now });
		const clientId = await createClient(owner);
		const create = async () => {
			clock.advance(minute);
			return await createQuote(owner, clientId);
		};
		const draft = await create();
		const valid = await create();
		await emitRevision(owner, valid);
		const expired = await create();
		await emitRevision(owner, expired, {
			content: { ...exampleContent(), validityDays: 1 },
			emittedOn: "2026-09-20",
		});
		const refused = await create();
		await emitRevision(owner, refused);
		await owner.quotes.refuse({
			baseVersion: 1,
			opId: newOpId(),
			quoteId: refused,
			refusedOn: "2026-09-24",
		});
		const lastDay = await create();
		await emitRevision(owner, lastDay, {
			content: { ...exampleContent(), validityDays: 1 },
			emittedOn: "2026-09-23",
		});
		const tabs = await inSequence(
			["draft", "emitted", "expired", "refused"] as const,
			async (status) => {
				const { items } = await listOf(owner, status);
				return {
					ids: items.map((item) => item.id),
					statuses: [...new Set(items.map((item) => item.status))],
				};
			}
		);
		expect(tabs).toEqual([
			{ ids: [draft], statuses: ["draft"] },
			{ ids: [lastDay, valid], statuses: ["emitted"] },
			{ ids: [expired], statuses: ["expired"] },
			{ ids: [refused], statuses: ["refused"] },
		]);
	});

	test("takes the total from the latest revision or from the draft", async () => {
		const clock = manualClock();
		const { owner } = await ownerSetup({ now: clock.now });
		const clientId = await createClient(owner);
		const draft = await createQuote(owner, clientId);
		await updateWith(owner, draft, 1, {
			discount: null,
			lines: [serviceLine(), freeLine()],
		});
		clock.advance(minute);
		const emitted = await createQuote(owner, clientId);
		await emitRevision(owner, emitted);
		expect((await listOf(owner, "draft")).items).toEqual([
			{
				approvedOn: null,
				archivedAt: null,
				clientId,
				clientName: "Maria Beatriz Alencar",
				code: "ORC-2026-PC-0001",
				createdOn: "2026-09-24",
				emittedOn: null,
				id: draft,
				lineCount: 2,
				refusedOn: null,
				revisionNumber: null,
				serviceOrderCode: null,
				status: "draft",
				totalCents: "19400",
				validUntil: null,
			},
		]);
		expect((await listOf(owner, "emitted")).items).toEqual([
			{
				approvedOn: null,
				archivedAt: null,
				clientId,
				clientName: "Maria Beatriz Alencar",
				code: "ORC-2026-PC-0002",
				createdOn: "2026-09-24",
				emittedOn: "2026-09-24",
				id: emitted,
				lineCount: 0,
				refusedOn: null,
				revisionNumber: 1,
				serviceOrderCode: null,
				status: "emitted",
				totalCents: "88200",
				validUntil: "2026-10-09",
			},
		]);
	});

	test("finds by code fragments, client name and line description, and archived ones only when asked", async () => {
		const clock = manualClock();
		const { owner } = await ownerSetup({ now: clock.now });
		const marta = await createClient(owner, "Márta Albuquerque");
		const other = await createClient(owner, "Tereza Nogueira");
		const first = await createQuote(owner, marta);
		clock.advance(minute);
		const second = await createQuote(owner, other);
		await updateWith(owner, second, 1, {
			discount: null,
			lines: [customLine({ description: "Vestido de festa longo" })],
		});
		clock.advance(minute);
		const third = await createQuote(owner, marta);
		const found = async (query: string, archived = false) =>
			(await listOf(owner, "draft", { archived, query })).items.map(
				(item) => item.id
			);
		expect(
			await inSequence(["0003", "pc-0003", "20260003", "2026-0003"], (query) =>
				found(query)
			)
		).toEqual([[third], [third], [third], [third]]);
		expect(await found("marta")).toEqual([third, first]);
		expect(await found("vestido festa")).toEqual([second]);
		await owner.quotes.archive({
			baseVersion: 1,
			opId: newOpId(),
			quoteId: first,
		});
		expect(await found("marta")).toEqual([third]);
		expect(await found("marta", true)).toEqual([first]);
	});

	test("pages fifty at a time, newest first", async () => {
		const clock = manualClock();
		const { owner } = await ownerSetup({ now: clock.now });
		const clientId = await createClient(owner);
		const ids = await inSequence(times(51), async () => {
			clock.advance(minute);
			return await createQuote(owner, clientId);
		});
		const first = await listOf(owner, "draft");
		expect(first.items.map((item) => item.id)).toEqual(ids.slice(1).reverse());
		expect(first.nextOffset).toBe(50);
		const second = await listOf(owner, "draft", { offset: 50 });
		expect(second.items.map((item) => item.id)).toEqual(ids.slice(0, 1));
		expect(second.nextOffset).toBeNull();
	});

	test("refuses a bad day and an unknown status and needs a session", async () => {
		const { owner, server } = await ownerSetup();
		expect(
			await outcome(owner.quotes.list({ status: "draft", today: "2026-13-40" }))
		).toBe("BAD_REQUEST");
		expect(
			await outcome(
				owner.quotes.list({
					status: "cancelled" as "draft",
					today: "2026-09-24",
				})
			)
		).toBe("BAD_REQUEST");
		expect(
			await outcome(
				rpc(server).quotes.list({ status: "draft", today: "2026-09-24" })
			)
		).toBe("UNAUTHORIZED");
	});
});

import { afterEach, describe, expect, test } from "bun:test";
import { approvalChannelValues } from "@costura-pro/db/schema/service-orders";
import {
	approvalChannels,
	isWorkLine,
} from "@costura-pro/domain/service-order";

import {
	approvalInput,
	approvedQuote,
	createClient,
	createProfile,
	createVariant,
	emittedQuote,
	itemsOf,
	materialLine,
	type Owner,
	ownerSetup,
	type Person,
	pieceLine,
	recordMeasurement,
	type Snapshot,
	type Stock,
	seedPerson,
	seedStock,
	serviceLine,
} from "./service-order-fixtures";
import {
	inSequence,
	manualClock,
	newOpId,
	rpc,
	type TestServer,
	times,
} from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function snapshotsOf(
	owner: Owner,
	clientId: string
): Promise<Map<string, Snapshot[]>> {
	const { items } = await owner.measurements.list({ clientId });
	const current = new Map<string, Map<string, Snapshot>>();
	for (const item of items) {
		if (item.archivedAt !== null) {
			continue;
		}
		const byTemplate = current.get(item.profileId) ?? new Map();
		if (!byTemplate.has(item.templateId)) {
			byTemplate.set(item.templateId, {
				fields: item.fields.map((field) => ({ ...field })),
				measurementId: item.id,
				notes: item.notes,
				takenOn: item.takenOn,
				templateId: item.templateId,
				templateName: item.templateName,
				templateVersion: item.templateVersion,
			});
		}
		current.set(item.profileId, byTemplate);
	}
	return new Map(
		[...current].map(([profileId, byTemplate]) => [
			profileId,
			[...byTemplate.values()],
		])
	);
}

function freeLine(unitPriceCents = "5000") {
	return {
		description: "Taxa de urgência",
		discount: null,
		id: crypto.randomUUID(),
		kind: "free" as const,
		note: null,
		quantity: 1,
		unitCostCents: "0",
		unitPriceCents,
	};
}

function exampleLines(stock: Stock, person: Person) {
	return [
		serviceLine(person),
		pieceLine(stock, person.profileId),
		materialLine(stock.zipperId, "2000000"),
		freeLine(),
	];
}

function counts(server: TestServer) {
	const count = (table: string) =>
		server
			.native()
			.query<{ total: number }, []>(`SELECT count(*) AS total FROM ${table}`)
			.get()?.total ?? 0;
	return {
		approvals: count("quote_approval"),
		items: count("service_order_item"),
		orders: count("service_order"),
		receivables: count("receivable"),
		reservations: count("stock_reservation"),
	};
}

function orderOf(server: TestServer, serviceOrderId: string) {
	return server
		.native()
		.query<{ code: string; opened_on: string; search_text: string }, [string]>(
			"SELECT code, opened_on, search_text FROM service_order WHERE id = ?"
		)
		.get(serviceOrderId);
}

function reservationsOf(server: TestServer, itemId: string) {
	return server
		.native()
		.query<{ quantity: number; variant_id: string }, [string]>(
			"SELECT variant_id, quantity_micros AS quantity FROM stock_reservation WHERE service_order_item_id = ? ORDER BY rowid"
		)
		.all(itemId)
		.map((row) => [row.variant_id, String(row.quantity)]);
}

function reservedOf(server: TestServer, variantId: string): string {
	return String(
		server
			.native()
			.query<{ total: number | null }, [string]>(
				"SELECT sum(quantity_micros) AS total FROM stock_reservation WHERE variant_id = ?"
			)
			.get(variantId)?.total ?? 0
	);
}

function receivableOf(server: TestServer, serviceOrderId: string) {
	return server
		.native()
		.query<
			{ amount_cents: number; kind: string; occurred_on: string },
			[string]
		>(
			"SELECT amount_cents, kind, occurred_on FROM receivable WHERE service_order_id = ?"
		)
		.get(serviceOrderId);
}

describe("quote approval", () => {
	test("keeps the channel list of the database equal to the domain", () => {
		expect([...approvalChannelValues]).toEqual([...approvalChannels]);
	});

	test("approves the full example creating the order, items, reservations and receivable", async () => {
		const { owner, server } = await ownerSetup(servers);
		const stock = await seedStock(owner);
		const clientId = await createClient(owner);
		const person = await seedPerson(owner, clientId);
		await approvedQuote(owner, clientId, [
			materialLine(stock.crepeId, "1000000", {
				materialName: "Crepe",
				variantName: "Preto",
			}),
		]);
		const { revision } = await emittedQuote(
			owner,
			clientId,
			exampleLines(stock, person)
		);
		const snapshots = await snapshotsOf(owner, clientId);
		const input = approvalInput(revision, snapshots);
		expect(await owner.quotes.approve(input)).toEqual({
			id: input.approvalId,
			version: 1,
		});
		expect(orderOf(server, input.serviceOrderId)).toMatchObject({
			code: "OS-2026-PC-0002",
			opened_on: "2026-09-22",
		});
		const approval = server
			.native()
			.query<{ channel: string; note: string; revision_id: string }, [string]>(
				"SELECT channel, note, revision_id FROM quote_approval WHERE id = ?"
			)
			.get(input.approvalId);
		expect(approval).toEqual({
			channel: "whatsapp",
			note: "Aceitou por áudio",
			revision_id: revision.id,
		});
		const items = itemsOf(server, input.serviceOrderId);
		expect(items.map((item) => [item.position, item.kind, item.dueOn])).toEqual(
			[
				[0, "service", "2026-10-12"],
				[1, "custom", "2026-10-12"],
				[2, "material", "2026-10-12"],
			]
		);
		const work = revision.content.lines.filter(isWorkLine);
		expect(items.map((item) => item.line)).toEqual(work);
		const maria = snapshots.get(person.profileId) ?? [];
		expect(maria).toHaveLength(2);
		expect(items.map((item) => item.measurements)).toEqual([maria, maria, []]);
		expect(items.map((item) => reservationsOf(server, item.id))).toEqual([
			[],
			[
				[stock.crepeId, "1500000"],
				[stock.zipperId, "1000000"],
			],
			[[stock.zipperId, "2000000"]],
		]);
		expect(receivableOf(server, input.serviceOrderId)).toEqual({
			amount_cents: Number(revision.totalCents),
			kind: "serviceOrder",
			occurred_on: "2026-09-22",
		});
		const logged = server
			.native()
			.query<{ aggregate_type: string; total: number }, [string]>(
				"SELECT aggregate_type, count(*) AS total FROM change_log WHERE op_id = ? GROUP BY aggregate_type ORDER BY aggregate_type"
			)
			.all(input.opId);
		expect(logged).toEqual([
			{ aggregate_type: "quoteApproval", total: 1 },
			{ aggregate_type: "receivable", total: 1 },
			{ aggregate_type: "serviceOrder", total: 1 },
			{ aggregate_type: "serviceOrderItem", total: 3 },
			{ aggregate_type: "stockReservation", total: 3 },
		]);
	});

	test("turns a full shortage into a pending need without any negative reservation", async () => {
		const { owner, server } = await ownerSetup(servers);
		const stock = await seedStock(owner);
		const clientId = await createClient(owner);
		const person = await seedPerson(owner, clientId);
		await approvedQuote(owner, clientId, [
			materialLine(stock.crepeId, "2500000", {
				materialName: "Crepe",
				variantName: "Preto",
			}),
		]);
		expect(reservedOf(server, stock.crepeId)).toBe("2500000");
		const { revision } = await emittedQuote(
			owner,
			clientId,
			exampleLines(stock, person)
		);
		const input = approvalInput(revision, await snapshotsOf(owner, clientId));
		await owner.quotes.approve(input);
		const [, piece] = itemsOf(server, input.serviceOrderId);
		expect(reservationsOf(server, piece?.id ?? "")).toEqual([
			[stock.zipperId, "1000000"],
		]);
		expect(reservedOf(server, stock.crepeId)).toBe("2500000");
	});

	test("reserves nothing from a variant with negative physical stock", async () => {
		const { owner, server } = await ownerSetup(servers);
		const stock = await seedStock(owner);
		await owner.stockMovements.create({
			kind: "adjustment",
			locationId: stock.locationId,
			lotId: null,
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-02",
			opId: newOpId(),
			quantityMicros: "-3000000",
			reason: "Retalho perdido",
			variantId: stock.crepeId,
		});
		const clientId = await createClient(owner);
		const input = await approvedQuote(owner, clientId, [
			pieceLine(stock, null),
		]);
		const [piece] = itemsOf(server, input.serviceOrderId);
		expect(reservationsOf(server, piece?.id ?? "")).toEqual([
			[stock.zipperId, "1000000"],
		]);
		expect(reservedOf(server, stock.crepeId)).toBe("0");
	});

	test("approves a revision with only a free line as an order without items", async () => {
		const { owner, server } = await ownerSetup(servers);
		const clientId = await createClient(owner);
		const input = await approvedQuote(owner, clientId, [freeLine()]);
		expect(itemsOf(server, input.serviceOrderId)).toEqual([]);
		expect(receivableOf(server, input.serviceOrderId)?.amount_cents).toBe(5000);
	});

	test("creates no receivable for a zero total", async () => {
		const { owner, server } = await ownerSetup(servers);
		const clientId = await createClient(owner);
		const input = await approvedQuote(owner, clientId, [freeLine("0")]);
		expect(orderOf(server, input.serviceOrderId)).not.toBeNull();
		expect(receivableOf(server, input.serviceOrderId)).toBeNull();
	});

	test("owes the total after the document discount", async () => {
		const { owner, server } = await ownerSetup(servers);
		const clientId = await createClient(owner);
		const { revision } = await emittedQuote(owner, clientId, [freeLine()], {
			discount: { amountCents: "1000", kind: "amount", reason: null },
		});
		expect(revision.grossCents).toBe("5000");
		const input = approvalInput(revision, new Map());
		await owner.quotes.approve(input);
		expect(receivableOf(server, input.serviceOrderId)?.amount_cents).toBe(4000);
	});

	test("numbers the codes by the year of the acceptance", async () => {
		const clock = manualClock(Date.parse("2027-01-02T12:00:00Z"));
		const { owner, server } = await ownerSetup(servers, { now: clock.now });
		const clientId = await createClient(owner);
		const approve = async (emittedOn: string, approvedOn: string) => {
			const { revision } = await emittedQuote(owner, clientId, [freeLine()], {
				emittedOn,
			});
			const input = approvalInput(revision, new Map(), {
				approvedOn,
				dueOn: null,
			});
			await owner.quotes.approve(input);
			return orderOf(server, input.serviceOrderId)?.code;
		};
		expect(await approve("2026-09-20", "2026-09-22")).toBe("OS-2026-PC-0001");
		expect(await approve("2026-09-20", "2026-09-23")).toBe("OS-2026-PC-0002");
		expect(await approve("2027-01-01", "2027-01-02")).toBe("OS-2027-PC-0001");
		expect(await approve("2026-12-20", "2026-12-30")).toBe("OS-2026-PC-0003");
	});

	test("clears a refusal on approval", async () => {
		const { owner } = await ownerSetup(servers);
		const clientId = await createClient(owner);
		const { quoteId, revision } = await emittedQuote(owner, clientId, [
			freeLine(),
		]);
		const { quote } = await owner.quotes.get({ quoteId });
		await owner.quotes.refuse({
			baseVersion: quote.version,
			opId: newOpId(),
			quoteId,
			reason: "Achou caro",
			refusedOn: "2026-09-21",
		});
		await owner.quotes.approve(approvalInput(revision, new Map()));
		expect((await owner.quotes.get({ quoteId })).quote).toMatchObject({
			refusalReason: null,
			refusedOn: null,
		});
	});

	test("keeps an approved quote refused afterwards only among the approved", async () => {
		const { owner } = await ownerSetup(servers);
		const clientId = await createClient(owner);
		const { quoteId, revision } = await emittedQuote(owner, clientId, [
			freeLine(),
		]);
		await owner.quotes.approve(approvalInput(revision, new Map()));
		const { quote } = await owner.quotes.get({ quoteId });
		await owner.quotes.refuse({
			baseVersion: quote.version,
			opId: newOpId(),
			quoteId,
			reason: "Desistiu",
			refusedOn: "2026-09-23",
		});
		const ids = async (status: "approved" | "refused") =>
			(await owner.quotes.list({ status, today: "2026-09-24" })).items.map(
				(item) => item.id
			);
		expect(await ids("approved")).toEqual([quoteId]);
		expect(await ids("refused")).toEqual([]);
	});

	test("reserves the same variant across items in line order", async () => {
		const { owner, server } = await ownerSetup(servers);
		const stock = await seedStock(owner);
		const clientId = await createClient(owner);
		const input = await approvedQuote(owner, clientId, [
			pieceLine(stock, null),
			materialLine(stock.zipperId, "5000000"),
		]);
		const [piece, material] = itemsOf(server, input.serviceOrderId);
		expect(reservationsOf(server, piece?.id ?? "")).toEqual([
			[stock.crepeId, "2500000"],
			[stock.zipperId, "1000000"],
		]);
		expect(reservationsOf(server, material?.id ?? "")).toEqual([
			[stock.zipperId, "4000000"],
		]);
	});

	test("accepts a profile without any measurement", async () => {
		const { owner, server } = await ownerSetup(servers);
		const stock = await seedStock(owner);
		const clientId = await createClient(owner);
		const profileId = await createProfile(owner, clientId, "Luísa");
		const input = await approvedQuote(owner, clientId, [
			pieceLine(stock, profileId),
		]);
		expect(
			itemsOf(server, input.serviceOrderId).map((item) => item.measurements)
		).toEqual([[]]);
	});

	test("repeats by opId without writing again", async () => {
		const { owner, server } = await ownerSetup(servers);
		const stock = await seedStock(owner);
		const clientId = await createClient(owner);
		const person = await seedPerson(owner, clientId);
		const { revision } = await emittedQuote(
			owner,
			clientId,
			exampleLines(stock, person)
		);
		const input = approvalInput(revision, await snapshotsOf(owner, clientId));
		const first = await owner.quotes.approve(input);
		const before = counts(server);
		const changes = () =>
			server
				.native()
				.query<{ total: number }, []>(
					"SELECT count(*) AS total FROM change_log"
				)
				.get()?.total;
		const logged = changes();
		expect(await owner.quotes.approve(input)).toEqual(first);
		expect(counts(server)).toEqual(before);
		expect(changes()).toBe(logged);
	});
});

describe("quote approval refusals", () => {
	async function refusalSetup() {
		const setup = await ownerSetup(servers);
		const stock = await seedStock(setup.owner);
		const clientId = await createClient(setup.owner);
		const person = await seedPerson(setup.owner, clientId);
		const emitted = await emittedQuote(
			setup.owner,
			clientId,
			exampleLines(stock, person)
		);
		const snapshots = await snapshotsOf(setup.owner, clientId);
		return { ...setup, ...emitted, clientId, person, snapshots, stock };
	}

	async function refused(
		server: TestServer,
		call: Promise<unknown>,
		expected: { code: string; message?: string }
	) {
		const before = counts(server);
		await expect(call).rejects.toMatchObject(expected);
		expect(counts(server)).toEqual(before);
	}

	test("refuses a missing quote", async () => {
		const { owner, revision, server, snapshots } = await refusalSetup();
		await refused(
			server,
			owner.quotes.approve(
				approvalInput(revision, snapshots, { quoteId: crypto.randomUUID() })
			),
			{ code: "NOT_FOUND", message: "Orçamento não encontrado" }
		);
	});

	test("refuses the quote of an anonymized client", async () => {
		const { clientId, owner, revision, server, snapshots } =
			await refusalSetup();
		const { client } = await owner.clients.get({ clientId });
		await owner.clients.anonymize({
			baseVersion: client.version,
			clientId,
			opId: newOpId(),
		});
		await refused(
			server,
			owner.quotes.approve(approvalInput(revision, snapshots)),
			{ code: "PRECONDITION_FAILED", message: "Cliente anonimizado" }
		);
	});

	test("refuses a second approval", async () => {
		const { owner, revision, server, snapshots } = await refusalSetup();
		await owner.quotes.approve(approvalInput(revision, snapshots));
		await refused(
			server,
			owner.quotes.approve(approvalInput(revision, snapshots)),
			{ code: "CONFLICT", message: "Orçamento já aprovado" }
		);
	});

	test("refuses a revision of another quote and a missing revision", async () => {
		const { clientId, owner, revision, server, snapshots } =
			await refusalSetup();
		const other = await emittedQuote(owner, clientId, [freeLine()]);
		const notFound = { code: "NOT_FOUND", message: "Revisão não encontrada" };
		await refused(
			server,
			owner.quotes.approve(
				approvalInput(revision, snapshots, { revisionId: other.revision.id })
			),
			notFound
		);
		await refused(
			server,
			owner.quotes.approve(
				approvalInput(revision, snapshots, { revisionId: crypto.randomUUID() })
			),
			notFound
		);
	});

	test("refuses a superseded revision", async () => {
		const { owner, quoteId, revision, server, snapshots } =
			await refusalSetup();
		await owner.quotes.emit({
			content: {
				discount: revision.content.discount,
				leadTimeDays: revision.content.leadTimeDays,
				lines: revision.content.lines.map(
					({ costCents, discountCents, grossCents, totalCents, ...line }) =>
						line
				),
				notes: revision.content.notes,
				validityDays: revision.content.validityDays,
			},
			emittedOn: "2026-09-21",
			opId: newOpId(),
			quoteId,
			reason: "Nova data",
			revisionId: crypto.randomUUID(),
		});
		await refused(
			server,
			owner.quotes.approve(approvalInput(revision, snapshots)),
			{ code: "NOT_FOUND", message: "Revisão substituída por outra mais nova" }
		);
	});

	test("refuses an acceptance outside the validity of the revision", async () => {
		const { owner, revision, server, snapshots } = await refusalSetup();
		const outside = {
			code: "NOT_FOUND",
			message: "Data fora da validade da revisão",
		};
		await inSequence(["2026-09-19", "2026-10-06"], (approvedOn) =>
			refused(
				server,
				owner.quotes.approve(
					approvalInput(revision, snapshots, {
						approvedOn,
						dueOn: null,
					})
				),
				outside
			)
		);
	});

	test("accepts the day of the emission", async () => {
		const { owner, revision, snapshots } = await refusalSetup();
		const input = approvalInput(revision, snapshots, {
			approvedOn: "2026-09-20",
		});
		expect(await owner.quotes.approve(input)).toMatchObject({ version: 1 });
	});

	test("accepts the last valid day", async () => {
		const { owner, revision, snapshots } = await refusalSetup();
		const input = approvalInput(revision, snapshots, {
			approvedOn: "2026-10-05",
			dueOn: "2026-10-20",
		});
		expect(await owner.quotes.approve(input)).toMatchObject({ version: 1 });
	});

	test("refuses items that do not match the revision", async () => {
		const { owner, revision, server, snapshots } = await refusalSetup();
		const mismatch = {
			code: "NOT_FOUND",
			message: "Subitens não conferem com a revisão",
		};
		const base = approvalInput(revision, snapshots);
		const [service, piece, material] = base.items;
		if (!(service && piece && material)) {
			throw new Error("Subitens ausentes");
		}
		const variants = [
			{ ...base, items: [service, piece] },
			{ ...base, items: [piece, service, material] },
			{
				...base,
				items: [
					service,
					piece,
					{ ...material, measurements: service.measurements },
				],
			},
			{
				...base,
				items: [
					service,
					{ ...piece, reservations: [...piece.reservations].reverse() },
					material,
				],
			},
		];
		await inSequence(variants, (input) =>
			refused(
				server,
				owner.quotes.approve({
					...input,
					approvalId: crypto.randomUUID(),
					opId: newOpId(),
				}),
				mismatch
			)
		);
	});

	test("refuses a measurement of another profile and a missing one", async () => {
		const { clientId, owner, person, revision, server } = await refusalSetup();
		const luisa = await createProfile(owner, clientId, "Luísa");
		await recordMeasurement(owner, luisa, "Vestido", "2026-09-05", 900);
		const snapshots = await snapshotsOf(owner, clientId);
		const notFound = { code: "NOT_FOUND", message: "Medição não encontrada" };
		await refused(
			server,
			owner.quotes.approve(
				approvalInput(
					revision,
					new Map([[person.profileId, snapshots.get(luisa) ?? []]])
				)
			),
			notFound
		);
		const [maria] = snapshots.get(person.profileId) ?? [];
		if (!maria) {
			throw new Error("Medição ausente");
		}
		await refused(
			server,
			owner.quotes.approve(
				approvalInput(
					revision,
					new Map([
						[
							person.profileId,
							[{ ...maria, measurementId: crypto.randomUUID() }],
						],
					])
				)
			),
			notFound
		);
	});

	test("refuses ids already used without a server error", async () => {
		const { clientId, owner, revision, server, snapshots } =
			await refusalSetup();
		const previous = await approvedQuote(owner, clientId, [
			materialLine(crypto.randomUUID(), "1000000"),
		]);
		const [usedItem] = itemsOf(server, previous.serviceOrderId);
		const exists = { code: "CONFLICT", message: "Registro já existe" };
		const input = approvalInput(revision, snapshots);
		const [service, ...rest] = input.items;
		if (!service) {
			throw new Error("Subitem ausente");
		}
		await refused(
			server,
			owner.quotes.approve({
				...input,
				items: [{ ...service, itemId: usedItem?.id ?? "" }, ...rest],
			}),
			exists
		);
		const again = approvalInput(revision, snapshots);
		await refused(
			server,
			owner.quotes.approve({ ...again, serviceOrderId: again.approvalId }),
			exists
		);
	});

	test("refuses an order, a receivable and a reservation id already used", async () => {
		const { clientId, owner, revision, server, snapshots, stock } =
			await refusalSetup();
		const previous = await approvedQuote(owner, clientId, [
			materialLine(stock.zipperId, "1000000"),
		]);
		const usedReservation =
			previous.items[0]?.reservations[0]?.reservationId ?? "";
		expect(reservationsOf(server, previous.items[0]?.itemId ?? "")).toEqual([
			[stock.zipperId, "1000000"],
		]);
		const exists = { code: "CONFLICT", message: "Registro já existe" };
		const withReservation = () => {
			const input = approvalInput(revision, snapshots);
			return {
				...input,
				items: input.items.map((item, index) =>
					index === 1
						? {
								...item,
								reservations: item.reservations.map((reservation, position) =>
									position === 0
										? { ...reservation, reservationId: usedReservation }
										: reservation
								),
							}
						: item
				),
			};
		};
		await inSequence(
			[
				{
					...approvalInput(revision, snapshots),
					serviceOrderId: previous.serviceOrderId,
				},
				{
					...approvalInput(revision, snapshots),
					receivableId: previous.receivableId,
				},
				withReservation(),
			],
			(input) => refused(server, owner.quotes.approve(input), exists)
		);
	});

	test("refuses malformed payloads", async () => {
		const { owner, revision, server, snapshots } = await refusalSetup();
		const base = approvalInput(revision, snapshots);
		const [service, piece, material] = base.items;
		if (!(service && piece && material)) {
			throw new Error("Subitens ausentes");
		}
		const emptied = service.measurements.map((snapshot) => ({
			...snapshot,
			fields: snapshot.fields.map((field) => ({ ...field, valueMm: null })),
		}));
		const malformed = [
			{ ...base, channel: "fax" },
			{ ...base, dueOn: "2026-09-21" },
			{
				...base,
				items: [
					service,
					{
						...piece,
						reservations: piece.reservations.map((reservation, index) =>
							index === 0
								? { ...reservation, reservationId: piece.itemId }
								: reservation
						),
					},
					material,
				],
			},
			{ ...base, note: "a".repeat(201) },
			{
				...base,
				items: [{ ...service, measurements: emptied }, piece, material],
			},
			{
				...base,
				items: [service, { ...piece, lineId: service.lineId }, material],
			},
		];
		await inSequence(malformed, (input) =>
			refused(
				server,
				owner.quotes.approve({
					...input,
					approvalId: crypto.randomUUID(),
					opId: newOpId(),
				} as Parameters<Owner["quotes"]["approve"]>[0]),
				{ code: "BAD_REQUEST" }
			)
		);
	});

	test("refuses to emit an approved quote", async () => {
		const { owner, quoteId, revision, snapshots } = await refusalSetup();
		await owner.quotes.approve(approvalInput(revision, snapshots));
		await expect(
			owner.quotes.emit({
				content: {
					discount: null,
					leadTimeDays: null,
					lines: [freeLine()],
					notes: null,
					validityDays: 15,
				},
				emittedOn: "2026-09-23",
				opId: newOpId(),
				quoteId,
				reason: null,
				revisionId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Orçamento já aprovado",
		});
	});

	test("refuses the approval without a session", async () => {
		const { revision, server, snapshots } = await refusalSetup();
		await expect(
			rpc(server).quotes.approve(approvalInput(revision, snapshots))
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("service order reads", () => {
	async function readSetup() {
		const clock = manualClock();
		const setup = await ownerSetup(servers, { now: clock.now });
		const stock = await seedStock(setup.owner);
		const clientId = await createClient(setup.owner);
		const person = await seedPerson(setup.owner, clientId);
		return { ...setup, clientId, clock, person, stock };
	}

	test("lists orders by the nearest due date, with the item count, the total owed and the shortage", async () => {
		const { clientId, clock, owner, person, stock } = await readSetup();
		clock.advance(60_000);
		const late = await approvedQuote(
			owner,
			clientId,
			[materialLine(stock.zipperId, "1000000")],
			{ dueOn: "2026-10-12" }
		);
		clock.advance(60_000);
		const open = await approvedQuote(owner, clientId, [freeLine("0")], {
			dueOn: null,
		});
		clock.advance(60_000);
		const { revision } = await emittedQuote(
			owner,
			clientId,
			exampleLines(stock, person)
		);
		const soon = approvalInput(revision, await snapshotsOf(owner, clientId), {
			dueOn: "2026-10-01",
		});
		await owner.quotes.approve(soon);
		const { items, nextOffset } = await owner.serviceOrders.list({});
		expect(nextOffset).toBeNull();
		expect(
			items.map((item) => [
				item.id,
				item.dueOn,
				item.itemCount,
				item.totalCents,
				item.shortage,
			])
		).toEqual([
			[soon.serviceOrderId, "2026-10-01", 3, revision.totalCents, true],
			[late.serviceOrderId, "2026-10-12", 1, "800", false],
			[open.serviceOrderId, null, 0, "0", false],
		]);
		expect(items[0]).toMatchObject({
			clientId,
			clientName: "Maria Beatriz Alencar",
			code: "OS-2026-PC-0003",
			openedOn: "2026-09-22",
		});
	});

	test("orders by the due date before the creation, in the list and in the search", async () => {
		const { clientId, clock, owner, stock } = await readSetup();
		clock.advance(60_000);
		const early = await approvedQuote(
			owner,
			clientId,
			[materialLine(stock.zipperId, "1000000")],
			{ dueOn: "2026-10-01" }
		);
		clock.advance(60_000);
		const later = await approvedQuote(
			owner,
			clientId,
			[materialLine(stock.zipperId, "1000000")],
			{ dueOn: "2026-10-20" }
		);
		clock.advance(60_000);
		const open = await approvedQuote(
			owner,
			clientId,
			[materialLine(stock.zipperId, "1000000")],
			{ dueOn: null }
		);
		const expected = [
			early.serviceOrderId,
			later.serviceOrderId,
			open.serviceOrderId,
		];
		expect(
			(await owner.serviceOrders.list({})).items.map((item) => item.id)
		).toEqual(expected);
		expect(
			(await owner.search.global({ query: "os-2026" })).serviceOrders.items.map(
				(item) => item.id
			)
		).toEqual(expected);
	});

	test("keeps the frozen measurements after the profile is measured again", async () => {
		const { clientId, owner, person, stock } = await readSetup();
		const { revision } = await emittedQuote(
			owner,
			clientId,
			exampleLines(stock, person)
		);
		const input = approvalInput(revision, await snapshotsOf(owner, clientId));
		await owner.quotes.approve(input);
		const { items: measured } = await owner.measurements.list({ clientId });
		const dress = measured.find((item) => item.templateName === "Vestido");
		if (!dress) {
			throw new Error("Medição ausente");
		}
		await owner.measurements.update({
			baseVersion: dress.version,
			measurementId: dress.id,
			opId: newOpId(),
			patch: {
				fields: dress.fields.map((field, index) =>
					index === 0 ? { ...field, valueMm: 900 } : field
				),
			},
		});
		await recordMeasurement(
			owner,
			person.profileId,
			"Vestido",
			"2026-09-23",
			910
		);
		const detail = await owner.serviceOrders.get({
			serviceOrderId: input.serviceOrderId,
		});
		expect(detail.items.map((item) => item.measurements)).toEqual(
			input.items.map((item) =>
				item.measurements.map((snapshot) => ({
					...snapshot,
					notes: snapshot.notes ?? null,
				}))
			)
		);
	});

	test("finds orders by code, code digits, client name and item title", async () => {
		const { clientId, clock, owner, person, stock } = await readSetup();
		const tereza = await createClient(owner, "Tereza Nogueira");
		const first = await approvedQuote(owner, tereza, [freeLine()], {
			dueOn: null,
		});
		clock.advance(60_000);
		const { revision } = await emittedQuote(
			owner,
			clientId,
			exampleLines(stock, person)
		);
		const second = approvalInput(revision, new Map(), { dueOn: null });
		await owner.quotes.approve(second);
		const found = async (query: string) =>
			(await owner.serviceOrders.list({ query })).items.map((item) => item.id);
		expect(await found("os-2026-pc-0002")).toEqual([second.serviceOrderId]);
		expect(await found("20260001")).toEqual([first.serviceOrderId]);
		expect(await found("tereza")).toEqual([first.serviceOrderId]);
		expect(await found("maria")).toEqual([second.serviceOrderId]);
		expect(await found("vestido festa")).toEqual([second.serviceOrderId]);
		expect(await found("nada disso")).toEqual([]);
	});

	test("pages fifty orders at a time", async () => {
		const { clientId, clock, owner } = await readSetup();
		await inSequence(times(51), () => {
			clock.advance(60_000);
			return approvedQuote(owner, clientId, [freeLine()], { dueOn: null });
		});
		const first = await owner.serviceOrders.list({});
		expect(first.items).toHaveLength(50);
		expect(first.nextOffset).toBe(50);
		const second = await owner.serviceOrders.list({ offset: 50 });
		expect(second.items).toHaveLength(1);
		expect(second.nextOffset).toBeNull();
		expect(second.items[0]?.code).toBe("OS-2026-PC-0001");
	}, 60_000);

	test("reads one order with the client, the approval, the revision, the items with reservations and the receivable", async () => {
		const { clientId, owner, person, stock } = await readSetup();
		const { quoteId, revision } = await emittedQuote(
			owner,
			clientId,
			exampleLines(stock, person)
		);
		const input = approvalInput(revision, await snapshotsOf(owner, clientId));
		await owner.quotes.approve(input);
		const detail = await owner.serviceOrders.get({
			serviceOrderId: input.serviceOrderId,
		});
		const quote = await owner.quotes.get({ quoteId });
		expect(detail.serviceOrder).toMatchObject({
			clientId,
			code: "OS-2026-PC-0001",
			id: input.serviceOrderId,
			openedOn: "2026-09-22",
			quoteId,
			version: 1,
		});
		expect(detail.client).toEqual({
			anonymized: false,
			archived: false,
			id: clientId,
			name: "Maria Beatriz Alencar",
		});
		expect(detail.quote).toEqual({ code: quote.quote.code, id: quoteId });
		expect(detail.approval).toMatchObject({
			approvedOn: "2026-09-22",
			channel: "whatsapp",
			id: input.approvalId,
			note: "Aceitou por áudio",
			revisionId: revision.id,
			serviceOrderId: input.serviceOrderId,
		});
		expect(detail.revision).toEqual({
			costCents: revision.costCents,
			discountCents: revision.discountCents,
			emittedOn: revision.emittedOn,
			grossCents: revision.grossCents,
			id: revision.id,
			number: 1,
			targetMarginBasisPoints: revision.targetMarginBasisPoints,
			totalCents: revision.totalCents,
			validUntil: revision.validUntil,
		});
		expect(
			detail.items.map((item) => [item.position, item.kind, item.reservations])
		).toEqual([
			[0, "service", []],
			[
				1,
				"custom",
				[
					{ reservedMicros: "2500000", variantId: stock.crepeId },
					{ reservedMicros: "1000000", variantId: stock.zipperId },
				],
			],
			[
				2,
				"material",
				[{ reservedMicros: "2000000", variantId: stock.zipperId }],
			],
		]);
		expect(detail.receivable).toMatchObject({
			amountCents: revision.totalCents,
			occurredOn: "2026-09-22",
			serviceOrderId: input.serviceOrderId,
		});
		await expect(
			owner.serviceOrders.get({ serviceOrderId: crypto.randomUUID() })
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "OS não encontrada",
		});
	});

	test("shows the approval and the reserved stock on the quote and the approved status on the list", async () => {
		const { clientId, owner, person, stock } = await readSetup();
		await approvedQuote(owner, clientId, [
			materialLine(stock.crepeId, "1000000", {
				materialName: "Crepe",
				variantName: "Preto",
			}),
		]);
		const { quoteId, revision } = await emittedQuote(
			owner,
			clientId,
			exampleLines(stock, person)
		);
		const before = await owner.quotes.get({ quoteId });
		expect(before.approval).toBeNull();
		expect(before.stock).toEqual([
			{
				quantityMicros: "2500000",
				reservedMicros: "1000000",
				variantId: stock.crepeId,
			},
			{
				quantityMicros: "5000000",
				reservedMicros: "0",
				variantId: stock.zipperId,
			},
		]);
		await owner.quotes.refuse({
			baseVersion: before.quote.version,
			opId: newOpId(),
			quoteId,
			refusedOn: "2026-09-21",
		});
		const input = approvalInput(revision, await snapshotsOf(owner, clientId));
		await owner.quotes.approve(input);
		const after = await owner.quotes.get({ quoteId });
		expect(after.approval).toEqual({
			approvedOn: "2026-09-22",
			channel: "whatsapp",
			id: input.approvalId,
			note: "Aceitou por áudio",
			revisionId: revision.id,
			revisionNumber: 1,
			serviceOrderCode: "OS-2026-PC-0002",
			serviceOrderId: input.serviceOrderId,
		});
		expect(after.stock).toEqual([
			{
				quantityMicros: "2500000",
				reservedMicros: "2500000",
				variantId: stock.crepeId,
			},
			{
				quantityMicros: "5000000",
				reservedMicros: "3000000",
				variantId: stock.zipperId,
			},
		]);
		const tab = async (
			status: "approved" | "draft" | "emitted" | "expired" | "refused",
			today: string
		) =>
			(await owner.quotes.list({ status, today })).items.map((item) => [
				item.id,
				item.status,
				item.serviceOrderCode,
				item.approvedOn,
			]);
		expect(await tab("approved", "2026-12-01")).toContainEqual([
			quoteId,
			"approved",
			"OS-2026-PC-0002",
			"2026-09-22",
		]);
		const elsewhere = await inSequence(
			["emitted", "expired", "refused", "draft"] as const,
			async (status) => [
				...(await tab(status, "2026-12-01")),
				...(await tab(status, "2026-09-24")),
			]
		);
		expect(elsewhere.flat().map(([id]) => id)).not.toContain(quoteId);
	});

	test("shows the reserved stock on the balances, the variant detail and the material", async () => {
		const { clientId, owner, person, stock } = await readSetup();
		const { revision } = await emittedQuote(
			owner,
			clientId,
			exampleLines(stock, person)
		);
		const input = approvalInput(revision, await snapshotsOf(owner, clientId));
		await owner.quotes.approve(input);
		const unused = await createVariant(owner, "Linha", {
			baseUnit: "un",
			code: null,
			displayPrecision: 0,
			name: "Branca",
			referenceCostCents: "100",
		});
		const { items } = await owner.stockBalances.list({});
		const reserved = new Map(
			items.map((item) => [item.variantId, item.reservedMicros])
		);
		expect(reserved.get(stock.crepeId)).toBe("2500000");
		expect(reserved.get(stock.zipperId)).toBe("3000000");
		expect(reserved.get(unused)).toBe("0");
		expect(
			(await owner.stockBalances.get({ variantId: stock.zipperId }))
				.reservations
		).toEqual([
			{
				code: "OS-2026-PC-0001",
				itemId: input.items[1]?.itemId ?? "",
				itemTitle: "Vestido de festa",
				reservedMicros: "1000000",
				serviceOrderId: input.serviceOrderId,
			},
			{
				code: "OS-2026-PC-0001",
				itemId: input.items[2]?.itemId ?? "",
				itemTitle: "Zíper · 20 cm",
				reservedMicros: "2000000",
				serviceOrderId: input.serviceOrderId,
			},
		]);
		const { items: found } = await owner.materialVariants.search({
			query: "zíper",
		});
		const zipper = found.find((item) => item.id === stock.zipperId);
		const { variants } = await owner.materials.get({
			materialId: zipper?.materialId ?? "",
		});
		expect(variants.map((variant) => variant.reservedMicros)).toEqual([
			"3000000",
		]);
	});

	test("needs a session for the order reads", async () => {
		const { server } = await readSetup();
		await expect(rpc(server).serviceOrders.list({})).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
		await expect(
			rpc(server).serviceOrders.get({ serviceOrderId: crypto.randomUUID() })
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

import { afterEach, describe, expect, test } from "bun:test";
import {
	financialAccountKindValues,
	financialMovementKindValues,
} from "@costura-pro/db/schema/finance";
import {
	financialAccountKinds,
	financialMovementKinds,
} from "@costura-pro/domain/finance";

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

type Owner = ReturnType<typeof rpc>;

async function ownerSetup(options: ServerOptions = {}) {
	const server = await startTestServer(options);
	servers.push(server);
	const { cookie } = await completeWizard(server);
	return { owner: rpc(server, { cookie }), server };
}

function createAccount(owner: Owner, overrides: Record<string, unknown> = {}) {
	return owner.financialAccounts.create({
		accountId: crypto.randomUUID(),
		kind: "cash",
		name: "Caixa",
		notes: null,
		opId: newOpId(),
		...overrides,
	});
}

function openingInput(
	accountId: string,
	overrides: Record<string, unknown> = {}
) {
	return {
		accountId,
		amountCents: "15000",
		kind: "opening" as const,
		movementId: crypto.randomUUID(),
		occurredOn: "2026-09-17",
		opId: newOpId(),
		reason: null,
		...overrides,
	};
}

function transferInput(
	fromAccountId: string,
	toAccountId: string,
	overrides: Record<string, unknown> = {}
) {
	return {
		amountCents: "4000",
		fromAccountId,
		inboundId: crypto.randomUUID(),
		movementId: crypto.randomUUID(),
		occurredOn: "2026-09-17",
		opId: newOpId(),
		reason: null,
		toAccountId,
		...overrides,
	};
}

async function balances(owner: Owner) {
	const { items } = await owner.financialAccounts.list({});
	return Object.fromEntries(items.map((item) => [item.id, item.balanceCents]));
}

describe("financial accounts", () => {
	test("keeps the kind lists of the database equal to the domain", () => {
		expect([...financialAccountKindValues]).toEqual([...financialAccountKinds]);
		expect([...financialMovementKindValues]).toEqual([
			...financialMovementKinds,
		]);
	});

	test("creates, reads and edits an account, kind included", async () => {
		const { owner } = await ownerSetup({ now: manualClock().now });
		const created = await createAccount(owner, {
			accountId: "00000000-0000-4000-8000-000000000001",
		});
		expect(created).toEqual({
			id: "00000000-0000-4000-8000-000000000001",
			version: 1,
		});
		const { items } = await owner.financialAccounts.list({});
		expect(items).toEqual([
			{
				archivedAt: null,
				balanceCents: "0",
				createdAt: "2026-09-16T12:00:00.000Z",
				id: created.id,
				kind: "cash",
				name: "Caixa",
				notes: null,
				updatedAt: "2026-09-16T12:00:00.000Z",
				version: 1,
			},
		]);
		expect(
			await owner.financialAccounts.update({
				accountId: created.id,
				baseVersion: 1,
				opId: newOpId(),
				patch: { kind: "bank", name: "Banco do bairro", notes: "Conta PJ" },
			})
		).toEqual({ version: 2 });
		const edited = await owner.financialAccounts.list({});
		expect(edited.items[0]).toMatchObject({
			kind: "bank",
			name: "Banco do bairro",
			notes: "Conta PJ",
			version: 2,
		});
	});

	test("archives without effect twice, unarchives and filters the list", async () => {
		const { owner } = await ownerSetup();
		const { id } = await createAccount(owner);
		expect(
			await owner.financialAccounts.archive({
				accountId: id,
				baseVersion: 1,
				opId: newOpId(),
			})
		).toEqual({ version: 2 });
		expect(
			await owner.financialAccounts.archive({
				accountId: id,
				baseVersion: 2,
				opId: newOpId(),
			})
		).toEqual({ version: 2 });
		expect((await owner.financialAccounts.list({})).items).toHaveLength(0);
		expect(
			(await owner.financialAccounts.list({ archived: true })).items
		).toHaveLength(1);
		expect(
			await owner.financialAccounts.unarchive({
				accountId: id,
				baseVersion: 2,
				opId: newOpId(),
			})
		).toEqual({ version: 3 });
	});

	test("repeats by opId and refuses a stale version, a repeated id, an empty patch and a missing account", async () => {
		const { owner } = await ownerSetup();
		const accountId = crypto.randomUUID();
		const opId = newOpId();
		const first = await createAccount(owner, { accountId, opId });
		expect(await createAccount(owner, { accountId, opId })).toEqual(first);
		await expect(createAccount(owner, { accountId })).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		await expect(
			owner.financialAccounts.update({
				accountId,
				baseVersion: 9,
				opId: newOpId(),
				patch: { name: "Outra" },
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: { currentVersion: 1 },
			message: "Versão desatualizada",
		});
		await expect(
			owner.financialAccounts.update({
				accountId,
				baseVersion: 1,
				opId: newOpId(),
				patch: {},
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			owner.financialAccounts.update({
				accountId: crypto.randomUUID(),
				baseVersion: 1,
				opId: newOpId(),
				patch: { name: "Outra" },
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Conta não encontrada",
		});
	});
});

describe("financial movements", () => {
	test("sums positive and negative openings into the balance", async () => {
		const { owner } = await ownerSetup();
		const cash = await createAccount(owner);
		const bank = await createAccount(owner, { kind: "bank", name: "Banco" });
		await owner.financialMovements.create(openingInput(cash.id));
		await owner.financialMovements.create(
			openingInput(bank.id, { amountCents: "-2550", reason: "Cheque especial" })
		);
		await owner.financialMovements.create(
			openingInput(cash.id, { amountCents: "1" })
		);
		expect(await balances(owner)).toEqual({
			[bank.id]: "-2550",
			[cash.id]: "15001",
		});
		const { items } = await owner.financialMovements.list({
			accountId: bank.id,
		});
		expect(items).toEqual([
			expect.objectContaining({
				accountId: bank.id,
				amountCents: "-2550",
				kind: "opening",
				obligationId: null,
				purchaseId: null,
				reason: "Cheque especial",
				reversedByMovementId: null,
				supplierName: null,
				version: 1,
			}),
		]);
	});

	test("refuses a zero opening, a malformed amount and a missing account", async () => {
		const { owner } = await ownerSetup();
		const cash = await createAccount(owner);
		await expect(
			owner.financialMovements.create(
				openingInput(cash.id, { amountCents: "0" })
			)
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			owner.financialMovements.create(
				openingInput(cash.id, { amountCents: "12,50" })
			)
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			owner.financialMovements.create(openingInput(crypto.randomUUID()))
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Conta não encontrada",
		});
	});

	test("repeats an opening by opId without duplicating it", async () => {
		const { owner } = await ownerSetup();
		const cash = await createAccount(owner);
		const input = openingInput(cash.id);
		const first = await owner.financialMovements.create(input);
		expect(await owner.financialMovements.create(input)).toEqual(first);
		expect(await balances(owner)).toEqual({ [cash.id]: "15000" });
	});

	test("transfers between accounts with two linked legs", async () => {
		const { owner } = await ownerSetup();
		const cash = await createAccount(owner);
		const bank = await createAccount(owner, { kind: "bank", name: "Banco" });
		await owner.financialMovements.create(openingInput(cash.id));
		const input = transferInput(cash.id, bank.id, { reason: "Depósito" });
		const first = await owner.financialMovements.transfer(input);
		expect(await owner.financialMovements.transfer(input)).toEqual(first);
		expect(await balances(owner)).toEqual({
			[bank.id]: "4000",
			[cash.id]: "11000",
		});
		const out = await owner.financialMovements.list({ accountId: cash.id });
		const inbound = await owner.financialMovements.list({
			accountId: bank.id,
		});
		expect(out.items[0]).toMatchObject({
			amountCents: "-4000",
			id: input.movementId,
			kind: "transferOut",
			transferId: input.movementId,
		});
		expect(inbound.items[0]).toMatchObject({
			amountCents: "4000",
			id: input.inboundId,
			kind: "transferIn",
			transferId: input.movementId,
		});
	});

	test("refuses a transfer to the same account, a missing account and an inbound id already used", async () => {
		const { owner } = await ownerSetup();
		const cash = await createAccount(owner);
		const bank = await createAccount(owner, { kind: "bank", name: "Banco" });
		await expect(
			owner.financialMovements.transfer(transferInput(cash.id, cash.id))
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			owner.financialMovements.transfer(
				transferInput(cash.id, crypto.randomUUID())
			)
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Conta não encontrada",
		});
		const opening = await owner.financialMovements.create(
			openingInput(cash.id)
		);
		await expect(
			owner.financialMovements.transfer(
				transferInput(cash.id, bank.id, { inboundId: opening.id })
			)
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		const same = crypto.randomUUID();
		await expect(
			owner.financialMovements.transfer(
				transferInput(cash.id, bank.id, { inboundId: same, movementId: same })
			)
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Registro já existe",
		});
		expect(await balances(owner)).toEqual({
			[bank.id]: "0",
			[cash.id]: "15000",
		});
	});

	test("reverses an opening once and refuses to reverse the reversal", async () => {
		const { owner } = await ownerSetup();
		const cash = await createAccount(owner);
		const opening = await owner.financialMovements.create(
			openingInput(cash.id)
		);
		const reversal = await owner.financialMovements.reverse({
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-18",
			opId: newOpId(),
			reason: "Lançado em dobro",
			reversesMovementId: opening.id,
		});
		expect(await balances(owner)).toEqual({ [cash.id]: "0" });
		const { items } = await owner.financialMovements.list({
			accountId: cash.id,
		});
		expect(items.find((item) => item.id === opening.id)).toMatchObject({
			reversedByMovementId: reversal.id,
		});
		expect(items.find((item) => item.id === reversal.id)).toMatchObject({
			amountCents: "-15000",
			kind: "reversal",
			reason: "Lançado em dobro",
			reversesMovementId: opening.id,
		});
		await expect(
			owner.financialMovements.reverse({
				movementId: crypto.randomUUID(),
				occurredOn: "2026-09-18",
				opId: newOpId(),
				reason: "De novo",
				reversesMovementId: opening.id,
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Movimento já estornado",
		});
		await expect(
			owner.financialMovements.reverse({
				movementId: crypto.randomUUID(),
				occurredOn: "2026-09-18",
				opId: newOpId(),
				reason: "Desfazer o estorno",
				reversesMovementId: reversal.id,
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Estorno não se estorna",
		});
		await expect(
			owner.financialMovements.reverse({
				movementId: crypto.randomUUID(),
				occurredOn: "2026-09-18",
				opId: newOpId(),
				reason: "Nada",
				reversesMovementId: crypto.randomUUID(),
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Movimento não encontrado",
		});
	});

	test("reverses both legs of a transfer and demands the counterpart id", async () => {
		const { owner } = await ownerSetup();
		const cash = await createAccount(owner);
		const bank = await createAccount(owner, { kind: "bank", name: "Banco" });
		await owner.financialMovements.create(openingInput(cash.id));
		const transfer = transferInput(cash.id, bank.id);
		await owner.financialMovements.transfer(transfer);
		await expect(
			owner.financialMovements.reverse({
				movementId: crypto.randomUUID(),
				occurredOn: "2026-09-18",
				opId: newOpId(),
				reason: "Transferi errado",
				reversesMovementId: transfer.inboundId,
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Movimento não encontrado",
		});
		const reverseInput = {
			counterpartId: crypto.randomUUID(),
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-18",
			opId: newOpId(),
			reason: "Transferi errado",
			reversesMovementId: transfer.inboundId,
		};
		const first = await owner.financialMovements.reverse(reverseInput);
		expect(await owner.financialMovements.reverse(reverseInput)).toEqual(first);
		expect(await balances(owner)).toEqual({
			[bank.id]: "0",
			[cash.id]: "15000",
		});
		await expect(
			owner.financialMovements.reverse({
				counterpartId: crypto.randomUUID(),
				movementId: crypto.randomUUID(),
				occurredOn: "2026-09-18",
				opId: newOpId(),
				reason: "De novo",
				reversesMovementId: transfer.movementId,
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Movimento já estornado",
		});
	});

	test("refuses a movement written straight to the table", async () => {
		const { owner, server } = await ownerSetup();
		const cash = await createAccount(owner);
		await owner.financialMovements.create(openingInput(cash.id));
		expect(() =>
			server.native().run("UPDATE financial_movement SET amount_cents = 1")
		).toThrow("financial_movement é append-only");
	});
});

describe("financial ids of a two-row reversal", () => {
	test("refuses a counterpart id equal to the reversal id or already used", async () => {
		const { owner } = await ownerSetup();
		const cash = await createAccount(owner);
		const bank = await createAccount(owner, { kind: "bank", name: "Banco" });
		const opening = await owner.financialMovements.create(
			openingInput(cash.id)
		);
		const transfer = transferInput(cash.id, bank.id);
		await owner.financialMovements.transfer(transfer);
		const same = crypto.randomUUID();
		const refusals = [
			{ counterpartId: same, movementId: same },
			{ counterpartId: opening.id, movementId: crypto.randomUUID() },
		];
		await inSequence(refusals, async (ids) => {
			await expect(
				owner.financialMovements.reverse({
					...ids,
					occurredOn: "2026-09-18",
					opId: newOpId(),
					reason: "Transferi errado",
					reversesMovementId: transfer.movementId,
				})
			).rejects.toMatchObject({
				code: "CONFLICT",
				message: "Registro já existe",
			});
		});
		expect(await balances(owner)).toEqual({
			[bank.id]: "4000",
			[cash.id]: "11000",
		});
	});
});

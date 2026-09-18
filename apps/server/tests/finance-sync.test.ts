import { afterEach, describe, expect, test } from "bun:test";

import {
	inSequence,
	newOpId,
	type SyncSetup,
	syncSetup,
	type TestServer,
} from "./support";

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

function operation(
	setup: SyncSetup,
	aggregateType: string,
	command: string,
	payload: unknown,
	id = crypto.randomUUID()
) {
	return envelope(setup, {
		aggregateId: id,
		aggregateType,
		baseVersion: null,
		command,
		payload,
	});
}

async function accounts(setup: SyncSetup) {
	const cash = await setup.local.financialAccounts.create({
		accountId: crypto.randomUUID(),
		kind: "cash",
		name: "Caixa",
		notes: null,
		opId: newOpId(),
	});
	const bank = await setup.local.financialAccounts.create({
		accountId: crypto.randomUUID(),
		kind: "bank",
		name: "Banco",
		notes: null,
		opId: newOpId(),
	});
	return { bankId: bank.id, cashId: cash.id };
}

function openingPayload(
	accountId: string,
	overrides: Record<string, unknown> = {}
) {
	return {
		accountId,
		amountCents: "15000",
		kind: "opening",
		occurredOn: "2026-09-17",
		...overrides,
	};
}

describe("finance sync", () => {
	test("creates and edits an account over push and reads it back on pull", async () => {
		const setup = await syncSetup(servers);
		const accountId = crypto.randomUUID();
		const create = operation(
			setup,
			"financialAccount",
			"financialAccount.create",
			{ kind: "pix", name: "Pix do ateliê", notes: null },
			accountId
		);
		const edit = envelope(setup, {
			aggregateId: accountId,
			aggregateType: "financialAccount",
			baseVersion: 1,
			command: "financialAccount.update",
			payload: { kind: "bank" },
		});
		const results = await inSequence([create, edit], (item) =>
			setup.sync.sync.push({ operations: [item] })
		);
		expect(results.flatMap((result) => result.accepted)).toEqual([
			{ newVersion: 1, opId: create.opId },
			{ newVersion: 2, opId: edit.opId },
		]);
		const { changes } = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		expect(
			changes
				.filter((change) => change.aggregateType === "financialAccount")
				.at(-1)?.data
		).toMatchObject({
			id: accountId,
			kind: "bank",
			name: "Pix do ateliê",
			version: 2,
		});
	});

	test("records an opening, a transfer and a reversal over push", async () => {
		const setup = await syncSetup(servers);
		const { bankId, cashId } = await accounts(setup);
		const opening = operation(
			setup,
			"financialMovement",
			"financialMovement.create",
			openingPayload(cashId)
		);
		const transfer = operation(
			setup,
			"financialMovement",
			"financialMovement.transfer",
			{
				amountCents: "4000",
				fromAccountId: cashId,
				inboundId: crypto.randomUUID(),
				occurredOn: "2026-09-17",
				toAccountId: bankId,
			}
		);
		const reverse = operation(
			setup,
			"financialMovement",
			"financialMovement.reverse",
			{
				counterpartId: crypto.randomUUID(),
				occurredOn: "2026-09-18",
				reason: "Transferi errado",
				reversesMovementId: transfer.aggregateId,
			}
		);
		const results = await inSequence([opening, transfer, reverse], (item) =>
			setup.sync.sync.push({ operations: [item] })
		);
		expect(results.flatMap((result) => result.accepted)).toHaveLength(3);
		const again = await setup.sync.sync.push({ operations: [transfer] });
		expect(again.accepted).toEqual(results[1]?.accepted ?? []);
		const { items } = await setup.local.financialAccounts.list({});
		expect(
			Object.fromEntries(items.map((item) => [item.id, item.balanceCents]))
		).toEqual({ [bankId]: "0", [cashId]: "15000" });
		const { changes } = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
		});
		expect(
			changes.find(
				(change) =>
					change.aggregateType === "financialMovement" &&
					change.aggregateId === opening.aggregateId
			)?.data
		).toEqual({
			accountId: cashId,
			amountCents: "15000",
			createdAt: expect.any(String),
			id: opening.aggregateId,
			kind: "opening",
			obligationId: null,
			occurredOn: "2026-09-17",
			reason: null,
			reversesMovementId: null,
			transferId: null,
			version: 1,
		});
	});

	test("quarantines a missing account, an invalid payload and a repeated id", async () => {
		const setup = await syncSetup(servers);
		const { bankId, cashId } = await accounts(setup);
		const openingId = crypto.randomUUID();
		await setup.sync.sync.push({
			operations: [
				operation(
					setup,
					"financialMovement",
					"financialMovement.create",
					openingPayload(cashId),
					openingId
				),
			],
		});
		const operations = [
			operation(
				setup,
				"financialMovement",
				"financialMovement.create",
				openingPayload(crypto.randomUUID())
			),
			operation(
				setup,
				"financialMovement",
				"financialMovement.create",
				openingPayload(cashId, { amountCents: "12,50" })
			),
			operation(
				setup,
				"financialMovement",
				"financialMovement.create",
				openingPayload(cashId, { amountCents: "0" })
			),
			operation(setup, "financialMovement", "financialMovement.transfer", {
				amountCents: "100",
				fromAccountId: cashId,
				inboundId: crypto.randomUUID(),
				occurredOn: "2026-09-17",
				toAccountId: cashId,
			}),
			operation(setup, "financialMovement", "financialMovement.transfer", {
				amountCents: "100",
				fromAccountId: cashId,
				inboundId: openingId,
				occurredOn: "2026-09-17",
				toAccountId: bankId,
			}),
			operation(
				setup,
				"financialMovement",
				"financialMovement.create",
				openingPayload(cashId),
				openingId
			),
		];
		const pushed = await setup.sync.sync.push({ operations });
		expect(pushed.quarantined.map((item) => item.reason)).toEqual([
			"aggregateNotFound",
			"invalidPayload",
			"invalidPayload",
			"invalidPayload",
			"aggregateExists",
			"aggregateExists",
		]);
	});

	test("quarantines a second reversal and a reversal of a reversal", async () => {
		const setup = await syncSetup(servers);
		const { cashId } = await accounts(setup);
		const opening = await setup.local.financialMovements.create({
			accountId: cashId,
			amountCents: "15000",
			kind: "opening",
			movementId: crypto.randomUUID(),
			occurredOn: "2026-09-17",
			opId: newOpId(),
			reason: null,
		});
		const first = operation(
			setup,
			"financialMovement",
			"financialMovement.reverse",
			{
				occurredOn: "2026-09-18",
				reason: "Lançado errado",
				reversesMovementId: opening.id,
			}
		);
		const second = operation(
			setup,
			"financialMovement",
			"financialMovement.reverse",
			{
				occurredOn: "2026-09-18",
				reason: "De novo",
				reversesMovementId: opening.id,
			}
		);
		const ofReversal = operation(
			setup,
			"financialMovement",
			"financialMovement.reverse",
			{
				occurredOn: "2026-09-18",
				reason: "Desfazer",
				reversesMovementId: first.aggregateId,
			}
		);
		const pushed = await setup.sync.sync.push({
			operations: [first, second, ofReversal],
		});
		expect(pushed.accepted).toEqual([{ newVersion: 1, opId: first.opId }]);
		expect(pushed.quarantined.map((item) => item.reason)).toEqual([
			"aggregateExists",
			"aggregateNotFound",
		]);
	});

	test("opens a conflict on a stale account edit and resolves it with keepLocal", async () => {
		const setup = await syncSetup(servers);
		const { cashId } = await accounts(setup);
		await setup.local.financialAccounts.update({
			accountId: cashId,
			baseVersion: 1,
			opId: newOpId(),
			patch: { name: "Caixa da loja" },
		});
		const stale = envelope(setup, {
			aggregateId: cashId,
			aggregateType: "financialAccount",
			baseVersion: 1,
			command: "financialAccount.update",
			payload: { notes: "Escrito no celular" },
		});
		const pushed = await setup.sync.sync.push({ operations: [stale] });
		expect(pushed.conflicts).toHaveLength(1);
		const resolved = await setup.local.sync.resolve({
			choice: "keepLocal",
			conflictId: pushed.conflicts[0]?.conflictId ?? "",
			opId: newOpId(),
			reason: "O celular estava certo",
		});
		expect(resolved.choice).toBe("keepLocal");
		const { items } = await setup.local.financialAccounts.list({});
		expect(items.find((item) => item.id === cashId)).toMatchObject({
			name: "Caixa da loja",
			notes: "Escrito no celular",
		});
	});
});

describe("finance sync ids", () => {
	test("quarantines a reversal whose counterpart id repeats the reversal id", async () => {
		const setup = await syncSetup(servers);
		const { bankId, cashId } = await accounts(setup);
		const transfer = operation(
			setup,
			"financialMovement",
			"financialMovement.transfer",
			{
				amountCents: "4000",
				fromAccountId: cashId,
				inboundId: crypto.randomUUID(),
				occurredOn: "2026-09-17",
				toAccountId: bankId,
			}
		);
		await setup.sync.sync.push({ operations: [transfer] });
		const same = crypto.randomUUID();
		const reverse = operation(
			setup,
			"financialMovement",
			"financialMovement.reverse",
			{
				counterpartId: same,
				occurredOn: "2026-09-18",
				reason: "Transferi errado",
				reversesMovementId: transfer.aggregateId,
			},
			same
		);
		const pushed = await setup.sync.sync.push({ operations: [reverse] });
		expect(pushed.quarantined).toEqual([
			{ opId: reverse.opId, reason: "aggregateExists" },
		]);
	});
});

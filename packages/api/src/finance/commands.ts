import { commandMessages } from "../command-messages";
import { emptyPayload } from "../schemas";
import type { CreateDefinition, CreateRejection } from "../sync/commands";
import {
	archivePatch,
	definedFields,
	unarchivePatch,
	updateCommands,
} from "../update-command";
import {
	financialAccountCreatePayload,
	financialAccountPatchPayload,
	financialMovementCreatePayload,
	financialMovementReversePayload,
	financialMovementTransferPayload,
} from "./schemas";
import {
	type FinancialAccountPatch,
	type FinancialAccountRow,
	financialAccountSnapshot,
	financialReversalFields,
	insertFinancialAccount,
	insertFinancialMovement,
	readFinancialAccount,
	readFinancialMovement,
	readFinancialReversalOf,
	readFinancialTransferCounterpart,
	updateFinancialAccount,
} from "./store";

const notFound = (message: string): CreateRejection => ({
	message,
	reason: "aggregateNotFound",
});

const reversed: CreateRejection = {
	message: commandMessages.financialMovementReversed,
	reason: "aggregateExists",
};

const accountCommand = updateCommands<
	FinancialAccountRow,
	FinancialAccountPatch
>({
	aggregateType: "financialAccount",
	anonymized: () => false,
	read: readFinancialAccount,
	snapshot: financialAccountSnapshot,
	update: updateFinancialAccount,
});

const createAccount: CreateDefinition = {
	aggregateType: "financialAccount",
	create: (db, id, values, stamp) =>
		insertFinancialAccount(
			db,
			id,
			financialAccountCreatePayload.parse(values),
			stamp
		).version,
	exists: (db, id) => readFinancialAccount(db, id) !== undefined,
	kind: "create",
	payload: financialAccountCreatePayload,
};

const createMovement: CreateDefinition = {
	aggregateType: "financialMovement",
	create: (db, id, values, stamp) => {
		const fields = financialMovementCreatePayload.parse(values);
		if (!readFinancialAccount(db, fields.accountId)) {
			return notFound(commandMessages.financialAccountNotFound);
		}
		return insertFinancialMovement(
			db,
			id,
			{
				accountId: fields.accountId,
				amountCents: fields.amountCents,
				kind: fields.kind,
				obligationId: null,
				occurredOn: fields.occurredOn,
				reason: fields.reason,
				reversesMovementId: null,
				transferId: null,
			},
			stamp
		).version;
	},
	exists: (db, id) => readFinancialMovement(db, id) !== undefined,
	kind: "create",
	payload: financialMovementCreatePayload,
};

const transferMovement: CreateDefinition = {
	aggregateType: "financialMovement",
	create: (db, id, values, stamp) => {
		const fields = financialMovementTransferPayload.parse(values);
		if (
			!(
				readFinancialAccount(db, fields.fromAccountId) &&
				readFinancialAccount(db, fields.toAccountId)
			)
		) {
			return notFound(commandMessages.financialAccountNotFound);
		}
		if (
			fields.inboundId === id ||
			readFinancialMovement(db, fields.inboundId)
		) {
			return { reason: "aggregateExists" };
		}
		const shared = {
			obligationId: null,
			occurredOn: fields.occurredOn,
			reason: fields.reason,
			reversesMovementId: null,
			transferId: id,
		};
		const out = insertFinancialMovement(
			db,
			id,
			{
				...shared,
				accountId: fields.fromAccountId,
				amountCents: (-BigInt(fields.amountCents)).toString(),
				kind: "transferOut",
			},
			stamp
		);
		insertFinancialMovement(
			db,
			fields.inboundId,
			{
				...shared,
				accountId: fields.toAccountId,
				amountCents: fields.amountCents,
				kind: "transferIn",
			},
			stamp
		);
		return out.version;
	},
	exists: (db, id) => readFinancialMovement(db, id) !== undefined,
	kind: "create",
	payload: financialMovementTransferPayload,
};

const reverseMovement: CreateDefinition = {
	aggregateType: "financialMovement",
	create: (db, id, values, stamp) => {
		const fields = financialMovementReversePayload.parse(values);
		const original = readFinancialMovement(db, fields.reversesMovementId);
		if (!original) {
			return notFound(commandMessages.financialMovementNotFound);
		}
		if (original.kind === "reversal") {
			return notFound(commandMessages.reversalNotReversible);
		}
		if (readFinancialReversalOf(db, original.id)) {
			return reversed;
		}
		const counterpart =
			original.transferId === null
				? undefined
				: readFinancialTransferCounterpart(
						db,
						original.transferId,
						original.id
					);
		if ((counterpart === undefined) !== (fields.counterpartId === null)) {
			return notFound(commandMessages.financialMovementNotFound);
		}
		if (counterpart && readFinancialReversalOf(db, counterpart.id)) {
			return reversed;
		}
		if (
			fields.counterpartId &&
			(fields.counterpartId === id ||
				readFinancialMovement(db, fields.counterpartId))
		) {
			return { reason: "aggregateExists" };
		}
		const pairId = counterpart ? id : null;
		const created = insertFinancialMovement(
			db,
			id,
			financialReversalFields(
				original,
				fields.occurredOn,
				fields.reason,
				pairId
			),
			stamp
		);
		if (counterpart && fields.counterpartId) {
			insertFinancialMovement(
				db,
				fields.counterpartId,
				financialReversalFields(
					counterpart,
					fields.occurredOn,
					fields.reason,
					pairId
				),
				stamp
			);
		}
		return created.version;
	},
	exists: (db, id) => readFinancialMovement(db, id) !== undefined,
	kind: "create",
	payload: financialMovementReversePayload,
};

export const financeCommands = {
	"financialAccount.archive": accountCommand(emptyPayload, archivePatch),
	"financialAccount.create": createAccount,
	"financialAccount.unarchive": accountCommand(emptyPayload, unarchivePatch),
	"financialAccount.update": accountCommand(
		financialAccountPatchPayload,
		(_row, values) => definedFields(values)
	),
	"financialMovement.create": createMovement,
	"financialMovement.reverse": reverseMovement,
	"financialMovement.transfer": transferMovement,
};

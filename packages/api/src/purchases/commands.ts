import { commandMessages } from "../command-messages";
import {
	financialReversalFields,
	insertFinancialMovement,
	readActiveObligationPayment,
	readFinancialAccount,
	readFinancialMovement,
} from "../finance/store";
import { emptyPayload } from "../schemas";
import { checkPlace } from "../stock/commands";
import { insertStockMovement, readStockMovement } from "../stock/store";
import type {
	CommandExecutor,
	CreateDefinition,
	CreateRejection,
} from "../sync/commands";
import {
	archivePatch,
	definedFields,
	unarchivePatch,
	updateCommands,
} from "../update-command";
import {
	obligationPayPayload,
	purchaseCreatePayload,
	purchaseReversePayload,
	purchaseTotalsOf,
	supplierCreatePayload,
	supplierPatchPayload,
} from "./schemas";
import {
	insertObligation,
	insertPurchase,
	insertPurchaseReversal,
	type PurchaseItem,
	readObligation,
	readObligationOfPurchase,
	readPurchase,
	readPurchaseReversal,
	readReversalOfPurchase,
} from "./store";
import {
	insertSupplier,
	readSupplier,
	type SupplierPatch,
	type SupplierRow,
	supplierSnapshot,
	updateSupplier,
} from "./supplier-store";

const notFound = (message: string): CreateRejection => ({
	message,
	reason: "aggregateNotFound",
});

const taken: CreateRejection = { reason: "aggregateExists" };

const supplierCommand = updateCommands<SupplierRow, SupplierPatch>({
	aggregateType: "supplier",
	anonymized: () => false,
	read: readSupplier,
	snapshot: supplierSnapshot,
	update: updateSupplier,
});

const createSupplier: CreateDefinition = {
	aggregateType: "supplier",
	create: (db, id, values, stamp) =>
		insertSupplier(db, id, supplierCreatePayload.parse(values), stamp).version,
	exists: (db, id) => readSupplier(db, id) !== undefined,
	kind: "create",
	payload: supplierCreatePayload,
};

function firstRejection(
	checks: (() => CreateRejection | null)[]
): CreateRejection | null {
	for (const check of checks) {
		const rejection = check();
		if (rejection) {
			return rejection;
		}
	}
	return null;
}

const createPurchase: CreateDefinition = {
	aggregateType: "purchase",
	create: (db, id, values, stamp) => {
		const fields = purchaseCreatePayload.parse(values);
		const { payment } = fields;
		const rejection = firstRejection([
			() =>
				readSupplier(db, fields.supplierId)
					? null
					: notFound(commandMessages.supplierNotFound),
			...fields.items.map((item) => () => checkPlace(db, item)),
			() =>
				payment.kind === "now" && !readFinancialAccount(db, payment.accountId)
					? notFound(commandMessages.financialAccountNotFound)
					: null,
			() =>
				fields.items.some((item) => readStockMovement(db, item.movementId)) ||
				readObligation(db, fields.obligationId) ||
				(payment.kind === "now" &&
					readFinancialMovement(db, payment.movementId))
					? taken
					: null,
		]);
		if (rejection) {
			return rejection;
		}
		const totals = purchaseTotalsOf(fields);
		const items: PurchaseItem[] = fields.items.map((item, index) => {
			const line = totals.lines[index];
			return {
				discountCents: (line?.discountCents ?? 0n).toString(),
				freightCents: (line?.freightCents ?? 0n).toString(),
				grossCents: (line?.grossCents ?? 0n).toString(),
				locationId: item.locationId,
				lotId: item.lotId,
				movementId: item.movementId,
				packageCountMicros: item.packageCountMicros,
				packagingLabel: item.packagingLabel,
				packagingQuantityMicros: item.packagingQuantityMicros,
				quantityMicros: (line?.quantityMicros ?? 0n).toString(),
				unitPriceCents: item.unitPriceCents,
				valueCents: (line?.valueCents ?? 0n).toString(),
				variantId: item.variantId,
			};
		});
		const created = insertPurchase(
			db,
			id,
			{
				discountCents: totals.discountCents.toString(),
				freightCents: totals.freightCents.toString(),
				grossCents: totals.grossCents.toString(),
				items,
				notes: fields.notes,
				occurredOn: fields.occurredOn,
				reference: fields.reference,
				supplierId: fields.supplierId,
				totalCents: totals.totalCents.toString(),
			},
			stamp
		);
		for (const item of items) {
			insertStockMovement(
				db,
				item.movementId,
				{
					inventorySessionId: null,
					kind: "purchase",
					locationId: item.locationId,
					lotId: item.lotId,
					occurredOn: fields.occurredOn,
					purchaseId: id,
					quantityMicros: item.quantityMicros,
					reason: null,
					reversesMovementId: null,
					transferId: null,
					valueCents: item.valueCents,
					variantId: item.variantId,
				},
				stamp
			);
		}
		insertObligation(
			db,
			fields.obligationId,
			{
				amountCents: totals.totalCents.toString(),
				dueOn: payment.kind === "later" ? payment.dueOn : fields.occurredOn,
				purchaseId: id,
			},
			stamp
		);
		if (payment.kind === "now") {
			insertFinancialMovement(
				db,
				payment.movementId,
				{
					accountId: payment.accountId,
					amountCents: (-totals.totalCents).toString(),
					kind: "obligationPayment",
					obligationId: fields.obligationId,
					occurredOn: fields.occurredOn,
					reason: null,
					reversesMovementId: null,
					transferId: null,
				},
				stamp
			);
		}
		return created.version;
	},
	exists: (db, id) => readPurchase(db, id) !== undefined,
	kind: "create",
	payload: purchaseCreatePayload,
};

function idTaken(db: CommandExecutor, id: string): boolean {
	return (
		readStockMovement(db, id) !== undefined ||
		readFinancialMovement(db, id) !== undefined
	);
}

const reversePurchase: CreateDefinition = {
	aggregateType: "purchaseReversal",
	create: (db, id, values, stamp) => {
		const fields = purchaseReversePayload.parse(values);
		const original = readPurchase(db, fields.purchaseId);
		if (!original) {
			return notFound(commandMessages.purchaseNotFound);
		}
		if (readReversalOfPurchase(db, original.id)) {
			return { message: commandMessages.purchaseReversed, ...taken };
		}
		if (fields.movementIds.length !== original.items.length) {
			return notFound(commandMessages.purchaseNotFound);
		}
		if (
			[...fields.movementIds, fields.paymentReversalId].some((movementId) =>
				idTaken(db, movementId)
			)
		) {
			return taken;
		}
		const created = insertPurchaseReversal(
			db,
			id,
			{
				occurredOn: fields.occurredOn,
				purchaseId: original.id,
				reason: fields.reason,
			},
			stamp
		);
		original.items.forEach((item, index) => {
			insertStockMovement(
				db,
				fields.movementIds[index] ?? "",
				{
					inventorySessionId: null,
					kind: "reversal",
					locationId: item.locationId,
					lotId: item.lotId,
					occurredOn: fields.occurredOn,
					purchaseId: original.id,
					quantityMicros: (-BigInt(item.quantityMicros)).toString(),
					reason: fields.reason,
					reversesMovementId: item.movementId,
					transferId: null,
					valueCents: (-BigInt(item.valueCents)).toString(),
					variantId: item.variantId,
				},
				stamp
			);
		});
		const obligation = readObligationOfPurchase(db, original.id);
		const payment = obligation
			? readActiveObligationPayment(db, obligation.id)
			: undefined;
		if (payment) {
			insertFinancialMovement(
				db,
				fields.paymentReversalId,
				financialReversalFields(
					payment,
					fields.occurredOn,
					fields.reason,
					null
				),
				stamp
			);
		}
		return created.version;
	},
	exists: (db, id) => readPurchaseReversal(db, id) !== undefined,
	kind: "create",
	payload: purchaseReversePayload,
};

const payObligation: CreateDefinition = {
	aggregateType: "financialMovement",
	create: (db, id, values, stamp) => {
		const fields = obligationPayPayload.parse(values);
		const obligation = readObligation(db, fields.obligationId);
		if (!obligation) {
			return notFound(commandMessages.obligationNotFound);
		}
		if (readReversalOfPurchase(db, obligation.purchaseId)) {
			return notFound(commandMessages.obligationCancelled);
		}
		if (readActiveObligationPayment(db, obligation.id)) {
			return { message: commandMessages.obligationPaid, ...taken };
		}
		if (!readFinancialAccount(db, fields.accountId)) {
			return notFound(commandMessages.financialAccountNotFound);
		}
		return insertFinancialMovement(
			db,
			id,
			{
				accountId: fields.accountId,
				amountCents: (-obligation.amountCents).toString(),
				kind: "obligationPayment",
				obligationId: obligation.id,
				occurredOn: fields.occurredOn,
				reason: null,
				reversesMovementId: null,
				transferId: null,
			},
			stamp
		).version;
	},
	exists: (db, id) => readFinancialMovement(db, id) !== undefined,
	kind: "create",
	payload: obligationPayPayload,
};

export const purchaseCommands = {
	"obligation.pay": payObligation,
	"purchase.create": createPurchase,
	"purchase.reverse": reversePurchase,
	"supplier.archive": supplierCommand(emptyPayload, archivePatch),
	"supplier.create": createSupplier,
	"supplier.unarchive": supplierCommand(emptyPayload, unarchivePatch),
	"supplier.update": supplierCommand(supplierPatchPayload, (_row, values) =>
		definedFields(values)
	),
};

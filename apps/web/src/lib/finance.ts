import {
	type FinancialAccountKind,
	type FinancialMovementKind,
	financeLimits,
	financialAccountKinds,
	type ObligationStatus,
} from "@costura-pro/domain/finance";
import { formatMoney, parseMoney } from "@costura-pro/domain/money";

import { dateError, emptyToNull } from "./stock";

export type AccountView = {
	archivedAt: string | null;
	balanceCents: string;
	createdAt: string;
	id: string;
	kind: FinancialAccountKind;
	name: string;
	notes: string | null;
	updatedAt: string;
	version: number;
};

export type Direction = "in" | "out";

export type AccountFormValues = {
	kind: FinancialAccountKind;
	name: string;
	notes: string;
};

export type AccountOpeningFormValues = {
	amount: string;
	direction: Direction;
	occurredOn: string;
	reason: string;
};

export type AccountTransferFormValues = {
	amount: string;
	occurredOn: string;
	reason: string;
	toAccountId: string;
};

const accountKindLabels: Record<FinancialAccountKind, string> = {
	bank: "Banco",
	cash: "Dinheiro",
	other: "Outra",
	pix: "Pix",
};

export const accountKindOptions = financialAccountKinds.map((kind) => ({
	label: accountKindLabels[kind],
	value: kind,
}));

export function accountKindLabel(kind: FinancialAccountKind): string {
	return accountKindLabels[kind];
}

const movementKindLabels: Record<FinancialMovementKind, string> = {
	obligationPayment: "Pagamento de compra",
	opening: "Saldo de abertura",
	reversal: "Estorno",
	transferIn: "Transferência (entrada)",
	transferOut: "Transferência (saída)",
};

export function financialMovementKindLabel(
	kind: FinancialMovementKind
): string {
	return movementKindLabels[kind];
}

const obligationLabels: Record<ObligationStatus, string> = {
	cancelled: "Cancelada",
	open: "A pagar",
	paid: "Paga",
};

export function obligationStatusLabel(status: ObligationStatus): string {
	return obligationLabels[status];
}

export function isOverdue(
	dueOn: string,
	today: string,
	status: ObligationStatus
): boolean {
	return status === "open" && dueOn < today;
}

export function moneyLabel(cents: string | bigint): string {
	return `R$ ${formatMoney(BigInt(cents))}`;
}

export function signedMoney(cents: string): string {
	const value = BigInt(cents);
	if (value === 0n) {
		return moneyLabel(value);
	}
	return value < 0n ? `-${moneyLabel(-value)}` : `+${moneyLabel(value)}`;
}

export function amountError(text: string): string | null {
	const trimmed = text.trim();
	if (trimmed === "") {
		return "Informe um valor maior que zero";
	}
	const cents = parseMoney(trimmed);
	if (cents === null) {
		return "Use só número, com vírgula e até 2 casas";
	}
	return cents > 0n ? null : "Informe um valor maior que zero";
}

function lengthError(text: string, max: number): string | null {
	return text.trim().length > max ? `Use até ${max} caracteres` : null;
}

export function accountFormErrors(
	values: AccountFormValues
): Partial<Record<"name" | "notes", string>> {
	const name = values.name.trim();
	const nameError =
		name === ""
			? "Informe o nome da conta"
			: lengthError(name, financeLimits.accountName.max);
	const notes = lengthError(values.notes, financeLimits.notes);
	return {
		...(nameError ? { name: nameError } : {}),
		...(notes ? { notes } : {}),
	};
}

export function accountFields(values: AccountFormValues): {
	kind: FinancialAccountKind;
	name: string;
	notes: string | null;
} {
	return {
		kind: values.kind,
		name: values.name.trim(),
		notes: emptyToNull(values.notes),
	};
}

export function accountOpeningErrors(
	values: AccountOpeningFormValues
): Partial<Record<"amount" | "occurredOn" | "reason", string>> {
	const amount = amountError(values.amount);
	const occurredOn = dateError(values.occurredOn);
	const reason = lengthError(values.reason, financeLimits.notes);
	return {
		...(amount ? { amount } : {}),
		...(occurredOn ? { occurredOn } : {}),
		...(reason ? { reason } : {}),
	};
}

export function accountOpeningFields(values: AccountOpeningFormValues): {
	amountCents: string;
	kind: "opening";
	occurredOn: string;
	reason: string | null;
} {
	const cents = parseMoney(values.amount.trim()) ?? 0n;
	return {
		amountCents: (values.direction === "out" ? -cents : cents).toString(),
		kind: "opening",
		occurredOn: values.occurredOn,
		reason: emptyToNull(values.reason),
	};
}

export function accountTransferErrors(
	values: AccountTransferFormValues,
	fromAccountId: string
): Partial<Record<"amount" | "occurredOn" | "reason" | "toAccountId", string>> {
	const amount = amountError(values.amount);
	const occurredOn = dateError(values.occurredOn);
	const reason = lengthError(values.reason, financeLimits.notes);
	const destination = (() => {
		if (values.toAccountId === "") {
			return "Escolha a conta de destino";
		}
		return values.toAccountId === fromAccountId
			? "Escolha uma conta diferente da origem"
			: null;
	})();
	return {
		...(amount ? { amount } : {}),
		...(occurredOn ? { occurredOn } : {}),
		...(reason ? { reason } : {}),
		...(destination ? { toAccountId: destination } : {}),
	};
}

export function accountTransferFields(
	values: AccountTransferFormValues,
	fromAccountId: string
): {
	amountCents: string;
	fromAccountId: string;
	occurredOn: string;
	reason: string | null;
	toAccountId: string;
} {
	return {
		amountCents: (parseMoney(values.amount.trim()) ?? 0n).toString(),
		fromAccountId,
		occurredOn: values.occurredOn,
		reason: emptyToNull(values.reason),
		toAccountId: values.toAccountId,
	};
}

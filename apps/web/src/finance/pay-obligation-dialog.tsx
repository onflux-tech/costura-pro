import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@costura-pro/ui/components/dialog";
import {
	Field,
	FieldError,
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import { Select } from "@costura-pro/ui/components/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { moneyLabel } from "@/lib/finance";
import { localDay } from "@/lib/measurements";
import { dateError } from "@/lib/stock";
import { useOpId } from "@/lib/use-op-id";
import { client as api } from "@/utils/orpc";

import {
	accountsQuery,
	failedFinanceCommand,
	refreshFinance,
} from "./finance-queries";

export type PayableObligation = {
	amountCents: string;
	id: string;
	reference: string | null;
	supplierName: string;
};

export function PayObligationDialog({
	obligation,
	onOpenChange,
	open,
}: {
	obligation: PayableObligation;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<PayObligationForm
					close={() => onOpenChange(false)}
					key={obligation.id}
					obligation={obligation}
				/>
			</DialogContent>
		</Dialog>
	);
}

function PayObligationForm({
	close,
	obligation,
}: {
	close: () => void;
	obligation: PayableObligation;
}) {
	const queryClient = useQueryClient();
	const { opIdFor } = useOpId();
	const accounts = useQuery(accountsQuery());
	const [movementId] = useState(() => crypto.randomUUID());
	const [accountId, setAccountId] = useState("");
	const [occurredOn, setOccurredOn] = useState(() => localDay(new Date()));
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [failure, setFailure] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const accountItems = (accounts.data?.items ?? []).map((account) => ({
		label: `${account.name} (${moneyLabel(account.balanceCents)})`,
		value: account.id,
	}));

	const submit = async () => {
		const invalidDate = dateError(occurredOn);
		const found: Record<string, string> = {
			...(accountId === "" ? { accountId: "Escolha a conta que pagou" } : {}),
			...(invalidDate ? { occurredOn: invalidDate } : {}),
		};
		setErrors(found);
		if (Object.keys(found).length > 0) {
			return;
		}
		setFailure(null);
		setSubmitting(true);
		try {
			const fields = { accountId, obligationId: obligation.id, occurredOn };
			await api.obligations.pay({
				...fields,
				movementId,
				opId: opIdFor(JSON.stringify(fields)),
			});
		} catch (error) {
			const failed = await failedFinanceCommand(queryClient, error, "compra");
			if (failed.kind === "exists") {
				toast.info(failed.message);
				close();
				return;
			}
			setFailure(failed.message);
			return;
		} finally {
			setSubmitting(false);
		}
		await refreshFinance(queryClient);
		toast.success("Pagamento registrado.");
		close();
	};

	const label = submitting ? "Registrando..." : "Registrar pagamento";

	return (
		<form
			className="flex flex-col gap-4"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<DialogTitle>Pagar obrigação</DialogTitle>
			<DialogDescription>
				{obligation.supplierName}
				{obligation.reference ? ` · ${obligation.reference}` : ""}. Valor
				integral de {moneyLabel(obligation.amountCents)}.
			</DialogDescription>
			<Field invalid={Boolean(errors.accountId)} name="accountId">
				<FieldLabel requirement="required">Conta</FieldLabel>
				<Select
					items={accountItems}
					onValueChange={setAccountId}
					value={accountId}
				/>
				{errors.accountId ? (
					<FieldError match>{errors.accountId}</FieldError>
				) : null}
			</Field>
			<Field invalid={Boolean(errors.occurredOn)} name="occurredOn">
				<FieldLabel requirement="required">Data do pagamento</FieldLabel>
				<Input
					aria-invalid={Boolean(errors.occurredOn) || undefined}
					onChange={(event) => setOccurredOn(event.target.value)}
					type="date"
					value={occurredOn}
				/>
				{errors.occurredOn ? (
					<FieldError match>{errors.occurredOn}</FieldError>
				) : null}
			</Field>
			{failure ? (
				<Alert role="alert" tone="danger">
					<AlertTitle>Não foi possível registrar o pagamento</AlertTitle>
					<AlertDescription>{failure}</AlertDescription>
				</Alert>
			) : null}
			<DialogActions>
				<DialogClose render={<Button variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button disabled={submitting} type="submit">
					{label}
				</Button>
			</DialogActions>
		</form>
	);
}

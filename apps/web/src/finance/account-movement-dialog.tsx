import { financeLimits } from "@costura-pro/domain/finance";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import {
	ChoiceChip,
	ChoiceChips,
} from "@costura-pro/ui/components/choice-chips";
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
import { Fieldset, FieldsetLegend } from "@costura-pro/ui/components/fieldset";
import { Input } from "@costura-pro/ui/components/input";
import { NumberField } from "@costura-pro/ui/components/number-field";
import { Select } from "@costura-pro/ui/components/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { CommandDraft } from "@/lib/drafts";
import {
	type AccountView,
	accountOpeningErrors,
	accountOpeningFields,
	accountTransferErrors,
	accountTransferFields,
	type Direction,
} from "@/lib/finance";
import { localDay } from "@/lib/measurements";
import { client as api } from "@/utils/orpc";

import {
	accountsQuery,
	failedFinanceCommand,
	refreshFinance,
} from "./finance-queries";

export type AccountAction = "opening" | "transfer";

const titles: Record<AccountAction, string> = {
	opening: "Lançar saldo de abertura",
	transfer: "Transferir entre contas",
};

const descriptions: Record<AccountAction, string> = {
	opening:
		"Dinheiro que já estava na conta quando o ateliê começou a usar o sistema.",
	transfer:
		"Move dinheiro desta conta para outra, sem ser receita nem despesa.",
};

export function AccountMovementDialog({
	account,
	action,
	draft,
	onDone,
	onOpenChange,
	open,
}: {
	account: AccountView;
	action: AccountAction;
	draft: CommandDraft;
	onDone: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<AccountMovementForm
					account={account}
					action={action}
					close={() => onOpenChange(false)}
					draft={draft}
					key={`${account.id}:${action}`}
					onDone={onDone}
				/>
			</DialogContent>
		</Dialog>
	);
}

function AccountMovementForm({
	account,
	action,
	close,
	draft,
	onDone,
}: {
	account: AccountView;
	action: AccountAction;
	close: () => void;
	draft: CommandDraft;
	onDone: () => void;
}) {
	const queryClient = useQueryClient();
	const { inboundId, movementId, opIdFor } = draft;
	const accounts = useQuery({
		...accountsQuery(),
		enabled: action === "transfer",
	});
	const [direction, setDirection] = useState<Direction>("in");
	const [amount, setAmount] = useState("");
	const [toAccountId, setToAccountId] = useState("");
	const [reason, setReason] = useState("");
	const [occurredOn, setOccurredOn] = useState(() => localDay(new Date()));
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [failure, setFailure] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const destinations = (accounts.data?.items ?? [])
		.filter((item) => item.id !== account.id)
		.map((item) => ({ label: item.name, value: item.id }));

	const send = async () => {
		if (action === "transfer") {
			const fields = accountTransferFields(
				{ amount, occurredOn, reason, toAccountId },
				account.id
			);
			await api.financialMovements.transfer({
				...fields,
				inboundId,
				movementId,
				opId: opIdFor(JSON.stringify(fields)),
			});
			return;
		}
		const fields = accountOpeningFields({
			amount,
			direction,
			occurredOn,
			reason,
		});
		await api.financialMovements.create({
			...fields,
			accountId: account.id,
			movementId,
			opId: opIdFor(JSON.stringify(fields)),
		});
	};

	const submit = async () => {
		const found =
			action === "transfer"
				? accountTransferErrors(
						{ amount, occurredOn, reason, toAccountId },
						account.id
					)
				: accountOpeningErrors({ amount, direction, occurredOn, reason });
		setErrors(found);
		if (Object.keys(found).length > 0) {
			return;
		}
		setFailure(null);
		setSubmitting(true);
		try {
			await send();
		} catch (error) {
			const failed = await failedFinanceCommand(queryClient, error);
			if (failed.kind === "exists") {
				onDone();
				toast.info("Este movimento já tinha sido registrado.");
				close();
				return;
			}
			setFailure(failed.message);
			return;
		} finally {
			setSubmitting(false);
		}
		onDone();
		await refreshFinance(queryClient);
		toast.success("Movimento registrado.");
		close();
	};

	const label = submitting ? "Registrando..." : "Registrar";

	return (
		<form
			className="flex flex-col gap-4"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<DialogTitle>{titles[action]}</DialogTitle>
			<DialogDescription>
				{account.name}. {descriptions[action]}
			</DialogDescription>
			{action === "opening" ? (
				<Fieldset>
					<FieldsetLegend>Saldo</FieldsetLegend>
					<ChoiceChips
						onValueChange={(next) => setDirection(next as Direction)}
						value={direction}
					>
						<ChoiceChip value="in">Positivo</ChoiceChip>
						<ChoiceChip value="out">Negativo</ChoiceChip>
					</ChoiceChips>
				</Fieldset>
			) : (
				<Field invalid={Boolean(errors.toAccountId)} name="toAccountId">
					<FieldLabel requirement="required">Conta de destino</FieldLabel>
					<Select
						items={destinations}
						onValueChange={setToAccountId}
						value={toAccountId}
					/>
					{errors.toAccountId ? (
						<FieldError match>{errors.toAccountId}</FieldError>
					) : null}
				</Field>
			)}
			<Field invalid={Boolean(errors.amount)} name="amount">
				<FieldLabel requirement="required">Valor</FieldLabel>
				<NumberField
					aria-invalid={Boolean(errors.amount) || undefined}
					onChange={(event) => setAmount(event.target.value)}
					suffix="R$"
					value={amount}
				/>
				{errors.amount ? <FieldError match>{errors.amount}</FieldError> : null}
			</Field>
			<Field invalid={Boolean(errors.reason)} name="reason">
				<FieldLabel requirement="optional">Observação</FieldLabel>
				<Input
					aria-invalid={Boolean(errors.reason) || undefined}
					maxLength={financeLimits.notes}
					onChange={(event) => setReason(event.target.value)}
					value={reason}
				/>
				{errors.reason ? <FieldError match>{errors.reason}</FieldError> : null}
			</Field>
			<Field invalid={Boolean(errors.occurredOn)} name="occurredOn">
				<FieldLabel requirement="required">Data</FieldLabel>
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
					<AlertTitle>Não foi possível registrar o movimento</AlertTitle>
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

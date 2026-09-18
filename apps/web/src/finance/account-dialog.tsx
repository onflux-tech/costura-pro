import { financeLimits } from "@costura-pro/domain/finance";
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
import { Textarea } from "@costura-pro/ui/components/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
	type AccountFormValues,
	type AccountView,
	accountFields,
	accountFormErrors,
	accountKindOptions,
} from "@/lib/finance";
import { useOpId } from "@/lib/use-op-id";
import { client as api } from "@/utils/orpc";

import { failedFinanceCommand, refreshFinance } from "./finance-queries";

export function AccountDialog({
	account,
	onOpenChange,
	open,
}: {
	account: AccountView | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<AccountForm
					account={account}
					close={() => onOpenChange(false)}
					key={account?.id ?? "nova"}
				/>
			</DialogContent>
		</Dialog>
	);
}

function AccountForm({
	account,
	close,
}: {
	account: AccountView | null;
	close: () => void;
}) {
	const queryClient = useQueryClient();
	const { opIdFor } = useOpId();
	const [accountId] = useState(() => account?.id ?? crypto.randomUUID());
	const [values, setValues] = useState<AccountFormValues>({
		kind: account?.kind ?? "cash",
		name: account?.name ?? "",
		notes: account?.notes ?? "",
	});
	const [errors, setErrors] = useState<
		Partial<Record<"name" | "notes", string>>
	>({});
	const [failure, setFailure] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const save = async () => {
		const fields = accountFields(values);
		if (!account) {
			await api.financialAccounts.create({
				...fields,
				accountId,
				opId: opIdFor(JSON.stringify(fields)),
			});
			return;
		}
		const patch = {
			...(fields.name === account.name ? {} : { name: fields.name }),
			...(fields.kind === account.kind ? {} : { kind: fields.kind }),
			...(fields.notes === account.notes ? {} : { notes: fields.notes }),
		};
		if (Object.keys(patch).length === 0) {
			return;
		}
		await api.financialAccounts.update({
			accountId,
			baseVersion: account.version,
			opId: opIdFor(`${account.version}:${JSON.stringify(patch)}`),
			patch,
		});
	};

	const submit = async () => {
		const found = accountFormErrors(values);
		setErrors(found);
		if (Object.keys(found).length > 0) {
			return;
		}
		setFailure(null);
		setSubmitting(true);
		try {
			await save();
		} catch (error) {
			const failed = await failedFinanceCommand(queryClient, error);
			if (failed.kind === "stale") {
				toast.error(`${failed.message} Confira e edite de novo.`);
				close();
				return;
			}
			if (failed.kind === "exists") {
				await refreshFinance(queryClient);
				close();
				return;
			}
			setFailure(failed.message);
			return;
		} finally {
			setSubmitting(false);
		}
		await refreshFinance(queryClient);
		close();
	};

	const label = submitting ? "Salvando..." : "Salvar conta";

	return (
		<form
			className="flex flex-col gap-4"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<DialogTitle>{account ? "Editar conta" : "Nova conta"}</DialogTitle>
			<DialogDescription>
				Onde o dinheiro do ateliê fica: caixa, banco ou conta Pix.
			</DialogDescription>
			<Field invalid={Boolean(errors.name)} name="name">
				<FieldLabel requirement="required">Nome</FieldLabel>
				<Input
					aria-invalid={Boolean(errors.name) || undefined}
					maxLength={financeLimits.accountName.max}
					onChange={(event) =>
						setValues((current) => ({ ...current, name: event.target.value }))
					}
					value={values.name}
				/>
				{errors.name ? <FieldError match>{errors.name}</FieldError> : null}
			</Field>
			<Field name="kind">
				<FieldLabel requirement="required">Tipo</FieldLabel>
				<Select
					items={accountKindOptions}
					onValueChange={(next) =>
						setValues((current) => ({
							...current,
							kind: next as AccountFormValues["kind"],
						}))
					}
					value={values.kind}
				/>
			</Field>
			<Field invalid={Boolean(errors.notes)} name="notes">
				<FieldLabel requirement="optional">Notas</FieldLabel>
				<Textarea
					aria-invalid={Boolean(errors.notes) || undefined}
					maxLength={financeLimits.notes}
					onChange={(event) =>
						setValues((current) => ({ ...current, notes: event.target.value }))
					}
					value={values.notes}
				/>
				{errors.notes ? <FieldError match>{errors.notes}</FieldError> : null}
			</Field>
			{failure ? (
				<Alert role="alert" tone="danger">
					<AlertTitle>Não foi possível salvar a conta</AlertTitle>
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

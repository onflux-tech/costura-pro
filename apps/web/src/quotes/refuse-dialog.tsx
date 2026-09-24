import { quoteLimits } from "@costura-pro/domain/quote";
import { Button } from "@costura-pro/ui/components/button";
import {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@costura-pro/ui/components/dialog";
import { Input } from "@costura-pro/ui/components/input";
import { useState } from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import { localDay } from "@/lib/measurements";
import { dayError } from "@/lib/quote-drafts";

import { FailureAlert, QuoteField, useFieldTargets } from "./quote-field";

type RefuseField = "reason" | "refusedOn";

const fieldOrder: readonly RefuseField[] = ["refusedOn", "reason"];

function RefuseForm({
	close,
	onRefuse,
}: {
	close: () => void;
	onRefuse: (
		refusedOn: string,
		reason: string
	) => Promise<ClientCommandFailure | null>;
}) {
	const [today] = useState(() => localDay(new Date()));
	const [refusedOn, setRefusedOn] = useState(today);
	const [reason, setReason] = useState("");
	const [errors, setErrors] = useState<Partial<Record<RefuseField, string>>>(
		{}
	);
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [sending, setSending] = useState(false);
	const { fieldRef, focusFirst } = useFieldTargets<RefuseField>();

	const submit = async () => {
		const found: Partial<Record<RefuseField, string>> = {};
		const dateProblem = dayError(refusedOn, today);
		if (dateProblem) {
			found.refusedOn = dateProblem;
		}
		if (reason.trim().length > quoteLimits.refusalReason) {
			found.reason = `Use até ${quoteLimits.refusalReason} caracteres`;
		}
		setErrors(found);
		if (focusFirst(fieldOrder, found)) {
			return;
		}
		setFailure(null);
		setSending(true);
		const failed = await onRefuse(refusedOn, reason);
		setSending(false);
		if (failed) {
			setFailure(failed);
			return;
		}
		close();
	};

	return (
		<form
			className="flex flex-col gap-4"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<DialogTitle>Registrar recusa</DialogTitle>
			<DialogDescription>
				O orçamento vai para Recusados. Dá para desfazer depois, e emitir uma
				nova revisão também reabre.
			</DialogDescription>
			<QuoteField
				error={errors.refusedOn}
				label="Recusado em"
				name="refusedOn"
				requirement="required"
			>
				<Input
					aria-invalid={errors.refusedOn ? true : undefined}
					max={today}
					onChange={(event) => setRefusedOn(event.target.value)}
					ref={fieldRef("refusedOn")}
					type="date"
					value={refusedOn}
				/>
			</QuoteField>
			<QuoteField
				error={errors.reason}
				hint="Como Achou caro ou Fez em outro lugar."
				label="Motivo"
				name="reason"
				requirement="optional"
			>
				<Input
					aria-invalid={errors.reason ? true : undefined}
					maxLength={quoteLimits.refusalReason}
					onChange={(event) => setReason(event.target.value)}
					ref={fieldRef("reason")}
					value={reason}
				/>
			</QuoteField>
			<FailureAlert
				failure={failure}
				heading="Não foi possível registrar a recusa"
			/>
			<DialogActions>
				<DialogClose render={<Button type="button" variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button disabled={sending} type="submit" variant="destructive">
					Registrar recusa
				</Button>
			</DialogActions>
		</form>
	);
}

export function RefuseDialog({
	onOpenChange,
	onRefuse,
	open,
}: {
	onOpenChange: (open: boolean) => void;
	onRefuse: (
		refusedOn: string,
		reason: string
	) => Promise<ClientCommandFailure | null>;
	open: boolean;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				{open ? (
					<RefuseForm close={() => onOpenChange(false)} onRefuse={onRefuse} />
				) : null}
			</DialogContent>
		</Dialog>
	);
}

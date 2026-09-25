import { reconciliationLimits } from "@costura-pro/domain/reconciliation";
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
import { Text } from "@costura-pro/ui/components/typography";
import { type ComponentProps, useState } from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import { localDay } from "@/lib/measurements";
import { reverseReconciliationErrors } from "@/lib/reconciliation";
import type { ReconciliationView } from "@/lib/service-orders";
import {
	FailureAlert,
	QuoteField,
	useFieldTargets,
} from "@/quotes/quote-field";

import type { ReconciliationActions } from "./use-reconciliation-actions";

type DialogContentProps = ComponentProps<typeof DialogContent>;

type ReverseField = "date" | "reason";

const fieldOrder: readonly ReverseField[] = ["date", "reason"];

function ReverseForm({
	close,
	itemTitle,
	reconciliation,
	reverse,
}: {
	close: () => void;
	itemTitle: string;
	reconciliation: ReconciliationView;
	reverse: ReconciliationActions["reverse"];
}) {
	const [today] = useState(() => localDay(new Date()));
	const [occurredOn, setOccurredOn] = useState(today);
	const [reason, setReason] = useState("");
	const [checked, setChecked] = useState(false);
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [sending, setSending] = useState(false);
	const { fieldRef, focusFirst } = useFieldTargets<ReverseField>();
	const bounds = { reconciledOn: reconciliation.occurredOn, today };
	const errors = checked
		? reverseReconciliationErrors({ occurredOn, reason }, bounds)
		: null;

	const submit = async () => {
		const found = reverseReconciliationErrors({ occurredOn, reason }, bounds);
		setChecked(true);
		if (
			focusFirst(fieldOrder, {
				date: found.date ?? undefined,
				reason: found.reason ?? undefined,
			})
		) {
			return;
		}
		setFailure(null);
		setSending(true);
		const failed = await reverse(reconciliation, { occurredOn, reason });
		setSending(false);
		if (failed) {
			setFailure(failed);
			return;
		}
		close();
	};

	const sendLabel = sending ? "Estornando..." : "Estornar reconciliação";

	return (
		<form
			className="flex flex-col gap-4"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<DialogTitle>Estornar reconciliação</DialogTitle>
			<Text size="sm" weight="semibold">
				{itemTitle}
			</Text>
			<DialogDescription>
				Os materiais voltam ao estoque pelo mesmo valor e a peça sai de Pronto.
			</DialogDescription>
			<QuoteField
				error={errors?.date ?? undefined}
				label="Data"
				name="occurredOn"
				requirement="required"
			>
				<Input
					aria-invalid={errors?.date ? true : undefined}
					max={today}
					min={reconciliation.occurredOn}
					onChange={(event) => setOccurredOn(event.target.value)}
					ref={fieldRef("date")}
					type="date"
					value={occurredOn}
				/>
			</QuoteField>
			<QuoteField
				error={errors?.reason ?? undefined}
				label="Motivo"
				name="reason"
				requirement="required"
			>
				<Input
					aria-invalid={errors?.reason ? true : undefined}
					maxLength={reconciliationLimits.reason.max}
					onChange={(event) => setReason(event.target.value)}
					ref={fieldRef("reason")}
					value={reason}
				/>
			</QuoteField>
			<FailureAlert failure={failure} heading="Não foi possível estornar" />
			<DialogActions>
				<DialogClose render={<Button type="button" variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button disabled={sending} type="submit" variant="destructive">
					{sendLabel}
				</Button>
			</DialogActions>
		</form>
	);
}

export function ReverseReconciliationDialog({
	actions,
	finalFocus,
	itemTitle,
	onOpenChange,
	open,
	reconciliation,
}: {
	actions: ReconciliationActions;
	finalFocus?: DialogContentProps["finalFocus"];
	itemTitle: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	reconciliation: ReconciliationView | null;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent finalFocus={finalFocus}>
				{open && reconciliation ? (
					<ReverseForm
						close={() => onOpenChange(false)}
						itemTitle={itemTitle}
						key={reconciliation.id}
						reconciliation={reconciliation}
						reverse={actions.reverse}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

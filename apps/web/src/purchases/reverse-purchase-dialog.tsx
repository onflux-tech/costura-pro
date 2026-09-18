import { purchaseLimits } from "@costura-pro/domain/purchase";
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
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { localDay } from "@/lib/measurements";
import { dateError } from "@/lib/stock";
import { useOpId } from "@/lib/use-op-id";
import { client as api } from "@/utils/orpc";

import { failedPurchaseCommand, refreshPurchases } from "./purchase-queries";

export function ReversePurchaseDialog({
	itemCount,
	onOpenChange,
	open,
	paid,
	purchaseId,
}: {
	itemCount: number;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	paid: boolean;
	purchaseId: string;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<ReversePurchaseForm
					close={() => onOpenChange(false)}
					itemCount={itemCount}
					key={purchaseId}
					paid={paid}
					purchaseId={purchaseId}
				/>
			</DialogContent>
		</Dialog>
	);
}

function ReversePurchaseForm({
	close,
	itemCount,
	paid,
	purchaseId,
}: {
	close: () => void;
	itemCount: number;
	paid: boolean;
	purchaseId: string;
}) {
	const queryClient = useQueryClient();
	const { opIdFor } = useOpId();
	const [ids] = useState(() => ({
		movementIds: Array.from({ length: itemCount }, () => crypto.randomUUID()),
		paymentReversalId: crypto.randomUUID(),
		reversalId: crypto.randomUUID(),
	}));
	const [reason, setReason] = useState("");
	const [occurredOn, setOccurredOn] = useState(() => localDay(new Date()));
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [failure, setFailure] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const submit = async () => {
		const trimmed = reason.trim();
		const invalidDate = dateError(occurredOn);
		const found: Record<string, string> = {
			...(trimmed === ""
				? { reason: "Diga por que a compra é estornada" }
				: {}),
			...(trimmed.length > purchaseLimits.reason.max
				? { reason: `Use até ${purchaseLimits.reason.max} caracteres` }
				: {}),
			...(invalidDate ? { occurredOn: invalidDate } : {}),
		};
		setErrors(found);
		if (Object.keys(found).length > 0) {
			return;
		}
		setFailure(null);
		setSubmitting(true);
		try {
			const fields = { occurredOn, purchaseId, reason: trimmed };
			await api.purchases.reverse({
				...fields,
				...ids,
				opId: opIdFor(JSON.stringify(fields)),
			});
		} catch (error) {
			const failed = await failedPurchaseCommand(queryClient, error);
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
		await refreshPurchases(queryClient);
		toast.success("Compra estornada.");
		close();
	};

	const label = submitting ? "Estornando..." : "Estornar compra";

	return (
		<form
			className="flex flex-col gap-4"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<DialogTitle>Estornar compra</DialogTitle>
			<DialogDescription>
				{paid
					? "Os itens saem do estoque pelo valor de entrada, o pagamento volta para a conta e a obrigação é cancelada. A compra continua no histórico, marcada como estornada."
					: "Os itens saem do estoque pelo valor de entrada e a obrigação é cancelada. A compra continua no histórico, marcada como estornada."}
			</DialogDescription>
			<Field invalid={Boolean(errors.reason)} name="reason">
				<FieldLabel requirement="required">Motivo</FieldLabel>
				<Input
					aria-invalid={Boolean(errors.reason) || undefined}
					maxLength={purchaseLimits.reason.max}
					onChange={(event) => setReason(event.target.value)}
					value={reason}
				/>
				{errors.reason ? <FieldError match>{errors.reason}</FieldError> : null}
			</Field>
			<Field invalid={Boolean(errors.occurredOn)} name="occurredOn">
				<FieldLabel requirement="required">Data do estorno</FieldLabel>
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
					<AlertTitle>Não foi possível estornar a compra</AlertTitle>
					<AlertDescription>{failure}</AlertDescription>
				</Alert>
			) : null}
			<DialogActions>
				<DialogClose render={<Button variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button disabled={submitting} type="submit" variant="destructive">
					{label}
				</Button>
			</DialogActions>
		</form>
	);
}

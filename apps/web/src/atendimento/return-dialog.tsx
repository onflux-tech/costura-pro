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
import { useRef, useState } from "react";

import {
	type ReceivedItemView,
	receivedItemDateErrors,
} from "@/lib/received-items";

export function ReturnDialog({
	item,
	onConfirm,
	onOpenChange,
	open,
	pending,
	today,
}: {
	item: ReceivedItemView;
	onConfirm: (returnedOn: string) => Promise<void>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	pending: boolean;
	today: string;
}) {
	const [returnedOn, setReturnedOn] = useState(today);
	const [error, setError] = useState<string | null>(null);
	const input = useRef<HTMLInputElement>(null);
	const confirm = async () => {
		const found = receivedItemDateErrors(
			{ expectedReturnOn: "", receivedOn: item.receivedOn, returnedOn },
			today
		).returnedOn;
		setError(found ?? null);
		if (found) {
			input.current?.focus();
			return;
		}
		await onConfirm(returnedOn);
	};
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogTitle>Registrar devolução</DialogTitle>
				<DialogDescription>{`A peça "${item.description}" sai das peças em custódia.`}</DialogDescription>
				<Field invalid={error !== null} name="returnedOn">
					<FieldLabel requirement="required">Devolvida em</FieldLabel>
					<Input
						max={today}
						min={item.receivedOn}
						onChange={(event) => setReturnedOn(event.target.value)}
						ref={input}
						type="date"
						value={returnedOn}
					/>
					{error ? <FieldError match>{error}</FieldError> : null}
				</Field>
				<DialogActions>
					<DialogClose render={<Button variant="outline" />}>
						Cancelar
					</DialogClose>
					<Button disabled={pending} onClick={confirm}>
						Registrar devolução
					</Button>
				</DialogActions>
			</DialogContent>
		</Dialog>
	);
}

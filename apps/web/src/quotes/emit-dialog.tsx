import { addDays, quoteLimits } from "@costura-pro/domain/quote";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import { Checkbox } from "@costura-pro/ui/components/checkbox";
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
import { useState } from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import { moneyLabel } from "@/lib/finance";
import { formatDay, localDay } from "@/lib/measurements";
import { dayError } from "@/lib/quote-drafts";
import type { EmissionWarning } from "@/lib/quotes";

import { FailureAlert, QuoteField, useFieldTargets } from "./quote-field";

type EmitField = "emittedOn" | "reason";

const fieldOrder: readonly EmitField[] = ["emittedOn", "reason"];

const warningTexts: Record<
	EmissionWarning,
	{ confirm: string; description: string; heading: string }
> = {
	belowCost: {
		confirm: "Emitir abaixo do custo",
		description:
			"O total ao cliente não cobre o custo estimado. Cada venda nesse valor sai no prejuízo.",
		heading: "Abaixo do custo",
	},
	belowTarget: {
		confirm: "Emitir abaixo da meta de margem",
		description:
			"O total ao cliente fica abaixo do preço sugerido pela meta de margem do ateliê.",
		heading: "Abaixo da meta de margem",
	},
	incomplete: {
		confirm: "Emitir sem o custo completo",
		description:
			"Algum item está sem custo, então a margem desta revisão não pode ser conferida.",
		heading: "Custo incompleto",
	},
};

function EmitForm({
	close,
	number,
	onEmit,
	refused,
	totalCents,
	validityDays,
	warnings,
}: {
	close: () => void;
	number: number;
	onEmit: (
		emittedOn: string,
		reason: string
	) => Promise<ClientCommandFailure | null>;
	refused: boolean;
	totalCents: bigint;
	validityDays: number;
	warnings: readonly EmissionWarning[];
}) {
	const [today] = useState(() => localDay(new Date()));
	const [emittedOn, setEmittedOn] = useState(today);
	const [reason, setReason] = useState("");
	const [confirmed, setConfirmed] = useState<ReadonlySet<EmissionWarning>>(
		() => new Set()
	);
	const [errors, setErrors] = useState<Partial<Record<EmitField, string>>>({});
	const [unconfirmed, setUnconfirmed] = useState(false);
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [sending, setSending] = useState(false);
	const { fieldRef, focusFirst } = useFieldTargets<EmitField>();
	const dateProblem = dayError(emittedOn, today);

	const toggle = (warning: EmissionWarning, checked: boolean) => {
		setConfirmed((current) => {
			const next = new Set(current);
			if (checked) {
				next.add(warning);
			} else {
				next.delete(warning);
			}
			return next;
		});
	};

	const submit = async () => {
		const found: Partial<Record<EmitField, string>> = {};
		if (dateProblem) {
			found.emittedOn = dateProblem;
		}
		if (reason.trim().length > quoteLimits.revisionReason) {
			found.reason = `Use até ${quoteLimits.revisionReason} caracteres`;
		}
		setErrors(found);
		if (focusFirst(fieldOrder, found)) {
			return;
		}
		const missing = warnings.some((warning) => !confirmed.has(warning));
		setUnconfirmed(missing);
		if (missing) {
			return;
		}
		setFailure(null);
		setSending(true);
		const failed = await onEmit(emittedOn, reason);
		setSending(false);
		if (failed) {
			setFailure(failed);
			return;
		}
		close();
	};

	const sendLabel = sending ? "Emitindo..." : "Emitir";

	return (
		<form
			className="flex flex-col gap-4"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<DialogTitle>{`Emitir revisão ${number}`}</DialogTitle>
			<DialogDescription>
				A revisão emitida fica congelada. Mudanças depois dela preparam a
				próxima revisão.
			</DialogDescription>
			{refused ? (
				<Text tone="subtle">Emitir reabre o orçamento recusado.</Text>
			) : null}
			<Text weight="semibold">{`Total ao cliente ${moneyLabel(totalCents)}`}</Text>
			<QuoteField
				error={errors.emittedOn}
				hint={
					dateProblem
						? undefined
						: `Válida até ${formatDay(addDays(emittedOn, validityDays))}.`
				}
				label="Emitida em"
				name="emittedOn"
				requirement="required"
			>
				<Input
					aria-invalid={errors.emittedOn ? true : undefined}
					max={today}
					onChange={(event) => setEmittedOn(event.target.value)}
					ref={fieldRef("emittedOn")}
					type="date"
					value={emittedOn}
				/>
			</QuoteField>
			{number > 1 ? (
				<QuoteField
					error={errors.reason}
					hint="Como Cliente pediu desconto ou Tirou a barra."
					label="Motivo da revisão"
					name="reason"
					requirement="optional"
				>
					<Input
						aria-invalid={errors.reason ? true : undefined}
						maxLength={quoteLimits.revisionReason}
						onChange={(event) => setReason(event.target.value)}
						ref={fieldRef("reason")}
						value={reason}
					/>
				</QuoteField>
			) : null}
			{warnings.map((warning) => (
				<Alert
					key={warning}
					tone={warning === "belowCost" ? "danger" : "warning"}
				>
					<AlertTitle>{warningTexts[warning].heading}</AlertTitle>
					<AlertDescription>
						{warningTexts[warning].description}
					</AlertDescription>
					<Checkbox
						checked={confirmed.has(warning)}
						onCheckedChange={(checked) => toggle(warning, checked)}
					>
						{warningTexts[warning].confirm}
					</Checkbox>
				</Alert>
			))}
			{unconfirmed ? (
				<Text role="alert" tone="danger">
					Confirme cada aviso para emitir.
				</Text>
			) : null}
			<FailureAlert failure={failure} heading="Não foi possível emitir" />
			<DialogActions>
				<DialogClose render={<Button type="button" variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button disabled={sending} type="submit">
					{sendLabel}
				</Button>
			</DialogActions>
		</form>
	);
}

export function EmitDialog({
	number,
	onEmit,
	onOpenChange,
	open,
	refused,
	totalCents,
	validityDays,
	warnings,
}: {
	number: number;
	onEmit: (
		emittedOn: string,
		reason: string
	) => Promise<ClientCommandFailure | null>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	refused: boolean;
	totalCents: bigint;
	validityDays: number;
	warnings: readonly EmissionWarning[];
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				{open ? (
					<EmitForm
						close={() => onOpenChange(false)}
						number={number}
						onEmit={onEmit}
						refused={refused}
						totalCents={totalCents}
						validityDays={validityDays}
						warnings={warnings}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

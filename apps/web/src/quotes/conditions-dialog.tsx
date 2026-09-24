import { addDays, quoteLimits } from "@costura-pro/domain/quote";
import { Button } from "@costura-pro/ui/components/button";
import {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogTitle,
} from "@costura-pro/ui/components/dialog";
import { NumberField } from "@costura-pro/ui/components/number-field";
import { Textarea } from "@costura-pro/ui/components/textarea";
import { useState } from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import { moneyLabel } from "@/lib/finance";
import { formatDay, localDay } from "@/lib/measurements";
import {
	type ConditionsDraft,
	conditionsDraftOf,
	conditionsErrors,
} from "@/lib/quote-drafts";
import type { QuoteContentView } from "@/lib/quotes";

import { DiscountFields } from "./discount-fields";
import { FailureAlert, QuoteField, useFieldTargets } from "./quote-field";

type ConditionsField =
	| "discount"
	| "leadTime"
	| "notes"
	| "reason"
	| "validity";

const fieldOrder: readonly ConditionsField[] = [
	"validity",
	"leadTime",
	"discount",
	"reason",
	"notes",
];

const wholeDays = /^\d{1,3}$/;

function validityHint(validity: string): string {
	const text = validity.trim();
	const days = wholeDays.test(text) ? Number(text) : 0;
	if (
		days < quoteLimits.validityDays.min ||
		days > quoteLimits.validityDays.max
	) {
		return "Conta a partir da emissão.";
	}
	return `Se emitir hoje, vale até ${formatDay(addDays(localDay(new Date()), days))}.`;
}

function ConditionsForm({
	close,
	content,
	onSave,
	subtotalCents,
}: {
	close: () => void;
	content: QuoteContentView;
	onSave: (draft: ConditionsDraft) => Promise<ClientCommandFailure | null>;
	subtotalCents: bigint;
}) {
	const [draft, setDraft] = useState(() => conditionsDraftOf(content));
	const [errors, setErrors] = useState<
		Partial<Record<ConditionsField, string>>
	>({});
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [saving, setSaving] = useState(false);
	const { fieldRef, focusFirst } = useFieldTargets<ConditionsField>();

	const submit = async () => {
		const found = conditionsErrors(draft, subtotalCents);
		setErrors(found);
		if (focusFirst(fieldOrder, found)) {
			return;
		}
		setFailure(null);
		setSaving(true);
		const failed = await onSave(draft);
		setSaving(false);
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
			<DialogTitle>Condições do orçamento</DialogTitle>
			<div className="grid gap-4 sm:grid-cols-2">
				<QuoteField
					error={errors.validity}
					hint={validityHint(draft.validity)}
					label="Validade"
					name="validity"
					requirement="required"
				>
					<NumberField
						aria-invalid={errors.validity ? true : undefined}
						inputMode="numeric"
						maxLength={3}
						onChange={(event) =>
							setDraft({ ...draft, validity: event.target.value })
						}
						ref={fieldRef("validity")}
						suffix="dias"
						value={draft.validity}
					/>
				</QuoteField>
				<QuoteField
					error={errors.leadTime}
					hint="Conta a partir da aprovação."
					label="Prazo de entrega"
					name="leadTime"
					requirement="optional"
				>
					<NumberField
						aria-invalid={errors.leadTime ? true : undefined}
						inputMode="numeric"
						maxLength={3}
						onChange={(event) =>
							setDraft({ ...draft, leadTime: event.target.value })
						}
						ref={fieldRef("leadTime")}
						suffix="dias"
						value={draft.leadTime}
					/>
				</QuoteField>
			</div>
			<DiscountFields
				draft={draft.discount}
				errors={errors}
				fieldRef={fieldRef}
				legend={`Desconto no orçamento (subtotal ${moneyLabel(subtotalCents)})`}
				onChange={(discount) => setDraft({ ...draft, discount })}
			/>
			<QuoteField
				error={errors.notes}
				hint="Saem no orçamento para o cliente."
				label="Observações"
				name="notes"
				requirement="optional"
			>
				<Textarea
					aria-invalid={errors.notes ? true : undefined}
					maxLength={quoteLimits.notes}
					onChange={(event) =>
						setDraft({ ...draft, notes: event.target.value })
					}
					ref={fieldRef("notes")}
					value={draft.notes}
				/>
			</QuoteField>
			<FailureAlert
				failure={failure}
				heading="Não foi possível salvar as condições"
			/>
			<DialogActions>
				<DialogClose render={<Button type="button" variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button disabled={saving} type="submit">
					Salvar condições
				</Button>
			</DialogActions>
		</form>
	);
}

export function ConditionsDialog({
	content,
	onOpenChange,
	onSave,
	open,
	subtotalCents,
}: {
	content: QuoteContentView;
	onOpenChange: (open: boolean) => void;
	onSave: (draft: ConditionsDraft) => Promise<ClientCommandFailure | null>;
	open: boolean;
	subtotalCents: bigint;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				{open ? (
					<ConditionsForm
						close={() => onOpenChange(false)}
						content={content}
						onSave={onSave}
						subtotalCents={subtotalCents}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

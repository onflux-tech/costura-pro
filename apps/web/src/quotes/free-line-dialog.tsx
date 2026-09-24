import { quoteLimits } from "@costura-pro/domain/quote";
import { Button } from "@costura-pro/ui/components/button";
import {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogTitle,
} from "@costura-pro/ui/components/dialog";
import { Input } from "@costura-pro/ui/components/input";
import { NumberField } from "@costura-pro/ui/components/number-field";
import { useState } from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import {
	emptyFreeLine,
	type FreeLineDraft,
	freeLineDraftOf,
	freeLineErrors,
	freeLineOf,
	type LineErrors,
	type LineField,
} from "@/lib/quote-drafts";
import type { FreeLineView, QuoteLineView } from "@/lib/quotes";

import { DiscountFields } from "./discount-fields";
import { FailureAlert, QuoteField, useFieldTargets } from "./quote-field";

const fieldOrder: readonly LineField[] = [
	"description",
	"quantity",
	"cost",
	"price",
	"discount",
	"reason",
	"note",
];

function FreeLineForm({
	close,
	line,
	onSave,
}: {
	close: () => void;
	line: FreeLineView | null;
	onSave: (line: QuoteLineView) => Promise<ClientCommandFailure | null>;
}) {
	const [lineId] = useState(() => line?.id ?? crypto.randomUUID());
	const [draft, setDraft] = useState<FreeLineDraft>(() =>
		line ? freeLineDraftOf(line) : emptyFreeLine
	);
	const [errors, setErrors] = useState<LineErrors>({});
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [saving, setSaving] = useState(false);
	const { fieldRef, focusFirst } = useFieldTargets<LineField>();

	const submit = async () => {
		const found = freeLineErrors(draft);
		setErrors(found);
		if (focusFirst(fieldOrder, found)) {
			return;
		}
		setFailure(null);
		setSaving(true);
		const failed = await onSave(freeLineOf(draft, lineId));
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
			<DialogTitle>
				{line ? "Editar linha livre" : "Acrescentar linha livre"}
			</DialogTitle>
			<QuoteField
				error={errors.description}
				hint="Como Taxa de urgência ou Entrega."
				label="Descrição"
				name="description"
				requirement="required"
			>
				<Input
					aria-invalid={errors.description ? true : undefined}
					maxLength={quoteLimits.description.max}
					onChange={(event) =>
						setDraft({ ...draft, description: event.target.value })
					}
					ref={fieldRef("description")}
					value={draft.description}
				/>
			</QuoteField>
			<div className="grid gap-4 sm:grid-cols-3">
				<QuoteField
					error={errors.quantity}
					label="Quantidade"
					name="quantity"
					requirement="required"
				>
					<NumberField
						aria-invalid={errors.quantity ? true : undefined}
						inputMode="numeric"
						maxLength={4}
						onChange={(event) =>
							setDraft({ ...draft, quantity: event.target.value })
						}
						ref={fieldRef("quantity")}
						suffix="un"
						value={draft.quantity}
					/>
				</QuoteField>
				<QuoteField
					error={errors.cost}
					hint="Vazio deixa o custo incompleto; use 0 para cobrança sem custo."
					label="Custo por unidade"
					name="cost"
					requirement="optional"
				>
					<NumberField
						aria-invalid={errors.cost ? true : undefined}
						maxLength={20}
						onChange={(event) =>
							setDraft({ ...draft, cost: event.target.value })
						}
						ref={fieldRef("cost")}
						suffix="R$"
						value={draft.cost}
					/>
				</QuoteField>
				<QuoteField
					error={errors.price}
					label="Preço por unidade"
					name="price"
					requirement="required"
				>
					<NumberField
						aria-invalid={errors.price ? true : undefined}
						maxLength={20}
						onChange={(event) =>
							setDraft({ ...draft, price: event.target.value })
						}
						ref={fieldRef("price")}
						suffix="R$"
						value={draft.price}
					/>
				</QuoteField>
			</div>
			<DiscountFields
				draft={draft.discount}
				errors={errors}
				fieldRef={fieldRef}
				onChange={(discount) => setDraft({ ...draft, discount })}
			/>
			<QuoteField
				error={errors.note}
				label="Observação"
				name="note"
				requirement="optional"
			>
				<Input
					aria-invalid={errors.note ? true : undefined}
					maxLength={quoteLimits.lineNote}
					onChange={(event) => setDraft({ ...draft, note: event.target.value })}
					ref={fieldRef("note")}
					value={draft.note}
				/>
			</QuoteField>
			<FailureAlert
				failure={failure}
				heading="Não foi possível salvar o item"
			/>
			<DialogActions>
				<DialogClose render={<Button type="button" variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button disabled={saving} type="submit">
					Salvar item
				</Button>
			</DialogActions>
		</form>
	);
}

export function FreeLineDialog({
	line,
	onOpenChange,
	onSave,
	open,
}: {
	line: FreeLineView | null;
	onOpenChange: (open: boolean) => void;
	onSave: (line: QuoteLineView) => Promise<ClientCommandFailure | null>;
	open: boolean;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				{open ? (
					<FreeLineForm
						close={() => onOpenChange(false)}
						key={line?.id ?? "nova"}
						line={line}
						onSave={onSave}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

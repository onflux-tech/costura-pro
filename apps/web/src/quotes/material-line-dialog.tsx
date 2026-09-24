import { formatMoneyInput, parseMoney } from "@costura-pro/domain/money";
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
import { NumberField } from "@costura-pro/ui/components/number-field";
import { Text } from "@costura-pro/ui/components/typography";
import { useState } from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import { unitAbbreviation } from "@/lib/materials";
import { pricingPreview } from "@/lib/pricing";
import {
	type LineErrors,
	type LineField,
	type MaterialLineDraft,
	materialLineDraft,
	materialLineDraftOf,
	materialLineErrors,
	materialLineOf,
} from "@/lib/quote-drafts";
import type { MaterialLineView, QuoteLineView } from "@/lib/quotes";
import { VariantPicker } from "@/materials/variant-picker";
import { PricingPanel } from "@/pricing/pricing-panel";

import { DiscountFields } from "./discount-fields";
import { FailureAlert, QuoteField, useFieldTargets } from "./quote-field";

const fieldOrder: readonly LineField[] = [
	"quantity",
	"cost",
	"price",
	"discount",
	"reason",
	"note",
];

function MaterialLineForm({
	atelierTarget,
	close,
	line,
	onSave,
}: {
	atelierTarget: number | null;
	close: () => void;
	line: MaterialLineView | null;
	onSave: (line: QuoteLineView) => Promise<ClientCommandFailure | null>;
}) {
	const [lineId] = useState(() => line?.id ?? crypto.randomUUID());
	const [draft, setDraft] = useState<MaterialLineDraft | null>(() =>
		line ? materialLineDraftOf(line) : null
	);
	const [errors, setErrors] = useState<LineErrors>({});
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [saving, setSaving] = useState(false);
	const { fieldRef, focusFirst } = useFieldTargets<LineField>();
	const heading = line ? "Editar material" : "Acrescentar material";

	if (!draft) {
		return (
			<div className="flex flex-col gap-4">
				<DialogTitle>{heading}</DialogTitle>
				<DialogDescription>
					Escolha a variante do material. A unidade e o custo de referência vêm
					dela.
				</DialogDescription>
				<VariantPicker
					emptyHint="Nenhuma variante encontrada. Cadastre o material em Catálogo."
					onPick={(option) => setDraft(materialLineDraft(option))}
				/>
				<DialogActions>
					<Button onClick={close} type="button" variant="outline">
						Cancelar
					</Button>
				</DialogActions>
			</div>
		);
	}

	const unit = unitAbbreviation(draft.material.baseUnit);
	const cost = draft.cost.trim() === "" ? null : parseMoney(draft.cost);
	const price = parseMoney(draft.price);
	const preview =
		atelierTarget === null || cost === null
			? null
			: pricingPreview(
					{
						costCents: String(cost),
						priceCents: price === null ? null : String(price),
						targetMarginBasisPoints: null,
					},
					atelierTarget
				);

	const submit = async () => {
		const found = materialLineErrors(draft);
		setErrors(found);
		if (focusFirst(fieldOrder, found)) {
			return;
		}
		setFailure(null);
		setSaving(true);
		const failed = await onSave(materialLineOf(draft, lineId));
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
			<DialogTitle>{heading}</DialogTitle>
			<div className="flex flex-col gap-0.5">
				<Text weight="semibold">
					{`${draft.material.materialName} · ${draft.material.variantName}`}
				</Text>
				{draft.material.code ? (
					<Text size="xs" tone="subtle">
						{draft.material.code}
					</Text>
				) : null}
			</div>
			<div className="grid gap-4 sm:grid-cols-3">
				<QuoteField
					error={errors.quantity}
					label="Quantidade"
					name="quantity"
					requirement="required"
				>
					<NumberField
						aria-invalid={errors.quantity ? true : undefined}
						maxLength={20}
						onChange={(event) =>
							setDraft({ ...draft, quantity: event.target.value })
						}
						ref={fieldRef("quantity")}
						suffix={unit}
						value={draft.quantity}
					/>
				</QuoteField>
				<QuoteField
					error={errors.cost}
					hint="Vazio deixa o custo do orçamento incompleto."
					label={`Custo por ${unit}`}
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
					label={`Preço por ${unit}`}
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
			<PricingPanel
				hint="Informe o custo para ver o preço sugerido."
				onUseSuggestion={() => {
					if (preview) {
						setDraft({
							...draft,
							price: formatMoneyInput(preview.suggestedCents),
						});
					}
				}}
				preview={preview}
				suggestionApplied={preview !== null && price === preview.suggestedCents}
			/>
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

export function MaterialLineDialog({
	atelierTarget,
	line,
	onOpenChange,
	onSave,
	open,
}: {
	atelierTarget: number | null;
	line: MaterialLineView | null;
	onOpenChange: (open: boolean) => void;
	onSave: (line: QuoteLineView) => Promise<ClientCommandFailure | null>;
	open: boolean;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				{open ? (
					<MaterialLineForm
						atelierTarget={atelierTarget}
						close={() => onOpenChange(false)}
						key={line?.id ?? "novo"}
						line={line}
						onSave={onSave}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

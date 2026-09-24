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
import { Select } from "@costura-pro/ui/components/select";
import { Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import { moneyLabel } from "@/lib/finance";
import { pricingPreview } from "@/lib/pricing";
import {
	type LineErrors,
	type LineField,
	type ServiceLineDraft,
	serviceCopyOf,
	serviceLineDraft,
	serviceLineDraftOf,
	serviceLineErrors,
	serviceLineOf,
} from "@/lib/quote-drafts";
import type { QuoteLineView, ServiceLineView } from "@/lib/quotes";
import { PricingPanel } from "@/pricing/pricing-panel";
import { ServicePicker } from "@/products/service-picker";
import { serviceQuery } from "@/services/service-queries";

import { DiscountFields } from "./discount-fields";
import { FailureAlert, QuoteField, useFieldTargets } from "./quote-field";
import type { PersonChoice, PersonChoices } from "./use-people";

const noneValue = "-";

const fieldOrder: readonly LineField[] = [
	"quantity",
	"price",
	"discount",
	"reason",
	"note",
];

function choiceOptions(
	entries: readonly PersonChoice[],
	selected: string | null,
	noneLabel: string
) {
	return [
		{ label: noneLabel, value: noneValue },
		...entries
			.filter((entry) => entry.active || entry.id === selected)
			.map((entry) => ({ label: entry.label, value: entry.id })),
	];
}

function chosen(value: string): string | null {
	return value === noneValue ? null : value;
}

function ServiceLineForm({
	atelierTarget,
	choices,
	close,
	line,
	onSave,
}: {
	atelierTarget: number | null;
	choices: PersonChoices;
	close: () => void;
	line: ServiceLineView | null;
	onSave: (line: QuoteLineView) => Promise<ClientCommandFailure | null>;
}) {
	const [lineId] = useState(() => line?.id ?? crypto.randomUUID());
	const [draft, setDraft] = useState<ServiceLineDraft | null>(() =>
		line ? serviceLineDraftOf(line) : null
	);
	const [errors, setErrors] = useState<LineErrors>({});
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [saving, setSaving] = useState(false);
	const { fieldRef, focusFirst } = useFieldTargets<LineField>();
	const service = useQuery({
		...serviceQuery(draft?.service.serviceId ?? ""),
		enabled: draft !== null,
	});
	const heading = line ? "Editar serviço" : "Acrescentar serviço";

	if (!draft) {
		return (
			<div className="flex flex-col gap-4">
				<DialogTitle>{heading}</DialogTitle>
				<DialogDescription>
					Escolha o serviço. O preço de catálogo e o custo vêm dele e ficam
					copiados no orçamento.
				</DialogDescription>
				<ServicePicker
					onPick={(picked) => setDraft(serviceLineDraft(serviceCopyOf(picked)))}
				/>
				<DialogActions>
					<Button onClick={close} type="button" variant="outline">
						Cancelar
					</Button>
				</DialogActions>
			</div>
		);
	}

	const price = parseMoney(draft.price);
	const preview =
		atelierTarget === null
			? null
			: pricingPreview(
					{
						costCents: draft.service.unitCostCents,
						priceCents: price === null ? null : String(price),
						targetMarginBasisPoints:
							service.data?.targetMarginBasisPoints ?? null,
					},
					atelierTarget
				);

	const submit = async () => {
		const found = serviceLineErrors(draft);
		setErrors(found);
		if (focusFirst(fieldOrder, found)) {
			return;
		}
		setFailure(null);
		setSaving(true);
		const failed = await onSave(serviceLineOf(draft, lineId));
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
				<Text weight="semibold">{draft.service.name}</Text>
				<Text size="xs" tone="subtle">
					{`Catálogo ${moneyLabel(draft.service.catalogPriceCents)} · custo ${moneyLabel(draft.service.unitCostCents)}${draft.service.outsourced ? " · terceirizado" : ""}`}
				</Text>
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
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
					error={errors.price}
					hint="Por unidade, antes do desconto."
					label="Preço"
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
				hint="Carregando a meta de margem."
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
			<div className="grid gap-4 sm:grid-cols-2">
				<QuoteField
					error={undefined}
					label="Para quem"
					name="profileId"
					requirement="optional"
				>
					<Select
						items={choiceOptions(
							choices.profiles,
							draft.profileId,
							"Ninguém em especial"
						)}
						onValueChange={(value) =>
							setDraft({ ...draft, profileId: chosen(value) })
						}
						value={draft.profileId ?? noneValue}
					/>
				</QuoteField>
				<QuoteField
					error={undefined}
					label="Peça recebida"
					name="receivedItemId"
					requirement="optional"
				>
					<Select
						items={choiceOptions(
							choices.receivedItems,
							draft.receivedItemId,
							"Nenhuma"
						)}
						onValueChange={(value) =>
							setDraft({ ...draft, receivedItemId: chosen(value) })
						}
						value={draft.receivedItemId ?? noneValue}
					/>
				</QuoteField>
			</div>
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

export function ServiceLineDialog({
	atelierTarget,
	choices,
	line,
	onOpenChange,
	onSave,
	open,
}: {
	atelierTarget: number | null;
	choices: PersonChoices;
	line: ServiceLineView | null;
	onOpenChange: (open: boolean) => void;
	onSave: (line: QuoteLineView) => Promise<ClientCommandFailure | null>;
	open: boolean;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				{open ? (
					<ServiceLineForm
						atelierTarget={atelierTarget}
						choices={choices}
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

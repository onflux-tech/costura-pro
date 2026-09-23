import { materialLimits } from "@costura-pro/domain/material";
import { stockLimits } from "@costura-pro/domain/stock";
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
import { NumberField } from "@costura-pro/ui/components/number-field";
import { Select } from "@costura-pro/ui/components/select";
import { Text } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { FieldMessage } from "@/components/field-message";

import { moneyLabel } from "@/lib/finance";
import { unitAbbreviation } from "@/lib/materials";
import {
	defaultPackaging,
	type ItemDraftField,
	itemDraftErrors,
	type PurchaseItemDraft,
	purchasePreview,
	type VariantOptionView,
} from "@/lib/purchases";
import { lotFormErrors, pointQuantity } from "@/lib/stock";
import { useOpId } from "@/lib/use-op-id";
import { VariantPicker } from "@/materials/variant-picker";
import {
	failedStockCommand,
	refreshStock,
	stockLocationsQuery,
	stockLotsQuery,
} from "@/stock/stock-queries";
import { client as api } from "@/utils/orpc";

export function PurchaseItemDialog({
	defaultLocationId,
	draft,
	onOpenChange,
	onSave,
	open,
}: {
	defaultLocationId: string;
	draft: PurchaseItemDraft | null;
	onOpenChange: (open: boolean) => void;
	onSave: (draft: PurchaseItemDraft) => void;
	open: boolean;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<PurchaseItemForm
					close={() => onOpenChange(false)}
					defaultLocationId={defaultLocationId}
					draft={draft}
					key={draft?.key ?? "novo"}
					onSave={onSave}
				/>
			</DialogContent>
		</Dialog>
	);
}

function NewLot({
	onCreated,
	variantId,
}: {
	onCreated: (lotId: string) => void;
	variantId: string;
}) {
	const queryClient = useQueryClient();
	const { opIdFor } = useOpId();
	const [lotId, setLotId] = useState(() => crypto.randomUUID());
	const [label, setLabel] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const create = async () => {
		const found = lotFormErrors({ label, notes: "" }).label;
		if (found) {
			setError(found);
			return;
		}
		setError(null);
		setBusy(true);
		try {
			const fields = { label: label.trim(), notes: null, variantId };
			await api.stockLots.create({
				...fields,
				lotId,
				opId: opIdFor(`${lotId}:${JSON.stringify(fields)}`),
			});
			await refreshStock(queryClient);
			onCreated(lotId);
			setLabel("");
			setLotId(crypto.randomUUID());
		} catch (caught) {
			const failed = await failedStockCommand(queryClient, caught, "lote");
			setError(failed.message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Field invalid={Boolean(error)} name="newLot">
			<FieldLabel requirement="optional">Novo lote</FieldLabel>
			<div className="flex gap-2">
				<Input
					aria-invalid={Boolean(error) || undefined}
					maxLength={stockLimits.lotLabel.max}
					onChange={(event) => setLabel(event.target.value)}
					placeholder="Rolo 3"
					value={label}
				/>
				<Button
					disabled={busy}
					onClick={create}
					type="button"
					variant="outline"
				>
					Criar lote
				</Button>
			</div>
			{error ? <FieldError match>{error}</FieldError> : null}
		</Field>
	);
}

function PurchaseItemForm({
	close,
	defaultLocationId,
	draft,
	onSave,
}: {
	close: () => void;
	defaultLocationId: string;
	draft: PurchaseItemDraft | null;
	onSave: (draft: PurchaseItemDraft) => void;
}) {
	const locations = useQuery(stockLocationsQuery());
	const [key] = useState(() => draft?.key ?? crypto.randomUUID());
	const [movementId] = useState(() => draft?.movementId ?? crypto.randomUUID());
	const [variant, setVariant] = useState<VariantOptionView | null>(
		draft?.variant ?? null
	);
	const [locationId, setLocationId] = useState(
		draft?.locationId ?? defaultLocationId
	);
	const [lotId, setLotId] = useState<string | null>(draft?.lotId ?? null);
	const [amounts, setAmounts] = useState<Amounts>({
		packageCount: draft?.packageCount ?? "",
		packagingLabel: draft?.packagingLabel ?? "",
		packagingQuantity: draft?.packagingQuantity ?? "",
		unitPrice: draft?.unitPrice ?? "",
	});
	const [errors, setErrors] = useState<Partial<Record<ItemDraftField, string>>>(
		{}
	);

	const pick = (next: VariantOptionView) => {
		const packaging = defaultPackaging(next);
		setVariant(next);
		setLotId(null);
		setAmounts((previous) => ({
			...previous,
			packagingLabel: packaging.label,
			packagingQuantity: packaging.quantity,
		}));
	};

	if (!variant) {
		return (
			<div className="flex flex-col gap-4">
				<DialogTitle>Adicionar item</DialogTitle>
				<DialogDescription>
					Escolha a variante que chegou nesta compra.
				</DialogDescription>
				<VariantPicker
					emptyHint="Nenhuma variante encontrada. Cadastre o material em Catálogo antes de lançar a compra."
					onPick={pick}
				/>
				<DialogActions>
					<DialogClose render={<Button variant="outline" />}>
						Cancelar
					</DialogClose>
				</DialogActions>
			</div>
		);
	}

	const current: PurchaseItemDraft = {
		...amounts,
		key,
		locationId,
		lotId,
		movementId,
		variant,
	};
	const locationItems = (locations.data?.items ?? []).map((location) => ({
		label: location.name,
		value: location.id,
	}));

	const submit = () => {
		const found = itemDraftErrors(current);
		setErrors(found);
		if (Object.keys(found).length > 0) {
			return;
		}
		onSave(current);
		close();
	};

	const saveLabel = draft ? "Salvar item" : "Incluir item";

	return (
		<form
			className="flex flex-col gap-4"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<DialogTitle>{draft ? "Editar item" : "Adicionar item"}</DialogTitle>
			<DialogDescription>
				{`${variant.materialName} · ${variant.name}`}
			</DialogDescription>
			<Button
				className="self-start"
				onClick={() => setVariant(null)}
				size="sm"
				type="button"
				variant="ghost"
			>
				Trocar variante
			</Button>
			<Field invalid={Boolean(errors.locationId)} name="locationId">
				<FieldLabel requirement="required">Local</FieldLabel>
				<Select
					items={locationItems}
					onValueChange={setLocationId}
					value={locationId}
				/>
				<FieldMessage message={errors.locationId} />
			</Field>
			{variant.tracksLots ? (
				<LotFields
					error={errors.lotId}
					lotId={lotId}
					onLotChange={setLotId}
					variantId={variant.id}
				/>
			) : null}
			<PackagingFields
				errors={errors}
				onChange={(field, next) =>
					setAmounts((previous) => ({ ...previous, [field]: next }))
				}
				unit={unitAbbreviation(variant.baseUnit)}
				values={amounts}
			/>
			<Text size="sm" tone="subtle">
				A embalagem vem da variante e pode mudar só nesta compra.
			</Text>
			<LinePreview draft={current} />
			<DialogActions>
				<DialogClose render={<Button variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button type="submit">{saveLabel}</Button>
			</DialogActions>
		</form>
	);
}

type Amounts = Pick<
	PurchaseItemDraft,
	"packageCount" | "packagingLabel" | "packagingQuantity" | "unitPrice"
>;

function LotFields({
	error,
	lotId,
	onLotChange,
	variantId,
}: {
	error: string | undefined;
	lotId: string | null;
	onLotChange: (lotId: string) => void;
	variantId: string;
}) {
	const lots = useQuery(stockLotsQuery(variantId));
	const lotItems = (lots.data?.items ?? []).map((lot) => ({
		label: lot.label,
		value: lot.id,
	}));
	return (
		<>
			<Field invalid={Boolean(error)} name="lotId">
				<FieldLabel requirement="required">Lote</FieldLabel>
				<Select
					items={lotItems}
					onValueChange={onLotChange}
					value={lotId ?? ""}
				/>
				<FieldMessage message={error} />
			</Field>
			<NewLot onCreated={onLotChange} variantId={variantId} />
		</>
	);
}

function PackagingFields({
	errors,
	onChange,
	unit,
	values,
}: {
	errors: Partial<Record<ItemDraftField, string>>;
	onChange: (field: keyof Amounts, next: string) => void;
	unit: string;
	values: Amounts;
}) {
	return (
		<div className="grid gap-4 md:grid-cols-2">
			<Field invalid={Boolean(errors.packagingLabel)} name="packagingLabel">
				<FieldLabel requirement="required">Embalagem</FieldLabel>
				<Input
					aria-invalid={Boolean(errors.packagingLabel) || undefined}
					maxLength={materialLimits.packagingLabel.max}
					onChange={(event) => onChange("packagingLabel", event.target.value)}
					value={values.packagingLabel}
				/>
				<FieldMessage message={errors.packagingLabel} />
			</Field>
			<Field
				invalid={Boolean(errors.packagingQuantity)}
				name="packagingQuantity"
			>
				<FieldLabel requirement="required">Cada embalagem tem</FieldLabel>
				<NumberField
					aria-invalid={Boolean(errors.packagingQuantity) || undefined}
					onChange={(event) =>
						onChange("packagingQuantity", event.target.value)
					}
					suffix={unit}
					value={values.packagingQuantity}
				/>
				<FieldMessage message={errors.packagingQuantity} />
			</Field>
			<Field invalid={Boolean(errors.packageCount)} name="packageCount">
				<FieldLabel requirement="required">Embalagens</FieldLabel>
				<NumberField
					aria-invalid={Boolean(errors.packageCount) || undefined}
					onChange={(event) => onChange("packageCount", event.target.value)}
					value={values.packageCount}
				/>
				<FieldMessage message={errors.packageCount} />
			</Field>
			<Field invalid={Boolean(errors.unitPrice)} name="unitPrice">
				<FieldLabel requirement="required">Preço por embalagem</FieldLabel>
				<NumberField
					aria-invalid={Boolean(errors.unitPrice) || undefined}
					onChange={(event) => onChange("unitPrice", event.target.value)}
					suffix="R$"
					value={values.unitPrice}
				/>
				<FieldMessage message={errors.unitPrice} />
			</Field>
		</div>
	);
}

function LinePreview({ draft }: { draft: PurchaseItemDraft }) {
	const preview = purchasePreview({
		discount: "",
		freight: "",
		items: [draft],
	});
	const line = preview?.ok ? preview.totals.lines[0] : undefined;
	if (!line) {
		return null;
	}
	return (
		<div
			aria-live="polite"
			className="flex flex-col gap-1 rounded-md bg-muted p-3"
		>
			<Text weight="semibold">
				{`Entra ${pointQuantity(line.quantityMicros.toString(), draft.variant.baseUnit, draft.variant.displayPrecision)}`}
			</Text>
			<Text size="sm" tone="subtle">
				{`Total da linha ${moneyLabel(line.grossCents)}, antes de frete e desconto.`}
			</Text>
		</div>
	);
}

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
import { NumberField } from "@costura-pro/ui/components/number-field";
import { Select } from "@costura-pro/ui/components/select";
import { Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { countError, type DraftPoint, expectedAt } from "@/lib/inventory";
import { unitAbbreviation } from "@/lib/materials";
import type { VariantOptionView } from "@/lib/purchases";
import { VariantPicker } from "@/materials/variant-picker";
import { NewLot } from "@/stock/new-lot-field";
import { stockLotsQuery, variantBalanceQuery } from "@/stock/stock-queries";

type Location = { id: string; name: string };

type OnAdd = (point: DraftPoint, text: string, expectedMicros: string) => void;

export function AddItemDialog({
	location,
	onAdd,
	onOpenChange,
	open,
}: {
	location: Location | null;
	onAdd: OnAdd;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				{location ? (
					<AddItemForm
						close={() => onOpenChange(false)}
						key={location.id}
						location={location}
						onAdd={onAdd}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function AddItemForm({
	close,
	location,
	onAdd,
}: {
	close: () => void;
	location: Location;
	onAdd: OnAdd;
}) {
	const [variant, setVariant] = useState<VariantOptionView | null>(null);

	if (!variant) {
		return (
			<div className="flex flex-col gap-4">
				<DialogTitle>Acrescentar item</DialogTitle>
				<DialogDescription>
					{`Escolha o que você achou em ${location.name}.`}
				</DialogDescription>
				<VariantPicker
					emptyHint="Nenhuma variante encontrada. Cadastre o material antes de contar."
					onPick={setVariant}
				/>
				<DialogActions>
					<DialogClose render={<Button variant="outline" />}>
						Cancelar
					</DialogClose>
				</DialogActions>
			</div>
		);
	}

	return (
		<CountedItemForm
			close={close}
			location={location}
			onAdd={onAdd}
			onChangeVariant={() => setVariant(null)}
			variant={variant}
		/>
	);
}

function pointOf(
	variant: VariantOptionView,
	location: Location,
	lotId: string | null,
	lotLabel: string | null
): DraftPoint {
	return {
		archived: false,
		baseUnit: variant.baseUnit,
		code: variant.code,
		displayPrecision: variant.displayPrecision,
		locationId: location.id,
		locationName: location.name,
		lotId,
		lotLabel,
		materialId: variant.materialId,
		materialName: variant.materialName,
		referenceCostCents: variant.referenceCostCents,
		tracksLots: variant.tracksLots,
		variantId: variant.id,
		variantName: variant.name,
	};
}

function countedErrors(
	text: string,
	variant: VariantOptionView,
	lotId: string | null
): Partial<Record<"count" | "lotId", string>> {
	const count = text.trim() === "" ? "Informe a contagem" : countError(text);
	return {
		...(count ? { count } : {}),
		...(variant.tracksLots && lotId === null
			? { lotId: "Escolha o lote" }
			: {}),
	};
}

function CountedItemForm({
	close,
	location,
	onAdd,
	onChangeVariant,
	variant,
}: {
	close: () => void;
	location: Location;
	onAdd: OnAdd;
	onChangeVariant: () => void;
	variant: VariantOptionView;
}) {
	const balance = useQuery(variantBalanceQuery(variant.id));
	const lots = useQuery({
		...stockLotsQuery(variant.id),
		enabled: variant.tracksLots,
	});
	const [lotId, setLotId] = useState<string | null>(null);
	const [text, setText] = useState("");
	const [errors, setErrors] = useState<
		Partial<Record<"count" | "lotId", string>>
	>({});
	const lotItems = (lots.data?.items ?? []).map((lot) => ({
		label: lot.label,
		value: lot.id,
	}));

	const fresh = balance.isSuccess && balance.isFetchedAfterMount;

	const submit = () => {
		const found = countedErrors(text, variant, lotId);
		setErrors(found);
		if (Object.keys(found).length > 0 || !fresh) {
			return;
		}
		const expected = expectedAt(balance.data.points, location.id, lotId);
		const lotLabel =
			lotItems.find((item) => item.value === lotId)?.label ?? null;
		onAdd(pointOf(variant, location, lotId, lotLabel), text, expected);
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
			<DialogTitle>Acrescentar item</DialogTitle>
			<DialogDescription>
				{`${variant.materialName} · ${variant.name} em ${location.name}`}
			</DialogDescription>
			<Button
				className="self-start"
				onClick={onChangeVariant}
				size="sm"
				type="button"
				variant="ghost"
			>
				Trocar variante
			</Button>
			{variant.tracksLots ? (
				<>
					<Field invalid={Boolean(errors.lotId)} name="lotId">
						<FieldLabel requirement="required">Lote</FieldLabel>
						<Select
							items={lotItems}
							onValueChange={setLotId}
							value={lotId ?? ""}
						/>
						{errors.lotId ? (
							<FieldError match>{errors.lotId}</FieldError>
						) : null}
					</Field>
					<NewLot onCreated={setLotId} variantId={variant.id} />
				</>
			) : null}
			<Field invalid={Boolean(errors.count)} name="count">
				<FieldLabel requirement="required">Contado</FieldLabel>
				<NumberField
					aria-invalid={Boolean(errors.count) || undefined}
					onChange={(event) => setText(event.target.value)}
					suffix={unitAbbreviation(variant.baseUnit)}
					value={text}
				/>
				{errors.count ? <FieldError match>{errors.count}</FieldError> : null}
			</Field>
			{balance.isError ? (
				<Text role="alert" tone="danger">
					Não foi possível ler o saldo desta variante. Tente de novo.
				</Text>
			) : null}
			<DialogActions>
				<DialogClose render={<Button variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button disabled={!fresh} type="submit">
					Acrescentar
				</Button>
			</DialogActions>
		</form>
	);
}

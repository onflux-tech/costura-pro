import { formatMoneyInput } from "@costura-pro/domain/money";
import { stockLimits } from "@costura-pro/domain/stock";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import {
	ChoiceChip,
	ChoiceChips,
} from "@costura-pro/ui/components/choice-chips";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { unitAbbreviation } from "@/lib/materials";
import {
	type AdjustmentFormValues,
	adjustmentFields,
	adjustmentFormErrors,
	type BalanceItemView,
	type Direction,
	type OpeningFormValues,
	openingFields,
	openingFormErrors,
	openingValueCents,
	type StockLocationView,
	type TransferFormValues,
	transferFields,
	transferFormErrors,
} from "@/lib/stock";
import { useOpId } from "@/lib/use-op-id";
import { client as api } from "@/utils/orpc";

import {
	failedStockCommand,
	refreshStock,
	stockLocationsQuery,
	stockLotsQuery,
} from "./stock-queries";

export type MovementAction = "adjustment" | "opening" | "transfer";

const titles: Record<MovementAction, string> = {
	adjustment: "Ajustar saldo",
	opening: "Lançar saldo de abertura",
	transfer: "Transferir entre locais",
};

const descriptions: Record<MovementAction, string> = {
	adjustment: "Correção pontual de saldo, com motivo obrigatório.",
	opening: "Quantidade que já existia no ateliê, sem ser compra.",
	transfer: "Move a quantidade de um local para outro.",
};

export function MovementDialog({
	action,
	onOpenChange,
	open,
	referenceCostCents,
	variant,
}: {
	action: MovementAction;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	referenceCostCents: string | null;
	variant: BalanceItemView;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<MovementForm
					action={action}
					close={() => onOpenChange(false)}
					key={`${variant.variantId}:${action}`}
					referenceCostCents={referenceCostCents}
					variant={variant}
				/>
			</DialogContent>
		</Dialog>
	);
}

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function locationItems(locations: readonly StockLocationView[]) {
	return locations.map((location) => ({
		label: location.name,
		value: location.id,
	}));
}

function SelectField({
	error,
	items,
	label,
	name,
	onValueChange,
	value,
}: {
	error: string | undefined;
	items: readonly { label: string; value: string }[];
	label: string;
	name: string;
	onValueChange: (next: string) => void;
	value: string;
}) {
	return (
		<Field invalid={Boolean(error)} name={name}>
			<FieldLabel requirement="required">{label}</FieldLabel>
			<Select items={items} onValueChange={onValueChange} value={value} />
			{error ? <FieldError match>{error}</FieldError> : null}
		</Field>
	);
}

function AmountField({
	error,
	label,
	onChange,
	suffix,
	trailing,
	value,
}: {
	error: string | undefined;
	label: string;
	onChange: (next: string) => void;
	suffix: string;
	trailing?: React.ReactNode;
	value: string;
}) {
	return (
		<Field invalid={Boolean(error)} name={label}>
			<FieldLabel requirement="required">{label}</FieldLabel>
			<NumberField
				aria-invalid={Boolean(error) || undefined}
				onChange={(event) => onChange(event.target.value)}
				suffix={suffix}
				value={value}
			/>
			{trailing}
			{error ? <FieldError match>{error}</FieldError> : null}
		</Field>
	);
}

function ReasonField({
	error,
	maxLength,
	onChange,
	requirement,
	value,
}: {
	error: string | undefined;
	maxLength: number;
	onChange: (next: string) => void;
	requirement: "optional" | "required";
	value: string;
}) {
	return (
		<Field invalid={Boolean(error)} name="reason">
			<FieldLabel requirement={requirement}>Motivo</FieldLabel>
			<Input
				aria-invalid={Boolean(error) || undefined}
				maxLength={maxLength}
				onChange={(event) => onChange(event.target.value)}
				value={value}
			/>
			{error ? <FieldError match>{error}</FieldError> : null}
		</Field>
	);
}

function MovementForm({
	action,
	close,
	referenceCostCents,
	variant,
}: {
	action: MovementAction;
	close: () => void;
	referenceCostCents: string | null;
	variant: BalanceItemView;
}) {
	const queryClient = useQueryClient();
	const { opIdFor } = useOpId();
	const locations = useQuery(stockLocationsQuery());
	const lots = useQuery({
		...stockLotsQuery(variant.variantId),
		enabled: variant.tracksLots,
	});
	const [movementId] = useState(() => crypto.randomUUID());
	const [inboundId] = useState(() => crypto.randomUUID());
	const [direction, setDirection] = useState<Direction>("out");
	const [locationId, setLocationId] = useState("");
	const [toLocationId, setToLocationId] = useState("");
	const [lotId, setLotId] = useState<string | null>(null);
	const [quantity, setQuantity] = useState("");
	const [value, setValue] = useState("");
	const [reason, setReason] = useState("");
	const [occurredOn, setOccurredOn] = useState(today);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [failure, setFailure] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const unit = unitAbbreviation(variant.baseUnit);
	const needsValue = action === "opening" || direction === "in";
	const available = locations.data?.items ?? [];
	const lotItems = (lots.data?.items ?? []).map((lot) => ({
		label: lot.label,
		value: lot.id,
	}));

	const opening: OpeningFormValues = {
		locationId,
		lotId,
		occurredOn,
		quantity,
		value,
	};
	const adjustment: AdjustmentFormValues = {
		direction,
		locationId,
		lotId,
		occurredOn,
		quantity,
		reason,
		value,
	};
	const transfer: TransferFormValues = {
		fromLocationId: locationId,
		lotId,
		occurredOn,
		quantity,
		reason,
		toLocationId,
	};

	const suggest = () => {
		const micros = openingFields({ ...opening, value: "0" }).quantityMicros;
		setValue(
			formatMoneyInput(openingValueCents(referenceCostCents, BigInt(micros)))
		);
	};

	const send = async () => {
		if (action === "transfer") {
			const fields = transferFields(transfer);
			await api.stockMovements.transfer({
				...fields,
				inboundId,
				movementId,
				opId: opIdFor(JSON.stringify(fields)),
				variantId: variant.variantId,
			});
			return;
		}
		if (action === "opening") {
			const fields = openingFields(opening);
			await api.stockMovements.create({
				...fields,
				movementId,
				opId: opIdFor(JSON.stringify(fields)),
				variantId: variant.variantId,
			});
			return;
		}
		const fields = adjustmentFields(adjustment);
		await api.stockMovements.create({
			...fields,
			movementId,
			opId: opIdFor(JSON.stringify(fields)),
			variantId: variant.variantId,
		});
	};

	const errorsFor = () => {
		if (action === "opening") {
			return openingFormErrors(opening);
		}
		if (action === "adjustment") {
			return adjustmentFormErrors(adjustment);
		}
		return transferFormErrors(transfer);
	};

	const submit = async () => {
		const found: Record<string, string> = {
			...errorsFor(),
			...(variant.tracksLots && lotId === null
				? { lotId: "Escolha o lote" }
				: {}),
		};
		setErrors(found);
		if (Object.keys(found).length > 0) {
			return;
		}
		setFailure(null);
		setSubmitting(true);
		try {
			await send();
		} catch (error) {
			const failed = await failedStockCommand(queryClient, error, "variante");
			setFailure(failed.message);
			return;
		} finally {
			setSubmitting(false);
		}
		await refreshStock(queryClient);
		toast.success("Movimento registrado.");
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
			<DialogTitle>{titles[action]}</DialogTitle>
			<DialogDescription>
				{variant.materialName} · {variant.variantName}. {descriptions[action]}
			</DialogDescription>
			{action === "adjustment" ? (
				<Field name="direction">
					<FieldLabel>Direção</FieldLabel>
					<ChoiceChips
						aria-label="Direção do ajuste"
						onValueChange={(next) => setDirection(next as Direction)}
						value={direction}
					>
						<ChoiceChip value="out">Sai do estoque</ChoiceChip>
						<ChoiceChip value="in">Entra no estoque</ChoiceChip>
					</ChoiceChips>
				</Field>
			) : null}
			<SelectField
				error={errors.locationId}
				items={locationItems(available)}
				label={action === "transfer" ? "Local de origem" : "Local"}
				name="locationId"
				onValueChange={setLocationId}
				value={locationId}
			/>
			{action === "transfer" ? (
				<SelectField
					error={errors.toLocationId}
					items={locationItems(available)}
					label="Local de destino"
					name="toLocationId"
					onValueChange={setToLocationId}
					value={toLocationId}
				/>
			) : null}
			{variant.tracksLots ? (
				<SelectField
					error={errors.lotId}
					items={lotItems}
					label="Lote"
					name="lotId"
					onValueChange={setLotId}
					value={lotId ?? ""}
				/>
			) : null}
			<AmountField
				error={errors.quantity}
				label="Quantidade"
				onChange={setQuantity}
				suffix={unit}
				value={quantity}
			/>
			{needsValue ? (
				<AmountField
					error={errors.value}
					label="Valor do estoque"
					onChange={setValue}
					suffix="R$"
					trailing={
						referenceCostCents ? (
							<Button onClick={suggest} size="sm" type="button" variant="ghost">
								Usar o custo de referência
							</Button>
						) : null
					}
					value={value}
				/>
			) : null}
			{action === "opening" ? null : (
				<ReasonField
					error={errors.reason}
					maxLength={
						action === "adjustment" ? stockLimits.reason.max : stockLimits.notes
					}
					onChange={setReason}
					requirement={action === "adjustment" ? "required" : "optional"}
					value={reason}
				/>
			)}
			<Field invalid={Boolean(errors.occurredOn)} name="occurredOn">
				<FieldLabel requirement="required">Data</FieldLabel>
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
					<AlertTitle>Não foi possível registrar o movimento</AlertTitle>
					<AlertDescription>{failure}</AlertDescription>
				</Alert>
			) : null}
			<DialogActions>
				<DialogClose render={<Button variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button disabled={submitting} type="submit">
					{submitting ? "Registrando..." : "Registrar"}
				</Button>
			</DialogActions>
		</form>
	);
}

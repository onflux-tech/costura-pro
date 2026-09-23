import { materialLimits } from "@costura-pro/domain/material";
import { baseUnitByCode } from "@costura-pro/domain/unit";
import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import {
	ChoiceChip,
	ChoiceChips,
} from "@costura-pro/ui/components/choice-chips";
import {
	Field,
	FieldError,
	FieldHint,
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { Fieldset, FieldsetLegend } from "@costura-pro/ui/components/fieldset";
import { FilePickerButton } from "@costura-pro/ui/components/file-picker-button";
import { Input } from "@costura-pro/ui/components/input";
import { NumberField } from "@costura-pro/ui/components/number-field";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Photo } from "@costura-pro/ui/components/photo";
import { Select } from "@costura-pro/ui/components/select";
import { Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import {
	precisionOptions,
	unitAbbreviation,
	unitOptions,
	type VariantField,
	type VariantFields,
	type VariantFormValues,
	variantFields,
	variantFormErrors,
} from "@/lib/materials";
import { photoAccept } from "@/lib/photos";
import { orpc } from "@/utils/orpc";

import type { VariantPhoto } from "./use-variant-photo";

const fieldOrder: readonly VariantField[] = [
	"name",
	"code",
	"referenceCost",
	"minQuantity",
	"targetQuantity",
	"packagingLabel",
	"packagingQuantity",
];

type FieldErrors = Partial<Record<VariantField, string>>;

type Register = (field: VariantField) => (element: HTMLElement | null) => void;

type PanelProps = {
	errors: FieldErrors;
	onChange: (field: keyof VariantFormValues, value: string) => void;
	register: Register;
	unit: string;
	values: VariantFormValues;
};

function QuantityField({
	errors,
	field,
	hint,
	label,
	onChange,
	register,
	unit,
	values,
}: PanelProps & { field: VariantField; hint: string; label: string }) {
	const message = errors[field];
	return (
		<Field invalid={Boolean(message)}>
			<FieldLabel requirement="optional">{label}</FieldLabel>
			<NumberField
				aria-invalid={message ? true : undefined}
				onChange={(event) =>
					onChange(field as keyof VariantFormValues, event.target.value)
				}
				ref={register(field)}
				suffix={unit}
				value={values[field as keyof VariantFormValues]}
			/>
			<FieldHint>{hint}</FieldHint>
			{message ? <FieldError match>{message}</FieldError> : null}
		</Field>
	);
}

function useRepeatedCode(code: string, variantId: string | undefined) {
	const [trimmed, setTrimmed] = useState(code.trim());
	useEffect(() => {
		const timer = setTimeout(() => setTrimmed(code.trim()), 400);
		return () => clearTimeout(timer);
	}, [code]);
	const found = useQuery({
		...orpc.materialVariants.byCode.queryOptions({
			input: { code: trimmed },
			meta: { silent: true },
		}),
		enabled: trimmed !== "",
	});
	const others = (found.data?.items ?? []).filter(
		(item) => item.id !== variantId
	);
	const [first] = others;
	if (!first) {
		return null;
	}
	const rest = others.length > 1 ? ` e mais ${others.length - 1}` : "";
	return `Este código já é de ${first.name}, em ${first.materialName}${rest}.`;
}

function IdentityPanel({
	editingUnit,
	errors,
	onChange,
	register,
	unit,
	values,
	variantId,
}: PanelProps & { editingUnit: boolean; variantId?: string }) {
	const unitLabel =
		unitOptions.find((item) => item.value === values.baseUnit)?.label ?? unit;
	const repeated = useRepeatedCode(values.code, variantId);
	return (
		<Panel>
			<PanelContent className="flex flex-col gap-4">
				<Field invalid={Boolean(errors.name)}>
					<FieldLabel requirement="required">Nome da variante</FieldLabel>
					<Input
						aria-invalid={errors.name ? true : undefined}
						maxLength={materialLimits.variantName.max}
						onChange={(event) => onChange("name", event.target.value)}
						placeholder="Azul marinho"
						ref={register("name")}
						value={values.name}
					/>
					{errors.name ? <FieldError match>{errors.name}</FieldError> : null}
				</Field>
				<Field invalid={Boolean(errors.code)}>
					<FieldLabel requirement="optional">Código</FieldLabel>
					<Input
						aria-invalid={errors.code ? true : undefined}
						maxLength={materialLimits.code}
						onChange={(event) => onChange("code", event.target.value)}
						placeholder="GR-AZ"
						ref={register("code")}
						value={values.code}
					/>
					<FieldHint>O código do fornecedor ou da sua etiqueta.</FieldHint>
					{repeated ? (
						<Text size="xs" tone="warning">
							{repeated}
						</Text>
					) : null}
					{errors.code ? <FieldError match>{errors.code}</FieldError> : null}
				</Field>
				<Field>
					<FieldLabel requirement="required">Unidade base</FieldLabel>
					{editingUnit ? (
						<Select
							items={unitOptions}
							onValueChange={(value) => onChange("baseUnit", value)}
							value={values.baseUnit}
						/>
					) : (
						<Text>{unitLabel}</Text>
					)}
					<FieldHint>
						{editingUnit
							? "Escolhida uma vez: todo saldo, reserva e custo nascem nela."
							: "A unidade base não muda depois da criação."}
					</FieldHint>
				</Field>
				{editingUnit ? (
					<Fieldset>
						<FieldsetLegend>Controle por lote</FieldsetLegend>
						<ChoiceChips
							onValueChange={(value) => onChange("tracksLots", value)}
							value={values.tracksLots}
						>
							<ChoiceChip value="nao">Saldo único</ChoiceChip>
							<ChoiceChip value="sim">Por lote</ChoiceChip>
						</ChoiceChips>
						<Text size="sm" tone="subtle">
							Rolo ou aquisição identificável, como a unidade base: escolhido
							uma vez.
						</Text>
					</Fieldset>
				) : (
					<Field>
						<FieldLabel requirement="required">Controle por lote</FieldLabel>
						<Text>
							{values.tracksLots === "sim"
								? "Saldo controlado por lote"
								: "Saldo único, sem lote"}
						</Text>
						<FieldHint>
							O controle por lote não muda depois da criação.
						</FieldHint>
					</Field>
				)}
				<Field>
					<FieldLabel requirement="required">Casas decimais</FieldLabel>
					<Select
						items={precisionOptions}
						onValueChange={(value) => onChange("displayPrecision", value)}
						value={values.displayPrecision}
					/>
					<FieldHint>Só muda como a quantidade aparece.</FieldHint>
				</Field>
				<Field invalid={Boolean(errors.referenceCost)}>
					<FieldLabel requirement="optional">
						{`Custo de referência (R$ por ${unit})`}
					</FieldLabel>
					<NumberField
						aria-invalid={errors.referenceCost ? true : undefined}
						onChange={(event) => onChange("referenceCost", event.target.value)}
						placeholder="12,50"
						ref={register("referenceCost")}
						value={values.referenceCost}
					/>
					<FieldHint>Só você vê. A compra atualiza o custo real.</FieldHint>
					{errors.referenceCost ? (
						<FieldError match>{errors.referenceCost}</FieldError>
					) : null}
				</Field>
			</PanelContent>
		</Panel>
	);
}

function PackagingPanel(props: PanelProps) {
	const { errors, onChange, register, unit, values } = props;
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Embalagem de compra</PanelTitle>
			</PanelHeader>
			<PanelContent className="flex flex-col gap-4">
				<Field invalid={Boolean(errors.packagingLabel)}>
					<FieldLabel requirement="optional">Nome da embalagem</FieldLabel>
					<Input
						aria-invalid={errors.packagingLabel ? true : undefined}
						maxLength={materialLimits.packagingLabel.max}
						onChange={(event) => onChange("packagingLabel", event.target.value)}
						placeholder="Rolo"
						ref={register("packagingLabel")}
						value={values.packagingLabel}
					/>
					{errors.packagingLabel ? (
						<FieldError match>{errors.packagingLabel}</FieldError>
					) : null}
				</Field>
				<QuantityField
					{...props}
					field="packagingQuantity"
					hint="A compra já vem preenchida com isso."
					label={`Quanto cada embalagem tem (${unit})`}
				/>
			</PanelContent>
		</Panel>
	);
}

function PhotoPanel({ photo }: { photo: VariantPhoto }) {
	const pickLabel = photo.photo ? "Trocar foto" : "Escolher foto";
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Foto</PanelTitle>
			</PanelHeader>
			<PanelContent className="flex flex-col items-start gap-3">
				{photo.preview ? (
					<Photo
						alt="Foto da variante"
						className="size-28 rounded-md"
						height={224}
						src={photo.preview}
						width={224}
					/>
				) : (
					<Text tone="subtle">Sem foto.</Text>
				)}
				{photo.status === "uploading" ? (
					<Text size="xs" tone="muted">
						Enviando...
					</Text>
				) : null}
				{photo.failure ? (
					<Alert tone="danger">
						<AlertTitle>A foto nova não entrou</AlertTitle>
						<AlertDescription>{photo.failure.message}</AlertDescription>
						<AlertActions>
							{photo.failure.retry ? (
								<Button onClick={photo.retry} variant="outline">
									Tentar de novo
								</Button>
							) : null}
							<Button onClick={photo.discard} variant="outline">
								Descartar a foto nova
							</Button>
						</AlertActions>
					</Alert>
				) : null}
				<div className="flex flex-wrap gap-2">
					<FilePickerButton
						accept={photoAccept}
						onFiles={photo.pick}
						variant="outline"
					>
						{pickLabel}
					</FilePickerButton>
					{photo.photo ? (
						<Button onClick={photo.remove} variant="ghost">
							Remover foto
						</Button>
					) : null}
				</div>
			</PanelContent>
		</Panel>
	);
}

export function VariantForm({
	editingUnit,
	failure,
	initialValues,
	onDirtyChange,
	onReloadCurrent,
	onSubmit,
	photo,
	submitLabel,
	variantId,
}: {
	editingUnit: boolean;
	failure: ClientCommandFailure | null;
	initialValues: VariantFormValues;
	onDirtyChange?: (dirty: boolean) => void;
	onReloadCurrent?: () => void;
	onSubmit: (fields: VariantFields) => Promise<void>;
	photo: VariantPhoto;
	submitLabel: string;
	variantId?: string;
}) {
	const [values, setValues] = useState(initialValues);
	const [errors, setErrors] = useState<FieldErrors>({});
	const [submitting, setSubmitting] = useState(false);
	const alertRef = useRef<HTMLDivElement>(null);
	const targets = useRef(new Map<VariantField, HTMLElement>());
	const register: Register = (field) => (element) => {
		if (element) {
			targets.current.set(field, element);
		} else {
			targets.current.delete(field);
		}
	};
	const onChange = (field: keyof VariantFormValues, value: string) => {
		onDirtyChange?.(true);
		setValues((current) =>
			field === "baseUnit"
				? {
						...current,
						baseUnit: value as VariantFormValues["baseUnit"],
						displayPrecision: String(
							baseUnitByCode(value)?.defaultPrecision ??
								Number(current.displayPrecision)
						),
					}
				: { ...current, [field]: value }
		);
	};

	useEffect(() => {
		if (failure) {
			alertRef.current?.focus();
		}
	}, [failure]);

	const unit = unitAbbreviation(values.baseUnit);
	const panelProps = { errors, onChange, register, unit, values };
	const submit = async () => {
		const found = variantFormErrors(values);
		setErrors(found);
		const first = fieldOrder.find((field) => found[field]);
		if (first) {
			targets.current.get(first)?.focus();
			return;
		}
		setSubmitting(true);
		try {
			await onSubmit(variantFields(values, photo.photo));
		} finally {
			setSubmitting(false);
		}
	};
	const label = submitting ? "Salvando..." : submitLabel;

	return (
		<form
			className="flex flex-col gap-4 md:max-w-2xl"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<IdentityPanel
				{...panelProps}
				editingUnit={editingUnit}
				variantId={variantId}
			/>
			<Panel>
				<PanelHeader>
					<PanelTitle>Reposição</PanelTitle>
				</PanelHeader>
				<PanelContent className="flex flex-col gap-4">
					<QuantityField
						{...panelProps}
						field="minQuantity"
						hint="Abaixo disso a variante entra na lista de compras."
						label="Mínimo"
					/>
					<QuantityField
						{...panelProps}
						field="targetQuantity"
						hint="Quantidade até a qual a lista sugere comprar."
						label="Alvo"
					/>
				</PanelContent>
			</Panel>
			<PackagingPanel {...panelProps} />
			<PhotoPanel photo={photo} />
			{failure ? (
				<Alert
					ref={alertRef}
					role="alert"
					tabIndex={-1}
					tone={failure.kind === "stale" ? "warning" : "danger"}
				>
					<AlertTitle>Não foi possível salvar</AlertTitle>
					<AlertDescription>{failure.message}</AlertDescription>
					{failure.kind === "stale" && onReloadCurrent ? (
						<AlertActions>
							<Button onClick={onReloadCurrent} variant="outline">
								Carregar versão atual
							</Button>
						</AlertActions>
					) : null}
				</Alert>
			) : null}
			<Button
				className="md:w-auto md:self-start"
				disabled={submitting || photo.blocked}
				size="touch"
				type="submit"
			>
				{label}
			</Button>
		</form>
	);
}

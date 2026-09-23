import { productLimits } from "@costura-pro/domain/product";
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
	FieldHint,
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { Fieldset, FieldsetLegend } from "@costura-pro/ui/components/fieldset";
import { Input } from "@costura-pro/ui/components/input";
import { NumberField } from "@costura-pro/ui/components/number-field";
import { Text } from "@costura-pro/ui/components/typography";
import { type ReactNode, useRef, useState } from "react";

import { unitAbbreviation } from "@/lib/materials";
import {
	type LossKind,
	type MaterialItemDraft,
	materialDraft,
	materialReferenceOf,
	type ServiceItemDraft,
	type SheetItemDraft,
	type SheetItemField,
	type SheetItemView,
	serviceDraft,
	serviceReferenceOf,
	sheetItemErrors,
	sheetItemOf,
} from "@/lib/products";
import { VariantPicker } from "@/materials/variant-picker";

import { ServicePicker } from "./service-picker";

export type SheetItemDialogMode =
	| { heading: string; kind: "newMaterial" }
	| { heading: string; kind: "newService" }
	| { draft: SheetItemDraft; heading: string; itemId: string; kind: "edit" };

type Errors = Partial<Record<SheetItemField, string>>;

const fieldOrder: readonly SheetItemField[] = [
	"quantity",
	"loss",
	"count",
	"note",
];

function pickerKindOf(mode: SheetItemDialogMode): "material" | "service" {
	if (mode.kind === "edit") {
		return mode.draft.kind;
	}
	return mode.kind === "newService" ? "service" : "material";
}

function ItemField({
	children,
	error,
	hint,
	label,
	name,
	requirement,
}: {
	children: ReactNode;
	error: string | undefined;
	hint?: string;
	label: string;
	name: SheetItemField;
	requirement: "optional" | "required";
}) {
	return (
		<Field invalid={Boolean(error)} name={name}>
			<FieldLabel requirement={requirement}>{label}</FieldLabel>
			{children}
			{hint ? <FieldHint>{hint}</FieldHint> : null}
			{error ? <FieldError match>{error}</FieldError> : null}
		</Field>
	);
}

type FieldRef = (
	field: SheetItemField
) => (element: HTMLElement | null) => void;

function MaterialFields({
	draft,
	errors,
	fieldRef,
	onChange,
}: {
	draft: MaterialItemDraft;
	errors: Errors;
	fieldRef: FieldRef;
	onChange: (draft: MaterialItemDraft) => void;
}) {
	const unit = unitAbbreviation(draft.variant.baseUnit);
	const lossSuffix = draft.lossKind === "percent" ? "%" : unit;
	return (
		<>
			<ItemField
				error={errors.quantity}
				hint="Quanto uma peça usa, sem a perda."
				label="Quantidade"
				name="quantity"
				requirement="required"
			>
				<NumberField
					aria-invalid={errors.quantity ? true : undefined}
					maxLength={20}
					onChange={(event) =>
						onChange({ ...draft, quantity: event.target.value })
					}
					ref={fieldRef("quantity")}
					suffix={unit}
					value={draft.quantity}
				/>
			</ItemField>
			<Fieldset>
				<FieldsetLegend>Perda normal</FieldsetLegend>
				<ChoiceChips
					onValueChange={(next) =>
						onChange({ ...draft, loss: "", lossKind: next as LossKind })
					}
					value={draft.lossKind}
				>
					<ChoiceChip value="none">Sem perda</ChoiceChip>
					<ChoiceChip value="fixed">Fixa</ChoiceChip>
					<ChoiceChip value="percent">Percentual</ChoiceChip>
				</ChoiceChips>
			</Fieldset>
			{draft.lossKind === "none" ? null : (
				<ItemField
					error={errors.loss}
					hint={
						draft.lossKind === "percent"
							? "Sobre a quantidade, arredondada para cima."
							: "Sobra de corte somada à quantidade."
					}
					label="Perda"
					name="loss"
					requirement="required"
				>
					<NumberField
						aria-invalid={errors.loss ? true : undefined}
						maxLength={20}
						onChange={(event) =>
							onChange({ ...draft, loss: event.target.value })
						}
						ref={fieldRef("loss")}
						suffix={lossSuffix}
						value={draft.loss}
					/>
				</ItemField>
			)}
		</>
	);
}

function ServiceFields({
	draft,
	errors,
	fieldRef,
	onChange,
}: {
	draft: ServiceItemDraft;
	errors: Errors;
	fieldRef: FieldRef;
	onChange: (draft: ServiceItemDraft) => void;
}) {
	return (
		<ItemField
			error={errors.count}
			hint="Cada vez soma o custo do serviço uma vez."
			label="Quantidade"
			name="count"
			requirement="required"
		>
			<NumberField
				aria-invalid={errors.count ? true : undefined}
				inputMode="numeric"
				maxLength={2}
				onChange={(event) => onChange({ ...draft, count: event.target.value })}
				ref={fieldRef("count")}
				suffix="vezes"
				value={draft.count}
			/>
		</ItemField>
	);
}

function PickerStep({
	close,
	kind,
	onPickMaterial,
	heading,
	onPickService,
}: {
	close: () => void;
	kind: "material" | "service";
	onPickMaterial: Parameters<typeof VariantPicker>[0]["onPick"];
	heading: string;
	onPickService: Parameters<typeof ServicePicker>[0]["onPick"];
}) {
	return (
		<div className="flex flex-col gap-4">
			<DialogTitle>{heading}</DialogTitle>
			<DialogDescription>
				{kind === "material"
					? "Escolha a variante do material. Custo de referência e unidade vêm dela."
					: "Escolha o serviço. O custo dele entra no custo da peça."}
			</DialogDescription>
			{kind === "material" ? (
				<VariantPicker
					emptyHint="Nenhuma variante encontrada. Cadastre o material em Catálogo antes de pôr na ficha."
					onPick={onPickMaterial}
				/>
			) : (
				<ServicePicker onPick={onPickService} />
			)}
			<DialogActions>
				<Button onClick={close} type="button" variant="outline">
					Cancelar
				</Button>
			</DialogActions>
		</div>
	);
}

function selectedTitle(draft: SheetItemDraft): string {
	return draft.kind === "material"
		? `${draft.variant.materialName} · ${draft.variant.name}`
		: draft.service.name;
}

function SheetItemForm({
	close,
	mode,
	onSave,
}: {
	close: () => void;
	mode: SheetItemDialogMode;
	onSave: (item: SheetItemView, draft: SheetItemDraft) => void;
}) {
	const [itemId] = useState(() =>
		mode.kind === "edit" ? mode.itemId : crypto.randomUUID()
	);
	const [draft, setDraft] = useState<SheetItemDraft | null>(
		mode.kind === "edit" ? mode.draft : null
	);
	const [picking, setPicking] = useState(mode.kind !== "edit");
	const [errors, setErrors] = useState<Errors>({});
	const targets = useRef(new Map<SheetItemField, HTMLElement>());
	const kind = pickerKindOf(mode);

	const fieldRef: FieldRef = (field) => (element) => {
		if (element) {
			targets.current.set(field, element);
		} else {
			targets.current.delete(field);
		}
	};

	if (picking || !draft) {
		return (
			<PickerStep
				close={close}
				heading={mode.heading}
				kind={kind}
				onPickMaterial={(option) => {
					const variant = materialReferenceOf(option);
					setDraft((current) =>
						current?.kind === "material"
							? { ...current, variant }
							: materialDraft(variant)
					);
					setPicking(false);
				}}
				onPickService={(service) => {
					const reference = serviceReferenceOf(service);
					setDraft((current) =>
						current?.kind === "service"
							? { ...current, service: reference }
							: serviceDraft(reference)
					);
					setPicking(false);
				}}
			/>
		);
	}

	const submit = () => {
		const found = sheetItemErrors(draft);
		setErrors(found);
		const first = fieldOrder.find((field) => found[field]);
		if (first) {
			targets.current.get(first)?.focus();
			return;
		}
		onSave(sheetItemOf(draft, itemId), draft);
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
			<DialogTitle>{mode.heading}</DialogTitle>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Text weight="semibold">{selectedTitle(draft)}</Text>
				<Button
					onClick={() => setPicking(true)}
					size="sm"
					type="button"
					variant="outline"
				>
					{draft.kind === "material" ? "Trocar material" : "Trocar serviço"}
				</Button>
			</div>
			{draft.kind === "material" ? (
				<MaterialFields
					draft={draft}
					errors={errors}
					fieldRef={fieldRef}
					onChange={setDraft}
				/>
			) : (
				<ServiceFields
					draft={draft}
					errors={errors}
					fieldRef={fieldRef}
					onChange={setDraft}
				/>
			)}
			<ItemField
				error={errors.note}
				hint="Como Forro ou Viés da gola."
				label="Observação"
				name="note"
				requirement="optional"
			>
				<Input
					aria-invalid={errors.note ? true : undefined}
					maxLength={productLimits.itemNote}
					onChange={(event) => setDraft({ ...draft, note: event.target.value })}
					ref={fieldRef("note")}
					value={draft.note}
				/>
			</ItemField>
			<DialogActions>
				<DialogClose render={<Button type="button" variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button type="submit">Salvar item</Button>
			</DialogActions>
		</form>
	);
}

export function SheetItemDialog({
	mode,
	onOpenChange,
	onSave,
}: {
	mode: SheetItemDialogMode | null;
	onOpenChange: (open: boolean) => void;
	onSave: (item: SheetItemView, draft: SheetItemDraft) => void;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={mode !== null}>
			<DialogContent>
				{mode ? (
					<SheetItemForm
						close={() => onOpenChange(false)}
						key={mode.kind === "edit" ? mode.itemId : mode.kind}
						mode={mode}
						onSave={onSave}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

import {
	receivedItemConditions,
	receivedItemLimits,
} from "@costura-pro/domain/received-item";
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
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { Fieldset, FieldsetLegend } from "@costura-pro/ui/components/fieldset";
import { Input } from "@costura-pro/ui/components/input";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Textarea } from "@costura-pro/ui/components/textarea";
import { Text } from "@costura-pro/ui/components/typography";
import { useEffect, useRef, useState } from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import {
	conditionLabels,
	firstInvalidField,
	type ReceivedItemField,
	type ReceivedItemFieldErrors,
	type ReceivedItemFields,
	type ReceivedItemFormValues,
	receivedItemFields,
	receivedItemFormErrors,
} from "@/lib/received-items";
import { PhotoField } from "@/photos/photo-field";
import type { PhotoDrafts } from "@/photos/use-photo-drafts";

type ReceivedItemFormProps = {
	failure: ClientCommandFailure | null;
	returnedOn?: string | null;
	focusPhotos?: boolean;
	heading: string;
	initialValues: ReceivedItemFormValues;
	onReloadCurrent?: () => void;
	onSubmit: (fields: ReceivedItemFields) => Promise<void>;
	photos: PhotoDrafts;
	submitLabel: string;
	today: string;
};

export function ReceivedItemForm({
	failure,
	focusPhotos = false,
	heading,
	initialValues,
	onReloadCurrent,
	onSubmit,
	photos,
	returnedOn = null,
	submitLabel,
	today,
}: ReceivedItemFormProps) {
	const [description, setDescription] = useState(initialValues.description);
	const [condition, setCondition] = useState(initialValues.condition);
	const [quantity, setQuantity] = useState(initialValues.quantity);
	const [receivedOn, setReceivedOn] = useState(initialValues.receivedOn);
	const [expectedReturnOn, setExpectedReturnOn] = useState(
		initialValues.expectedReturnOn
	);
	const [accessories, setAccessories] = useState(initialValues.accessories);
	const [notes, setNotes] = useState(initialValues.notes);
	const [errors, setErrors] = useState<ReceivedItemFieldErrors>({});
	const [submitting, setSubmitting] = useState(false);
	const alertRef = useRef<HTMLDivElement>(null);
	const targets = useRef(new Map<ReceivedItemField, HTMLElement>());
	const register =
		(field: ReceivedItemField) => (element: HTMLElement | null) => {
			if (element) {
				targets.current.set(field, element);
			} else {
				targets.current.delete(field);
			}
		};

	useEffect(() => {
		if (failure) {
			alertRef.current?.focus();
		}
	}, [failure]);

	const submit = async () => {
		const values: ReceivedItemFormValues = {
			accessories,
			condition,
			description,
			expectedReturnOn,
			notes,
			photos: photos.photos,
			quantity,
			receivedOn,
		};
		const found = receivedItemFormErrors(values, today, returnedOn);
		setErrors(found);
		const first = firstInvalidField(found);
		if (first) {
			targets.current.get(first)?.focus();
			return;
		}
		const fields = receivedItemFields(values);
		if (!fields || photos.busy) {
			return;
		}
		setSubmitting(true);
		try {
			await onSubmit(fields);
		} finally {
			setSubmitting(false);
		}
	};

	const submitText = submitting ? "Salvando..." : submitLabel;
	const alertTone = failure?.kind === "stale" ? "warning" : "danger";

	return (
		<form
			className="flex flex-col gap-4 md:max-w-3xl"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<Panel>
				<PanelHeader>
					<PanelTitle>{heading}</PanelTitle>
				</PanelHeader>
				<PanelContent className="flex flex-col gap-4">
					<Field invalid={errors.description !== undefined} name="description">
						<FieldLabel requirement="required">Descrição da peça</FieldLabel>
						<Input
							maxLength={receivedItemLimits.description.max}
							onChange={(event) => setDescription(event.target.value)}
							ref={register("description")}
							value={description}
						/>
						{errors.description ? (
							<FieldError match>{errors.description}</FieldError>
						) : null}
					</Field>
					<Fieldset className="flex flex-col gap-2">
						<FieldsetLegend>Estado na recepção</FieldsetLegend>
						<ChoiceChips
							aria-label="Estado na recepção"
							onValueChange={(value) =>
								setCondition(value as ReceivedItemFormValues["condition"])
							}
							value={condition}
						>
							{receivedItemConditions.map((option, index) => (
								<ChoiceChip
									key={option}
									ref={index === 0 ? register("condition") : undefined}
									value={option}
								>
									{conditionLabels[option]}
								</ChoiceChip>
							))}
						</ChoiceChips>
						{errors.condition ? (
							<Text role="alert" size="xs" tone="danger">
								{errors.condition}
							</Text>
						) : null}
					</Fieldset>
					<div className="grid gap-4 md:grid-cols-3">
						<Field invalid={errors.quantity !== undefined} name="quantity">
							<FieldLabel requirement="required">Quantidade</FieldLabel>
							<Input
								inputMode="numeric"
								maxLength={3}
								onChange={(event) => setQuantity(event.target.value)}
								ref={register("quantity")}
								value={quantity}
							/>
							{errors.quantity ? (
								<FieldError match>{errors.quantity}</FieldError>
							) : null}
						</Field>
						<Field invalid={errors.receivedOn !== undefined} name="receivedOn">
							<FieldLabel requirement="required">Recebida em</FieldLabel>
							<Input
								max={today}
								onChange={(event) => setReceivedOn(event.target.value)}
								ref={register("receivedOn")}
								type="date"
								value={receivedOn}
							/>
							{errors.receivedOn ? (
								<FieldError match>{errors.receivedOn}</FieldError>
							) : null}
						</Field>
						<Field
							invalid={errors.expectedReturnOn !== undefined}
							name="expectedReturnOn"
						>
							<FieldLabel requirement="optional">Devolução prevista</FieldLabel>
							<Input
								min={receivedOn}
								onChange={(event) => setExpectedReturnOn(event.target.value)}
								ref={register("expectedReturnOn")}
								type="date"
								value={expectedReturnOn}
							/>
							{errors.expectedReturnOn ? (
								<FieldError match>{errors.expectedReturnOn}</FieldError>
							) : null}
						</Field>
					</div>
					<PhotoField
						captionLimit={receivedItemLimits.caption}
						disabled={submitting}
						focusPicker={focusPhotos}
						hint={`Opcional · até ${receivedItemLimits.photos} · otimizadas no aparelho`}
						legend="Fotos de condição"
						limit={receivedItemLimits.photos}
						photos={photos}
					/>
					<Field name="accessories">
						<FieldLabel requirement="optional">Acessórios recebidos</FieldLabel>
						<Input
							maxLength={receivedItemLimits.accessories}
							onChange={(event) => setAccessories(event.target.value)}
							value={accessories}
						/>
					</Field>
					<Field name="notes">
						<FieldLabel requirement="optional">Observações</FieldLabel>
						<Textarea
							maxLength={receivedItemLimits.notes}
							onChange={(event) => setNotes(event.target.value)}
							value={notes}
						/>
					</Field>
				</PanelContent>
			</Panel>
			{failure ? (
				<Alert ref={alertRef} role="alert" tabIndex={-1} tone={alertTone}>
					<AlertTitle>Não foi possível salvar a peça</AlertTitle>
					<AlertDescription>{failure.message}</AlertDescription>
					{failure.kind === "stale" && onReloadCurrent ? (
						<AlertActions>
							<Button onClick={onReloadCurrent} type="button" variant="outline">
								Carregar versão atual
							</Button>
						</AlertActions>
					) : null}
				</Alert>
			) : null}
			{photos.busy ? (
				<Text role="status" size="xs" tone="muted">
					Aguarde as fotos terminarem de enviar, ou remova as que falharam.
				</Text>
			) : null}
			<Button
				className="md:w-auto md:self-start"
				disabled={submitting || photos.busy}
				size="touch"
				type="submit"
			>
				{submitText}
			</Button>
		</form>
	);
}

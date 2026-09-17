import {
	formatCentimeters,
	measurementLimits,
} from "@costura-pro/domain/measurement";
import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import {
	Field,
	FieldError,
	FieldHint,
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Textarea } from "@costura-pro/ui/components/textarea";
import { useEffect, useRef, useState } from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import {
	type DraftField,
	type MeasurementValues,
	parseDraft,
} from "@/lib/measurements";

const emptyMessage = "Preencha pelo menos uma medida";
const dateMessage = "Informe uma data até hoje";

type MeasurementFormProps = {
	failure: ClientCommandFailure | null;
	initialFields: readonly DraftField[];
	initialNotes: string;
	initialTakenOn: string;
	onReloadCurrent?: () => void;
	onSubmit: (values: MeasurementValues) => Promise<void>;
	submitLabel: string;
	heading: string;
	today: string;
};

export function MeasurementForm({
	failure,
	initialFields,
	initialNotes,
	initialTakenOn,
	onReloadCurrent,
	onSubmit,
	submitLabel,
	heading,
	today,
}: MeasurementFormProps) {
	const [fields, setFields] = useState(() => [...initialFields]);
	const [takenOn, setTakenOn] = useState(initialTakenOn);
	const [notes, setNotes] = useState(initialNotes);
	const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
	const [dateError, setDateError] = useState<string | null>(null);
	const [emptyError, setEmptyError] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const alertRef = useRef<HTMLDivElement>(null);
	const inputs = useRef(new Map<string, HTMLInputElement>());
	const message = emptyError ? emptyMessage : (failure?.message ?? null);
	const register = (key: string) => (element: HTMLInputElement | null) => {
		if (element) {
			inputs.current.set(key, element);
		} else {
			inputs.current.delete(key);
		}
	};

	useEffect(() => {
		if (message) {
			alertRef.current?.focus();
		}
	}, [message]);

	const submit = async () => {
		const parsed = parseDraft(fields);
		const invalidDate = takenOn === "" || takenOn > today;
		const hasErrors = Object.keys(parsed.errors).length > 0;
		const empty =
			!hasErrors && parsed.fields.every((field) => field.valueMm === null);
		setErrors(parsed.errors);
		setDateError(invalidDate ? dateMessage : null);
		setEmptyError(empty);
		const firstInvalid = invalidDate
			? "takenOn"
			: fields.find((field) => parsed.errors[field.fieldId])?.fieldId;
		if (firstInvalid) {
			inputs.current.get(firstInvalid)?.focus();
		}
		if (invalidDate || hasErrors || empty) {
			return;
		}
		setSubmitting(true);
		try {
			await onSubmit({
				fields: parsed.fields,
				notes: notes.trim() === "" ? null : notes.trim(),
				takenOn,
			});
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
					<PanelMeta>Valores em centímetros</PanelMeta>
				</PanelHeader>
				<PanelContent className="flex flex-col gap-4">
					<Field
						className="md:max-w-xs"
						invalid={dateError !== null}
						name="takenOn"
					>
						<FieldLabel requirement="required">Data da medição</FieldLabel>
						<Input
							max={today}
							onChange={(event) => setTakenOn(event.target.value)}
							ref={register("takenOn")}
							type="date"
							value={takenOn}
						/>
						{dateError ? <FieldError match>{dateError}</FieldError> : null}
					</Field>
					<div className="grid gap-4 md:grid-cols-2">
						{fields.map((field) => {
							const error = errors[field.fieldId];
							return (
								<Field
									invalid={error !== undefined}
									key={field.fieldId}
									name={field.fieldId}
								>
									<FieldLabel>{field.label}</FieldLabel>
									<Input
										autoComplete="off"
										inputMode="decimal"
										maxLength={6}
										onChange={(event) =>
											setFields((current) =>
												current.map((item) =>
													item.fieldId === field.fieldId
														? { ...item, text: event.target.value }
														: item
												)
											)
										}
										ref={register(field.fieldId)}
										value={field.text}
									/>
									{field.previousMm === null ? null : (
										<FieldHint>
											{`anterior ${formatCentimeters(field.previousMm)} cm`}
										</FieldHint>
									)}
									{error ? <FieldError match>{error}</FieldError> : null}
								</Field>
							);
						})}
					</div>
					<Field name="notes">
						<FieldLabel requirement="optional">Notas</FieldLabel>
						<Textarea
							maxLength={measurementLimits.notes}
							onChange={(event) => setNotes(event.target.value)}
							value={notes}
						/>
					</Field>
				</PanelContent>
			</Panel>
			{message ? (
				<Alert ref={alertRef} role="alert" tabIndex={-1} tone={alertTone}>
					<AlertTitle>Não foi possível salvar as medidas</AlertTitle>
					<AlertDescription>{message}</AlertDescription>
					{failure?.kind === "stale" && onReloadCurrent ? (
						<AlertActions>
							<Button onClick={onReloadCurrent} type="button" variant="outline">
								Carregar versão atual
							</Button>
						</AlertActions>
					) : null}
				</Alert>
			) : null}
			<Button
				className="md:w-auto md:self-start"
				disabled={submitting}
				size="touch"
				type="submit"
			>
				{submitText}
			</Button>
		</form>
	);
}

import { measurementLimits } from "@costura-pro/domain/measurement";
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
import { Text } from "@costura-pro/ui/components/typography";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import {
	hasTemplateErrors,
	moveField,
	moveFocusTarget,
	type TemplateDraftErrors,
	type TemplateDraftField,
	type TemplateFieldView,
	templateDraftErrors,
} from "@/lib/measurements";

export type TemplateEditorValues = {
	fields: TemplateDraftField[];
	name: string;
};

type TemplateEditorProps = {
	failure: ClientCommandFailure | null;
	initialFields: readonly TemplateFieldView[];
	initialName: string;
	onChangedChange?: (changed: boolean) => void;
	onReloadCurrent?: () => void;
	onSubmit: (values: TemplateEditorValues) => Promise<void>;
	submitLabel: string;
};

function activeDraft(fields: readonly TemplateFieldView[]) {
	return fields
		.filter((field) => field.active)
		.map(({ id, label }) => ({ id, label }));
}

export function TemplateEditor({
	failure,
	initialFields,
	initialName,
	onChangedChange,
	onReloadCurrent,
	onSubmit,
	submitLabel,
}: TemplateEditorProps) {
	const [name, setName] = useState(initialName);
	const [fields, setFields] = useState<TemplateDraftField[]>(() =>
		activeDraft(initialFields)
	);
	const [errors, setErrors] = useState<TemplateDraftErrors | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [focusKey, setFocusKey] = useState<string | null>(null);
	const focusables = useRef(new Map<string, HTMLElement>());
	const failureRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (focusKey) {
			focusables.current.get(focusKey)?.focus();
			setFocusKey(null);
		}
	}, [focusKey]);
	useEffect(() => {
		if (failure) {
			failureRef.current?.focus();
		}
	}, [failure]);

	const register = (key: string) => (element: HTMLElement | null) => {
		if (element) {
			focusables.current.set(key, element);
		} else {
			focusables.current.delete(key);
		}
	};
	const inactive = initialFields.filter(
		(field) => !fields.some((item) => item.id === field.id)
	);
	const initialActive = activeDraft(initialFields);
	const changed =
		name.trim() !== initialName ||
		fields.length !== initialActive.length ||
		fields.some(
			(field, index) =>
				field.id !== initialActive[index]?.id ||
				field.label.trim() !== initialActive[index]?.label
		);
	const full = fields.length >= measurementLimits.fields.max;

	useEffect(() => {
		onChangedChange?.(changed);
	}, [changed, onChangedChange]);

	const move = (index: number, direction: -1 | 1) => {
		const field = fields[index];
		if (!field) {
			return;
		}
		setFields(moveField(fields, index, direction));
		setFocusKey(
			`${field.id}:${moveFocusTarget(index + direction, fields.length, direction)}`
		);
	};
	const deactivate = (index: number) => {
		const next = fields[index + 1] ?? fields[index - 1];
		setFields(fields.filter((_, position) => position !== index));
		setFocusKey(next ? `${next.id}:label` : "add");
	};
	const add = () => {
		const id = crypto.randomUUID();
		setFields([...fields, { id, label: "" }]);
		setFocusKey(`${id}:label`);
	};
	const reactivate = (field: TemplateFieldView) => {
		setFields([...fields, { id: field.id, label: field.label }]);
		setFocusKey(`${field.id}:label`);
	};

	const submit = async () => {
		const found = templateDraftErrors(name, fields);
		setErrors(found);
		if (hasTemplateErrors(found)) {
			const firstField = fields.find((field) => found.fields[field.id]);
			if (found.name) {
				setFocusKey("name");
			} else if (firstField) {
				setFocusKey(`${firstField.id}:label`);
			} else {
				setFocusKey("add");
			}
			return;
		}
		setSubmitting(true);
		try {
			await onSubmit({
				fields: fields.map(({ id, label }) => ({ id, label: label.trim() })),
				name: name.trim(),
			});
		} finally {
			setSubmitting(false);
		}
	};
	const submitText = submitting ? "Salvando..." : submitLabel;

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
				<PanelContent>
					<Field invalid={Boolean(errors?.name)} name="name">
						<FieldLabel requirement="required">Nome do modelo</FieldLabel>
						<Input
							maxLength={measurementLimits.templateName.max}
							onChange={(event) => setName(event.target.value)}
							ref={register("name")}
							value={name}
						/>
						{errors?.name ? <FieldError match>{errors.name}</FieldError> : null}
					</Field>
				</PanelContent>
			</Panel>
			<Panel>
				<PanelHeader>
					<PanelTitle>Campos</PanelTitle>
					<PanelMeta>{`${fields.length} ativos · em centímetros`}</PanelMeta>
				</PanelHeader>
				<PanelContent className="flex flex-col gap-3">
					{fields.map((field, index) => {
						const error = errors?.fields[field.id];
						const spoken = field.label.trim() || `campo ${index + 1}`;
						return (
							<div
								className="flex flex-wrap items-end gap-2 border-divider border-b pb-3 last:border-b-0"
								key={field.id}
							>
								<Field
									className="min-w-0 flex-1 basis-48"
									invalid={Boolean(error)}
									name={`campo-${field.id}`}
								>
									<FieldLabel>{`Campo ${index + 1}`}</FieldLabel>
									<Input
										maxLength={measurementLimits.fieldLabel.max}
										onChange={(event) =>
											setFields(
												fields.map((item) =>
													item.id === field.id
														? { ...item, label: event.target.value }
														: item
												)
											)
										}
										ref={register(`${field.id}:label`)}
										value={field.label}
									/>
									{error ? <FieldError match>{error}</FieldError> : null}
								</Field>
								<div className="flex gap-1">
									<Button
										aria-label={`Subir ${spoken}`}
										disabled={index === 0}
										onClick={() => move(index, -1)}
										ref={register(`${field.id}:up`)}
										size="icon"
										type="button"
										variant="outline"
									>
										<ArrowUpIcon aria-hidden="true" />
									</Button>
									<Button
										aria-label={`Descer ${spoken}`}
										disabled={index === fields.length - 1}
										onClick={() => move(index, 1)}
										ref={register(`${field.id}:down`)}
										size="icon"
										type="button"
										variant="outline"
									>
										<ArrowDownIcon aria-hidden="true" />
									</Button>
									<Button
										aria-label={`Desativar ${spoken}`}
										onClick={() => deactivate(index)}
										size="sm"
										type="button"
										variant="ghost"
									>
										Desativar
									</Button>
								</div>
							</div>
						);
					})}
					{errors?.form ? (
						<Text role="alert" tone="danger">
							{errors.form}
						</Text>
					) : null}
					<Button
						disabled={full}
						onClick={add}
						ref={register("add")}
						type="button"
						variant="dashed"
					>
						Adicionar campo
					</Button>
					{full ? (
						<Text size="xs" tone="muted">
							{`Um modelo tem no máximo ${measurementLimits.fields.max} campos ativos. Desative um para adicionar outro.`}
						</Text>
					) : null}
				</PanelContent>
			</Panel>
			{inactive.length > 0 ? (
				<Panel>
					<PanelHeader>
						<PanelTitle>Desativados</PanelTitle>
						<PanelMeta>
							Medições antigas continuam mostrando estes campos
						</PanelMeta>
					</PanelHeader>
					<PanelContent className="flex flex-col gap-2">
						{inactive.map((field) => (
							<div
								className="flex items-center justify-between gap-3"
								key={field.id}
							>
								<Text tone="subtle">{field.label}</Text>
								<Button
									aria-label={`Reativar ${field.label}`}
									disabled={full}
									onClick={() => reactivate(field)}
									size="sm"
									type="button"
									variant="outline"
								>
									Reativar
								</Button>
							</div>
						))}
					</PanelContent>
				</Panel>
			) : null}
			{failure ? (
				<Alert
					ref={failureRef}
					role="alert"
					tabIndex={-1}
					tone={failure.kind === "stale" ? "warning" : "danger"}
				>
					<AlertTitle>Não foi possível salvar o modelo</AlertTitle>
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
			<Button
				className="md:w-auto md:self-start"
				disabled={!changed || submitting}
				size="touch"
				type="submit"
			>
				{submitText}
			</Button>
		</form>
	);
}

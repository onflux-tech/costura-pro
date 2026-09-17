import {
	materialCategorySuggestions,
	materialLimits,
} from "@costura-pro/domain/material";
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
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { SuggestionField } from "@costura-pro/ui/components/suggestion-field";
import { Textarea } from "@costura-pro/ui/components/textarea";
import { useEffect, useRef, useState } from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import {
	type MaterialField,
	type MaterialFields,
	type MaterialFormValues,
	materialFields,
	materialFormErrors,
} from "@/lib/materials";

const fieldOrder: readonly MaterialField[] = ["name", "category", "notes"];

export function MaterialForm({
	categories,
	failure,
	initialValues,
	onReloadCurrent,
	onSubmit,
	submitLabel,
}: {
	categories: readonly string[];
	failure: ClientCommandFailure | null;
	initialValues: MaterialFormValues;
	onReloadCurrent?: () => void;
	onSubmit: (fields: MaterialFields) => Promise<void>;
	submitLabel: string;
}) {
	const [name, setName] = useState(initialValues.name);
	const [category, setCategory] = useState(initialValues.category);
	const [notes, setNotes] = useState(initialValues.notes);
	const [errors, setErrors] = useState<Partial<Record<MaterialField, string>>>(
		{}
	);
	const [submitting, setSubmitting] = useState(false);
	const alertRef = useRef<HTMLDivElement>(null);
	const targets = useRef(new Map<MaterialField, HTMLElement>());
	const register = (field: MaterialField) => (element: HTMLElement | null) => {
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

	const suggestions = [
		...new Set([...categories, ...materialCategorySuggestions]),
	];

	const submit = async () => {
		const values: MaterialFormValues = { category, name, notes };
		const found = materialFormErrors(values);
		setErrors(found);
		const first = fieldOrder.find((field) => found[field]);
		if (first) {
			targets.current.get(first)?.focus();
			return;
		}
		setSubmitting(true);
		try {
			await onSubmit(materialFields(values));
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
			<Panel>
				<PanelContent className="flex flex-col gap-4">
					<Field invalid={Boolean(errors.name)}>
						<FieldLabel requirement="required">Nome</FieldLabel>
						<Input
							aria-invalid={errors.name ? true : undefined}
							maxLength={materialLimits.name.max}
							onChange={(event) => setName(event.target.value)}
							ref={register("name")}
							value={name}
						/>
						{errors.name ? <FieldError match>{errors.name}</FieldError> : null}
					</Field>
					<Field invalid={Boolean(errors.category)}>
						<FieldLabel requirement="optional">Categoria</FieldLabel>
						<SuggestionField
							items={suggestions}
							maxLength={materialLimits.category}
							onValueChange={setCategory}
							placeholder="Tecido"
							value={category}
						/>
						<FieldHint>
							Escolha uma sugestão ou escreva uma categoria nova.
						</FieldHint>
						{errors.category ? (
							<FieldError match>{errors.category}</FieldError>
						) : null}
					</Field>
					<Field invalid={Boolean(errors.notes)}>
						<FieldLabel requirement="optional">Notas</FieldLabel>
						<Textarea
							aria-invalid={errors.notes ? true : undefined}
							maxLength={materialLimits.notes}
							onChange={(event) => setNotes(event.target.value)}
							ref={register("notes")}
							value={notes}
						/>
						<FieldHint>Fornecedor de preferência, cuidados, largura.</FieldHint>
						{errors.notes ? (
							<FieldError match>{errors.notes}</FieldError>
						) : null}
					</Field>
				</PanelContent>
			</Panel>
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
				disabled={submitting}
				size="touch"
				type="submit"
			>
				{label}
			</Button>
		</form>
	);
}

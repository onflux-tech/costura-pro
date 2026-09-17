import { type ClientKind, clientFieldLength } from "@costura-pro/domain/client";
import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import { Checkbox } from "@costura-pro/ui/components/checkbox";
import {
	ChoiceChip,
	ChoiceChips,
} from "@costura-pro/ui/components/choice-chips";
import { Fieldset, FieldsetLegend } from "@costura-pro/ui/components/fieldset";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { useForm } from "@tanstack/react-form";
import { useEffect, useRef } from "react";
import z from "zod";

import type { ClientCommandFailure } from "@/lib/client-command-error";

import { type ClientFormValues, clientFormSchema } from "./client-form-values";
import { FormTextField } from "./form-text-field";

export type ClientFormSubmit = ClientFormValues & { createProfile: boolean };

const phoneLength = 20;

const textFields = [
	{
		autoComplete: "name",
		inputMode: "text",
		key: "name",
		label: "Nome",
		maxLength: clientFieldLength.name.max,
		requirement: "required",
	},
	{
		autoComplete: "tel",
		inputMode: "tel",
		key: "phone",
		label: "Telefone",
		maxLength: phoneLength,
		requirement: "optional",
	},
	{
		autoComplete: "off",
		inputMode: "tel",
		key: "secondaryPhone",
		label: "Outro telefone",
		maxLength: phoneLength,
		requirement: "optional",
	},
	{
		autoComplete: "email",
		inputMode: "email",
		key: "email",
		label: "E-mail",
		maxLength: clientFieldLength.email,
		requirement: "optional",
	},
	{
		autoComplete: "street-address",
		inputMode: "text",
		key: "address",
		label: "Endereço",
		maxLength: clientFieldLength.address,
		requirement: "optional",
	},
] as const;

const submitSchema = clientFormSchema.extend({ createProfile: z.boolean() });

export function ClientForm({
	failure,
	initialValues,
	onReloadCurrent,
	onSubmit,
	submitLabel,
	withProfileOption,
}: {
	failure: ClientCommandFailure | null;
	initialValues: ClientFormValues;
	onReloadCurrent?: () => void;
	onSubmit: (values: ClientFormSubmit) => Promise<void>;
	submitLabel: string;
	withProfileOption: boolean;
}) {
	const failureRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (failure) {
			failureRef.current?.focus();
		}
	}, [failure]);
	const form = useForm({
		defaultValues: {
			...initialValues,
			createProfile: withProfileOption && initialValues.kind === "person",
		},
		onSubmit: ({ value }) => onSubmit(value),
		validators: { onSubmit: submitSchema },
	});

	return (
		<form
			className="flex flex-col gap-4 md:max-w-2xl"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<Panel>
				<PanelContent className="flex flex-col gap-4">
					<form.Field name="kind">
						{(field) => (
							<Fieldset>
								<FieldsetLegend>Tipo</FieldsetLegend>
								<ChoiceChips
									onValueChange={(value) => {
										field.handleChange(value as ClientKind);
										if (withProfileOption) {
											form.setFieldValue("createProfile", value === "person");
										}
									}}
									value={field.state.value}
								>
									<ChoiceChip value="person">Pessoa</ChoiceChip>
									<ChoiceChip value="organization">Organização</ChoiceChip>
								</ChoiceChips>
							</Fieldset>
						)}
					</form.Field>
					{textFields.map((item) => (
						<form.Field key={item.key} name={item.key}>
							{(field) => (
								<FormTextField
									autoComplete={item.autoComplete}
									errors={field.state.meta.errors.map(
										(error) => error?.message
									)}
									inputMode={item.inputMode}
									label={item.label}
									maxLength={item.maxLength}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={field.handleChange}
									requirement={item.requirement}
									value={field.state.value}
								/>
							)}
						</form.Field>
					))}
					<form.Field name="notes">
						{(field) => (
							<FormTextField
								errors={field.state.meta.errors.map((error) => error?.message)}
								hint="Preferências e cuidados. Só você vê."
								label="Notas"
								maxLength={clientFieldLength.notes}
								multiline
								name={field.name}
								onBlur={field.handleBlur}
								onChange={field.handleChange}
								requirement="optional"
								value={field.state.value}
							/>
						)}
					</form.Field>
					{withProfileOption ? (
						<form.Field name="createProfile">
							{(field) => (
								<Checkbox
									checked={field.state.value}
									onCheckedChange={(checked) => field.handleChange(checked)}
								>
									Criar perfil com o mesmo nome
								</Checkbox>
							)}
						</form.Field>
					) : null}
				</PanelContent>
			</Panel>
			{failure ? (
				<Alert
					ref={failureRef}
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
			<form.Subscribe selector={(state) => state.isSubmitting}>
				{(isSubmitting) => {
					const label = isSubmitting ? "Salvando..." : submitLabel;
					return (
						<Button
							className="md:w-auto md:self-start"
							disabled={isSubmitting}
							size="touch"
							type="submit"
						>
							{label}
						</Button>
					);
				}}
			</form.Subscribe>
		</form>
	);
}

import { atelierNameLength } from "@costura-pro/domain/installation-state";
import {
	Alert,
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
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import z from "zod";

import { commandErrorMessage } from "@/lib/command-error";
import {
	type InstallationDetails,
	refreshInstallation,
} from "@/lib/installation-queries";
import { useOpId } from "@/lib/use-op-id";
import { orpc } from "@/utils/orpc";

import { StepHeading } from "./step-heading";

export function AtelierStep({
	details,
	onPreview,
}: {
	details: InstallationDetails;
	onPreview: (name: string | null) => void;
}) {
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [failure, setFailure] = useState<string | null>(null);
	const setAtelierName = useMutation(
		orpc.installation.setAtelierName.mutationOptions()
	);

	const form = useForm({
		defaultValues: { atelierName: details.atelierName ?? "" },
		onSubmit: async ({ value }) => {
			const atelierName = value.atelierName.trim();
			setFailure(null);
			try {
				await setAtelierName.mutateAsync({
					atelierName,
					baseVersion: details.version,
					opId: opIdFor(`${details.version}:${atelierName}`),
				});
				reset();
				onPreview(null);
			} catch (error) {
				setFailure(commandErrorMessage(error));
			}
			await refreshInstallation(queryClient);
		},
		validators: {
			onSubmit: z.object({
				atelierName: z
					.string()
					.trim()
					.min(atelierNameLength.min, "Informe o nome do ateliê")
					.max(
						atelierNameLength.max,
						`Use até ${atelierNameLength.max} caracteres`
					),
			}),
		},
	});

	return (
		<form
			className="flex flex-col gap-5"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<StepHeading description="Aparece no topo do Costura Pro e, depois, nos documentos.">
				Qual é o nome do ateliê?
			</StepHeading>
			<form.Field name="atelierName">
				{(field) => (
					<Field invalid={field.state.meta.errors.length > 0} name={field.name}>
						<FieldLabel>Nome do ateliê</FieldLabel>
						<Input
							autoComplete="organization"
							maxLength={atelierNameLength.max}
							onBlur={field.handleBlur}
							onChange={(event) => {
								field.handleChange(event.target.value);
								onPreview(event.target.value.trim() || null);
							}}
							value={field.state.value}
						/>
						<FieldHint>Dá para trocar depois em Configurações.</FieldHint>
						{field.state.meta.errors.map((error) => (
							<FieldError key={error?.message} match>
								{error?.message}
							</FieldError>
						))}
					</Field>
				)}
			</form.Field>
			{failure ? (
				<Alert tone="danger">
					<AlertTitle>Não foi possível salvar o nome</AlertTitle>
					<AlertDescription>{failure}</AlertDescription>
				</Alert>
			) : null}
			<form.Subscribe selector={(state) => state.isSubmitting}>
				{(isSubmitting) => (
					<Button
						className="md:w-auto md:self-end"
						disabled={isSubmitting}
						size="touch"
						type="submit"
					>
						{isSubmitting ? "Salvando..." : "Continuar"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}

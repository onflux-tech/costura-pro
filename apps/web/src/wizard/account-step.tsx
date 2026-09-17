import {
	isValidUsername,
	normalizeUsername,
	passwordLength,
	usernameLength,
} from "@costura-pro/domain/credentials";
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
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { wizardRoute } from "@/lib/installation-gates";
import { failedCommand, refreshInstallation } from "@/lib/installation-queries";
import { sessionQuery } from "@/lib/session";
import { useOpId } from "@/lib/use-op-id";
import { orpc } from "@/utils/orpc";

import { StepHeading } from "./step-heading";

const accountSchema = z
	.object({
		confirmation: z.string(),
		password: z
			.string()
			.min(
				passwordLength.min,
				`A senha tem pelo menos ${passwordLength.min} caracteres`
			)
			.max(
				passwordLength.max,
				`A senha tem até ${passwordLength.max} caracteres`
			),
		username: z
			.string()
			.refine(
				(value) => isValidUsername(normalizeUsername(value)),
				`Use de ${usernameLength.min} a ${usernameLength.max} letras, números, ponto ou sublinhado`
			),
	})
	.refine((value) => value.confirmation === value.password, {
		message: "As senhas não conferem",
		path: ["confirmation"],
	});

export function AccountStep() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { opIdFor, reset } = useOpId();
	const [failure, setFailure] = useState<string | null>(null);
	const createOwner = useMutation(
		orpc.installation.createOwner.mutationOptions()
	);

	const form = useForm({
		defaultValues: { confirmation: "", password: "", username: "" },
		onSubmit: async ({ value }) => {
			const username = normalizeUsername(value.username);
			setFailure(null);
			try {
				await createOwner.mutateAsync({
					opId: opIdFor(username),
					password: value.password,
					username,
				});
			} catch (error) {
				setFailure(await failedCommand(queryClient, error));
				return;
			}
			reset();
			const signedIn = await authClient.signIn
				.username({ password: value.password, username })
				.catch(() => null);
			await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
			await refreshInstallation(queryClient);
			if (!signedIn || signedIn.error) {
				await navigate({ search: { redirect: wizardRoute }, to: "/login" });
			}
		},
		validators: { onSubmit: accountSchema },
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
			<StepHeading description="O Costura Pro tem uma conta só. Ela nasce aqui, no PC, e entra também pelo celular.">
				Crie a conta do dono
			</StepHeading>
			<form.Field name="username">
				{(field) => (
					<Field invalid={field.state.meta.errors.length > 0} name={field.name}>
						<FieldLabel>Usuário</FieldLabel>
						<Input
							autoCapitalize="none"
							autoComplete="username"
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							spellCheck={false}
							value={field.state.value}
						/>
						<FieldHint>
							Letras, números, ponto ou sublinhado; fica em minúsculas.
						</FieldHint>
						{field.state.meta.errors.map((error) => (
							<FieldError key={error?.message} match>
								{error?.message}
							</FieldError>
						))}
					</Field>
				)}
			</form.Field>
			<form.Field name="password">
				{(field) => (
					<Field invalid={field.state.meta.errors.length > 0} name={field.name}>
						<FieldLabel>Senha</FieldLabel>
						<Input
							autoComplete="new-password"
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							type="password"
							value={field.state.value}
						/>
						<FieldHint>Pelo menos {passwordLength.min} caracteres.</FieldHint>
						{field.state.meta.errors.map((error) => (
							<FieldError key={error?.message} match>
								{error?.message}
							</FieldError>
						))}
					</Field>
				)}
			</form.Field>
			<form.Field name="confirmation">
				{(field) => (
					<Field invalid={field.state.meta.errors.length > 0} name={field.name}>
						<FieldLabel>Confirme a senha</FieldLabel>
						<Input
							autoComplete="new-password"
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							type="password"
							value={field.state.value}
						/>
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
					<AlertTitle>Não foi possível criar a conta</AlertTitle>
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
						{isSubmitting ? "Criando conta..." : "Criar conta"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}

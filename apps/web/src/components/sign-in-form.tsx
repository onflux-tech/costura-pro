import {
	normalizeUsername,
	passwordLength,
	usernameLength,
} from "@costura-pro/domain/credentials";
import { Button } from "@costura-pro/ui/components/button";
import {
	Field,
	FieldError,
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Eyebrow, Heading, Text } from "@costura-pro/ui/components/typography";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { sessionQuery } from "@/lib/session";
import { signInErrorMessage } from "@/lib/sign-in-error";

export default function SignInForm({ redirectTo }: { redirectTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const form = useForm({
		defaultValues: {
			password: "",
			username: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn
				.username(
					{
						password: value.password,
						username: normalizeUsername(value.username),
					},
					{
						onError: (error) => {
							toast.error(signInErrorMessage(error.error.status));
						},
						onSuccess: async () => {
							await queryClient.invalidateQueries({
								queryKey: sessionQuery.queryKey,
							});
							await navigate({ href: redirectTo });
						},
					}
				)
				.catch(() => {
					toast.error(signInErrorMessage(0));
				});
		},
		validators: {
			onSubmit: z.object({
				password: z
					.string()
					.min(
						passwordLength.min,
						`A senha tem pelo menos ${passwordLength.min} caracteres`
					),
				username: z
					.string()
					.min(
						usernameLength.min,
						`O usuário tem pelo menos ${usernameLength.min} caracteres`
					),
			}),
		},
	});

	return (
		<main className="flex items-start justify-center px-4 py-10 md:py-16">
			<Panel className="w-full max-w-sm">
				<PanelContent className="flex flex-col gap-6 p-6">
					<div className="flex flex-col gap-1">
						<Eyebrow>Costura Pro</Eyebrow>
						<Heading>Entrar</Heading>
						<Text tone="muted">Acesso do dono do ateliê.</Text>
					</div>
					<form
						className="flex flex-col gap-4"
						noValidate
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						<form.Field name="username">
							{(field) => (
								<Field
									invalid={field.state.meta.errors.length > 0}
									name={field.name}
								>
									<FieldLabel>Usuário</FieldLabel>
									<Input
										autoCapitalize="none"
										autoComplete="username"
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										type="text"
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
						<form.Field name="password">
							{(field) => (
								<Field
									invalid={field.state.meta.errors.length > 0}
									name={field.name}
								>
									<FieldLabel>Senha</FieldLabel>
									<Input
										autoComplete="current-password"
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
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
						<form.Subscribe
							selector={(state) => ({
								canSubmit: state.canSubmit,
								isSubmitting: state.isSubmitting,
							})}
						>
							{({ canSubmit, isSubmitting }) => (
								<Button
									disabled={!canSubmit || isSubmitting}
									size="touch"
									type="submit"
								>
									{isSubmitting ? "Entrando..." : "Entrar"}
								</Button>
							)}
						</form.Subscribe>
					</form>
				</PanelContent>
			</Panel>
		</main>
	);
}

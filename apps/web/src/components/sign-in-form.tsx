import {
	passwordLength,
	usernameLength,
} from "@costura-pro/domain/credentials";
import { Button } from "@costura-pro/ui/components/button";
import { Input } from "@costura-pro/ui/components/input";
import { Label } from "@costura-pro/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

const signInErrorMessages: Partial<Record<number, string>> = {
	401: "Usuário ou senha inválidos",
	422: "Usuário ou senha inválidos",
	429: "Muitas tentativas. Tente de novo mais tarde.",
};

export default function SignInForm() {
	const navigate = useNavigate({
		from: "/",
	});
	const { isPending } = authClient.useSession();

	const form = useForm({
		defaultValues: {
			password: "",
			username: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.username(
				{
					password: value.password,
					username: value.username,
				},
				{
					onError: (error) => {
						toast.error(
							signInErrorMessages[error.error.status] ??
								(error.error.message || error.error.statusText)
						);
					},
					onSuccess: () => {
						navigate({
							to: "/dashboard",
						});
						toast.success("Login feito");
					},
				}
			);
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

	if (isPending) {
		return <Loader />;
	}

	return (
		<div className="mx-auto mt-10 w-full max-w-md p-6">
			<h1 className="mb-6 text-center font-bold text-3xl">Entrar</h1>

			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div>
					<form.Field name="username">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Usuário</Label>
								<Input
									autoCapitalize="none"
									autoComplete="username"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									type="text"
									value={field.state.value}
								/>
								{field.state.meta.errors.map((error) => (
									<p className="text-red-500" key={error?.message}>
										{error?.message}
									</p>
								))}
							</div>
						)}
					</form.Field>
				</div>

				<div>
					<form.Field name="password">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Senha</Label>
								<Input
									autoComplete="current-password"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									type="password"
									value={field.state.value}
								/>
								{field.state.meta.errors.map((error) => (
									<p className="text-red-500" key={error?.message}>
										{error?.message}
									</p>
								))}
							</div>
						)}
					</form.Field>
				</div>

				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{({ canSubmit, isSubmitting }) => (
						<Button
							className="w-full"
							disabled={!canSubmit || isSubmitting}
							type="submit"
						>
							{isSubmitting ? "Entrando..." : "Entrar"}
						</Button>
					)}
				</form.Subscribe>
			</form>
		</div>
	);
}

import { clientFieldLength } from "@costura-pro/domain/client";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@costura-pro/ui/components/dialog";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useOpId } from "@/lib/use-op-id";
import { client as api } from "@/utils/orpc";

import {
	changedProfileFields,
	profileFormSchema,
	toProfilePayload,
} from "./client-form-values";
import { failedClientCommand, refreshClients } from "./client-queries";
import { FormTextField } from "./form-text-field";

export type EditableProfile = {
	id: string;
	name: string;
	notes: string | null;
	version: number;
};

export function ProfileDialog({
	clientId,
	onOpenChange,
	open,
	profile,
}: {
	clientId: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	profile: EditableProfile | null;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<ProfileForm
					clientId={clientId}
					close={() => onOpenChange(false)}
					key={profile?.id ?? "new"}
					profile={profile}
				/>
			</DialogContent>
		</Dialog>
	);
}

function ProfileForm({
	clientId,
	close,
	profile,
}: {
	clientId: string;
	close: () => void;
	profile: EditableProfile | null;
}) {
	const queryClient = useQueryClient();
	const { opIdFor } = useOpId();
	const [profileId] = useState(() => profile?.id ?? crypto.randomUUID());
	const [failure, setFailure] = useState<string | null>(null);
	const initial = { name: profile?.name ?? "", notes: profile?.notes ?? "" };

	const save = async (value: typeof initial) => {
		if (!profile) {
			const payload = toProfilePayload(value);
			await api.profiles.create({
				...payload,
				clientId,
				opId: opIdFor(JSON.stringify(payload)),
				profileId,
			});
			return;
		}
		const patch = changedProfileFields(initial, value);
		if (Object.keys(patch).length === 0) {
			return;
		}
		await api.profiles.update({
			baseVersion: profile.version,
			opId: opIdFor(`${profile.version}:${JSON.stringify(patch)}`),
			patch,
			profileId,
		});
	};

	const form = useForm({
		defaultValues: initial,
		onSubmit: async ({ value }) => {
			setFailure(null);
			try {
				await save(value);
			} catch (error) {
				const failed = await failedClientCommand(queryClient, error, "perfil");
				if (failed.kind === "stale") {
					toast.error(`${failed.message} Confira e edite de novo.`);
					close();
					return;
				}
				setFailure(failed.message);
				return;
			}
			await refreshClients(queryClient);
			close();
		},
		validators: { onSubmit: profileFormSchema },
	});

	return (
		<form
			className="flex flex-col gap-4"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<DialogTitle>
				{profile ? "Editar perfil" : "Adicionar perfil"}
			</DialogTitle>
			<DialogDescription>
				Nome e observações de quem veste a peça.
			</DialogDescription>
			<form.Field name="name">
				{(field) => (
					<FormTextField
						errors={field.state.meta.errors.map((error) => error?.message)}
						label="Nome"
						maxLength={clientFieldLength.name.max}
						name={field.name}
						onBlur={field.handleBlur}
						onChange={field.handleChange}
						requirement="required"
						value={field.state.value}
					/>
				)}
			</form.Field>
			<form.Field name="notes">
				{(field) => (
					<FormTextField
						errors={field.state.meta.errors.map((error) => error?.message)}
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
			{failure ? (
				<Alert role="alert" tone="danger">
					<AlertTitle>Não foi possível salvar o perfil</AlertTitle>
					<AlertDescription>{failure}</AlertDescription>
				</Alert>
			) : null}
			<DialogActions>
				<DialogClose render={<Button variant="outline" />}>
					Cancelar
				</DialogClose>
				<form.Subscribe selector={(state) => state.isSubmitting}>
					{(isSubmitting) => (
						<Button disabled={isSubmitting} type="submit">
							{isSubmitting ? "Salvando..." : "Salvar perfil"}
						</Button>
					)}
				</form.Subscribe>
			</DialogActions>
		</form>
	);
}

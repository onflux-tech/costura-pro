import { Heading } from "@costura-pro/ui/components/typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { orpc } from "@/utils/orpc";

import { ClientForm, type ClientFormSubmit } from "./client-form";
import { emptyClientForm, toClientPayload } from "./client-form-values";
import { failedClientCommand, refreshClients } from "./client-queries";

export function NewClientPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const clientOp = useOpId();
	const profileOp = useOpId();
	const [clientId] = useState(() => crypto.randomUUID());
	const [profileId] = useState(() => crypto.randomUUID());
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const createClient = useMutation(orpc.clients.create.mutationOptions());
	const createProfile = useMutation(orpc.profiles.create.mutationOptions());
	usePageHeader({
		backHref: "/atendimento/clientes",
		eyebrow: "Atendimento",
		heading: "Novo cliente",
	});

	const submit = async ({
		createProfile: withProfile,
		...values
	}: ClientFormSubmit) => {
		setFailure(null);
		const payload = toClientPayload(values);
		try {
			await createClient.mutateAsync({
				...payload,
				clientId,
				opId: clientOp.opIdFor(JSON.stringify(payload)),
			});
		} catch (error) {
			const failed = await failedClientCommand(queryClient, error, "cliente");
			if (failed.kind !== "exists") {
				setFailure(failed);
				return;
			}
			toast.info(failed.message);
		}
		if (withProfile) {
			try {
				await createProfile.mutateAsync({
					clientId,
					name: payload.name,
					opId: profileOp.opIdFor(payload.name),
					profileId,
				});
			} catch {
				toast.error(
					"Cliente salvo, mas o perfil não foi criado. Adicione de novo."
				);
			}
		}
		await refreshClients(queryClient);
		await navigate({
			params: { clienteId: clientId },
			to: "/atendimento/clientes/$clienteId",
		});
	};

	return (
		<>
			<Heading className="max-md:sr-only">Novo cliente</Heading>
			<ClientForm
				failure={failure}
				initialValues={emptyClientForm}
				onSubmit={submit}
				submitLabel="Salvar cliente"
				withProfileOption
			/>
		</>
	);
}

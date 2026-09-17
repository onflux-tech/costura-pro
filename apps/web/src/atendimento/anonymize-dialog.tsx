import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import {
	AlertDialog,
	AlertDialogActions,
	AlertDialogClose,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogTitle,
} from "@costura-pro/ui/components/alert-dialog";
import { Button } from "@costura-pro/ui/components/button";
import { Checkbox } from "@costura-pro/ui/components/checkbox";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useOpId } from "@/lib/use-op-id";
import { client as api } from "@/utils/orpc";

import { failedClientCommand, refreshClients } from "./client-queries";

export function AnonymizeDialog({
	client,
	onOpenChange,
	open,
}: {
	client: { id: string; name: string; version: number };
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [understood, setUnderstood] = useState(false);
	const [pending, setPending] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);

	const confirm = async () => {
		setPending(true);
		setFailure(null);
		try {
			await api.clients.anonymize({
				baseVersion: client.version,
				clientId: client.id,
				opId: opIdFor(String(client.version)),
			});
			reset();
			await refreshClients(queryClient);
			onOpenChange(false);
		} catch (error) {
			setFailure(
				(await failedClientCommand(queryClient, error, "cliente")).message
			);
		} finally {
			setPending(false);
		}
	};

	return (
		<AlertDialog
			onOpenChange={(next) => {
				if (!next) {
					setUnderstood(false);
					setFailure(null);
				}
				onOpenChange(next);
			}}
			open={open}
		>
			<AlertDialogContent>
				<AlertDialogTitle>Anonimizar {client.name}?</AlertDialogTitle>
				<AlertDialogDescription>
					Nome, telefones, e-mail, endereço, notas, nomes dos perfis e os
					valores e notas das medições serão apagados de todos os registros. Não
					dá para desfazer.
				</AlertDialogDescription>
				<Checkbox
					checked={understood}
					onCheckedChange={(checked) => setUnderstood(checked)}
				>
					Entendo que não dá para desfazer
				</Checkbox>
				{failure ? (
					<Alert role="alert" tone="danger">
						<AlertTitle>Não foi possível anonimizar</AlertTitle>
						<AlertDescription>{failure}</AlertDescription>
					</Alert>
				) : null}
				<AlertDialogActions>
					<AlertDialogClose render={<Button variant="outline" />}>
						Cancelar
					</AlertDialogClose>
					<Button
						disabled={!understood || pending}
						onClick={confirm}
						variant="destructive"
					>
						{pending ? "Anonimizando..." : "Anonimizar"}
					</Button>
				</AlertDialogActions>
			</AlertDialogContent>
		</AlertDialog>
	);
}

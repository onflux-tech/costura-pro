import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import { Mono, Text } from "@costura-pro/ui/components/typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { commandErrorMessage } from "@/lib/command-error";
import { formatDateTime } from "@/lib/format-date-time";
import {
	type InstallationDetails,
	refreshInstallation,
} from "@/lib/installation-queries";
import { useOpId } from "@/lib/use-op-id";
import { orpc } from "@/utils/orpc";

import { FolderBrowser } from "./folder-browser";
import { StepHeading } from "./step-heading";

export function BackupStep({
	details,
	tested,
}: {
	details: InstallationDetails;
	tested: boolean;
}) {
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [browsing, setBrowsing] = useState(!tested);
	const [failure, setFailure] = useState<string | null>(null);
	const finish = useMutation(orpc.installation.finish.mutationOptions());

	const complete = async () => {
		setFailure(null);
		try {
			await finish.mutateAsync({ opId: opIdFor("finish") });
			reset();
		} catch (error) {
			setFailure(commandErrorMessage(error));
		}
		await refreshInstallation(queryClient);
	};

	if (browsing || !details.backupFolder) {
		return (
			<>
				<StepHeading description="O servidor lista as pastas que o serviço do Costura Pro enxerga e testa gravando, relendo e apagando um arquivo. Unidade mapeada não aparece; pasta de rede entra pelo caminho, como \\servidor\backups.">
					Escolha a pasta de backup
				</StepHeading>
				<FolderBrowser
					initialPath={details.backupFolder}
					onTested={() => setBrowsing(false)}
				/>
			</>
		);
	}

	return (
		<>
			<StepHeading description="Concluir libera Hoje. O checklist de continuidade fica lá, com o que dá para configurar depois.">
				Pasta de backup testada
			</StepHeading>
			<Alert tone="success">
				<AlertTitle>Gravação e releitura conferidas</AlertTitle>
				<AlertDescription>
					O servidor gravou, releu e apagou um arquivo de teste em{" "}
					<Mono className="break-all">{details.backupFolder}</Mono>
					{details.backupTestedAt
						? ` em ${formatDateTime(new Date(details.backupTestedAt))}`
						: ""}
					.
				</AlertDescription>
			</Alert>
			{failure ? (
				<Alert tone="danger">
					<AlertTitle>Não foi possível concluir</AlertTitle>
					<AlertDescription>{failure}</AlertDescription>
				</Alert>
			) : null}
			<Text size="xs" tone="muted">
				A pasta guarda dados sensíveis e o pacote de backup não é cifrado.
			</Text>
			<div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
				<Button onClick={() => setBrowsing(true)} variant="outline">
					Escolher outra pasta
				</Button>
				<Button disabled={finish.isPending} onClick={complete}>
					{finish.isPending ? "Concluindo..." : "Concluir e abrir Hoje"}
				</Button>
			</div>
		</>
	);
}

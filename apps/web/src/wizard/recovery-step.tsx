import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import { Checkbox } from "@costura-pro/ui/components/checkbox";
import { CodeTag } from "@costura-pro/ui/components/code-tag";
import { Text } from "@costura-pro/ui/components/typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CopyIcon, DownloadIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { failedCommand, refreshInstallation } from "@/lib/installation-queries";
import {
	recoveryCodesFile,
	recoveryCodesFileName,
} from "@/lib/recovery-codes-file";
import { useOpId } from "@/lib/use-op-id";
import { orpc } from "@/utils/orpc";

import { saveTextFile } from "./save-text-file";
import { StepHeading } from "./step-heading";

type GeneratedCodes = { generatedAt: Date; values: string[] };

export function RecoveryStep({ atelierName }: { atelierName: string | null }) {
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [codes, setCodes] = useState<GeneratedCodes | null>(null);
	const [saved, setSaved] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const generate = useMutation(
		orpc.installation.generateRecoveryCodes.mutationOptions()
	);
	const confirm = useMutation(
		orpc.installation.confirmRecoveryCodes.mutationOptions()
	);

	const generateCodes = async () => {
		setFailure(null);
		setSaved(false);
		try {
			const result = await generate.mutateAsync({
				opId: crypto.randomUUID(),
			});
			setCodes({ generatedAt: new Date(), values: result.codes });
		} catch (error) {
			setFailure(await failedCommand(queryClient, error));
		}
	};

	const confirmCodes = async () => {
		setFailure(null);
		try {
			await confirm.mutateAsync({ opId: opIdFor("confirm") });
			reset();
			await refreshInstallation(queryClient);
		} catch (error) {
			setFailure(await failedCommand(queryClient, error));
		}
	};

	const copyCodes = async (values: string[]) => {
		try {
			await navigator.clipboard.writeText(values.join("\n"));
			toast.success("Códigos copiados");
		} catch {
			toast.error("Não foi possível copiar. Use Baixar arquivo.");
		}
	};

	return (
		<>
			<StepHeading description="Se a senha se perder, um destes códigos redefine a conta no PC. Cada código vale uma vez, e eles só aparecem agora.">
				Guarde os códigos de recuperação
			</StepHeading>
			{failure ? (
				<Alert tone="danger">
					<AlertTitle>Não foi possível continuar</AlertTitle>
					<AlertDescription>{failure}</AlertDescription>
				</Alert>
			) : null}
			{codes ? (
				<>
					<div className="grid gap-2 md:grid-cols-2">
						{codes.values.map((code, index) => (
							<div className="flex items-center gap-2.5" key={code}>
								<Text inline numeric size="xs" tone="muted">
									{String(index + 1).padStart(2, "0")}
								</Text>
								<CodeTag>{code}</CodeTag>
							</div>
						))}
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							onClick={() =>
								saveTextFile(
									recoveryCodesFileName,
									recoveryCodesFile({
										atelierName,
										codes: codes.values,
										generatedAt: codes.generatedAt,
									})
								)
							}
							variant="outline"
						>
							<DownloadIcon aria-hidden="true" />
							Baixar arquivo
						</Button>
						<Button onClick={() => copyCodes(codes.values)} variant="outline">
							<CopyIcon aria-hidden="true" />
							Copiar
						</Button>
					</div>
					<Checkbox checked={saved} onCheckedChange={setSaved}>
						Guardei os códigos em lugar seguro
					</Checkbox>
					<Button
						className="md:w-auto md:self-end"
						disabled={!saved || confirm.isPending}
						onClick={confirmCodes}
						size="touch"
					>
						{confirm.isPending ? "Confirmando..." : "Continuar"}
					</Button>
				</>
			) : (
				<>
					<Text size="xs" tone="muted">
						Gerar de novo invalida códigos gerados antes.
					</Text>
					<Button
						className="md:w-auto md:self-end"
						disabled={generate.isPending}
						onClick={generateCodes}
						size="touch"
					>
						{generate.isPending ? "Gerando..." : "Gerar códigos"}
					</Button>
				</>
			)}
		</>
	);
}

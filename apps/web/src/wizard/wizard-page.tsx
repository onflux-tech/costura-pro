import { Badge } from "@costura-pro/ui/components/badge";
import { BrandHeader } from "@costura-pro/ui/components/brand-header";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
} from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { useState } from "react";

import {
	canReadDetails,
	type WizardStep,
	wizardGate,
	wizardRoute,
} from "@/lib/installation-gates";
import {
	detailsQueryOptions,
	type InstallationDetails,
} from "@/lib/installation-queries";
import { useGate } from "@/lib/use-gate";
import { completedSteps } from "@/lib/wizard-progress";

import { AccountStep } from "./account-step";
import { AtelierStep } from "./atelier-step";
import { BackupStep } from "./backup-step";
import { RecoveryStep } from "./recovery-step";
import { WizardChecklist, WizardStageTrack } from "./wizard-progress";

function StepContent({
	details,
	onPreview,
	step,
}: {
	details: InstallationDetails | undefined;
	onPreview: (name: string | null) => void;
	step: WizardStep;
}) {
	if (step === "account") {
		return <AccountStep />;
	}
	if (!details) {
		return <Skeleton className="h-48" />;
	}
	if (step === "atelier") {
		return <AtelierStep details={details} onPreview={onPreview} />;
	}
	if (step === "recovery") {
		return <RecoveryStep atelierName={details.atelierName} />;
	}
	return <BackupStep details={details} tested={step === "done"} />;
}

export function WizardPage() {
	const gate = useGate();
	const details = useQuery(detailsQueryOptions(canReadDetails(gate)));
	const [preview, setPreview] = useState<string | null>(null);
	const decision = wizardGate(gate);

	if ("to" in decision) {
		return decision.to === "/login" ? (
			<Navigate search={{ redirect: wizardRoute }} to="/login" />
		) : (
			<Navigate to="/" />
		);
	}

	return (
		<div className="flex min-h-svh flex-col bg-background">
			<BrandHeader name={preview ?? details.data?.atelierName} />
			<main className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start md:px-6">
				{decision.screen === "remote" ? (
					<Panel className="md:col-span-2">
						<PanelContent className="flex flex-col gap-2 p-6">
							<Heading>Conclua a configuração no PC do ateliê</Heading>
							<Text tone="subtle">
								O wizard inicial roda só no acesso local do PC, pelo atalho do
								Costura Pro.
							</Text>
						</PanelContent>
					</Panel>
				) : (
					<>
						<WizardStageTrack current={completedSteps(decision.step)} />
						<Panel>
							<PanelHeader>
								<div className="flex flex-wrap items-center gap-2">
									<Badge tone="warning">ateliê novo</Badge>
									<PanelMeta>
										{completedSteps(decision.step)} de 5 passos concluídos
									</PanelMeta>
								</div>
							</PanelHeader>
							<PanelContent className="flex flex-col gap-5 md:p-6">
								<StepContent
									details={details.data}
									onPreview={setPreview}
									step={decision.step}
								/>
							</PanelContent>
						</Panel>
						<WizardChecklist current={completedSteps(decision.step)} />
					</>
				)}
			</main>
		</div>
	);
}

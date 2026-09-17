import { Checklist, ChecklistItem } from "@costura-pro/ui/components/checklist";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { StageTrack } from "@costura-pro/ui/components/stage-track";

import { stepState, wizardSteps } from "@/lib/wizard-progress";

export function WizardStageTrack({ current }: { current: number }) {
	return (
		<StageTrack
			className="md:hidden"
			current={current}
			label="Passos da configuração inicial"
			stages={wizardSteps}
		/>
	);
}

export function WizardChecklist({ current }: { current: number }) {
	return (
		<Panel className="hidden md:block">
			<PanelHeader>
				<PanelTitle>Configuração inicial</PanelTitle>
			</PanelHeader>
			<PanelContent>
				<Checklist>
					{wizardSteps.map((step, index) => (
						<ChecklistItem
							key={step.id}
							state={stepState(index, current)}
							step={index + 1}
						>
							{step.label}
						</ChecklistItem>
					))}
				</Checklist>
			</PanelContent>
		</Panel>
	);
}

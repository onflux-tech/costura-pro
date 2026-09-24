import { Checklist, ChecklistItem } from "@costura-pro/ui/components/checklist";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Text } from "@costura-pro/ui/components/typography";

import {
	closingSteps,
	type ServiceOrderDetailView,
} from "@/lib/service-orders";

export function ClosingPanel({ detail }: { detail: ServiceOrderDetailView }) {
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Encerramento</PanelTitle>
			</PanelHeader>
			<PanelContent className="flex flex-col gap-3">
				<Checklist>
					{closingSteps(detail).map((step, index) => (
						<ChecklistItem key={step.label} state={step.state} step={index + 1}>
							{step.label}
						</ChecklistItem>
					))}
				</Checklist>
				<Text size="xs" tone="subtle">
					A OS só encerra com os três resolvidos.
				</Text>
			</PanelContent>
		</Panel>
	);
}
